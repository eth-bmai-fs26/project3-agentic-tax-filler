"""Mock bridge — for local testing without a browser or Colab."""

from typing import Any

from .base import BrowserBridge


class MockFrontend:
    """In-memory simulation of the 6-page ZHprivateTax form.

    Keeps a dict of field values and supports page navigation.
    Useful for unit tests and CI.
    """

    _PAGES = ["login", "personal", "income", "deductions", "wealth", "review"]

    def __init__(self):
        self.current_page: str = "login"
        self.fields: dict[str, Any] = {}
        self.validation_errors: list[dict] = []
        self._page_elements: dict[str, list[dict]] = _build_stub_elements()

    def scan_page(self) -> dict:
        return {
            "page_name": self.current_page,
            "validation_errors": list(self.validation_errors),
            "elements": self._page_elements.get(self.current_page, []),
        }

    def fill_field(self, locator: str, value: Any) -> dict:
        self.fields[locator] = value
        self.validation_errors = [
            e for e in self.validation_errors if e.get("field_id") != locator
        ]
        return {
            "success": True,
            "field_id": locator,
            "value_set": value,
            "error": None,
            "triggered_changes": [],
        }

    def click_element(self, locator: str) -> dict:
        # Handle login button — advance to personal page
        if locator == "btn-login":
            self.current_page = "personal"
            return {
                "success": True,
                "locator": locator,
                "action": "navigate",
                "new_page": "personal",
            }
        for page in self._PAGES:
            if locator == f"btn-nav-{page}":
                self.current_page = page
                return {
                    "success": True,
                    "locator": locator,
                    "action": "navigate",
                    "new_page": page,
                }
        return {"success": True, "locator": locator, "action": "click", "new_page": None}

    def submit_form(self) -> dict:
        return {
            "success": True,
            "submission_json": dict(self.fields),
            "errors": [],
            "warnings": [],
        }


class MockBridge(BrowserBridge):
    """Drop-in ``BrowserBridge`` backed by :class:`MockFrontend`."""

    def __init__(self, frontend: MockFrontend | None = None):
        self._fe = frontend or MockFrontend()

    @property
    def is_available(self) -> bool:
        return True

    @property
    def frontend(self) -> MockFrontend:
        """Access the underlying mock state (handy in tests)."""
        return self._fe

    def scan_page(self) -> dict:
        return self._fe.scan_page()

    def fill_field(self, locator: str, value: Any) -> dict:
        return self._fe.fill_field(locator, value)

    def click_element(self, locator: str) -> dict:
        return self._fe.click_element(locator)

    def submit_form(self) -> dict:
        return self._fe.submit_form()

    def notify_ask_user(self, question: str, answer: str) -> None:
        """No-op for mock bridge — just log to stdout."""
        print(f"[MockBridge] ask_user Q: {question}")
        print(f"[MockBridge] ask_user A: {answer}")


# -------------------------------------------------------------------
# Stub page elements — minimal structure matching the spec
# -------------------------------------------------------------------

def _build_stub_elements() -> dict[str, list[dict]]:
    return {
        "login": [
            {"type": "input", "locator": "field-login-username", "label": "Username", "value": "", "required": True},
            {"type": "input", "locator": "field-login-password", "label": "Password", "value": "", "required": True},
            {"type": "button", "locator": "btn-login", "label": "Login"},
        ],
        "personal": [
            {"type": "input", "locator": "field-personal-main-name", "label": "Full Name", "value": "", "required": True},
            {"type": "input", "locator": "field-personal-main-ahv", "label": "AHV Number", "value": "", "required": True},
            {"type": "input", "locator": "field-personal-main-address", "label": "Address", "value": "", "required": True},
            {"type": "input", "locator": "field-personal-main-dob", "label": "Date of Birth", "value": "", "required": True},
            {"type": "select", "locator": "field-personal-main-zivilstand", "label": "Marital Status",
             "options": ["ledig", "verheiratet", "geschieden", "getrennt", "verwitwet"], "value": "", "required": True},
            {"type": "input", "locator": "field-personal-main-beruf", "label": "Profession", "value": "", "required": False},
            {"type": "input", "locator": "field-personal-main-arbeitgeber", "label": "Employer", "value": "", "required": False},
            {"type": "button", "locator": "btn-nav-income", "label": "Continue to Income"},
        ],
        "income": [
            {"type": "text", "content": "Please declare your employment income here."},
            {"type": "input", "locator": "field-income-employment-bruttolohn", "label": "1. Gross Salary (CHF)", "value": "", "required": True},
            {"type": "input", "locator": "field-income-employment-ahvcontributions", "label": "AHV/IV/EO Contributions (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-employment-bvgcontributions", "label": "BVG Contributions (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-selfemployment-revenue", "label": "Self-Employment Revenue (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-selfemployment-expenses", "label": "Self-Employment Expenses (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-pension-ahv", "label": "AHV Pension (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-pension-bvg", "label": "BVG Pension (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-investment-dividends", "label": "Dividends (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-investment-interest", "label": "Interest Income (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-alimony-received", "label": "Alimony Received (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-other", "label": "Other Income (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-income-realestate-rental", "label": "Rental / Eigenmietwert (CHF)", "value": "", "required": False},
            {"type": "select", "locator": "field-income-canteen", "label": "Subsidized canteen available?",
             "options": ["Yes", "No"], "value": "No", "required": True},
            {"type": "button", "locator": "btn-nav-deductions", "label": "Continue to Deductions"},
        ],
        "deductions": [
            {"type": "select", "locator": "field-deductions-berufsauslagen-type", "label": "Professional Expenses Type",
             "options": ["pauschale", "effektiv"], "value": "pauschale", "required": True},
            {"type": "input", "locator": "field-deductions-berufsauslagen-amount", "label": "Professional Expenses Amount (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-fahrkosten-amount", "label": "Commuting Costs (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-verpflegung-amount", "label": "Meal Allowance (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-pillar3a-amount", "label": "Pillar 3a Contributions (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-insurance-amount", "label": "Insurance Premiums (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-debt-interest", "label": "Debt Interest (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-childcare-amount", "label": "Childcare Costs (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-education-amount", "label": "Further Education Costs (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-donations-amount", "label": "Charitable Donations (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-medical-amount", "label": "Medical Expenses (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-dualincome-amount", "label": "Dual-Income Deduction (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-property-maintenance", "label": "Property Maintenance (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-deductions-other", "label": "Other Deductions (CHF)", "value": "", "required": False},
            {"type": "button", "locator": "btn-nav-wealth", "label": "Continue to Wealth"},
        ],
        "wealth": [
            {"type": "input", "locator": "field-wealth-securities-table", "label": "Securities (JSON)", "value": "", "required": False},
            {"type": "input", "locator": "field-wealth-bank-accounts", "label": "Bank Accounts (JSON)", "value": "", "required": False},
            {"type": "input", "locator": "field-wealth-realestate-value", "label": "Real Estate Tax Value (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-wealth-other-assets", "label": "Other Assets (CHF)", "value": "", "required": False},
            {"type": "input", "locator": "field-wealth-debts", "label": "Debts (JSON)", "value": "", "required": False},
            {"type": "button", "locator": "btn-nav-review", "label": "Continue to Review"},
        ],
        "review": [
            {"type": "text", "content": "Please review all entries before submitting."},
            {"type": "button", "locator": "btn-submit", "label": "Submit Tax Return"},
        ],
    }
