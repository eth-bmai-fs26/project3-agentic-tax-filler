"""MCPServer -- the core class that exposes all 9 MCP tools.

This is the most important file in the package.  ``MCPServer`` is the single
class that the rest of the system (agent loop, protocol layer, Colab
notebooks) interacts with.  It provides exactly **9 tools**:

Browser / UI tools (delegate to a BrowserBridge):
    1. ``scan_page``      -- see what is on the current form page
    2. ``fill_field``     -- enter a value into a form field
    3. ``click_element``  -- click a button or navigation link
    4. ``submit_form``    -- submit the completed tax return

Document / knowledge tools (read files from disk):
    5. ``list_documents`` -- list files in the persona folder
    6. ``read_document``  -- read and parse a specific file
    7. ``list_guides``    -- list available tax guide topics
    8. ``fetch_guide``    -- read the full text of a tax guide

Human-in-the-loop tool:
    9. ``ask_user``       -- ask the simulated taxpayer a question

The class is **bridge-agnostic**: it works identically with ColabBridge
(Google Colab), PlaywrightBridge (real browser), or MockBridge (in-memory
testing).  The bridge is injected via the constructor.

How it fits into the architecture
---------------------------------
::

    Agent loop / Protocol layer
          |
      MCPServer.execute(action)   <-- this file
          |
      dispatches to one of the 9 tool methods
          |
      BrowserBridge (for UI tools)  /  filesystem (for document tools)
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

# Logger scoped to this module
logger = logging.getLogger("mcp_server.server")


class MCPServer:
    """MCP tool server for AgenTekki.

    This class is the heart of the MCP server.  It holds references to:
    - the persona's document folder (where taxpayer files live)
    - the guides folder (where tax instruction documents live)
    - a BrowserBridge (for interacting with the tax form UI)
    - an ask_user function (for simulating taxpayer answers)
    - an InteractionLog (for recording every tool call)

    Parameters
    ----------
    persona_folder : str
        Path to the persona's document folder (e.g. ``"personas/anna_meier"``).
        This folder should contain files like ``profile.json``,
        ``lohnausweis.txt``, ``bank_statement.csv``, etc.
    guides_folder : str | None
        Path to the tax guides folder.  Defaults to ``"guides/"``.
    bridge : BrowserBridge | None
        Browser bridge to use for form interaction.  If ``None``, a
        ``MockBridge()`` (in-memory fake) is created automatically.
    ask_user_fn : callable | None
        A custom function with signature
        ``(question: str, conversation_history: list) -> str``.
        If ``None``, a rule-based keyword matcher is used as a fallback.
    """

    # List of all 9 tool names that this server supports.
    # Used by execute() to validate incoming tool calls.
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
        """Initialize the MCPServer with all its dependencies."""
        # Convert string paths to Path objects for easier file manipulation
        self.persona_folder = Path(persona_folder)
        self.guides_folder = Path(guides_folder) if guides_folder else Path("guides")

        # Create a fresh interaction log to record every tool call
        self.log = InteractionLog()

        # Use the provided bridge, or fall back to an in-memory mock
        self._bridge = bridge or MockBridge()

        # Use the provided ask_user function, or fall back to keyword matching
        self._ask_user_fn = ask_user_fn or make_rule_based_ask_user(persona_folder)

        # Maintain conversation history for the ask_user tool so that the
        # simulated taxpayer can remember previous questions and answers.
        # Each entry is {"role": "user"|"assistant", "content": "..."}.
        self._user_conversation: list[dict] = []

        logger.info(
            "MCPServer ready -- persona=%s, bridge=%s",
            self.persona_folder,
            type(self._bridge).__name__,
        )

    # ===================================================================
    # Browser & UI Tools
    # ===================================================================
    # These four tools delegate to the BrowserBridge, which handles the
    # actual interaction with the tax form (whether it is a real browser,
    # a Colab cell, or an in-memory mock).

    def scan_page(self) -> dict:
        """Return a JSON representation of the current form page.

        The returned dictionary contains:
        - ``page_name``: which page the form is currently showing
          (e.g. ``"income"``, ``"deductions"``)
        - ``elements``: a list of all visible inputs, buttons, and text
          blocks, each with a ``locator`` the agent can use to interact
          with it
        - ``validation_errors``: any error messages currently displayed

        The agent should call this tool first to discover what fields
        exist and what their locators are, before calling ``fill_field``.

        Returns
        -------
        dict
            Page state with keys ``page_name``, ``elements``,
            ``validation_errors``.
        """
        # Record the start time so we can measure how long the call takes
        t0 = time.time()
        result = self._bridge.scan_page()
        # Log the tool call for scoring (duration is in milliseconds)
        self.log.record("scan_page", {}, result, duration_ms=_ms(t0))
        return result

    def fill_field(self, locator: str, value: Any) -> dict:
        """Enter a value into a form field identified by *locator*.

        Parameters
        ----------
        locator : str
            The field identifier from a previous ``scan_page()`` call
            (e.g. ``"field-income-employment-bruttolohn"``).
        value : Any
            The value to enter (string, number, or JSON string for
            complex fields like securities tables).

        Returns
        -------
        dict
            Result with keys ``success``, ``field_id``, ``value_set``,
            ``error``, ``triggered_changes``.
        """
        t0 = time.time()
        result = self._bridge.fill_field(locator, value)
        self.log.record("fill_field", {"locator": locator, "value": value}, result, duration_ms=_ms(t0))
        return result

    def click_element(self, locator: str) -> dict:
        """Click a button or link identified by *locator*.

        Typically used for page navigation (e.g. clicking
        ``"btn-nav-deductions"`` to move from the income page to the
        deductions page).

        Parameters
        ----------
        locator : str
            The element identifier from a previous ``scan_page()`` call.

        Returns
        -------
        dict
            Result with keys ``success``, ``locator``, ``action``
            (``"navigate"`` or ``"click"``), ``new_page``.
        """
        t0 = time.time()
        result = self._bridge.click_element(locator)
        self.log.record("click_element", {"locator": locator}, result, duration_ms=_ms(t0))
        return result

    def submit_form(self) -> dict:
        """Submit the completed tax return and save the resulting JSON.

        After a successful submission, the bridge returns a
        ``submission_json`` dict containing all filled field values.
        This method saves that JSON to ``submitted_return.json`` inside
        the persona folder so the grading system can score it.

        Returns
        -------
        dict
            Result with keys ``success``, ``submission_json``,
            ``errors``, ``warnings``.
        """
        t0 = time.time()
        result = self._bridge.submit_form()
        self.log.record("submit_form", {}, result, duration_ms=_ms(t0))

        # If submission was successful, save the exported JSON for grading
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
    # These tools give the agent access to the taxpayer's documents
    # (salary statements, bank records, etc.) and tax reference guides.

    def list_documents(self) -> list[str]:
        """List all files in the persona's document folder.

        Certain files are hidden from the agent because they contain
        answers or internal data that the agent should not see:
        - ``submitted_return.json`` (the agent's own output)
        - ``interaction_log.json`` (the scoring log)
        - ``private_notes.json`` (the NPC's secret knowledge)
        - ``ground_truth.json`` (the correct answers for grading)

        Returns
        -------
        list[str]
            Sorted list of filenames (not full paths).
        """
        t0 = time.time()
        # These files must NOT be exposed to the agent -- they contain
        # grading answers, internal logs, or NPC-only knowledge.
        _HIDDEN_FILES = {"submitted_return.json", "interaction_log.json", "private_notes.json", "ground_truth.json"}

        if not self.persona_folder.exists():
            result: list[str] = []
        else:
            # List all files in the folder, excluding hidden ones
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
        """Read and extract content from a document file.

        Supports the following file types:
        - ``.txt`` -- read as plain text
        - ``.csv`` -- read as text *and* parse into a list of row dicts
        - ``.json`` -- read as text *and* parse into a Python object
        - ``.pdf`` -- extract text using PyPDF2 or pdfplumber

        Parameters
        ----------
        filepath : str
            Filename relative to the persona folder (e.g.
            ``"lohnausweis.txt"``), or an absolute path.

        Returns
        -------
        dict
            A dictionary with:
            - ``filepath``: the original path string
            - ``type``: ``"text"``, ``"csv"``, ``"json"``, or ``"pdf"``
            - ``content``: the raw text content of the file
            - ``structured``: parsed data (list of dicts for CSV, parsed
              object for JSON, ``None`` otherwise)
            - ``error``: error message if the file was not found
        """
        t0 = time.time()
        path = Path(filepath)

        # If the path is relative, resolve it against the persona folder
        if not path.is_absolute():
            path = self.persona_folder / path

        # Handle file-not-found gracefully (return an error dict, don't crash)
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

        # Determine the file type from its extension
        suffix = path.suffix.lower()
        content = ""
        structured = None

        if suffix == ".csv":
            # CSV files get both raw text and structured (parsed) output.
            # csv.DictReader turns each row into a dict keyed by column headers.
            doc_type = "csv"
            raw = path.read_text(encoding="utf-8")
            content = raw
            structured = list(csv.DictReader(io.StringIO(raw)))

        elif suffix == ".pdf":
            # PDF files require a third-party library for text extraction
            doc_type = "pdf"
            content = _extract_pdf_text(path)

        elif suffix == ".json":
            # JSON files get both raw text and parsed Python object
            doc_type = "json"
            raw = path.read_text(encoding="utf-8")
            content = raw
            try:
                structured = json.loads(raw)
            except json.JSONDecodeError:
                pass  # If JSON is malformed, structured stays None

        else:
            # Everything else (.txt, .md, etc.) is treated as plain text
            doc_type = "text"
            content = path.read_text(encoding="utf-8")

        result = {"filepath": str(filepath), "type": doc_type, "content": content, "structured": structured}
        self.log.record("read_document", {"filepath": filepath}, result, duration_ms=_ms(t0))
        return result

    def list_guides(self) -> list[dict]:
        """Return a list of available tax guide topics and their file paths.

        Scans the guides folder for ``.html``, ``.txt``, and ``.md`` files
        and returns metadata about each one.

        Returns
        -------
        list[dict]
            Each dict has:
            - ``title``: human-readable title derived from the filename
            - ``url``: the file path (used by ``fetch_guide``)
            - ``topic``: the filename stem (without extension)
        """
        t0 = time.time()
        guides = []
        if self.guides_folder.exists():
            for f in sorted(self.guides_folder.iterdir()):
                if f.is_file() and f.suffix in (".html", ".txt", ".md"):
                    # Convert the filename stem into a human-readable title:
                    # "commuting_costs" -> "Commuting Costs"
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
        """Return the full text of a specific tax guide.

        Parameters
        ----------
        url : str
            The file path of the guide, as returned by ``list_guides()``.

        Returns
        -------
        dict
            A dictionary with:
            - ``url``: the original path
            - ``title``: human-readable title
            - ``content``: the full text of the guide
            - ``success``: whether the file was found and read
            - ``error``: error message if the file was not found
        """
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
        """Send a question to the simulated taxpayer and get an answer.

        This tool simulates asking the real person a question.  The answer
        comes from the ``_ask_user_fn`` (which may be a keyword matcher or
        an LLM role-playing as the taxpayer).

        The full conversation history is maintained in
        ``self._user_conversation`` so that multi-turn conversations work
        naturally (the simulated taxpayer remembers previous exchanges).

        Important for scoring: every call to this tool is logged.  Asking
        questions whose answers are already available in the documents
        will result in a penalty during grading.

        Parameters
        ----------
        question : str
            The question to ask the taxpayer (e.g. "Do you have a
            subsidized canteen at work?").

        Returns
        -------
        dict
            A dictionary with ``question``, ``answer``, and ``timestamp``.
        """
        t0 = time.time()
        # Call the ask_user function, passing the full conversation history
        # so the NPC can give context-aware answers
        answer = self._ask_user_fn(question, conversation_history=self._user_conversation)

        # Append both the question and answer to the conversation history.
        # Note: in this context, "user" = the tax agent asking, and
        # "assistant" = the simulated taxpayer answering.
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
    # Action dispatcher (used by the agent loop and protocol layer)
    # ===================================================================

    def execute(self, action: dict) -> Any:
        """Dispatch an action dict to the corresponding tool method.

        This is the single entry point used by both the agent loop
        (``agent.py``) and the protocol server (``protocol.py``).
        It takes an action dictionary and calls the right method.

        Parameters
        ----------
        action : dict
            Must contain:
            - ``"tool"``: name of the tool to call (e.g. ``"fill_field"``)
            - ``"args"``: dict of keyword arguments for that tool

        Returns
        -------
        Any
            The return value of the called tool method.

        Raises
        ------
        ValueError
            If the tool name is not in ``AVAILABLE_TOOLS``.

        Example
        -------
        ::

            server.execute({"tool": "fill_field", "args": {"locator": "field-income-employment-bruttolohn", "value": "85000"}})
        """
        tool_name = action.get("tool")
        args = action.get("args", {})
        # Validate that the requested tool exists
        if tool_name not in self.AVAILABLE_TOOLS:
            raise ValueError(f"Unknown tool: {tool_name!r}. Available: {self.AVAILABLE_TOOLS}")
        # Use Python's getattr to look up the method by name and call it.
        # For example, if tool_name is "fill_field", this is equivalent to:
        #     self.fill_field(**args)
        return getattr(self, tool_name)(**args)


# ===================================================================
# Helper functions (module-level, not part of the class)
# ===================================================================


def _ms(t0: float) -> float:
    """Convert an elapsed time (from ``time.time()``) to milliseconds.

    Parameters
    ----------
    t0 : float
        The start time, as returned by ``time.time()`` before the operation.

    Returns
    -------
    float
        Elapsed time in milliseconds.
    """
    return (time.time() - t0) * 1000


def _extract_pdf_text(path: Path) -> str:
    """Extract text from a PDF file, trying multiple libraries.

    This function tries two different PDF-reading libraries in order:
    1. **PyPDF2** -- a popular pure-Python PDF library
    2. **pdfplumber** -- another library with better table extraction

    If neither library is installed, or if both fail to extract text,
    an empty string is returned (and a warning is logged).

    Parameters
    ----------
    path : Path
        Path to the PDF file.

    Returns
    -------
    str
        The extracted text (pages separated by double newlines), or an
        empty string if extraction failed.
    """
    # --- Attempt 1: PyPDF2 ---
    try:
        import PyPDF2  # type: ignore

        with open(path, "rb") as f:
            # Read all pages and join their text with double newlines
            text = "\n\n".join(p.extract_text() or "" for p in PyPDF2.PdfReader(f).pages).strip()
        if text:
            return text
    except (ImportError, Exception):
        # PyPDF2 not installed, or extraction failed -- try the next library
        pass

    # --- Attempt 2: pdfplumber ---
    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(path) as pdf:
            text = "\n\n".join(p.extract_text() or "" for p in pdf.pages).strip()
        if text:
            return text
    except (ImportError, Exception):
        # pdfplumber not installed or failed too
        pass

    # Neither library worked
    logger.warning("Could not extract text from PDF: %s", path)
    return ""
