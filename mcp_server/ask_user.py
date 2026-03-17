"""Simulated taxpayer (ask_user) — LLM-backed and rule-based implementations."""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("mcp_server.ask_user")


# -------------------------------------------------------------------
# Rule-based fallback
# -------------------------------------------------------------------

def make_rule_based_ask_user(persona_folder: str):
    """Create a keyword-matching ask_user backed by qa_pairs.json or defaults.

    Returns
    -------
    callable — (question: str, conversation_history: list) → str
    """
    qa_path = Path(persona_folder) / "qa_pairs.json"
    if qa_path.exists():
        with open(qa_path) as f:
            qa_pairs = json.load(f)
    else:
        qa_pairs = _default_qa_pairs()

    def _ask(question: str, conversation_history: list[dict] | None = None) -> str:
        q_lower = question.lower()
        for keyword, answer in qa_pairs.items():
            if keyword.lower() in q_lower:
                return answer
        return "I'm not sure about that. You might need to check my documents."

    return _ask


# -------------------------------------------------------------------
# LLM-backed implementations
# -------------------------------------------------------------------

def make_llm_ask_user(
    persona_system_prompt: str,
    model: str = "claude-sonnet-4-5-20250929",
    api_key: str | None = None,
):
    """Create an ``ask_user`` function backed by an LLM.

    Tries the Anthropic SDK first, then falls back to OpenAI-compatible.

    Parameters
    ----------
    persona_system_prompt : str
        System prompt defining the simulated taxpayer persona.
    model : str
        Model identifier.
    api_key : str | None
        API key. If None, reads from the standard env vars.

    Returns
    -------
    callable — (question: str, conversation_history: list) → str
    """
    # Try Anthropic
    try:
        from anthropic import Anthropic  # type: ignore

        client = Anthropic(api_key=api_key)

        def _ask(question: str, conversation_history: list[dict] | None = None) -> str:
            messages = list(conversation_history or [])
            messages.append({"role": "user", "content": question})
            response = client.messages.create(
                model=model,
                max_tokens=512,
                system=persona_system_prompt,
                messages=messages,
            )
            return response.content[0].text

        logger.info("LLM ask_user: using Anthropic SDK (model=%s)", model)
        return _ask
    except ImportError:
        pass

    # Try OpenAI-compatible
    try:
        import openai  # type: ignore

        client = openai.OpenAI(api_key=api_key)

        def _ask(question: str, conversation_history: list[dict] | None = None) -> str:
            messages = [{"role": "system", "content": persona_system_prompt}]
            messages.extend(conversation_history or [])
            messages.append({"role": "user", "content": question})
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=512,
            )
            return response.choices[0].message.content

        logger.info("LLM ask_user: using OpenAI SDK (model=%s)", model)
        return _ask
    except ImportError:
        pass

    raise ImportError(
        "Neither 'anthropic' nor 'openai' package found. "
        "Install one to use LLM-backed ask_user."
    )


# -------------------------------------------------------------------
# NPC ask_user backed by private_notes.json (Phase 2+)
# -------------------------------------------------------------------

def make_llm_ask_user_with_notes(
    persona_folder: str,
    model: str,
    client: Any,  # OpenAI-compatible client
) -> callable:
    """Create an NPC ask_user that uses private_notes.json as hidden knowledge.

    The NPC role-plays as the taxpayer using verbal knowledge that is NOT
    in any document — things a real person would just know.

    Parameters
    ----------
    persona_folder : str
        Path to the persona's document folder (contains profile.json and
        private_notes.json).
    model : str
        Model identifier (OpenAI-compatible).
    client : OpenAI-compatible client
        An instantiated client with a ``chat.completions.create`` method.

    Returns
    -------
    callable — (question: str, conversation_history: list) → str
    """
    folder = Path(persona_folder)

    # Load profile
    profile_path = folder / "profile.json"
    profile = {}
    if profile_path.exists():
        try:
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    # Load private_notes
    notes_path = folder / "private_notes.json"
    private_notes = {}
    if notes_path.exists():
        try:
            private_notes = json.loads(notes_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    persona_name = profile.get("name", folder.name)

    # Build knowledge text from verbal_knowledge and clarifications
    knowledge_parts = []

    verbal = private_notes.get("verbal_knowledge", [])
    if verbal:
        knowledge_parts.append("## Things I know verbally (not in any document)")
        for item in verbal:
            knowledge_parts.append(
                f"- Topic: {item.get('topic', '')}\n"
                f"  What I know: {item.get('answer', '')}"
            )

    clarifications = private_notes.get("clarifications", [])
    if clarifications:
        knowledge_parts.append("\n## Clarifications on specific fields")
        for item in clarifications:
            knowledge_parts.append(
                f"- Field: {item.get('field', '')}\n"
                f"  My answer: {item.get('answer', '')}"
            )

    knowledge_text = "\n".join(knowledge_parts) if knowledge_parts else "(No additional verbal knowledge available.)"

    brief = profile.get("brief", "")

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
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history or [])
        messages.append({"role": "user", "content": question})

        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=256,
            )
            return response.choices[0].message.content
        except Exception as exc:
            logger.warning("NPC LLM call failed: %s", exc)
            return "I'm not sure about that. You might need to check my documents."

    logger.info(
        "NPC ask_user ready for %s (model=%s, %d verbal items, %d clarifications)",
        persona_name, model, len(verbal), len(clarifications),
    )
    return _ask


# -------------------------------------------------------------------
# Default Q&A pairs (Anna Meier, Phase 0 fallback)
# -------------------------------------------------------------------

def _default_qa_pairs() -> dict[str, str]:
    return {
        "work from home": "Not regularly, maybe once in a while.",
        "home office": "Not regularly, maybe once in a while.",
        "canteen": "Yes, Google has a canteen. I eat there most days. It's subsidized by the company.",
        "kantinenverpflegung": "Yes, Google has a subsidized canteen.",
        "children": "No, no kids.",
        "kids": "No, no kids.",
        "property": "No, I rent my apartment.",
        "eigentum": "Nein, ich miete meine Wohnung.",
        "side income": "No, just my Google salary.",
        "nebeneinkommen": "Nein, nur mein Google-Gehalt.",
        "crypto": "No, I don't have any cryptocurrency.",
        "kryptowährung": "Nein, ich habe keine Kryptowährungen.",
        "donations": "Oh yeah, I donated CHF 200 to the Swiss Red Cross last year.",
        "spende": "Ja, ich habe CHF 200 an das Schweizerische Rote Kreuz gespendet.",
        "married": "No, I'm single.",
        "partner": "No, I'm single. No partner.",
        "car": "No, I don't have a car. I take the tram.",
        "auto": "Nein, ich habe kein Auto. Ich fahre mit dem Tram.",
        "commute": "I take the ZVV tram to work. I have an annual pass.",
        "pendeln": "Ich fahre mit dem Tram zur Arbeit. Ich habe ein Jahresabo.",
        "medical": "No significant medical expenses this year.",
        "arzt": "Keine grossen Arztkosten dieses Jahr.",
        "foreign": "No foreign income or investments.",
        "ausland": "Keine ausländischen Einkünfte oder Anlagen.",
        "pillar 3a": "Yes, I put money into a 3a account at VIAC.",
        "säule 3a": "Ja, ich habe bei VIAC eingezahlt.",
        "insurance": "Just the normal health insurance, nothing special.",
        "versicherung": "Nur die normale Krankenkasse, nichts Besonderes.",
    }
