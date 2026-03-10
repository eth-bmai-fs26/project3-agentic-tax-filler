"""AgenTekki MCP Server — Tax Agent Tools.

Colab usage:
    from mcp_server import MCPServer
    server = MCPServer(persona_folder="personas/anna_meier")

Standalone MCP server (Claude Code, Gemini CLI, etc.):
    python -m mcp_server --persona personas/anna_meier --bridge playwright --url http://localhost:3000
"""

from .server import MCPServer
from .agent import run_agent
from .ask_user import make_llm_ask_user, make_rule_based_ask_user
from .log import InteractionLog
from .bridges import BrowserBridge, MockBridge, MockFrontend

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
