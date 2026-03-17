"""Playwright bridge — drives a real browser against the ZHprivateTax simulator."""

import json
import logging
from typing import Any

from .base import BrowserBridge

logger = logging.getLogger("mcp_server.bridges.playwright")


class PlaywrightBridge(BrowserBridge):
    """Bridge that automates a real browser using Playwright.

    Parameters
    ----------
    url : str
        URL of the ZHprivateTax simulator (e.g. ``http://localhost:3000``).
    headless : bool
        Run the browser in headless mode (default True).
    browser_type : str
        ``"chromium"``, ``"firefox"``, or ``"webkit"``.
    """

    def __init__(
        self,
        url: str = "http://localhost:3000",
        headless: bool = True,
        browser_type: str = "chromium",
    ):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise ImportError(
                "PlaywrightBridge requires the 'playwright' package.\n"
                "  pip install playwright && playwright install chromium"
            )

        self._url = url
        self._pw = sync_playwright().start()
        launcher = getattr(self._pw, browser_type)
        self._browser = launcher.launch(headless=headless)
        self._page = self._browser.new_page()
        self._page.goto(url, wait_until="networkidle")
        logger.info("PlaywrightBridge: opened %s (headless=%s)", url, headless)

    # -- BrowserBridge implementation ------------------------------------

    @property
    def is_available(self) -> bool:
        return not self._browser.is_connected() is False

    def scan_page(self) -> dict:
        """Query the DOM for the current page's inputs, buttons, and text."""
        # If the frontend exposes window.TaxPortal, prefer it
        has_api = self._page.evaluate("typeof window.TaxPortal !== 'undefined'")
        if has_api:
            raw = self._page.evaluate("JSON.stringify(window.TaxPortal.scanPage())")
            return json.loads(raw) if isinstance(raw, str) else raw

        # Fallback: scrape the DOM generically
        return self._scrape_page()

    def fill_field(self, locator: str, value: Any) -> dict:
        # Prefer the JS API if available
        has_api = self._page.evaluate("typeof window.TaxPortal !== 'undefined'")
        if has_api:
            raw = self._page.evaluate(
                "JSON.stringify(window.TaxPortal.fillField(arguments[0], arguments[1]))",
                locator, value,
            )
            return json.loads(raw) if isinstance(raw, str) else raw

        # Fallback: direct Playwright interaction
        return self._pw_fill_field(locator, value)

    def click_element(self, locator: str) -> dict:
        has_api = self._page.evaluate("typeof window.TaxPortal !== 'undefined'")
        if has_api:
            raw = self._page.evaluate(
                "JSON.stringify(window.TaxPortal.clickElement(arguments[0]))",
                locator,
            )
            return json.loads(raw) if isinstance(raw, str) else raw

        return self._pw_click_element(locator)

    def submit_form(self) -> dict:
        has_api = self._page.evaluate("typeof window.TaxPortal !== 'undefined'")
        if has_api:
            raw = self._page.evaluate("JSON.stringify(window.TaxPortal.submitForm())")
            return json.loads(raw) if isinstance(raw, str) else raw

        return self._pw_submit_form()

    def notify_ask_user(self, question: str, answer: str) -> None:
        """Push an ask_user exchange to the frontend popup via Playwright.

        Calls ``window.TaxPortal.notifyAskUser(question, answer)`` in the
        browser page if the method is available.
        """
        try:
            self._page.evaluate(
                """([q, a]) => {
                    if (window.TaxPortal && typeof window.TaxPortal.notifyAskUser === 'function') {
                        window.TaxPortal.notifyAskUser(q, a);
                    }
                }""",
                [question, answer],
            )
        except Exception as exc:
            logger.warning("notify_ask_user playwright evaluate failed: %s", exc)

    def close(self):
        self._browser.close()
        self._pw.stop()
        logger.info("PlaywrightBridge: browser closed.")

    # -------------------------------------------------------------------
    # Fallback DOM scraping (when window.TaxPortal is absent)
    # -------------------------------------------------------------------

    def _scrape_page(self) -> dict:
        """Build the scan_page result by querying the live DOM."""
        page_name = self._page.evaluate("""
            (() => {
                const active = document.querySelector('[data-page].active, [data-page][aria-current]');
                if (active) return active.dataset.page;
                // Heuristic: derive from URL hash or title
                const hash = window.location.hash.replace('#', '').replace('/', '');
                return hash || document.title || 'unknown';
            })()
        """)

        elements = self._page.evaluate("""
            (() => {
                const els = [];
                document.querySelectorAll('input, select, textarea, button, [data-text]').forEach(el => {
                    const tag = el.tagName.toLowerCase();
                    const id = el.id || el.getAttribute('name') || '';
                    const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
                    const label = labelEl ? labelEl.textContent.trim()
                                 : el.getAttribute('aria-label')
                                 || el.getAttribute('placeholder') || '';

                    if (tag === 'button' || (tag === 'input' && el.type === 'submit')) {
                        els.push({type: 'button', locator: id, label: el.textContent.trim() || el.value || ''});
                    } else if (tag === 'select') {
                        els.push({
                            type: 'select', locator: id, label,
                            options: [...el.options].map(o => o.value),
                            value: el.value, required: el.required,
                        });
                    } else if (tag === 'textarea' || tag === 'input') {
                        els.push({
                            type: 'input', locator: id, label,
                            value: el.value, required: el.required,
                        });
                    } else {
                        els.push({type: 'text', content: el.textContent.trim()});
                    }
                });
                return els;
            })()
        """)

        errors = self._page.evaluate("""
            (() => {
                const errs = [];
                document.querySelectorAll('.error, .validation-error, [role="alert"]').forEach(el => {
                    const fieldId = el.dataset.field || el.closest('[data-field]')?.dataset.field || '';
                    errs.push({field_id: fieldId, message: el.textContent.trim()});
                });
                return errs;
            })()
        """)

        return {
            "page_name": page_name,
            "validation_errors": errors,
            "elements": elements,
        }

    def _pw_fill_field(self, locator: str, value: Any) -> dict:
        """Fill a field via Playwright selectors."""
        selector = f"#{locator}" if not locator.startswith("#") else locator
        try:
            el = self._page.locator(selector)
            tag = el.evaluate("e => e.tagName.toLowerCase()")

            if tag == "select":
                el.select_option(str(value))
            else:
                el.fill(str(value))

            # Check for triggered changes (new elements appearing)
            self._page.wait_for_timeout(200)

            return {
                "success": True,
                "field_id": locator,
                "value_set": value,
                "error": None,
                "triggered_changes": [],
            }
        except Exception as exc:
            return {
                "success": False,
                "field_id": locator,
                "value_set": None,
                "error": str(exc),
                "triggered_changes": [],
            }

    def _pw_click_element(self, locator: str) -> dict:
        """Click an element via Playwright selectors."""
        selector = f"#{locator}" if not locator.startswith("#") else locator
        try:
            self._page.locator(selector).click()
            self._page.wait_for_load_state("networkidle")

            new_page = self._page.evaluate("""
                (() => {
                    const active = document.querySelector('[data-page].active, [data-page][aria-current]');
                    return active ? active.dataset.page : null;
                })()
            """)

            return {
                "success": True,
                "locator": locator,
                "action": "navigate" if new_page else "click",
                "new_page": new_page,
            }
        except Exception as exc:
            return {
                "success": False,
                "locator": locator,
                "action": "error",
                "new_page": None,
                "error": str(exc),
            }

    def _pw_submit_form(self) -> dict:
        """Click the submit button and collect the exported JSON."""
        try:
            # Try the standard submit button
            btn = self._page.locator("#btn-submit, button[type='submit'], [data-action='submit']")
            btn.first.click()
            self._page.wait_for_timeout(500)

            # Try to grab the submission JSON from the page
            has_json = self._page.evaluate(
                "typeof window.__submissionResult !== 'undefined'"
            )
            if has_json:
                result = self._page.evaluate("window.__submissionResult")
                return result if isinstance(result, dict) else json.loads(result)

            # Fallback: scrape all fields
            fields = self._page.evaluate("""
                (() => {
                    const data = {};
                    document.querySelectorAll('input, select, textarea').forEach(el => {
                        if (el.id) data[el.id] = el.value;
                    });
                    return data;
                })()
            """)
            return {
                "success": True,
                "submission_json": fields,
                "errors": [],
                "warnings": [],
            }
        except Exception as exc:
            return {
                "success": False,
                "submission_json": {},
                "errors": [{"field_id": "", "message": str(exc)}],
                "warnings": [],
            }
