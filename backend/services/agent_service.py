"""
Session management service for the Flask backend.

This module is the "service layer" -- it sits between the HTTP route
handlers (in ``agent_routes.py``) and the lower-level components that
actually do the work (``FlaskBridge``, ``MCPServer``, ``think()``).

What this module does
---------------------
1. **Creates sessions**: sets up a FlaskBridge (virtual form), an
   MCPServer (tool server for the AI), and an NPC "taxpayer" function
   (so the agent can ask clarifying questions).
2. **Runs sessions**: launches the ``think()`` function in a background
   thread so the API can respond immediately while the agent works.
3. **Scores submissions**: after the agent finishes, compares the filled
   form against ``ground_truth.json`` to compute an accuracy score.
4. **Manages session lifecycle**: get, list, delete sessions from the
   in-memory store.

Architecture diagram (simplified)
----------------------------------
::

    Frontend  --->  agent_routes.py  --->  agent_service.py
                                              |
                          +-------------------+-------------------+
                          |                   |                   |
                    FlaskBridge          MCPServer           think()
                   (virtual form)      (tool server)       (LLM brain)

Thread safety
-------------
Sessions are stored in an in-memory dictionary (``_sessions``).
A threading lock (``_sessions_lock``) protects all reads and writes to
this dictionary, because the agent runs in a background thread while
the Flask request threads may access the same session concurrently.
"""

import json
import queue
import sys
import threading
import uuid
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

# Ensure the repository root is on Python's module search path so that
# imports like ``from mcp_server.server import MCPServer`` work correctly
# regardless of how the application is launched.
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.bridges.flask_bridge import FlaskBridge
from backend.config import (
    ANTHROPIC_API_KEY, LLM_MODEL, OPENAI_API_KEY, GEMINI_API_KEY, LLM_PROVIDER,
    OLLAMA_BASE_URL, PERSONAS_DIR, GUIDES_DIR, SCRIPTS_DIR, get_persona_names,
)
from backend.services.think_service import think
from mcp_server.server import MCPServer
from mcp_server.ask_user import make_llm_ask_user_with_notes


# ---------------------------------------------------------------------------
# Session dataclass
# ---------------------------------------------------------------------------

@dataclass
class Session:
    """
    Data container that holds everything related to a single agent run.

    Each time the user clicks "Start" in the frontend, a new Session is
    created.  It groups together:
      - Identifiers (session_id, persona name)
      - Status tracking (status, error message)
      - The virtual form (bridge) and tool server (server)
      - A queue for streaming events to the frontend (sse_queue)
      - The background thread handle
      - The final result and accuracy score

    Attributes
    ----------
    session_id : str
        A UUID that uniquely identifies this session.
    persona : str
        The folder name of the persona (e.g. "anna_meier").
    status : str
        Lifecycle state: "idle" (created but not started), "running"
        (agent is working), "done" (finished successfully), or "error".
    bridge : FlaskBridge or None
        The server-side virtual form that stores field values in memory.
    server : MCPServer or None
        The MCP tool server that provides the agent with tools like
        scan_page, fill_field, read_document, etc.
    sse_queue : queue.Queue or None
        A thread-safe queue where events are placed for the SSE stream.
    thread : threading.Thread or None
        The background thread running the agent.
    result : dict or None
        The raw result dict from ``think()`` after the agent finishes.
    score : dict or None
        The accuracy score computed by comparing the submission against
        ground_truth.json.
    error : str or None
        Error message if the agent crashed.
    """
    session_id: str
    persona: str
    status: str = "idle"           # idle | running | done | error
    bridge: Optional[FlaskBridge] = None
    server: Optional[MCPServer] = None
    sse_queue: Optional[queue.Queue] = None
    thread: Optional[threading.Thread] = None
    result: Optional[dict] = None
    score: Optional[dict] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# LLM client factory
# ---------------------------------------------------------------------------

def _make_llm_client():
    """
    Build an OpenAI-compatible client for the configured LLM provider.

    All LLM providers (Gemini, OpenAI, Anthropic, Ollama) expose an
    OpenAI-compatible chat completions API.  This function creates the
    right ``openai.OpenAI`` client with the correct API key and base URL
    for whichever provider is configured in ``config.py``.

    Returns
    -------
    openai.OpenAI
        A client instance ready to call ``client.chat.completions.create()``.
    """
    import openai

    if LLM_PROVIDER == "gemini":
        # Google Gemini exposes an OpenAI-compatible endpoint
        return openai.OpenAI(
            api_key=GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
    elif LLM_PROVIDER == "openai":
        # Native OpenAI -- no custom base_url needed
        return openai.OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=None,
        )
    elif LLM_PROVIDER == "ollama":
        # Ollama runs locally and accepts any string as "api_key"
        return openai.OpenAI(
            api_key="ollama",
            base_url=OLLAMA_BASE_URL,
        )
    else:
        # Anthropic (Claude) via their OpenAI-compatible endpoint
        return openai.OpenAI(
            api_key=ANTHROPIC_API_KEY,
            base_url="https://api.anthropic.com/v1/",
        )


# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------

# All active sessions are stored in this dictionary, keyed by session_id.
# This is an in-memory store -- sessions are lost when the server restarts.
_sessions: dict[str, Session] = {}

# A lock that protects concurrent access to _sessions.  This is necessary
# because Flask handles requests in separate threads and the agent also
# runs in its own background thread.
_sessions_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Public API -- these functions are called by the route handlers
# ---------------------------------------------------------------------------

def create_session(persona: str) -> Session:
    """
    Create a new agent session for the given persona.

    This sets up all the components the agent needs to run:
    1. A ``FlaskBridge`` (virtual form that stores field values in memory).
    2. An NPC "ask_user" function (simulated taxpayer that can answer
       the agent's clarifying questions using the persona's private notes).
    3. An ``MCPServer`` (provides tools like scan_page, fill_field,
       read_document to the agent).
    4. A ``Session`` object that bundles everything together.

    The session is stored in the in-memory ``_sessions`` dict and returned.

    Parameters
    ----------
    persona : str
        The folder name of the persona (e.g. "anna_meier").

    Returns
    -------
    Session
        The newly created session (status = "idle").

    Raises
    ------
    ValueError
        If the persona name is not found in the personas directory.
    """
    valid_names = get_persona_names()
    if persona not in valid_names:
        raise ValueError(f"Unknown persona: {persona!r}. Choose from {valid_names}")

    persona_folder = str(PERSONAS_DIR / persona)

    # Create a thread-safe queue for Server-Sent Events.  The agent pushes
    # events (log lines, field fills, navigation) into this queue, and
    # the SSE stream endpoint reads from it.
    sse_q: queue.Queue = queue.Queue()

    # Create the virtual form (no real browser -- just a Python dict)
    bridge = FlaskBridge(sse_queue=sse_q)

    # Set up the NPC (Non-Player Character) function.  This simulates a
    # taxpayer who can answer the agent's clarifying questions.  It uses
    # the same LLM provider as the main agent, plus the persona's
    # private_notes.json file for scripted answers.
    try:
        npc_client = _make_llm_client()
        ask_user_fn = make_llm_ask_user_with_notes(
            persona_folder=persona_folder,
            model=LLM_MODEL,
            client=npc_client,
        )
    except Exception:
        # If NPC setup fails (e.g., missing API key), fall back to None.
        # The agent will still work, but cannot ask the taxpayer questions.
        ask_user_fn = None

    # Create the MCP tool server, which wires together the persona's
    # documents, the virtual form, and the NPC function into a set of
    # tools that the agent can call.
    server = MCPServer(
        persona_folder=persona_folder,
        bridge=bridge,
        ask_user_fn=ask_user_fn,
    )

    session = Session(
        session_id=str(uuid.uuid4()),
        persona=persona,
        status="idle",
        bridge=bridge,
        server=server,
        sse_queue=sse_q,
    )

    # Store the session in the in-memory dict (thread-safe)
    with _sessions_lock:
        _sessions[session.session_id] = session

    return session


def get_session(session_id: str) -> Optional[Session]:
    """
    Look up a session by its UUID.

    Returns None if no session with that ID exists.
    """
    with _sessions_lock:
        return _sessions.get(session_id)


def list_sessions() -> list[Session]:
    """Return a list of all active sessions."""
    with _sessions_lock:
        return list(_sessions.values())


def delete_session(session_id: str) -> bool:
    """
    Remove a session from the in-memory store.

    Returns True if the session was found and deleted, False otherwise.
    """
    with _sessions_lock:
        if session_id in _sessions:
            del _sessions[session_id]
            return True
    return False


