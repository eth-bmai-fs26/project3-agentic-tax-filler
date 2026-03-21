"""
FlaskBridge — server-side BrowserBridge for Flask deployment.

Maintains form state as a Python dict (no browser DOM).
Navigation is index-based over PAGE_ORDER.
SSE events are emitted via an injected queue.Queue.
"""

import re
import threading
from copy import deepcopy
from typing import Any

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from mcp_server.bridges.base import BrowserBridge
from .form_model import (
    make_empty_form, ROW_TEMPLATES, PAGE_ORDER, LOCATOR_TO_PATH,
    PAGE_FIELD_DEFS, ROW_FIELD_DEFS,
)


# Known select field values → normalized form value
_SELECT_NORMALIZE: dict[str, dict[str, str]] = {
    "maritalstatus": {
        "single": "single", "ledig": "single",
        "married": "married", "verheiratet": "married",
        "divorced": "divorced", "geschieden": "divorced",
        "separated": "separated", "getrennt": "separated",
        "widowed": "widowed", "verwitwet": "widowed",
    },
    "religion": {
        "reformed": "reformed", "reformiert": "reformed",
        "roman catholic": "catholic", "catholic": "catholic", "katholisch": "catholic",
        "christ catholic": "christ-catholic", "christ-catholic": "christ-catholic",
        "christkatholisch": "christ-catholic",
        "orthodox": "orthodox", "orthodox christian": "orthodox",
        "none": "none", "keine": "none", "konfessionslos": "none",
        "other": "other", "andere": "other",
    },
}


