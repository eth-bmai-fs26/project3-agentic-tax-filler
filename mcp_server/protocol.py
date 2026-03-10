"""MCP JSON-RPC server — proper Model Context Protocol over stdio.

This makes the AgenTekki tools available to any MCP client:
Claude Code, Gemini CLI, Cursor, etc.

Usage:
    python -m mcp_server --persona personas/anna_meier --bridge mock
"""

import asyncio
import json
import logging
from typing import Any

from mcp.server import Server  # type: ignore
from mcp.server.stdio import stdio_server  # type: ignore
from mcp.types import TextContent, Tool  # type: ignore

from .server import MCPServer
from .bridges.base import BrowserBridge

logger = logging.getLogger("mcp_server.protocol")

# -------------------------------------------------------------------
# Tool schemas (JSON Schema for each tool's parameters)
# -------------------------------------------------------------------

TOOL_SCHEMAS: list[dict] = [
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


# -------------------------------------------------------------------
# Build and run the MCP protocol server
# -------------------------------------------------------------------

def create_mcp_app(mcp_server: MCPServer) -> Server:
    """Create a ``mcp.server.Server`` wired to the given MCPServer instance."""

    app = Server("agentekki-tax")

    @app.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name=s["name"],
                description=s["description"],
                inputSchema=s["inputSchema"],
            )
            for s in TOOL_SCHEMAS
        ]

    @app.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        # Dispatch to the sync MCPServer method in a thread
        result = await asyncio.to_thread(_call_sync, mcp_server, name, arguments)
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, default=str))]

    return app


def _call_sync(server: MCPServer, tool_name: str, args: dict) -> Any:
    """Call the sync MCPServer tool method."""
    return server.execute({"tool": tool_name, "args": args})


async def run_protocol_server(
    persona_folder: str,
    bridge: BrowserBridge | None = None,
    guides_folder: str | None = None,
    ask_user_fn=None,
):
    """Start the MCP JSON-RPC server over stdio."""
    mcp_server = MCPServer(
        persona_folder=persona_folder,
        bridge=bridge,
        guides_folder=guides_folder,
        ask_user_fn=ask_user_fn,
    )

    app = create_mcp_app(mcp_server)

    async with stdio_server() as (read_stream, write_stream):
        logger.info("MCP protocol server running over stdio…")
        await app.run(read_stream, write_stream, app.create_initialization_options())