def run_session(session_id: str) -> None:
    """
    Start the AI agent in a background thread.

    The agent (``think()`` function) navigates through the tax form
    page by page, asks an LLM what values to fill, writes them into the
    virtual form, and finally submits.  After submission, the result is
    scored against the ground truth.

    This function returns immediately -- the actual work happens in a
    daemon thread so it does not block the HTTP response.

    Parameters
    ----------
    session_id : str
        The UUID of the session to run.

    Raises
    ------
    KeyError
        If the session_id does not exist.
    """
    session = get_session(session_id)
    if session is None:
        raise KeyError(f"Session {session_id!r} not found")
    if session.status == "running":
        return  # already running, do nothing

    session.status = "running"

    def _worker():
        """
        Background worker that runs the agent and handles completion/errors.

        This function executes inside a daemon thread.  It:
        1. Calls ``think()`` to run the full agent loop.
        2. Extracts the submission from the result.
        3. Computes the accuracy score.
        4. Updates the session status and emits a terminal SSE event.
        """
        try:
            persona_folder = str(PERSONAS_DIR / session.persona)
            llm_client = _make_llm_client()

            # Select the raw API key string for the active provider.
            # The think() function needs this as a fallback if no
            # pre-built client is provided.
            api_key = GEMINI_API_KEY if LLM_PROVIDER == "gemini" else (
                OPENAI_API_KEY if LLM_PROVIDER == "openai" else ANTHROPIC_API_KEY
            )

            # Run the full agent loop: read documents, navigate pages,
            # ask LLM for field values, fill fields, and submit.
            result = think(
                server=session.server,
                persona_folder=persona_folder,
                api_key=api_key,
                model=LLM_MODEL,
                guides_dir=GUIDES_DIR if GUIDES_DIR.exists() else None,
                sse_queue=session.sse_queue,
                llm_client=llm_client,
            )
            session.result = result

            # Extract the submitted form data from the result.
            # The submission is nested: result -> submission -> submission_json
            submission = result.get("submission", {})
            submission_json = submission.get("submission_json", {}) if isinstance(submission, dict) else {}

            # Compare the agent's answers against the ground truth
            session.score = _compute_score(session.persona, submission_json)
            session.status = "done"

            # Notify the SSE stream that the agent has finished
            score_pct = session.score.get("score_percent") if session.score else None
            _emit(session, {"type": "agent_done", "score_percent": score_pct})
        except Exception as exc:
            # If anything goes wrong, mark the session as errored and
            # notify the SSE stream
            session.status = "error"
            session.error = str(exc)
            _emit(session, {"type": "agent_error", "error": str(exc)})

    # Start the worker in a daemon thread.  Daemon threads are automatically
    # killed when the main process exits, so we don't need to worry about
    # cleanup.
    t = threading.Thread(target=_worker, daemon=True)
    session.thread = t
    t.start()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _emit(session: Session, event: dict) -> None:
    """
    Push an event dict onto the session's SSE queue.

    This is a fire-and-forget helper -- if the queue is full or missing,
    the event is silently dropped.  This prevents the agent thread from
    crashing due to SSE issues.
    """
    if session.sse_queue is not None:
        try:
            session.sse_queue.put_nowait(event)
        except Exception:
            pass


def _compute_score(persona: str, submission_json: dict) -> dict:
    """
    Compare the agent's submitted form data against the ground truth.

    This function loads ``ground_truth.json`` from the persona's folder
    and uses the ``score.py`` script (from the ``scripts/`` directory)
    to perform a detailed comparison.

    The scoring logic works as follows:
    1. Load the ground truth and strip any keys starting with "_"
       (those are metadata, not actual form fields).
    2. Use ``compare_dicts()`` to find differences between the ground
       truth and the submission.  Each difference is categorized as
       "wrong_value" (field exists but has wrong value), "missing"
       (field exists in ground truth but not in submission), or "extra"
       (field exists in submission but not in ground truth).
    3. Count the total number of non-empty leaf values in the ground
       truth -- this is the denominator for the score.
    4. Compute: correct = total - wrong - missing
    5. Score percentage = 100 * correct / total

    Parameters
    ----------
    persona : str
        The persona folder name (used to locate ground_truth.json).
    submission_json : dict
        The form data that the agent submitted.

    Returns
    -------
    dict
        A dict with keys: score_percent, correct, wrong, missing, extra,
        total, errors (list of individual error dicts).
        If something goes wrong, returns {"error": "...", "score_percent": None}.
    """
    try:
        # Add the scripts directory to the Python path so we can import
        # the score module
        sys.path.insert(0, str(SCRIPTS_DIR))
        from score import compare_dicts, count_non_empty_leaves  # type: ignore

        gt_path = PERSONAS_DIR / persona / "ground_truth.json"
        if not gt_path.exists():
            return {"error": "ground_truth.json not found", "score_percent": None}

        with open(gt_path) as f:
            ground_truth = json.load(f)

        # Filter out metadata keys (those starting with "_") from ground truth
        gt_data = {k: v for k, v in ground_truth.items() if not k.startswith("_")}

        # compare_dicts returns a list of error dicts, each describing one
        # field that was wrong, missing, or extra
        errors = compare_dicts(gt_data, submission_json, persona)

        # Count total expected fields (only non-empty leaf values count)
        total = count_non_empty_leaves(gt_data)

        # Categorize errors by type
        wrong = [e for e in errors if e["error_type"] == "wrong_value"]
        missing = [e for e in errors if e["error_type"] == "missing"]
        extra = [e for e in errors if e["error_type"] == "extra"]

        # Score = fields that are correct / total expected fields
        correct = max(0, total - len(wrong) - len(missing))
        score_pct = round(100 * correct / total, 1) if total > 0 else 0.0

        return {
            "score_percent": score_pct,
            "correct": correct,
            "wrong": len(wrong),
            "missing": len(missing),
            "extra": len(extra),
            "total": total,
            "errors": errors,
        }
    except Exception as exc:
        return {"error": str(exc), "score_percent": None}