class FlaskBridge(BrowserBridge):
    """Server-side BrowserBridge backed by an in-memory form state dict."""

    def __init__(self, sse_queue=None):
        self._form_data: dict = make_empty_form()
        self._page_index: int = 0
        self._lock = threading.Lock()
        self._sse_queue = sse_queue

    # ── BrowserBridge abstract properties ───────────────────────

    @property
    def is_available(self) -> bool:
        return True

    @property
    def current_page_name(self) -> str:
        if self._page_index < len(PAGE_ORDER):
            return PAGE_ORDER[self._page_index]
        return "review"

    # ── BrowserBridge abstract methods ──────────────────────────

    def scan_page(self) -> dict:
        page_name = self.current_page_name
        elements = self._build_elements_for_page(page_name)
        self._emit_sse({"type": "navigate", "to_page": page_name})
        return {
            "page_name": page_name,
            "validation_errors": [],
            "elements": elements,
        }

    def fill_field(self, locator: str, value: Any) -> dict:
        with self._lock:
            result = self._apply_fill(locator, value)
        if result.get("success"):
            self._emit_sse({
                "type": "fill_field",
                "locator": locator,
                "value": value,
                "page": self.current_page_name,
            })
        return result

    def click_element(self, locator: str) -> dict:
        prev_page = self.current_page_name

        if locator == "btn-next":
            if self._page_index < len(PAGE_ORDER) - 1:
                self._page_index += 1
            new_page = self.current_page_name
            self._emit_sse({"type": "navigate", "from_page": prev_page, "to_page": new_page})
            return {"success": True, "locator": locator, "action": "navigate", "new_page": new_page}

        if locator == "btn-prev":
            if self._page_index > 0:
                self._page_index -= 1
            new_page = self.current_page_name
            return {"success": True, "locator": locator, "action": "navigate", "new_page": new_page}

        if locator.startswith("btn-add-row-"):
            rest = locator.removeprefix("btn-add-row-")
            # Format: page-section  (e.g. wealth-bankaccounts, personal-children)
            # Need to handle multi-word sections, so split on first dash only if page matches
            parts = rest.split("-", 1)
            if len(parts) == 2:
                page_key, section_key = parts[0], parts[1]
                with self._lock:
                    self._add_row(page_key, section_key)
            return {"success": True, "locator": locator, "action": "add_row", "new_page": None}

        if locator == "btn-submit":
            return self.submit_form()

        # Sidebar/tab nav locators → jump to page
        nav_map = self._build_nav_map()
        if locator in nav_map:
            target = nav_map[locator]
            if target in PAGE_ORDER:
                self._page_index = PAGE_ORDER.index(target)
            new_page = self.current_page_name
            self._emit_sse({"type": "navigate", "from_page": prev_page, "to_page": new_page})
            return {"success": True, "locator": locator, "action": "navigate", "new_page": new_page}

        # Unknown locator — just return success (no-op)
        return {"success": True, "locator": locator, "action": "click", "new_page": None}

    def submit_form(self) -> dict:
        with self._lock:
            submission = deepcopy(self._form_data)
        self._emit_sse({"type": "agent_done", "score_percent": None})
        return {
            "success": True,
            "submission_json": submission,
            "errors": [],
            "warnings": [],
        }

    # ── Extra helpers for Flask routes ──────────────────────────

    def get_form_data(self) -> dict:
        with self._lock:
            data = deepcopy(self._form_data)
        data["_page_index"] = self._page_index
        data["_current_page"] = self.current_page_name
        return data

    def notify_ask_user(self, question: str, answer: str) -> None:
        self._emit_sse({"type": "ask_user", "question": question, "answer": answer})

    # ── Internal helpers ─────────────────────────────────────────

    def _emit_sse(self, event: dict) -> None:
        if self._sse_queue is not None:
            try:
                self._sse_queue.put_nowait(event)
            except Exception:
                pass

    def _apply_fill(self, locator: str, value: Any) -> dict:
        """Parse locator and write value into self._form_data."""
        if not locator.startswith("field-"):
            return {"success": False, "field_id": locator, "error": "Not a field locator",
                    "value_set": None, "triggered_changes": []}

        rest = locator.removeprefix("field-")
        parts = rest.split("-")

        # Try matching against LOCATOR_TO_PATH keys (longest prefix first)
        matched_key = None
        matched_page = None
        matched_section = None
        remainder = []

        for prefix, (pg, sec) in sorted(LOCATOR_TO_PATH.items(), key=lambda x: -len(x[0])):
            prefix_parts = prefix.split("-")
            if parts[:len(prefix_parts)] == prefix_parts:
                matched_key = prefix
                matched_page = pg
                matched_section = sec
                remainder = parts[len(prefix_parts):]
                break

        if not matched_key:
            return {"success": False, "field_id": locator,
                    "error": f"Unknown locator prefix in: {rest}",
                    "value_set": None, "triggered_changes": []}

        section_data = self._form_data[matched_page][matched_section]

        if isinstance(section_data, list):
            # Array field: remainder = [rowIdx, colKey...]
            if len(remainder) < 2:
                return {"success": False, "field_id": locator,
                        "error": "Array locator needs rowIdx and field",
                        "value_set": None, "triggered_changes": []}
            try:
                row_idx = int(remainder[0])
            except ValueError:
                return {"success": False, "field_id": locator,
                        "error": f"Invalid row index: {remainder[0]}",
                        "value_set": None, "triggered_changes": []}

            col_key = "-".join(remainder[1:])

            # Auto-extend array if needed
            template_fn = ROW_TEMPLATES.get(matched_page, {}).get(matched_section)
            while len(section_data) <= row_idx:
                section_data.append(template_fn() if template_fn else {})

            section_data[row_idx][col_key] = value

        else:
            # Scalar field
            field_name = "-".join(remainder)
            # Normalize select field values (LLM may send "Reformed" instead of "reformed")
            if field_name in _SELECT_NORMALIZE and isinstance(value, str):
                value = _SELECT_NORMALIZE[field_name].get(value.lower().strip(), value.lower().strip())
            if field_name in section_data:
                section_data[field_name] = value
            else:
                # Try case-insensitive match
                matched_field = None
                for k in section_data:
                    if k.lower() == field_name.lower():
                        matched_field = k
                        break
                if matched_field:
                    section_data[matched_field] = value
                else:
                    return {"success": False, "field_id": locator,
                            "error": f"Unknown field '{field_name}' in {matched_key}",
                            "value_set": None, "triggered_changes": []}

        return {"success": True, "field_id": locator, "value_set": value,
                "error": None, "triggered_changes": []}

    def _add_row(self, page_key: str, section_key: str) -> None:
        try:
            arr = self._form_data[page_key][section_key]
            template_fn = ROW_TEMPLATES.get(page_key, {}).get(section_key)
            if isinstance(arr, list) and template_fn:
                arr.append(template_fn())
        except (KeyError, TypeError):
            pass

    def _build_elements_for_page(self, page_name: str) -> list[dict]:
        """Build element list for scan_page() from static defs + current state."""
        static_defs = PAGE_FIELD_DEFS.get(page_name, [])
        elements = []

        for defn in static_defs:
            elem = dict(defn)
            locator = elem.get("locator", "")

            if locator and locator.startswith("field-"):
                # Inject current value from form_data
                result = self._get_value(locator)
                elem["value"] = result
            elements.append(elem)

        # For pages with dynamic array sections, inject existing row fields
        elements = self._inject_array_rows(page_name, elements)

        return elements

    def _get_value(self, locator: str) -> Any:
        """Read current value for a scalar field locator from form_data."""
        if not locator.startswith("field-"):
            return ""
        rest = locator.removeprefix("field-")
        parts = rest.split("-")

        for prefix, (pg, sec) in sorted(LOCATOR_TO_PATH.items(), key=lambda x: -len(x[0])):
            prefix_parts = prefix.split("-")
            if parts[:len(prefix_parts)] == prefix_parts:
                remainder = parts[len(prefix_parts):]
                section_data = self._form_data.get(pg, {}).get(sec, {})
                if isinstance(section_data, list):
                    # Array — should not be called for scalar get, return ""
                    return ""
                field_name = "-".join(remainder)
                return section_data.get(field_name, section_data.get(field_name.lower(), ""))
        return ""

    def _inject_array_rows(self, page_name: str, elements: list) -> list:
        """Add element descriptors for existing array rows into the elements list."""
        # Determine which array sections this page has
        array_sections = self._page_array_sections(page_name)

        for page_key, section_key in array_sections:
            arr = self._form_data.get(page_key, {}).get(section_key, [])
            if not arr:
                continue

            row_defs = ROW_FIELD_DEFS.get(page_key, {}).get(section_key, [])

            for row_idx, row_data in enumerate(arr):
                for field_def in row_defs:
                    fname = field_def["name"]
                    locator = f"field-{page_key}-{section_key}-{row_idx}-{fname}"
                    elements.append({
                        "type": field_def["type"],
                        "locator": locator,
                        "label": f"{field_def['label']} (row {row_idx})",
                        "value": row_data.get(fname, ""),
                        "required": False,
                    })

        return elements

    def _page_array_sections(self, page_name: str) -> list[tuple[str, str]]:
        """Return (page_key, section_key) pairs for array sections on this page."""
        mapping = {
            "personal": [("personal", "children"), ("personal", "supported"),
                         ("personal", "giftsreceived"), ("personal", "giftsgiven")],
            "personal/children": [("personal", "children")],
            "personal/supported": [("personal", "supported")],
            "personal/gifts-received": [("personal", "giftsreceived")],
            "personal/gifts-given": [("personal", "giftsgiven")],
            "wealth": [("wealth", "bankaccounts"), ("wealth", "securities")],
            "wealth/insurance": [("wealth", "insurances")],
            "wealth/vehicles": [("wealth", "vehicles")],
            "wealth/debts": [("wealth", "debts")],
            "deductions/professional": [("deductions", "effective")],
        }
        return mapping.get(page_name, [])

    @staticmethod
    def _build_nav_map() -> dict[str, str]:
        """Map sidebar/tab nav locators to PAGE_ORDER entries."""
        return {
            "tab-nav-form": "personal",
            "btn-login": "personal",
            "btn-nav-personal": "personal",
            "nav-personal": "personal",
            "nav-personal-children": "personal/children",
            "nav-personal-supported": "personal/supported",
            "nav-personal-representative": "personal/representative",
            "nav-personal-gifts-received": "personal/gifts-received",
            "nav-personal-gifts-given": "personal/gifts-given",
            "nav-personal-capital-benefits": "personal/capital-benefits",
            "nav-personal-bank-details": "personal/bank-details",
            "nav-income": "income",
            "btn-nav-income": "income",
            "nav-income-pensions": "income/pensions",
            "nav-income-securities": "income/securities-income",
            "nav-income-property": "income/property-income",
            "nav-income-other": "income/other",
            "nav-deductions": "deductions",
            "btn-nav-deductions": "deductions",
            "nav-deductions-professional": "deductions/professional",
            "nav-deductions-debt": "deductions/debt-interest",
            "nav-deductions-alimony": "deductions/alimony",
            "nav-deductions-insurance": "deductions/insurance",
            "nav-deductions-medical": "deductions/medical",
            "nav-deductions-other": "deductions/other",
            "nav-wealth": "wealth",
            "btn-nav-wealth": "wealth",
            "nav-wealth-movable": "wealth/movable",
            "nav-wealth-insurance": "wealth/insurance",
            "nav-wealth-vehicles": "wealth/vehicles",
            "nav-wealth-realestate": "wealth/real-estate",
            "nav-wealth-debts": "wealth/debts",
            "nav-attachments": "attachments",
            "btn-nav-attachments": "attachments",
            "nav-review": "review",
            "btn-nav-review": "review",
        }
