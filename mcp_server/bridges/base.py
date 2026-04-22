"""Abstract browser bridge interface.

Every bridge (Colab, Playwright, Mock) implements these four methods
so that MCPServer is transport-agnostic.
"""

from abc import ABC, abstractmethod
from typing import Any


class BrowserBridge(ABC):
    """Contract between the MCP tool layer and the browser/frontend."""

    @abstractmethod
    def scan_page(self) -> dict:
        """Return a structured representation of the current page.

        Returns
        -------
        dict with keys:
            page_name : str
            validation_errors : list[dict]   — [{field_id, message}]
            elements : list[dict]            — [{type, locator?, label?, value?, …}]
        """

    @abstractmethod
    def fill_field(self, locator: str, value: Any) -> dict:
        """Set a value on a form field.

        Returns
        -------
        dict with keys:
            success : bool
            field_id : str
            value_set : any
            error : str | None
            triggered_changes : list[str]
        """

    @abstractmethod
    def click_element(self, locator: str) -> dict:
        """Click a button or link.

        Returns
        -------
        dict with keys:
            success : bool
            locator : str
            action : "navigate" | "click"
            new_page : str | None
        """

    @abstractmethod
    def submit_form(self) -> dict:
        """Submit the tax return.

        Returns
        -------
        dict with keys:
            success : bool
            submission_json : dict
            errors : list[dict]
            warnings : list[dict]
        """

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """Whether the bridge is ready to accept commands."""

    def notify_ask_user(self, question: str, answer: str) -> None:
        """Display an ask_user conversation exchange in the frontend popup.

        Default implementation is a no-op.  Override in bridges that
        support a live frontend (ColabBridge, PlaywrightBridge).

        Parameters
        ----------
        question : str
            The question the main LLM posed to the taxpayer NPC.
        answer : str
            The NPC's answer to the question.
        """

    def close(self):
        """Release resources (browser, connections).  Override if needed."""
