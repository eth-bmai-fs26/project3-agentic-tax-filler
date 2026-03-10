"""Entry point: python -m mcp_server

Starts the MCP JSON-RPC server over stdio for use with
Claude Code, Gemini CLI, Cursor, or any MCP client.
"""

import argparse
import asyncio
import logging


def main():
    parser = argparse.ArgumentParser(
        description="AgenTekki MCP Server — Tax Agent Tools over stdio",
    )
    parser.add_argument(
        "--persona", required=True,
        help="Path to the persona folder (e.g. personas/anna_meier)",
    )
    parser.add_argument(
        "--bridge", choices=["mock", "playwright", "colab"], default="mock",
        help="Browser bridge to use (default: mock)",
    )
    parser.add_argument(
        "--url", default="http://localhost:3000",
        help="URL for PlaywrightBridge (default: http://localhost:3000)",
    )
    parser.add_argument(
        "--guides", default=None,
        help="Path to the tax guides folder (default: guides/)",
    )
    parser.add_argument(
        "--headless", action="store_true", default=True,
        help="Run Playwright in headless mode (default: True)",
    )
    parser.add_argument(
        "--no-headless", action="store_false", dest="headless",
        help="Run Playwright with a visible browser window",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(name)s] %(message)s",
    )

    # Build the bridge
    bridge = _make_bridge(args.bridge, args.url, args.headless)

    from .protocol import run_protocol_server
    asyncio.run(run_protocol_server(
        persona_folder=args.persona,
        bridge=bridge,
        guides_folder=args.guides,
    ))


def _make_bridge(bridge_type: str, url: str, headless: bool):
    if bridge_type == "mock":
        from .bridges.mock import MockBridge
        return MockBridge()

    if bridge_type == "playwright":
        from .bridges.playwright import PlaywrightBridge
        return PlaywrightBridge(url=url, headless=headless)

    if bridge_type == "colab":
        from .bridges.colab import ColabBridge
        return ColabBridge()

    raise ValueError(f"Unknown bridge type: {bridge_type}")


if __name__ == "__main__":
    main()
