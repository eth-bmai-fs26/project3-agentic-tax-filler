"""
Form data model — mirrors EnvDemoV1/src/context/FormContext.tsx initialFormData exactly.
"""

from copy import deepcopy


def make_empty_form() -> dict:
    """Return a fresh empty form matching React's initialFormData."""
    return {
        "login": {"auth": {"ahvnumber": "", "zugangscode": ""}},
        "personal": {
            "main": {
                "firstName": "", "lastName": "", "dateofbirth": "",
                "street": "", "streetNumber": "", "apartment": "",
                "zip": "", "city": "", "phone": "", "email": "",
                "ahvnumber": "", "maritalstatus": "", "religion": "",
                "occupation": "", "employer": "", "workplace": "",
            },
            "partner": {
                "firstName": "", "lastName": "", "dateofbirth": "",
                "ahvnumber": "", "occupation": "", "employer": "", "religion": "",
            },
            "children": [],
            "supported": [],
            "representative": {"name": "", "address": "", "phone": ""},
            "giftsreceived": [],
            "giftsgiven": [],
            "capitalbenefits": {"amount": "", "description": ""},
            "bankdetails": {"iban": "", "bankname": "", "accountholder": ""},
        },
        "income": {
            "employment": {"bruttolohn": "", "ahvcontributions": "", "bvgcontributions": ""},
            "selfemployment": {"enabled": False, "revenue": "", "expenses": "", "netincome": ""},
            "pension": {"ahvpension": "", "bvgpension": "", "otherpension": ""},
            "capitalwithdrawals": {"amount": ""},
            "investment": {"dividends": "", "interest": ""},
            "alimony": {"amount": ""},
            "otherincome": {"description": "", "amount": ""},
            "rental": {"eigenmietwert": "", "rentalincome": "", "maintenancecosts": ""},
        },
        "deductions": {
            "berufsauslagen": {"type": "flat-rate"},
            "flatrate": {"amount": "0"},
            "effective": [],
            "fahrkosten": {"amount": "", "description": ""},
            "verpflegung": {"amount": ""},
            "weitereberufsauslagen": {"amount": "", "description": ""},
            "pillar3a": {"amount": ""},
            "insurance": {"amount": ""},
            "schuldzinsen": {"amount": ""},
            "unterhaltsbeitraege": {"amount": "", "recipient": ""},
            "kinderbetreuungskosten": {"amount": ""},
            "weiterbildungskosten": {"amount": ""},
            "donations": {"amount": "", "recipient": ""},
            "medical": {"amount": ""},
            "zweiverdienerabzug": {"amount": ""},
            "otherdeductions": {"description": "", "amount": ""},
        },
        "wealth": {
            "movableassets": {"cashgold": ""},
            "businessshares": [],
            "securities": [],
            "bankaccounts": [],
            "insurances": [],
            "vehicles": [],
            "realestate": {"eigenmietwert": "", "steuerwert": "", "address": ""},
            "otherassets": {"description": "", "value": ""},
            "debts": [],
        },
        "attachments": {
            "uploads": {
                "lohnausweis": "", "bankstatements": "", "pillar3a": "",
                "deductions": "", "property": "", "other": "",
            },
        },
    }


# Row templates — match rowTemplates in FormContext.tsx
ROW_TEMPLATES: dict[str, dict[str, callable]] = {
    "personal": {
        "children": lambda: {"name": "", "dateOfBirth": "", "relationship": ""},
        "supported": lambda: {"name": "", "relationship": "", "contribution": ""},
        "giftsreceived": lambda: {"description": "", "date": "", "amount": ""},
        "giftsgiven": lambda: {"description": "", "date": "", "amount": ""},
    },
    "wealth": {
        "businessshares": lambda: {"date": "", "description": "", "wealthAmount": "", "incomeAmount": ""},
        "securities": lambda: {"name": "", "isin": "", "quantity": "", "value": "", "grossReturn": ""},
        "bankaccounts": lambda: {"bankName": "", "balance": "", "interest": ""},
        "insurances": lambda: {"company": "", "policyNumber": "", "surrenderValue": ""},
        "vehicles": lambda: {"type": "", "brand": "", "year": "", "value": ""},
        "debts": lambda: {"creditor": "", "amount": ""},
    },
    "deductions": {
        "effective": lambda: {"description": "", "amount": ""},
    },
}

