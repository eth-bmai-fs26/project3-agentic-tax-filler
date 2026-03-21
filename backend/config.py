"""Flask backend configuration — reads from environment variables."""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PERSONAS_DIR = REPO_ROOT / "personas"
GUIDES_DIR = REPO_ROOT / "guides"  # may not exist — graceful fallback
SCRIPTS_DIR = REPO_ROOT / "scripts"

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# LLM_PROVIDER: "gemini" | "openai" | "anthropic" | "ollama"
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")

# Model defaults per provider
_DEFAULT_MODELS = {
    "gemini": "gemini-2.5-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-4-6",
    "ollama": "gemma3:12b",
}
LLM_MODEL = os.environ.get("LLM_MODEL", _DEFAULT_MODELS.get(LLM_PROVIDER, "gemini-2.5-flash"))

# Ollama endpoint (can be overridden if running on a different host/port)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")

PERSONA_NAMES = [
    "anna_meier",
    "marco_laura_bernasconi",
    "priya_chakraborty",
    "thomas_elisabeth_widmer",
    "yuki_tanaka",
]


def get_persona_names() -> list[str]:
    """Dynamically discover all persona folders containing profile.json."""
    if not PERSONAS_DIR.exists():
        return list(PERSONA_NAMES)
    return [
        d.name for d in sorted(PERSONAS_DIR.iterdir())
        if d.is_dir() and (d / "profile.json").exists()
    ]
