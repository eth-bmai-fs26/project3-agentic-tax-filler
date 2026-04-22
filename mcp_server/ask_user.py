"""Simulated taxpayer (ask_user) -- LLM-backed and rule-based implementations.

In the real world, a tax-filing agent would ask the *actual person* whenever
it needs information that is not in the documents (e.g., "Do you have a
subsidized canteen at work?").  In this project the "taxpayer" is simulated
by a function we call ``ask_user``.

This module provides **three** factory functions that each produce a different
``ask_user`` implementation:

1. ``make_rule_based_ask_user``  -- simple keyword matching, no LLM needed.
   Great for deterministic tests and Phase 0.
2. ``make_llm_ask_user``  -- uses an LLM (Anthropic or OpenAI) to role-play
   the taxpayer from a system prompt you supply.
3. ``make_llm_ask_user_with_notes``  -- like #2, but automatically builds the
   system prompt from the persona's ``private_notes.json`` (verbal knowledge
   that is intentionally *not* in any document).

All three return a callable with the same signature::

    ask_user(question: str, conversation_history: list[dict] | None) -> str

so they can be used interchangeably by the MCPServer.

Why it exists
-------------
Separating the "taxpayer simulation" from the rest of the code means students
can swap implementations easily -- use the cheap keyword matcher while
developing, then upgrade to an LLM-based NPC for final evaluation.
"""

import json
import logging
from pathlib import Path
from typing import Any

# Logger scoped to this module -- messages will appear as "mcp_server.ask_user".
logger = logging.getLogger("mcp_server.ask_user")


# ===================================================================
# 1. Rule-based fallback (no LLM required)
# ===================================================================

def make_rule_based_ask_user(persona_folder: str):
    """Create a keyword-matching ``ask_user`` function.

    How it works:
    - Loads ``qa_pairs.json`` from the persona folder (if it exists).
    - If not, falls back to a built-in set of default Q&A pairs (see
      ``_default_qa_pairs()`` at the bottom of this file).
    - When a question is asked, it scans every keyword in the Q&A pairs and
      returns the answer for the first keyword found inside the question text.
    - If no keyword matches, it returns a generic "I'm not sure" response.

    Parameters
    ----------
    persona_folder : str
        Path to the persona's document folder, which may contain
        ``qa_pairs.json``.

    Returns
    -------
    callable
        A function with signature ``(question: str, conversation_history) -> str``.
    """
    # Try to load persona-specific Q&A pairs; fall back to defaults
    qa_path = Path(persona_folder) / "qa_pairs.json"
    if qa_path.exists():
        with open(qa_path) as f:
            qa_pairs = json.load(f)
    else:
        qa_pairs = _default_qa_pairs()

    def _ask(question: str, conversation_history: list[dict] | None = None) -> str:
        """Search the question text for any known keyword and return the matching answer."""
        # Convert the question to lowercase for case-insensitive matching
        q_lower = question.lower()
        for keyword, answer in qa_pairs.items():
            # If the keyword appears anywhere inside the question, return its answer
            if keyword.lower() in q_lower:
                return answer
        # No keyword matched -- return a safe fallback
        return "I'm not sure about that. You might need to check my documents."

    return _ask


# ===================================================================
# 2. LLM-backed ask_user (generic system prompt)
# ===================================================================

def make_llm_ask_user(
    persona_system_prompt: str,
    model: str = "claude-sonnet-4-5-20250929",
    api_key: str | None = None,
):
    """Create an ``ask_user`` function that calls an LLM to role-play the taxpayer.

    The function tries to use the **Anthropic** SDK first.  If that package is
    not installed, it falls back to the **OpenAI**-compatible SDK.  If neither
    is available, it raises ``ImportError``.

    Parameters
    ----------
    persona_system_prompt : str
        A system-level prompt that tells the LLM *who* it is role-playing
        (name, background, what it knows, etc.).
    model : str
        The model identifier to use (e.g. ``"claude-sonnet-4-5-20250929"``
        for Anthropic, or ``"gpt-4o"`` for OpenAI).
    api_key : str | None
        API key.  If ``None``, the SDK reads it from the standard environment
        variable (``ANTHROPIC_API_KEY`` or ``OPENAI_API_KEY``).

    Returns
    -------
    callable
        A function with signature ``(question: str, conversation_history) -> str``.

    Raises
    ------
    ImportError
        If neither the ``anthropic`` nor the ``openai`` Python package is
        installed.
    """

    # --- Attempt 1: Anthropic SDK -------------------------------------------
    try:
        from anthropic import Anthropic  # type: ignore

        # Create a persistent client so we re-use the connection across calls
        client = Anthropic(api_key=api_key)

        def _ask(question: str, conversation_history: list[dict] | None = None) -> str:
            """Send the question (plus conversation history) to the Anthropic API."""
            # Build the messages list: prior conversation + the new question
            messages = list(conversation_history or [])
            messages.append({"role": "user", "content": question})
            response = client.messages.create(
                model=model,
                max_tokens=512,
                system=persona_system_prompt,   # Anthropic puts the system prompt separately
                messages=messages,
            )
            # The Anthropic response contains a list of content blocks; take the first one's text
            return response.content[0].text

        logger.info("LLM ask_user: using Anthropic SDK (model=%s)", model)
        return _ask
    except ImportError:
        # anthropic package not installed -- try the next option
        pass

    # --- Attempt 2: OpenAI-compatible SDK -----------------------------------
    try:
        import openai  # type: ignore

        client = openai.OpenAI(api_key=api_key)

        def _ask(question: str, conversation_history: list[dict] | None = None) -> str:
            """Send the question (plus conversation history) to the OpenAI API."""
            # OpenAI-style APIs put the system prompt as the first message
            messages = [{"role": "system", "content": persona_system_prompt}]
            messages.extend(conversation_history or [])
            messages.append({"role": "user", "content": question})
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=512,
            )
            # OpenAI returns a list of "choices"; we take the first one
            return response.choices[0].message.content

        logger.info("LLM ask_user: using OpenAI SDK (model=%s)", model)
        return _ask
    except ImportError:
        # openai package not installed either
        pass

    # Neither SDK was found -- raise a helpful error
    raise ImportError(
        "Neither 'anthropic' nor 'openai' package found. "
        "Install one to use LLM-backed ask_user."
    )


