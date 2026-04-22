"""
Central configuration module for the Flask backend.

This file reads all configurable settings from **environment variables**
so that sensitive values (API keys) are never hard-coded in the source.
It also computes filesystem paths that other modules need (e.g., where
persona folders live, where scoring scripts are located).

How it fits into the project
----------------------------
Almost every other backend module imports from ``config.py``:

* ``agent_service.py`` uses the API keys, LLM provider/model settings,
  and directory paths to create agent sessions and run the AI.
* ``personas.py`` uses ``PERSONAS_DIR`` to discover and load persona
  profiles from disk.
* ``think_service.py`` receives the LLM model and key indirectly
  (through ``agent_service``), but the values originate here.

Environment variables you can set
---------------------------------
- ``ANTHROPIC_API_KEY`` -- key for Claude / Anthropic models
- ``OPENAI_API_KEY``    -- key for OpenAI models (GPT-4o, etc.)
- ``GEMINI_API_KEY``    -- key for Google Gemini models
- ``LLM_PROVIDER``     -- which provider to use: "gemini" | "openai" |
                          "anthropic" | "ollama"
- ``LLM_MODEL``        -- override the default model for the chosen
                          provider (see ``_DEFAULT_MODELS`` below)
- ``OLLAMA_BASE_URL``   -- custom endpoint if Ollama runs on a non-default
                          host/port
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Filesystem paths
# ---------------------------------------------------------------------------
# REPO_ROOT is the top-level directory of the entire Git repository.
# We compute it by going two levels up from this file's location:
#   config.py -> backend/ -> project-root/
REPO_ROOT = Path(__file__).resolve().parent.parent

# Directory where persona folders live (each persona has its own sub-folder
# containing profile.json, financial documents, etc.)
PERSONAS_DIR = REPO_ROOT / "personas"

# Directory containing HTML/text tax guides that the agent can reference.
# This folder may not exist in every setup -- the code handles that gracefully.
GUIDES_DIR = REPO_ROOT / "guides"  # may not exist -- graceful fallback

# Directory containing helper scripts (e.g., score.py for grading submissions).
SCRIPTS_DIR = REPO_ROOT / "scripts"

# ---------------------------------------------------------------------------
# API keys -- read from environment variables, default to empty string
# ---------------------------------------------------------------------------
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# ---------------------------------------------------------------------------
# LLM provider selection
# ---------------------------------------------------------------------------
# Which LLM provider to use.  Supported values:
#   "gemini"    -- Google Gemini (default)
#   "openai"    -- OpenAI (GPT-4o, etc.)
#   "anthropic" -- Anthropic (Claude)
#   "ollama"    -- Local Ollama server (open-source models)
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")

# Each provider has a sensible default model.  The user can override by
# setting the LLM_MODEL environment variable.
_DEFAULT_MODELS = {
    "gemini": "gemini-2.5-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-4-6",
    "ollama": "gemma3:12b",
}

# Pick the model: first check the env var, then fall back to the provider's
# default, and finally fall back to "gemini-2.5-flash" as an ultimate default.
LLM_MODEL = os.environ.get("LLM_MODEL", _DEFAULT_MODELS.get(LLM_PROVIDER, "gemini-2.5-flash"))

# Ollama runs a local HTTP server.  The default address is localhost:11434.
# If you run Ollama on a different machine or port, override this env var.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")

# ---------------------------------------------------------------------------
# Hard-coded persona names (fallback)
# ---------------------------------------------------------------------------
# This list is used as a fallback when the personas directory does not exist
# on disk (e.g., in a minimal dev environment).  In production, personas
# are discovered dynamically by scanning PERSONAS_DIR (see get_persona_names).
PERSONA_NAMES = [
    "anna_meier",
    "marco_laura_bernasconi",
    "priya_chakraborty",
    "thomas_elisabeth_widmer",
    "yuki_tanaka",
]


def get_persona_names() -> list[str]:
    """
    Dynamically discover all persona folders that contain a profile.json file.

    The function scans the ``PERSONAS_DIR`` directory and returns the folder
    names (sorted alphabetically) of every sub-directory that has a
    ``profile.json`` file inside it.  This lets users add new personas simply
    by creating a new folder with the right structure -- no code changes needed.

    If ``PERSONAS_DIR`` does not exist (e.g., first-time setup), we fall back
    to the hard-coded ``PERSONA_NAMES`` list above.

    Returns
    -------
    list[str]
        A list of persona folder names, e.g. ["anna_meier", "yuki_tanaka"].
    """
    if not PERSONAS_DIR.exists():
        return list(PERSONA_NAMES)
    return [
        d.name for d in sorted(PERSONAS_DIR.iterdir())
        if d.is_dir() and (d / "profile.json").exists()
    ]
