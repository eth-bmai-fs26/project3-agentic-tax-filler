"""Interaction log -- records every MCP tool call for scoring and grading.

Every time the agent calls a tool (``scan_page``, ``fill_field``,
``ask_user``, etc.), the call is recorded in an ``InteractionLog``.  After
the agent finishes, the log is saved to ``interaction_log.json`` inside the
persona folder.  The grading system reads this file to evaluate the agent's
performance (e.g., penalizing unnecessary ``ask_user`` calls, rewarding
correct ``fill_field`` values).

Why it exists
-------------
Without a log, there would be no way to score or debug the agent's behavior
after the fact.  The log provides a complete, time-stamped audit trail of
every decision the agent made.

How it fits into the architecture
---------------------------------
::

    MCPServer  --(every tool call)-->  InteractionLog
                                            |
                                       save() --> interaction_log.json
                                            |
                                       Grading system reads it
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

# Logger scoped to this module
logger = logging.getLogger("mcp_server.log")


class InteractionLog:
    """Append-only log of every tool call, its arguments, and result.

    This class is intentionally simple: it is just a list of dictionaries
    that grows as the agent runs.  Each dictionary (one per tool call) is
    called an "entry" and contains:

    - ``timestamp``: when the call happened (UTC ISO-8601 format)
    - ``tool``: which tool was called (e.g. ``"fill_field"``)
    - ``args``: the arguments passed to the tool
    - ``result_summary``: a shortened version of the tool's return value
    - ``duration_ms``: how many milliseconds the call took

    The log is *append-only* -- entries are never modified or deleted.
    """

    def __init__(self):
        """Initialize an empty log with no entries."""
        self.entries: list[dict] = []

    def record(self, tool: str, args: dict, result: Any, *, duration_ms: float = 0):
        """Record a single tool call in the log.

        This method is called by every tool method in ``MCPServer`` right
        after the tool finishes executing.

        Parameters
        ----------
        tool : str
            Name of the tool that was called (e.g. ``"scan_page"``).
        args : dict
            The arguments that were passed to the tool.
        result : Any
            The raw return value of the tool call.  This is summarized
            (truncated) before storage to keep log files manageable.
        duration_ms : float
            How long the tool call took, in milliseconds.
        """
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tool": tool,
            "args": args,
            # Store a shortened version of the result (max 500 chars) to
            # prevent the log file from becoming excessively large
            "result_summary": self._summarize(result),
            "duration_ms": round(duration_ms, 1),
        }
        self.entries.append(entry)
        logger.info("Tool call: %s(%s)", tool, args)

    def export(self) -> list[dict]:
        """Return a copy of all log entries as a list of dicts.

        Returns a *copy* (not the original list) so that callers cannot
        accidentally modify the internal log.

        Returns
        -------
        list[dict]
            A shallow copy of the entries list.
        """
        return list(self.entries)

    def save(self, path: str):
        """Write the entire log to a JSON file on disk.

        Parameters
        ----------
        path : str
            File path where the JSON should be written (e.g.
            ``"personas/anna_meier/interaction_log.json"``).
        """
        with open(path, "w") as f:
            json.dump(self.entries, f, indent=2, ensure_ascii=False)
        logger.info("Interaction log saved to %s (%d entries)", path, len(self.entries))

    @staticmethod
    def _summarize(result: Any) -> str:
        """Create a short string representation of a tool result.

        Large results (e.g., the full content of a document) are truncated
        to 500 characters so the log stays readable.

        Parameters
        ----------
        result : Any
            The raw return value from a tool call.

        Returns
        -------
        str
            A string no longer than 500 characters summarizing the result.
        """
        if isinstance(result, dict):
            # Convert dict to JSON string and truncate to 500 chars
            return json.dumps(result, ensure_ascii=False)[:500]
        if isinstance(result, list):
            # For lists, just report how many items there are
            return f"[list of {len(result)} items]"
        # For anything else (str, int, etc.), convert to string and truncate
        return str(result)[:500]