# ===================================================================
# 3. NPC ask_user with private_notes.json (Phase 2+)
# ===================================================================

def make_llm_ask_user_with_notes(
    persona_folder: str,
    model: str,
    client: Any,  # OpenAI-compatible client
) -> callable:
    """Create an NPC ``ask_user`` that uses ``private_notes.json`` as hidden knowledge.

    This is the most realistic taxpayer simulation.  The NPC role-plays as
    the taxpayer using "verbal knowledge" -- things a real person would just
    *know* (e.g., "I take the tram to work") even though that information is
    not written in any document.

    The ``private_notes.json`` file contains two sections:
    - ``verbal_knowledge``: facts the taxpayer knows from memory.
    - ``clarifications``: specific field-level answers the taxpayer can give
      when asked.

    These are injected into the LLM's system prompt so it can answer
    naturally without revealing that it is reading from a file.

    Parameters
    ----------
    persona_folder : str
        Path to the persona's document folder (must contain ``profile.json``;
        may contain ``private_notes.json``).
    model : str
        Model identifier (OpenAI-compatible, e.g. ``"gpt-4o"``).
    client : Any
        An instantiated OpenAI-compatible client object that has a
        ``chat.completions.create`` method.

    Returns
    -------
    callable
        A function with signature ``(question: str, conversation_history) -> str``.
    """
    folder = Path(persona_folder)

    # -----------------------------------------------------------------------
    # Load the persona's public profile (name, brief background, etc.)
    # -----------------------------------------------------------------------
    profile_path = folder / "profile.json"
    profile = {}
    if profile_path.exists():
        try:
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
        except Exception:
            pass  # Gracefully handle corrupted JSON

    # -----------------------------------------------------------------------
    # Load private_notes.json -- the hidden knowledge only the NPC knows
    # -----------------------------------------------------------------------
    notes_path = folder / "private_notes.json"
    private_notes = {}
    if notes_path.exists():
        try:
            private_notes = json.loads(notes_path.read_text(encoding="utf-8"))
        except Exception:
            pass  # Gracefully handle corrupted JSON

    # Use the persona's real name (or fall back to the folder name)
    persona_name = profile.get("name", folder.name)

    # -----------------------------------------------------------------------
    # Build the "knowledge text" that will be injected into the system prompt.
    # This assembles all verbal_knowledge items and clarifications into a
    # human-readable block that the LLM can reference when answering.
    # -----------------------------------------------------------------------
    knowledge_parts = []

    # verbal_knowledge: things the taxpayer knows from memory
    verbal = private_notes.get("verbal_knowledge", [])
    if verbal:
        knowledge_parts.append("## Things I know verbally (not in any document)")
        for item in verbal:
            knowledge_parts.append(
                f"- Topic: {item.get('topic', '')}\n"
                f"  What I know: {item.get('answer', '')}"
            )

    # clarifications: specific answers about tax form fields
    clarifications = private_notes.get("clarifications", [])
    if clarifications:
        knowledge_parts.append("\n## Clarifications on specific fields")
        for item in clarifications:
            knowledge_parts.append(
                f"- Field: {item.get('field', '')}\n"
                f"  My answer: {item.get('answer', '')}"
            )

    # Join all parts into one block, or provide a placeholder if empty
    knowledge_text = "\n".join(knowledge_parts) if knowledge_parts else "(No additional verbal knowledge available.)"

    brief = profile.get("brief", "")

    # -----------------------------------------------------------------------
    # Assemble the full system prompt.
    # This prompt instructs the LLM to behave like a real taxpayer: answer
    # naturally, keep responses short, and never reveal the hidden notes.
    # -----------------------------------------------------------------------
    system_prompt = f"""You are {persona_name}, a Swiss taxpayer filling in your tax return.

## Your background
{brief}

## Your verbal knowledge (things you know but that aren't in any document)
{knowledge_text}

## Instructions
- Answer questions naturally and conversationally, as this person would speak.
- Keep answers short and direct — 1-4 sentences maximum.
- If you know the answer from your verbal knowledge above, give it confidently.
- If someone asks about something not covered above, say you're not sure and suggest they check your documents.
- You are NOT a tax expert — you speak as a layperson who knows their own situation.
- Do NOT mention that you have "verbal knowledge" or "private notes" — just answer naturally.
- Respond in the same language the question is asked in (German or English).
"""

    def _ask(question: str, conversation_history: list[dict] | None = None) -> str:
        """Call the LLM to answer the question as the taxpayer NPC.

        Builds a messages list with the system prompt, any prior conversation
        history (so the NPC remembers what was already discussed), and the
        new question.  If the LLM call fails for any reason, returns a safe
        fallback string.
        """
        # Build the full messages list for the chat completion API
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history or [])
        messages.append({"role": "user", "content": question})

        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=256,  # Keep answers short (NPC should be concise)
            )
            return response.choices[0].message.content
        except Exception as exc:
            # If the API call fails (network error, rate limit, etc.),
            # return a safe fallback instead of crashing
            logger.warning("NPC LLM call failed: %s", exc)
            return "I'm not sure about that. You might need to check my documents."

    logger.info(
        "NPC ask_user ready for %s (model=%s, %d verbal items, %d clarifications)",
        persona_name, model, len(verbal), len(clarifications),
    )
    return _ask


