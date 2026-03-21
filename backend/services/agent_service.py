"""
Session management for the Flask backend.

Creates and runs agent sessions backed by FlaskBridge + MCPServer + think().
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

# Ensure repo root on path
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
    """Build an OpenAI-compat client for the configured provider."""
    import openai

    if LLM_PROVIDER == "gemini":
        return openai.OpenAI(
            api_key=GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
    elif LLM_PROVIDER == "openai":
        return openai.OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=None,
        )
    elif LLM_PROVIDER == "ollama":
        return openai.OpenAI(
            api_key="ollama",
            base_url=OLLAMA_BASE_URL,
        )
    else:
        # anthropic via OpenAI-compat endpoint
        return openai.OpenAI(
            api_key=ANTHROPIC_API_KEY,
            base_url="https://api.anthropic.com/v1/",
        )


# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------

_sessions: dict[str, Session] = {}
_sessions_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_session(persona: str) -> Session:
    """Create a new session for the given persona."""
    valid_names = get_persona_names()
    if persona not in valid_names:
        raise ValueError(f"Unknown persona: {persona!r}. Choose from {valid_names}")

    persona_folder = str(PERSONAS_DIR / persona)
    sse_q: queue.Queue = queue.Queue()

    bridge = FlaskBridge(sse_queue=sse_q)

    # NPC function — uses same provider as main LLM
    try:
        npc_client = _make_llm_client()
        ask_user_fn = make_llm_ask_user_with_notes(
            persona_folder=persona_folder,
            model=LLM_MODEL,
            client=npc_client,
        )
    except Exception:
        # Fallback: rule-based NPC
        ask_user_fn = None

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

    with _sessions_lock:
        _sessions[session.session_id] = session

    return session


def get_session(session_id: str) -> Optional[Session]:
    with _sessions_lock:
        return _sessions.get(session_id)


def list_sessions() -> list[Session]:
    with _sessions_lock:
        return list(_sessions.values())


def delete_session(session_id: str) -> bool:
    with _sessions_lock:
        if session_id in _sessions:
            del _sessions[session_id]
            return True
    return False


def run_session(session_id: str) -> None:
    """Start the agent in a background thread."""
    session = get_session(session_id)
    if session is None:
        raise KeyError(f"Session {session_id!r} not found")
    if session.status == "running":
        return  # already running

    session.status = "running"

    def _worker():
        try:
            persona_folder = str(PERSONAS_DIR / session.persona)
            llm_client = _make_llm_client()
            # Pick the right raw API key for the provider
            api_key = GEMINI_API_KEY if LLM_PROVIDER == "gemini" else (
                OPENAI_API_KEY if LLM_PROVIDER == "openai" else ANTHROPIC_API_KEY
            )
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
            submission = result.get("submission", {})
            submission_json = submission.get("submission_json", {}) if isinstance(submission, dict) else {}
            session.score = _compute_score(session.persona, submission_json)
            session.status = "done"
            score_pct = session.score.get("score_percent") if session.score else None
            _emit(session, {"type": "agent_done", "score_percent": score_pct})
        except Exception as exc:
            session.status = "error"
            session.error = str(exc)
            _emit(session, {"type": "agent_error", "error": str(exc)})

    t = threading.Thread(target=_worker, daemon=True)
    session.thread = t
    t.start()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _emit(session: Session, event: dict) -> None:
    if session.sse_queue is not None:
        try:
            session.sse_queue.put_nowait(event)
        except Exception:
            pass


def _compute_score(persona: str, submission_json: dict) -> dict:
    """Compare submission against ground_truth.json using score.py logic."""
    try:
        sys.path.insert(0, str(SCRIPTS_DIR))
        from score import compare_dicts, count_non_empty_leaves  # type: ignore

        gt_path = PERSONAS_DIR / persona / "ground_truth.json"
        if not gt_path.exists():
            return {"error": "ground_truth.json not found", "score_percent": None}

        with open(gt_path) as f:
            ground_truth = json.load(f)

        gt_data = {k: v for k, v in ground_truth.items() if not k.startswith("_")}
        errors = compare_dicts(gt_data, submission_json, persona)

        total = count_non_empty_leaves(gt_data)
        wrong = [e for e in errors if e["error_type"] == "wrong_value"]
        missing = [e for e in errors if e["error_type"] == "missing"]
        extra = [e for e in errors if e["error_type"] == "extra"]
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
