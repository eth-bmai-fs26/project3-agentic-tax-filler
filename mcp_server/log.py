"""Interaction log — records every MCP tool call for scoring."""

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("mcp_server.log")


class InteractionLog:
    """Append-only log of every tool call, its arguments, and result."""

    def __init__(self):
        self.entries: list[dict] = []

    def record(self, tool: str, args: dict, result: Any, *, duration_ms: float = 0):
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tool": tool,
            "args": args,
            "result_summary": self._summarize(result),
            "duration_ms": round(duration_ms, 1),
        }
        self.entries.append(entry)
        logger.info("Tool call: %s(%s)", tool, args)

    def export(self) -> list[dict]:
        return list(self.entries)

    def save(self, path: str):
        with open(path, "w") as f:
            json.dump(self.entries, f, indent=2, ensure_ascii=False)
        logger.info("Interaction log saved to %s (%d entries)", path, len(self.entries))

    @staticmethod
    def _summarize(result: Any) -> str:
        if isinstance(result, dict):
            return json.dumps(result, ensure_ascii=False)[:500]
        if isinstance(result, list):
            return f"[list of {len(result)} items]"
        return str(result)[:500]