# Ordered page traversal for agent navigation (mirrors App.tsx routes)
PAGE_ORDER = [
    "personal",
    "personal/children",
    "personal/supported",
    "personal/representative",
    "personal/gifts-received",
    "personal/gifts-given",
    "personal/capital-benefits",
    "personal/bank-details",
    "income",
    "income/pensions",
    "income/securities-income",
    "income/property-income",
    "income/other",
    "deductions",
    "deductions/professional",
    "deductions/debt-interest",
    "deductions/alimony",
    "deductions/insurance",
    "deductions/medical",
    "deductions/other",
    "wealth",
    "wealth/movable",
    "wealth/insurance",
    "wealth/vehicles",
    "wealth/real-estate",
    "wealth/debts",
    "attachments",
    "review",
]

# Maps locator prefix → (form_page_key, form_section_key)
# Locator format: field-{prefix}-{fieldname}  e.g. field-personal-main-firstName
LOCATOR_TO_PATH: dict[str, tuple[str, str]] = {
    "personal-main": ("personal", "main"),
    "personal-partner": ("personal", "partner"),
    "personal-children": ("personal", "children"),
    "personal-supported": ("personal", "supported"),
    "personal-representative": ("personal", "representative"),
    "personal-giftsreceived": ("personal", "giftsreceived"),
    "personal-giftsgiven": ("personal", "giftsgiven"),
    "personal-capitalbenefits": ("personal", "capitalbenefits"),
    "personal-bankdetails": ("personal", "bankdetails"),
    "income-employment": ("income", "employment"),
    "income-selfemployment": ("income", "selfemployment"),
    "income-pension": ("income", "pension"),
    "income-capitalwithdrawals": ("income", "capitalwithdrawals"),
    "income-investment": ("income", "investment"),
    "income-alimony": ("income", "alimony"),
    "income-otherincome": ("income", "otherincome"),
    "income-rental": ("income", "rental"),
    "deductions-berufsauslagen": ("deductions", "berufsauslagen"),
    "deductions-flatrate": ("deductions", "flatrate"),
    "deductions-effective": ("deductions", "effective"),
    "deductions-fahrkosten": ("deductions", "fahrkosten"),
    "deductions-verpflegung": ("deductions", "verpflegung"),
    "deductions-weitereberufsauslagen": ("deductions", "weitereberufsauslagen"),
    "deductions-pillar3a": ("deductions", "pillar3a"),
    "deductions-insurance": ("deductions", "insurance"),
    "deductions-schuldzinsen": ("deductions", "schuldzinsen"),
    "deductions-unterhaltsbeitraege": ("deductions", "unterhaltsbeitraege"),
    "deductions-kinderbetreuungskosten": ("deductions", "kinderbetreuungskosten"),
    "deductions-weiterbildungskosten": ("deductions", "weiterbildungskosten"),
    "deductions-donations": ("deductions", "donations"),
    "deductions-medical": ("deductions", "medical"),
    "deductions-zweiverdienerabzug": ("deductions", "zweiverdienerabzug"),
    "deductions-otherdeductions": ("deductions", "otherdeductions"),
    "wealth-movableassets": ("wealth", "movableassets"),
    "wealth-businessshares": ("wealth", "businessshares"),
    "wealth-securities": ("wealth", "securities"),
    "wealth-bankaccounts": ("wealth", "bankaccounts"),
    "wealth-insurances": ("wealth", "insurances"),
    "wealth-vehicles": ("wealth", "vehicles"),
    "wealth-realestate": ("wealth", "realestate"),
    "wealth-otherassets": ("wealth", "otherassets"),
    "wealth-debts": ("wealth", "debts"),
}

# ── Page element definitions ────────────────────────────────────────────────
# Each page maps to a list of field descriptors that scan_page() returns.
# Field types: "input", "number", "date", "select", "checkbox", "button", "text"
# Locator convention: field-{page}-{section}-{fieldname}

