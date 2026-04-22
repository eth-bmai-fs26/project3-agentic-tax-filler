"""MCP JSON-RPC protocol server -- proper Model Context Protocol over stdio.

This module is the **bridge between the MCP wire protocol and the MCPServer
class**.  It translates incoming JSON-RPC messages from an MCP client (such
as Claude Code, Gemini CLI, or Cursor) into calls on ``MCPServer``, and
sends the results back as JSON-RPC responses.

What is JSON-RPC?
-----------------
JSON-RPC is a lightweight remote-procedure-call protocol.  The client sends
a JSON message like::

    {"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "scan_page", "arguments": {}}, "id": 1}

and the server replies with::

    {"jsonrpc": "2.0", "result": [...], "id": 1}

The ``mcp`` Python library (``pip install mcp``) handles all the low-level
JSON-RPC parsing.  This module just needs to:

1. Define the *tool schemas* (what tools exist and what parameters they take).
2. Wire the ``tools/call`` handler to ``MCPServer.execute()``.

What is stdio transport?
------------------------
"stdio" means the MCP client communicates with this server process via
standard input (stdin) and standard output (stdout) -- the same streams
used when you type in a terminal.  The client spawns this server as a
subprocess and pipes JSON-RPC messages through those streams.

Usage
-----
::

    python -m mcp_server --persona personas/anna_meier --bridge mock

How it fits into the architecture
---------------------------------
::

    MCP Client (Claude Code / Gemini CLI / Cursor)
         |
      stdin/stdout (JSON-RPC messages)
         |
    protocol.py  (this file -- translates JSON-RPC to Python calls)
         |
    MCPServer.execute()  (server.py -- dispatches to the right tool method)
         |
    BrowserBridge / document reader / ask_user
"""

import asyncio
import json
import logging
from typing import Any

# These imports come from the ``mcp`` Python package (pip install mcp).
# It provides the low-level JSON-RPC server, stdio transport, and type
# definitions for Tool and TextContent.
from mcp.server import Server  # type: ignore
from mcp.server.stdio import stdio_server  # type: ignore
from mcp.types import TextContent, Tool  # type: ignore

from .server import MCPServer
from .bridges.base import BrowserBridge

logger = logging.getLogger("mcp_server.protocol")

# ===================================================================
# Tool schemas (JSON Schema for each tool's parameters)
# ===================================================================
# Each entry in this list describes one MCP tool:
#   - "name":        the tool's unique identifier
#   - "description": human-readable text shown to the AI agent so it knows
#                    when and how to use the tool
#   - "inputSchema": a JSON Schema object that describes the tool's parameters
#                    (type, required fields, descriptions).  The MCP client
#                    validates arguments against this schema before sending
#                    the call.
#
# These schemas are sent to the client when it asks "what tools do you have?"
# (the ``tools/list`` JSON-RPC method).

