"""AgenTekki MCP Server -- Tax Agent Tools.

This is the **package initializer** for the ``mcp_server`` Python package.
When you write ``from mcp_server import MCPServer`` anywhere in your code,
Python runs this file first to set up the package.

What this file does
-------------------
1. It imports the most important classes and functions from the sub-modules
   so that users of the package can access them with a short, convenient
   import path (e.g. ``from mcp_server import MCPServer`` instead of
   ``from mcp_server.server import MCPServer``).
2. It defines ``__all__`` -- the list of names that are considered part of
   the package's *public API*.  Any name **not** listed in ``__all__`` is
   treated as an internal implementation detail.

How it fits into the MCP architecture
-------------------------------------
The Model Context Protocol (MCP) is a standard that lets an AI agent
(like Claude or Gemini) call "tools" exposed by an external server.
This package implements an MCP-compatible tool server whose tools help
an AI agent fill out a Swiss tax return.  The architecture looks like:

    AI Agent  <--MCP JSON-RPC-->  protocol.py  -->  MCPServer (server.py)
                                                       |
                                                   BrowserBridge
                                                  /      |      \\
                                            Colab   Playwright   Mock

Quick-start examples
--------------------
Colab usage::

    from mcp_server import MCPServer
    server = MCPServer(persona_folder="personas/anna_meier")

Standalone MCP server (Claude Code, Gemini CLI, etc.)::

    python -m mcp_server --persona personas/anna_meier --bridge playwright --url http://localhost:3000
"""

# ---------------------------------------------------------------------------
# Public API imports
# ---------------------------------------------------------------------------
# Each import below pulls a key class or function from its own sub-module and
# makes it available at the top-level package namespace.

# MCPServer is the central class that wires tools, bridges, and logging together.
from .server import MCPServer

# run_agent drives the perceive-think-act loop that students implement.
from .agent import run_agent

# Factory functions that create different "ask_user" implementations:
#   - make_llm_ask_user: uses an LLM (Anthropic or OpenAI) to simulate a taxpayer
#   - make_rule_based_ask_user: uses keyword matching (no LLM needed)
from .ask_user import make_llm_ask_user, make_rule_based_ask_user

# InteractionLog records every tool call for later scoring / grading.
from .log import InteractionLog

# Browser bridge classes -- the abstraction layer between MCPServer and a browser:
#   - BrowserBridge: the abstract base class all bridges implement
#   - MockBridge: an in-memory fake browser (great for testing)
#   - MockFrontend: the simulated form state used inside MockBridge
from .bridges import BrowserBridge, MockBridge, MockFrontend

# ---------------------------------------------------------------------------
# __all__ defines the public API of this package.
# Only these names will be exported when someone writes:
#     from mcp_server import *
# It also signals to documentation tools and IDEs which names are "public".
# ---------------------------------------------------------------------------
__all__ = [
    "MCPServer",
    "run_agent",
    "make_llm_ask_user",
    "make_rule_based_ask_user",
    "InteractionLog",
    "BrowserBridge",
    "MockBridge",
    "MockFrontend",
]