def _field(locator: str, label: str, ftype: str = "input", required: bool = False,
           options: list | None = None) -> dict:
    return {
        "type": ftype,
        "locator": locator,
        "label": label,
        "value": "",
        "required": required,
        **({"options": options} if options else {}),
    }


# Static field definitions per page path (used in scan_page())
PAGE_FIELD_DEFS: dict[str, list[dict]] = {
    "personal": [
        _field("field-personal-main-firstName", "First Name", required=True),
        _field("field-personal-main-lastName", "Last Name", required=True),
        _field("field-personal-main-dateofbirth", "Date of Birth", "date", required=True),
        _field("field-personal-main-street", "Street"),
        _field("field-personal-main-streetNumber", "Street Number"),
        _field("field-personal-main-apartment", "Apartment"),
        _field("field-personal-main-zip", "ZIP Code"),
        _field("field-personal-main-city", "City"),
        _field("field-personal-main-phone", "Phone"),
        _field("field-personal-main-email", "Email"),
        _field("field-personal-main-ahvnumber", "AHV Number", required=True),
        _field("field-personal-main-maritalstatus", "Marital Status", "select",
               options=["single", "married", "divorced", "widowed", "separated"]),
        _field("field-personal-main-religion", "Religion", "select",
               options=["", "protestant", "catholic", "other", "none"]),
        _field("field-personal-main-occupation", "Occupation"),
        _field("field-personal-main-employer", "Employer"),
        _field("field-personal-main-workplace", "Workplace"),
        # Partner fields (always visible, agent fills if married)
        _field("field-personal-partner-firstName", "Partner First Name"),
        _field("field-personal-partner-lastName", "Partner Last Name"),
        _field("field-personal-partner-dateofbirth", "Partner Date of Birth", "date"),
        _field("field-personal-partner-ahvnumber", "Partner AHV Number"),
        _field("field-personal-partner-occupation", "Partner Occupation"),
        _field("field-personal-partner-employer", "Partner Employer"),
        _field("field-personal-partner-religion", "Partner Religion", "select",
               options=["", "protestant", "catholic", "other", "none"]),
    ],
    "personal/children": [
        # Dynamic rows — populated in scan_page() from current state
        {"type": "button", "locator": "btn-add-row-personal-children",
         "label": "+ Add Child", "content": "+ Add Child"},
    ],
    "personal/supported": [
        {"type": "button", "locator": "btn-add-row-personal-supported",
         "label": "+ Add Supported Person", "content": "+ Add Supported Person"},
    ],
    "personal/representative": [
        _field("field-personal-representative-name", "Representative Name"),
        _field("field-personal-representative-address", "Address"),
        _field("field-personal-representative-phone", "Phone"),
    ],
    "personal/gifts-received": [
        {"type": "button", "locator": "btn-add-row-personal-giftsreceived",
         "label": "+ Add Gift Received", "content": "+ Add Gift Received"},
    ],
    "personal/gifts-given": [
        {"type": "button", "locator": "btn-add-row-personal-giftsgiven",
         "label": "+ Add Gift Given", "content": "+ Add Gift Given"},
    ],
    "personal/capital-benefits": [
        _field("field-personal-capitalbenefits-description", "Description"),
        _field("field-personal-capitalbenefits-amount", "Amount (CHF)", "number"),
    ],
    "personal/bank-details": [
        _field("field-personal-bankdetails-iban", "IBAN"),
        _field("field-personal-bankdetails-bankname", "Bank Name"),
        _field("field-personal-bankdetails-accountholder", "Account Holder"),
    ],
    "income": [
        {"type": "text", "content": "Employment Income"},
        _field("field-income-employment-bruttolohn", "Gross Salary / Bruttolohn (CHF)", "number", True),
        _field("field-income-employment-ahvcontributions", "AHV/IV/EO Contributions (CHF)", "number"),
        _field("field-income-employment-bvgcontributions", "BVG/Pension Contributions (CHF)", "number"),
        {"type": "text", "content": "Self-Employment Income"},
        _field("field-income-selfemployment-revenue", "Revenue (CHF)", "number"),
        _field("field-income-selfemployment-expenses", "Expenses (CHF)", "number"),
        _field("field-income-selfemployment-netincome", "Net Income (CHF)", "number"),
    ],
    "income/pensions": [
        _field("field-income-pension-ahvpension", "AHV Pension (CHF)", "number"),
        _field("field-income-pension-bvgpension", "BVG/Pension Fund (CHF)", "number"),
        _field("field-income-pension-otherpension", "Other Pension (CHF)", "number"),
        _field("field-income-capitalwithdrawals-amount", "Capital Withdrawal (CHF)", "number"),
    ],
    "income/securities-income": [
        _field("field-income-investment-dividends", "Dividends (CHF)", "number"),
        _field("field-income-investment-interest", "Interest Income (CHF)", "number"),
    ],
    "income/property-income": [
        _field("field-income-rental-eigenmietwert", "Eigenmietwert (CHF)", "number"),
        _field("field-income-rental-rentalincome", "Rental Income (CHF)", "number"),
        _field("field-income-rental-maintenancecosts", "Maintenance Costs (CHF)", "number"),
    ],
    "income/other": [
        _field("field-income-alimony-amount", "Alimony Received (CHF)", "number"),
        _field("field-income-otherincome-description", "Description"),
        _field("field-income-otherincome-amount", "Amount (CHF)", "number"),
    ],
    "deductions": [
        _field("field-deductions-fahrkosten-amount", "Commuting Costs (CHF)", "number"),
        _field("field-deductions-fahrkosten-description", "Description"),
        _field("field-deductions-verpflegung-amount", "Meal Deduction / Verpflegung (CHF)", "number"),
    ],
    "deductions/professional": [
        _field("field-deductions-berufsauslagen-type", "Professional Expenses Type", "select",
               options=["flat-rate", "effective"]),
        _field("field-deductions-flatrate-amount", "Flat-Rate Amount (CHF)", "number"),
        _field("field-deductions-weitereberufsauslagen-amount",
               "Other Professional Expenses (CHF)", "number"),
        _field("field-deductions-weitereberufsauslagen-description", "Description"),
    ],
    "deductions/debt-interest": [
        _field("field-deductions-schuldzinsen-amount", "Debt Interest / Schuldzinsen (CHF)", "number"),
    ],
    "deductions/alimony": [
        _field("field-deductions-unterhaltsbeitraege-amount", "Alimony Paid (CHF)", "number"),
        _field("field-deductions-unterhaltsbeitraege-recipient", "Recipient"),
    ],
    "deductions/insurance": [
        _field("field-deductions-insurance-amount", "Insurance Premiums (CHF)", "number"),
    ],
    "deductions/medical": [
        _field("field-deductions-medical-amount", "Medical Expenses (CHF)", "number"),
    ],
    "deductions/other": [
        _field("field-deductions-pillar3a-amount", "Pillar 3a (CHF)", "number"),
        _field("field-deductions-donations-amount", "Donations / Spenden (CHF)", "number"),
        _field("field-deductions-donations-recipient", "Recipient Organization"),
        _field("field-deductions-kinderbetreuungskosten-amount", "Childcare Costs (CHF)", "number"),
        _field("field-deductions-weiterbildungskosten-amount", "Training Costs (CHF)", "number"),
        _field("field-deductions-zweiverdienerabzug-amount",
               "Dual-Income Deduction / Zweiverdienerabzug (CHF)", "number"),
        _field("field-deductions-otherdeductions-description", "Other Deductions Description"),
        _field("field-deductions-otherdeductions-amount", "Other Deductions Amount (CHF)", "number"),
    ],
    "wealth": [
        # Bank accounts — dynamic
        {"type": "button", "locator": "btn-add-row-wealth-bankaccounts",
         "label": "+ Add Bank Account", "content": "+ Add Bank Account"},
        # Securities — dynamic
        {"type": "button", "locator": "btn-add-row-wealth-securities",
         "label": "+ Add Security", "content": "+ Add Security"},
    ],
    "wealth/movable": [
        _field("field-wealth-movableassets-cashgold", "Cash / Gold (CHF)", "number"),
    ],
    "wealth/insurance": [
        {"type": "button", "locator": "btn-add-row-wealth-insurances",
         "label": "+ Add Insurance", "content": "+ Add Insurance"},
    ],
    "wealth/vehicles": [
        {"type": "button", "locator": "btn-add-row-wealth-vehicles",
         "label": "+ Add Vehicle", "content": "+ Add Vehicle"},
    ],
    "wealth/real-estate": [
        _field("field-wealth-realestate-address", "Property Address"),
        _field("field-wealth-realestate-eigenmietwert", "Eigenmietwert (CHF)", "number"),
        _field("field-wealth-realestate-steuerwert", "Steuerwert / Tax Value (CHF)", "number"),
        _field("field-wealth-otherassets-description", "Other Assets Description"),
        _field("field-wealth-otherassets-value", "Other Assets Value (CHF)", "number"),
    ],
    "wealth/debts": [
        {"type": "button", "locator": "btn-add-row-wealth-debts",
         "label": "+ Add Debt", "content": "+ Add Debt"},
    ],
    "attachments": [
        {"type": "text", "content": "File uploads — not programmatically fillable. Return {}."},
    ],
    "review": [
        {"type": "text", "content": "Please review all entries before submitting."},
        {"type": "button", "locator": "btn-submit", "label": "Submit Tax Return",
         "content": "Submit & Export JSON"},
    ],
}

