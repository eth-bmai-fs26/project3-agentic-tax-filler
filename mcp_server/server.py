"""MCPServer — the core class that exposes all 9 MCP tools.

Bridge-agnostic: works with ColabBridge, PlaywrightBridge, or MockBridge.
"""

import csv
import io
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .bridges.base import BrowserBridge
from .bridges.mock import MockBridge
from .log import InteractionLog
from .ask_user import make_rule_based_ask_user

logger = logging.getLogger("mcp_server.server")


class MCPServer:
    """MCP tool server for AgenTekki.

    Parameters
    ----------
    persona_folder : str
        Path to the persona's document folder.
    guides_folder : str | None
        Path to the tax guides folder.  Defaults to ``"guides/"``.
    bridge : BrowserBridge | None
        Browser bridge to use.  Defaults to ``MockBridge()`` if None.
    ask_user_fn : callable | None
        Custom ``(question, conversation_history) → str`` function.
        If None, a rule-based fallback is used.
    """

    AVAILABLE_TOOLS = [
        "scan_page",
        "fill_field",
        "click_element",
        "submit_form",
        "list_documents",
        "read_document",
        "list_guides",
        "fetch_guide",
        "ask_user",
    ]

    def __init__(
        self,
        persona_folder: str,
        guides_folder: str | None = None,
        bridge: BrowserBridge | None = None,
        ask_user_fn=None,
    ):
        self.persona_folder = Path(persona_folder)
        self.guides_folder = Path(guides_folder) if guides_folder else Path("guides")
        self.log = InteractionLog()

        self._bridge = bridge or MockBridge()
        self._ask_user_fn = ask_user_fn or make_rule_based_ask_user(persona_folder)
        self._user_conversation: list[dict] = []

        logger.info(
            "MCPServer ready — persona=%s, bridge=%s",
            self.persona_folder,
            type(self._bridge).__name__,
        )

    # ===================================================================
    # Browser & UI Tools
    # ===================================================================

    def scan_page(self) -> dict:
        """Return a JSON representation of the current page.

        Lists all visible inputs, buttons, text elements, and
        validation errors.  The agent uses this to discover which
        fields exist and what their locators are.
        """
        t0 = time.time()
        result = self._bridge.scan_page()
        self.log.record("scan_page", {}, result, duration_ms=_ms(t0))
        return result

    def fill_field(self, locator: str, value: Any) -> dict:
        """Enter a value into a form field identified by *locator*."""
        t0 = time.time()
        result = self._bridge.fill_field(locator, value)
        self.log.record("fill_field", {"locator": locator, "value": value}, result, duration_ms=_ms(t0))
        return result

    def click_element(self, locator: str) -> dict:
        """Click a button or link identified by *locator*."""
        t0 = time.time()
        result = self._bridge.click_element(locator)
        self.log.record("click_element", {"locator": locator}, result, duration_ms=_ms(t0))
        return result

    def submit_form(self) -> dict:
        """Submit the completed tax return and save the JSON export."""
        t0 = time.time()
        result = self._bridge.submit_form()
        self.log.record("submit_form", {}, result, duration_ms=_ms(t0))

        if isinstance(result, dict) and result.get("success"):
            out_path = self.persona_folder / "submitted_return.json"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w") as f:
                json.dump(result.get("submission_json", {}), f, indent=2, ensure_ascii=False)
            logger.info("Submission saved to %s", out_path)

        return result

    # ===================================================================
    # Document & Knowledge Tools
    # ===================================================================

    def list_documents(self) -> list[str]:
        """List all files in the persona's document folder."""
        t0 = time.time()
        # Files that must NOT be exposed to the main LLM
        _HIDDEN_FILES = {"submitted_return.json", "interaction_log.json", "private_notes.json"}

        if not self.persona_folder.exists():
            result: list[str] = []
        else:
            result = sorted(
                [
                    f.name
                    for f in self.persona_folder.iterdir()
                    if f.is_file() and f.name not in _HIDDEN_FILES
                ]
            )
        self.log.record("list_documents", {}, result, duration_ms=_ms(t0))
        return result

    def read_document(self, filepath: str) -> dict:
        """Read and extract content from a document (.txt, .csv, .pdf, .json)."""
        t0 = time.time()
        path = Path(filepath)
        if not path.is_absolute():
            path = self.persona_folder / path

        if not path.exists():
            result = {
                "filepath": str(filepath),
                "type": "unknown",
                "content": "",
                "structured": None,
                "error": f"File not found: {path}",
            }
            self.log.record("read_document", {"filepath": filepath}, result, duration_ms=_ms(t0))
            return result

        suffix = path.suffix.lower()
        content = ""
        structured = None

        if suffix == ".csv":
            doc_type = "csv"
            raw = path.read_text(encoding="utf-8")
            content = raw
            structured = list(csv.DictReader(io.StringIO(raw)))

        elif suffix == ".pdf":
            doc_type = "pdf"
            content = _extract_pdf_text(path)

        elif suffix == ".json":
            doc_type = "json"
            raw = path.read_text(encoding="utf-8")
            content = raw
            try:
                structured = json.loads(raw)
            except json.JSONDecodeError:
                pass

        else:
            doc_type = "text"
            content = path.read_text(encoding="utf-8")

        result = {"filepath": str(filepath), "type": doc_type, "content": content, "structured": structured}
        self.log.record("read_document", {"filepath": filepath}, result, duration_ms=_ms(t0))
        return result

    def list_guides(self) -> list[dict]:
        """Return a list of available tax guide topics and their paths."""
        t0 = time.time()
        guides = []
        if self.guides_folder.exists():
            for f in sorted(self.guides_folder.iterdir()):
                if f.is_file() and f.suffix in (".html", ".txt", ".md"):
                    guides.append(
                        {
                            "title": f.stem.replace("_", " ").replace("-", " ").title(),
                            "url": str(f),
                            "topic": f.stem,
                        }
                    )
        self.log.record("list_guides", {}, guides, duration_ms=_ms(t0))
        return guides

    def fetch_guide(self, url: str) -> dict:
        """Return the full text of a specific tax guide."""
        t0 = time.time()
        path = Path(url)
        if not path.exists():
            result = {"url": url, "title": "", "content": "", "success": False, "error": f"Guide not found: {url}"}
        else:
            result = {
                "url": url,
                "title": path.stem.replace("_", " ").replace("-", " ").title(),
                "content": path.read_text(encoding="utf-8"),
                "success": True,
            }
        self.log.record("fetch_guide", {"url": url}, result, duration_ms=_ms(t0))
        return result

    # ===================================================================
    # Human-in-the-Loop
    # ===================================================================

    def ask_user(self, question: str) -> dict:
        """Send a question to the simulated taxpayer.

        Every call is logged — unnecessary questions are penalized.
        """
        t0 = time.time()
        answer = self._ask_user_fn(question, conversation_history=self._user_conversation)
        self._user_conversation.append({"role": "user", "content": question})
        self._user_conversation.append({"role": "assistant", "content": answer})

        result = {
            "question": question,
            "answer": answer,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.log.record("ask_user", {"question": question}, result, duration_ms=_ms(t0))
        return result

    # ===================================================================
    # Action dispatcher (used by the agent loop)
    # ===================================================================

    def execute(self, action: dict) -> Any:
        """Dispatch ``{"tool": "...", "args": {...}}`` to the right method."""
        tool_name = action.get("tool")
        args = action.get("args", {})
        if tool_name not in self.AVAILABLE_TOOLS:
            raise ValueError(f"Unknown tool: {tool_name!r}. Available: {self.AVAILABLE_TOOLS}")
        return getattr(self, tool_name)(**args)


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------


def _ms(t0: float) -> float:
    return (time.time() - t0) * 1000


def _extract_pdf_text(path: Path) -> str:
    try:
        import PyPDF2  # type: ignore

        with open(path, "rb") as f:
            text = "\n\n".join(p.extract_text() or "" for p in PyPDF2.PdfReader(f).pages).strip()
        if text:
            return text
    except (ImportError, Exception):
        pass

    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(path) as pdf:
            text = "\n\n".join(p.extract_text() or "" for p in pdf.pages).strip()
        if text:
            return text
    except (ImportError, Exception):
        pass

    logger.warning("Could not extract text from PDF: %s", path)
    return ""
