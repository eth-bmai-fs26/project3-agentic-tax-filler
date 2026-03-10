"""Colab JS bridge — calls window.TaxPortal.* via eval_js()."""

import json
import logging
from typing import Any

from .base import BrowserBridge

logger = logging.getLogger("mcp_server.bridges.colab")


class ColabBridge(BrowserBridge):
    """Bridge to a frontend rendered in a Google Colab cell output.

    The frontend must expose ``window.TaxPortal`` with four JS methods
    (scanPage, fillField, clickElement, submitForm) that each return a
    JSON string.
    """

    def __init__(self):
        self._colab_available = False
        try:
            from google.colab import output as _colab_output  # type: ignore
            self._eval_js = _colab_output.eval_js
            self._colab_available = True
            logger.info("Colab runtime detected — JS bridge active.")
        except ImportError:
            raise RuntimeError(
                "ColabBridge requires a Google Colab runtime. "
                "Use MockBridge or PlaywrightBridge outside Colab."
            )

    # -- BrowserBridge implementation ------------------------------------

    @property
    def is_available(self) -> bool:
        return self._colab_available

    def scan_page(self) -> dict:
        return self._call("JSON.stringify(window.TaxPortal.scanPage())")

    def fill_field(self, locator: str, value: Any) -> dict:
        value_json = json.dumps(value, ensure_ascii=False)
        return self._call(
            f"JSON.stringify(window.TaxPortal.fillField("
            f"{json.dumps(locator)}, {value_json}))"
        )

    def click_element(self, locator: str) -> dict:
        return self._call(
            f"JSON.stringify(window.TaxPortal.clickElement("
            f"{json.dumps(locator)}))"
        )

    def submit_form(self) -> dict:
        return self._call("JSON.stringify(window.TaxPortal.submitForm())")

    # -- internal --------------------------------------------------------

    def _call(self, js_expression: str) -> Any:
        raw = self._eval_js(js_expression)
        if raw is None:
            return None
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw
        return raw