# Row field definitions for dynamic sections
ROW_FIELD_DEFS: dict[str, dict[str, list[dict]]] = {
    "personal": {
        "children": [
            {"name": "name", "label": "Child Name", "type": "input"},
            {"name": "dateOfBirth", "label": "Date of Birth", "type": "date"},
            {"name": "relationship", "label": "Relationship", "type": "input"},
        ],
        "supported": [
            {"name": "name", "label": "Name", "type": "input"},
            {"name": "relationship", "label": "Relationship", "type": "input"},
            {"name": "contribution", "label": "Contribution (CHF)", "type": "number"},
        ],
        "giftsreceived": [
            {"name": "description", "label": "Description", "type": "input"},
            {"name": "date", "label": "Date", "type": "date"},
            {"name": "amount", "label": "Amount (CHF)", "type": "number"},
        ],
        "giftsgiven": [
            {"name": "description", "label": "Description", "type": "input"},
            {"name": "date", "label": "Date", "type": "date"},
            {"name": "amount", "label": "Amount (CHF)", "type": "number"},
        ],
    },
    "wealth": {
        "bankaccounts": [
            {"name": "bankName", "label": "Bank Name", "type": "input"},
            {"name": "balance", "label": "Balance (CHF)", "type": "number"},
            {"name": "interest", "label": "Interest (CHF)", "type": "number"},
        ],
        "securities": [
            {"name": "name", "label": "Security Name", "type": "input"},
            {"name": "isin", "label": "ISIN", "type": "input"},
            {"name": "quantity", "label": "Quantity", "type": "number"},
            {"name": "value", "label": "Value (CHF)", "type": "number"},
            {"name": "grossReturn", "label": "Gross Return (CHF)", "type": "number"},
        ],
        "insurances": [
            {"name": "company", "label": "Company", "type": "input"},
            {"name": "policyNumber", "label": "Policy Number", "type": "input"},
            {"name": "surrenderValue", "label": "Surrender Value (CHF)", "type": "number"},
        ],
        "vehicles": [
            {"name": "type", "label": "Type", "type": "input"},
            {"name": "brand", "label": "Brand", "type": "input"},
            {"name": "year", "label": "Year", "type": "number"},
            {"name": "value", "label": "Value (CHF)", "type": "number"},
        ],
        "debts": [
            {"name": "creditor", "label": "Creditor", "type": "input"},
            {"name": "amount", "label": "Amount (CHF)", "type": "number"},
        ],
    },
    "deductions": {
        "effective": [
            {"name": "description", "label": "Description", "type": "input"},
            {"name": "amount", "label": "Amount (CHF)", "type": "number"},
        ],
    },
}