# ===================================================================
# Default Q&A pairs (Anna Meier, Phase 0 fallback)
# ===================================================================

def _default_qa_pairs() -> dict[str, str]:
    """Return a hardcoded dictionary of keyword -> answer pairs.

    These are designed for the "Anna Meier" demo persona (a single
    software engineer at Google Zurich).  Each key is a keyword that
    might appear in a question, and the value is what Anna would say.

    Both English and German keywords are provided so the agent can ask
    questions in either language.

    Returns
    -------
    dict[str, str]
        Mapping of lowercase keyword to answer string.
    """
    return {
        # -- Work-from-home / home office --
        "work from home": "Not regularly, maybe once in a while.",
        "home office": "Not regularly, maybe once in a while.",
        # -- Canteen / meals --
        "canteen": "Yes, Google has a canteen. I eat there most days. It's subsidized by the company.",
        "kantinenverpflegung": "Yes, Google has a subsidized canteen.",
        # -- Children --
        "children": "No, no kids.",
        "kids": "No, no kids.",
        # -- Property / real estate --
        "property": "No, I rent my apartment.",
        "eigentum": "Nein, ich miete meine Wohnung.",
        # -- Side income --
        "side income": "No, just my Google salary.",
        "nebeneinkommen": "Nein, nur mein Google-Gehalt.",
        # -- Cryptocurrency --
        "crypto": "No, I don't have any cryptocurrency.",
        "kryptowährung": "Nein, ich habe keine Kryptowährungen.",
        # -- Charitable donations --
        "donations": "Oh yeah, I donated CHF 200 to the Swiss Red Cross last year.",
        "spende": "Ja, ich habe CHF 200 an das Schweizerische Rote Kreuz gespendet.",
        # -- Marital status --
        "married": "No, I'm single.",
        "partner": "No, I'm single. No partner.",
        # -- Car / transport --
        "car": "No, I don't have a car. I take the tram.",
        "auto": "Nein, ich habe kein Auto. Ich fahre mit dem Tram.",
        # -- Commute --
        "commute": "I take the ZVV tram to work. I have an annual pass.",
        "pendeln": "Ich fahre mit dem Tram zur Arbeit. Ich habe ein Jahresabo.",
        # -- Medical expenses --
        "medical": "No significant medical expenses this year.",
        "arzt": "Keine grossen Arztkosten dieses Jahr.",
        # -- Foreign income --
        "foreign": "No foreign income or investments.",
        "ausland": "Keine ausländischen Einkünfte oder Anlagen.",
        # -- Pillar 3a (Swiss retirement savings) --
        "pillar 3a": "Yes, I put money into a 3a account at VIAC.",
        "säule 3a": "Ja, ich habe bei VIAC eingezahlt.",
        # -- Insurance --
        "insurance": "Just the normal health insurance, nothing special.",
        "versicherung": "Nur die normale Krankenkasse, nichts Besonderes.",
    }