TOOL_SCHEMAS: list[dict] = [
    # ----- scan_page -----
    # No parameters needed -- it just reads the current page state.
    {
        "name": "scan_page",
        "description": (
            "Returns a JSON representation of the current tax form page. "
            "Lists all visible inputs, buttons, text elements, and validation errors. "
            "Use this to discover field locators before calling fill_field."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    # ----- fill_field -----
    # Requires a locator (which field) and a value (what to put in it).
    {
        "name": "fill_field",
        "description": (
            "Enter a value into a form field. The locator must come from a "
            "previous scan_page() call."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "locator": {
                    "type": "string",
                    "description": "The field locator from scan_page (e.g. 'field-income-employment-bruttolohn').",
                },
                "value": {
                    "description": "The value to set (string or number).",
                },
            },
            "required": ["locator", "value"],
        },
    },
    # ----- click_element -----
    # Used for page navigation and button clicks.
    {
        "name": "click_element",
        "description": (
            "Click a button or link. Use for page navigation (e.g. 'btn-nav-deductions') "
            "or other interactive elements discovered via scan_page."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "locator": {
                    "type": "string",
                    "description": "The element locator from scan_page.",
                },
            },
            "required": ["locator"],
        },
    },
    # ----- submit_form -----
    # No parameters -- submits whatever is currently filled in.
    {
        "name": "submit_form",
        "description": (
            "Submit the completed tax return. Generates submitted_return.json for scoring. "
            "Returns errors if validation fails."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    # ----- list_documents -----
    # No parameters -- returns filenames in the persona folder.
    {
        "name": "list_documents",
        "description": (
            "List all files in the persona's document folder "
            "(e.g. lohnausweis.txt, bank_statement.csv)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    # ----- read_document -----
    # Requires a filepath to the document to read.
    {
        "name": "read_document",
        "description": (
            "Read and extract content from a document. "
            "Handles .txt, .csv, .pdf, and .json files. No OCR."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "filepath": {
                    "type": "string",
                    "description": "Filename relative to the persona folder, or absolute path.",
                },
            },
            "required": ["filepath"],
        },
    },
    # ----- list_guides -----
    # No parameters -- returns available tax guide topics.
    {
        "name": "list_guides",
        "description": (
            "Return a list of available tax guide topics (Wegleitung, tips) "
            "and their URLs/paths."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    # ----- fetch_guide -----
    # Requires the URL/path of the guide to fetch.
    {
        "name": "fetch_guide",
        "description": (
            "Fetch the full text of a specific tax guide to understand "
            "deduction rules, thresholds, and filing requirements."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Path or URL of the guide (from list_guides).",
                },
            },
            "required": ["url"],
        },
    },
    # ----- ask_user -----
    # The agent asks the simulated taxpayer a question.
    # Important: unnecessary questions are penalized during grading!
    {
        "name": "ask_user",
        "description": (
            "Ask the simulated taxpayer a question. Use sparingly — "
            "unnecessary questions (answers already in documents) are penalized."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The question to ask the taxpayer.",
                },
            },
            "required": ["question"],
        },
    },
]


# ===================================================================
# Build and run the MCP protocol server
# ===================================================================

def create_mcp_app(mcp_server: MCPServer) -> Server:
    """Create an ``mcp.server.Server`` wired to the given MCPServer instance.

    This function registers two JSON-RPC handlers on the MCP ``Server``:

    1. ``tools/list`` -- returns the list of available tools and their schemas
       so the AI client knows what it can call.
    2. ``tools/call`` -- dispatches an incoming tool call to the appropriate
       ``MCPServer`` method and returns the result as JSON text.

    Parameters
    ----------
    mcp_server : MCPServer
        The fully initialized MCPServer that will actually execute tool calls.

    Returns
    -------
    Server
        A configured ``mcp.server.Server`` ready to be run.
    """

    # "agentekki-tax" is the server name shown to clients during initialization
    app = Server("agentekki-tax")

    # Register the tools/list handler using the @app.list_tools() decorator.
    # When a client sends a "tools/list" request, this function is called and
    # returns the list of Tool objects built from our TOOL_SCHEMAS.
    @app.list_tools()
    async def list_tools() -> list[Tool]:
        """Return all available tools and their JSON schemas to the MCP client."""
        return [
            Tool(
                name=s["name"],
                description=s["description"],
                inputSchema=s["inputSchema"],
            )
            for s in TOOL_SCHEMAS
        ]

    # Register the tools/call handler.  When a client sends a "tools/call"
    # request with a tool name and arguments, this function executes the tool
    # and returns the result.
    @app.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        """Execute a tool call and return the result as JSON text.

        Because MCPServer methods are synchronous (blocking) and the MCP
        protocol server is asynchronous, we use ``asyncio.to_thread()`` to
        run the synchronous call in a separate thread.  This prevents the
        server from freezing while a tool is executing.
        """
        # Dispatch to the synchronous MCPServer.execute() in a worker thread
        result = await asyncio.to_thread(_call_sync, mcp_server, name, arguments)
        # Wrap the result in a TextContent object (MCP protocol requirement)
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, default=str))]

    return app


def _call_sync(server: MCPServer, tool_name: str, args: dict) -> Any:
    """Thin wrapper that calls the synchronous MCPServer.execute() method.

    This exists as a standalone function (rather than a lambda) so that
    ``asyncio.to_thread()`` can call it cleanly.

    Parameters
    ----------
    server : MCPServer
        The server instance to call.
    tool_name : str
        Which tool to execute (e.g. ``"fill_field"``).
    args : dict
        The arguments to pass to the tool.

    Returns
    -------
    Any
        The tool's return value (usually a dict).
    """
    return server.execute({"tool": tool_name, "args": args})


async def run_protocol_server(
    persona_folder: str,
    bridge: BrowserBridge | None = None,
    guides_folder: str | None = None,
    ask_user_fn=None,
):
    """Start the MCP JSON-RPC server over stdio and run until the client disconnects.

    This is the top-level async function called from ``__main__.py``.  It:

    1. Creates an ``MCPServer`` with the given configuration.
    2. Wraps it in an MCP protocol ``Server`` (via ``create_mcp_app``).
    3. Opens a stdio transport (reads JSON-RPC from stdin, writes to stdout).
    4. Runs the server's main loop until the client closes the connection.

    Parameters
    ----------
    persona_folder : str
        Path to the persona's document folder.
    bridge : BrowserBridge | None
        Browser bridge to use (defaults to MockBridge).
    guides_folder : str | None
        Path to the tax guides folder.
    ask_user_fn : callable | None
        Custom ask_user implementation.
    """
    # Create the core MCPServer that knows how to execute all 9 tools
    mcp_server = MCPServer(
        persona_folder=persona_folder,
        bridge=bridge,
        guides_folder=guides_folder,
        ask_user_fn=ask_user_fn,
    )

    # Wrap it in the MCP protocol server (adds JSON-RPC handling)
    app = create_mcp_app(mcp_server)

    # Open the stdio transport and run the server.
    # stdio_server() is a context manager that sets up stdin/stdout streams
    # for reading and writing JSON-RPC messages.
    async with stdio_server() as (read_stream, write_stream):
        logger.info("MCP protocol server running over stdio...")
        # app.run() blocks here, processing requests until the client disconnects.
        # create_initialization_options() provides the server's capabilities
        # (name, version, supported features) that are sent during the MCP
        # initialization handshake.
        await app.run(read_stream, write_stream, app.create_initialization_options())
