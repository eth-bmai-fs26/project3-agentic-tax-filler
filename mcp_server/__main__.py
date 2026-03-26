"""CLI entry point for running the MCP server as a standalone process.

How to run
----------
From a terminal, execute::

    python -m mcp_server --persona personas/anna_meier --bridge mock

Python treats any package containing a ``__main__.py`` file as *runnable*.
When you type ``python -m mcp_server``, Python finds this file and calls it.

What this file does
-------------------
1. Parses command-line arguments (persona folder, bridge type, URL, etc.).
2. Sets up Python logging so you can see what is happening.
3. Creates the appropriate BrowserBridge object (Mock, Playwright, or Colab).
4. Starts the MCP JSON-RPC protocol server over *stdio* (standard input /
   standard output).  An MCP client such as Claude Code or Gemini CLI
   communicates with this server by reading/writing JSON messages on stdin
   and stdout.

Why it exists
-------------
This file allows the MCP server to run as its own process, separate from a
Jupyter / Colab notebook.  That is important when you want to use a desktop
MCP client (e.g. Claude Code, Cursor) instead of Colab.
"""

import argparse
import asyncio
import logging


def main():
    """Parse CLI arguments, build the bridge, and start the MCP protocol server.

    This is the top-level function that orchestrates everything.  It is called
    at the bottom of this file when the module is executed directly.
    """

    # -----------------------------------------------------------------------
    # 1. Define and parse command-line arguments using argparse.
    #    argparse is Python's built-in library for building friendly CLIs.
    # -----------------------------------------------------------------------
    parser = argparse.ArgumentParser(
        description="AgenTekki MCP Server -- Tax Agent Tools over stdio",
    )
    # --persona: required path to the folder containing the taxpayer's documents
    parser.add_argument(
        "--persona", required=True,
        help="Path to the persona folder (e.g. personas/anna_meier)",
    )
    # --bridge: which browser bridge implementation to use
    parser.add_argument(
        "--bridge", choices=["mock", "playwright", "colab"], default="mock",
        help="Browser bridge to use (default: mock)",
    )
    # --url: only relevant when using PlaywrightBridge (tells it where the web app is)
    parser.add_argument(
        "--url", default="http://localhost:3000",
        help="URL for PlaywrightBridge (default: http://localhost:3000)",
    )
    # --guides: optional path to the folder containing tax guide documents
    parser.add_argument(
        "--guides", default=None,
        help="Path to the tax guides folder (default: guides/)",
    )
    # --headless / --no-headless: controls whether the Playwright browser window
    # is visible on screen.  Headless = invisible (faster), no-headless = visible
    # (useful for debugging so you can watch the browser fill fields).
    parser.add_argument(
        "--headless", action="store_true", default=True,
        help="Run Playwright in headless mode (default: True)",
    )
    parser.add_argument(
        "--no-headless", action="store_false", dest="headless",
        help="Run Playwright with a visible browser window",
    )
    # --verbose / -v: when set, show detailed DEBUG-level log messages
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable verbose logging",
    )
    # Actually read the arguments the user passed on the command line
    args = parser.parse_args()

    # -----------------------------------------------------------------------
    # 2. Configure Python logging.
    #    DEBUG level prints everything; INFO level prints only key events.
    # -----------------------------------------------------------------------
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(name)s] %(message)s",
    )

    # -----------------------------------------------------------------------
    # 3. Build the correct BrowserBridge based on the --bridge argument.
    # -----------------------------------------------------------------------
    bridge = _make_bridge(args.bridge, args.url, args.headless)

    # -----------------------------------------------------------------------
    # 4. Import and run the MCP protocol server.
    #    asyncio.run() starts Python's async event loop, which is needed
    #    because the MCP protocol uses asynchronous I/O (reading/writing
    #    JSON messages on stdin/stdout without blocking).
    # -----------------------------------------------------------------------
    from .protocol import run_protocol_server
    asyncio.run(run_protocol_server(
        persona_folder=args.persona,
        bridge=bridge,
        guides_folder=args.guides,
    ))


def _make_bridge(bridge_type: str, url: str, headless: bool):
    """Factory function: create and return the right BrowserBridge instance.

    This uses *lazy imports* -- the bridge class is only imported when it is
    actually needed.  That way, if you pick ``mock``, you do not need the
    ``playwright`` or ``google.colab`` packages installed at all.

    Parameters
    ----------
    bridge_type : str
        One of ``"mock"``, ``"playwright"``, or ``"colab"``.
    url : str
        The URL of the tax form web application (only used by PlaywrightBridge).
    headless : bool
        Whether to run the Playwright browser without a visible window.

    Returns
    -------
    BrowserBridge
        An instance of the requested bridge.

    Raises
    ------
    ValueError
        If ``bridge_type`` is not one of the known options.
    """
    if bridge_type == "mock":
        # MockBridge runs entirely in memory -- no real browser needed.
        from .bridges.mock import MockBridge
        return MockBridge()

    if bridge_type == "playwright":
        # PlaywrightBridge launches a real Chromium browser and automates it.
        from .bridges.playwright import PlaywrightBridge
        return PlaywrightBridge(url=url, headless=headless)

    if bridge_type == "colab":
        # ColabBridge communicates with a frontend rendered inside a Colab
        # notebook cell via JavaScript evaluation.
        from .bridges.colab import ColabBridge
        return ColabBridge()

    raise ValueError(f"Unknown bridge type: {bridge_type}")


# ---------------------------------------------------------------------------
# When this module is executed directly (python -m mcp_server), call main().
# The ``if __name__ == "__main__"`` guard ensures main() is NOT called when
# this file is merely imported by another module.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    main()
