"""
Form Data Model — the single source of truth for the Swiss tax form's structure.

This module does three things:

1. **Defines the form's data shape** via ``make_empty_form()``.
   The dictionary it returns mirrors the ``initialFormData`` object in the
   React frontend (``FormContext.tsx``).  Both sides must stay in sync: if you
   add a new field in React you must also add it here, and vice versa.

2. **Provides metadata** about how each section works:
   - ``ROW_TEMPLATES``   — factories for new rows in dynamic (array) sections.
   - ``PAGE_ORDER``      — the sequence in which the agent visits pages.
   - ``LOCATOR_TO_PATH`` — maps an HTML element id prefix to the correct place
                           in the form dict so the bridge can store filled values.
   - ``PAGE_FIELD_DEFS`` — a static catalogue of every field on every page,
                           returned by the ``scan_page`` MCP tool.
   - ``ROW_FIELD_DEFS``  — column definitions for every dynamic (add-row) table.

3. **Exposes the ``_field()`` helper** that builds a consistent field-descriptor
   dictionary used throughout ``PAGE_FIELD_DEFS``.

Swiss tax form sections at a glance
------------------------------------
- **login**       — AHV number (Swiss social security) + access code to open the form.
- **personal**    — Taxpayer identity, address, marital status, partner, children,
                    gifts, capital benefits, and bank details for refund.
- **income**      — Employment (Lohnausweis), self-employment, pensions, capital
                    withdrawals, investment income, alimony received, rental income.
- **deductions**  — Work-related costs (Berufsauslagen), commuting, meals, Pillar 3a
                    retirement savings, insurance premiums, debt interest, alimony
                    paid, childcare, training, donations, and medical expenses.
- **wealth**      — Assets declared for cantonal wealth tax: cash/gold, business
                    shares, securities (stocks/bonds), bank accounts, insurance
                    policies, vehicles, real estate, and debts.
- **attachments** — File uploads (Lohnausweis PDF, bank statements, etc.).

How the locator convention works
----------------------------------
Every HTML input in the React app has an ``id`` that follows the pattern::

    field-{page}-{section}-{fieldname}

Example: ``field-personal-main-firstName``

The AI agent uses this id (called a *locator*) to identify which input to fill.
``LOCATOR_TO_PATH`` maps the ``{page}-{section}`` prefix part of the locator to
the corresponding nested keys inside the form dictionary, so the bridge knows
exactly where to store the new value.
"""

from copy import deepcopy


def make_empty_form() -> dict:
    """Return a fresh, blank form dictionary matching React's ``initialFormData``.

    The returned dict has the same nested structure that ``FormContext.tsx``
    initialises on the frontend.  Every field starts as an empty string ``""``
    (or ``False`` for booleans, or ``[]`` for dynamic array sections).

    The backend ``FlaskBridge`` stores a copy of this dict in memory and
    updates individual fields whenever the agent calls the ``fill_field`` tool.
    The ``/api/sessions/{id}/form`` endpoint then sends the current state back
    to the React UI so the user can watch it fill in real time.

    Top-level keys
    --------------
    login : dict
        AHV number and Zugangscode (access code) for the Swiss tax portal login.
    personal : dict
        Taxpayer identity fields, partner info, children, supported persons,
        legal representative, gifts, capital benefits, and refund bank details.
    income : dict
        All income sources: employment salary (Bruttolohn), self-employment,
        pensions (AHV/BVG), capital withdrawals, investment returns, alimony,
        and rental/property income.
    deductions : dict
        All deductible expenses: Berufsauslagen (professional costs), commuting
        (Fahrkosten), meals (Verpflegung), Pillar 3a retirement savings,
        insurance premiums, debt interest (Schuldzinsen), alimony paid,
        childcare, training, charitable donations, and medical costs.
    wealth : dict
        Assets subject to the cantonal wealth tax: movable assets, business
        shares, securities portfolio, bank accounts, insurance surrender values,
        vehicles, real estate, other assets, and debts (subtracted from wealth).
    attachments : dict
        Upload slots for supporting documents (Lohnausweis, bank statements, etc.).

    Returns
    -------
    dict
        A deeply nested dictionary with all fields set to their empty defaults.
    """
    return {
        # ── Login ────────────────────────────────────────────────────────────
        # The agent fills these fields first to authenticate on the tax portal.
        # AHV number = Swiss social security number (format: 756.XXXX.XXXX.XX).
        "login": {"auth": {"ahvnumber": "", "zugangscode": ""}},

        # ── Personal Information ─────────────────────────────────────────────
        "personal": {
            # Core taxpayer identity and contact details
            "main": {
                "firstName": "",
                "lastName": "",
                "dateofbirth": "",       # ISO date string: YYYY-MM-DD
                "street": "",
                "streetNumber": "",
                "apartment": "",         # e.g. "3rd floor, left"
                "zip": "",               # Swiss postal code (4 digits)
                "city": "",
                "phone": "",
                "email": "",
                "ahvnumber": "",         # 13-digit Swiss social security number
                "maritalstatus": "",     # "single" | "married" | "divorced" | ...
                "religion": "",          # affects cantonal church-tax calculation
                "occupation": "",        # job title
                "employer": "",
                "workplace": "",         # city/location of workplace
            },

            # Spouse/partner details — only relevant if maritalstatus == "married"
            "partner": {
                "firstName": "",
                "lastName": "",
                "dateofbirth": "",
                "ahvnumber": "",
                "occupation": "",
                "employer": "",
                "religion": "",
            },

            # Dynamic arrays — each entry is a dict matching the row template below
            "children": [],             # each row: {name, dateOfBirth, relationship}
            "supported": [],            # supported persons (e.g. elderly parents)

            # Optional legal representative (Rechtsvertreter)
            "representative": {"name": "", "address": "", "phone": ""},

            # Gifts received and given (declared for wealth/gift-tax purposes)
            "giftsreceived": [],        # each row: {description, date, amount}
            "giftsgiven": [],

            # One-off capital benefits (e.g. inheritance lump sum)
            "capitalbenefits": {"amount": "", "description": ""},

            # Bank account for receiving the tax refund
            "bankdetails": {"iban": "", "bankname": "", "accountholder": ""},
        },

        # ── Income ───────────────────────────────────────────────────────────
        "income": {
            # Employment income from the Lohnausweis (official salary certificate)
            "employment": {
                "bruttolohn": "",           # gross salary (CHF)
                "ahvcontributions": "",     # mandatory AHV/IV/EO social insurance
                "bvgcontributions": "",     # mandatory BVG occupational pension
            },

            # Self-employment / freelance income
            "selfemployment": {
                "enabled": False,           # checkbox — agent sets to True if applicable
                "revenue": "",
                "expenses": "",
                "netincome": "",            # revenue - expenses
            },

            # Pension income (Rentenleistungen)
            "pension": {
                "ahvpension": "",           # state pension (1st pillar)
                "bvgpension": "",           # occupational pension (2nd pillar)
                "otherpension": "",
            },

            # Lump-sum capital withdrawal from pension fund
            "capitalwithdrawals": {"amount": ""},

            # Investment income from securities (Wertschriften)
            "investment": {
                "dividends": "",            # gross dividends before withholding tax
                "interest": "",             # interest from savings/bonds
            },

            # Alimony received (Unterhaltsbeiträge empfangen)
            "alimony": {"amount": ""},

            # Any other taxable income not covered above
            "otherincome": {"description": "", "amount": ""},

            # Rental / property income
            "rental": {
                "eigenmietwert": "",        # imputed rental value for owner-occupied property
                "rentalincome": "",         # actual rent received
                "maintenancecosts": "",     # deductible maintenance expenses
            },
        },

        # ── Deductions ───────────────────────────────────────────────────────
        "deductions": {
            # Berufsauslagen: professional/work-related expenses
            "berufsauslagen": {
                "type": "flat-rate",        # "flat-rate" | "effective" — chosen by taxpayer
            },

            # Flat-rate professional deduction (auto-calculated in FormContext.tsx
            # as 3 % of Bruttolohn, capped at CHF 4 000)
            "flatrate": {"amount": "0"},

            # Effective (itemised) professional expenses — dynamic table rows
            "effective": [],              # each row: {description, amount}

            # Commuting costs to work (Fahrkosten)
            "fahrkosten": {"amount": "", "description": ""},

            # Meal/subsistence deduction (Verpflegungsmehrkosten)
            "verpflegung": {"amount": ""},

            # Additional professional expenses not covered by the flat rate
            "weitereberufsauslagen": {"amount": "", "description": ""},

            # Pillar 3a voluntary retirement savings (tax-privileged)
            "pillar3a": {"amount": ""},

            # Health and accident insurance premiums
            "insurance": {"amount": ""},

            # Debt interest paid (Schuldzinsen) — e.g. mortgage interest
            "schuldzinsen": {"amount": ""},

            # Alimony paid (Unterhaltsbeiträge geleistet)
            "unterhaltsbeitraege": {"amount": "", "recipient": ""},

            # Childcare costs (Kinderbetreuungskosten)
            "kinderbetreuungskosten": {"amount": ""},

            # Continuing education / training costs (Weiterbildungskosten)
            "weiterbildungskosten": {"amount": ""},

            # Charitable donations (Spenden) — deductible above a minimum threshold
            "donations": {"amount": "", "recipient": ""},

            # Medical expenses exceeding the deductible threshold
            "medical": {"amount": ""},

            # Dual-income couple deduction (Zweiverdienerabzug)
            "zweiverdienerabzug": {"amount": ""},

            # Catch-all for any other deductions
            "otherdeductions": {"description": "", "amount": ""},
        },

        # ── Wealth ───────────────────────────────────────────────────────────
        # Switzerland levies a cantonal wealth tax on net assets.
        # All asset categories must be declared; debts are subtracted.
        "wealth": {
            # Cash and physical gold/silver held outside bank accounts
            "movableassets": {"cashgold": ""},

            # Ownership stakes in private companies (unlisted shares)
            "businessshares": [],       # each row: {date, description, wealthAmount, incomeAmount}

            # Listed securities: stocks, bonds, ETFs (Wertschriften)
            "securities": [],           # each row: {name, isin, quantity, value, grossReturn}

            # Bank and savings accounts
            "bankaccounts": [],         # each row: {bankName, balance, interest}

            # Life / endowment insurance policies (surrender value)
            "insurances": [],           # each row: {company, policyNumber, surrenderValue}

            # Vehicles (taxed on estimated market value)
            "vehicles": [],             # each row: {type, brand, year, value}

            # Owner-occupied real estate
            "realestate": {
                "eigenmietwert": "",    # imputed rental value (also an income item)
                "steuerwert": "",       # official tax assessment value (Steuerwert)
                "address": "",
            },

            # Any other assets not listed above
            "otherassets": {"description": "", "value": ""},

            # Debts and liabilities (subtracted from gross wealth for net wealth tax base)
            "debts": [],                # each row: {creditor, amount}
        },

        # ── Attachments ───────────────────────────────────────────────────────
        # File upload slots — the agent cannot fill these programmatically;
        # the taxpayer uploads PDFs manually after the agent run.
        "attachments": {
            "uploads": {
                "lohnausweis": "",      # official salary certificate from employer
                "bankstatements": "",   # year-end bank statements
                "pillar3a": "",         # 3a contribution certificate
                "deductions": "",       # receipts for deductible expenses
                "property": "",         # property tax documents
                "other": "",            # any other supporting documents
            },
        },
    }


# ── Row Templates ─────────────────────────────────────────────────────────────
# These lambda factories mirror ``rowTemplates`` in ``FormContext.tsx``.
#
# When the agent calls the ``add_table_row`` MCP tool for a dynamic section,
# the bridge calls the matching lambda here to produce a fresh, empty row dict
# and appends it to the correct list inside the form.  This ensures the backend
# and frontend always agree on the shape of each row.
#
# Structure: { page_key: { section_key: lambda -> dict } }
ROW_TEMPLATES: dict[str, dict[str, callable]] = {
    "personal": {
        # Each child on the tax return
        "children":      lambda: {"name": "", "dateOfBirth": "", "relationship": ""},
        # Financially supported persons (e.g. elderly parents, siblings)
        "supported":     lambda: {"name": "", "relationship": "", "contribution": ""},
        # Gifts/inheritances received — declared for transparency
        "giftsreceived": lambda: {"description": "", "date": "", "amount": ""},
        # Gifts/donations given — some are tax-deductible
        "giftsgiven":    lambda: {"description": "", "date": "", "amount": ""},
    },
    "wealth": {
        # Ownership stakes in private companies
        "businessshares": lambda: {
            "date": "", "description": "", "wealthAmount": "", "incomeAmount": ""
        },
        # Listed securities (stocks, bonds, ETFs)
        "securities": lambda: {
            "name": "", "isin": "", "quantity": "", "value": "", "grossReturn": ""
        },
        # Bank / savings accounts
        "bankaccounts":  lambda: {"bankName": "", "balance": "", "interest": ""},
        # Life / endowment insurance policies
        "insurances":    lambda: {"company": "", "policyNumber": "", "surrenderValue": ""},
        # Vehicles owned by the taxpayer
        "vehicles":      lambda: {"type": "", "brand": "", "year": "", "value": ""},
        # Outstanding debts (reduce net wealth)
        "debts":         lambda: {"creditor": "", "amount": ""},
    },
    "deductions": {
        # Itemised professional expenses (used when choosing "effective" mode)
        "effective": lambda: {"description": "", "amount": ""},
    },
}


# ── Page Order ────────────────────────────────────────────────────────────────
# The ordered list of URL path segments that the agent visits, one by one.
#
# This list mirrors the route definitions in ``App.tsx``.  The agent's
# ``fill_page`` loop (in ``think_service.py``) iterates through this list and
# calls ``navigate_to_page`` for each entry before scanning and filling fields.
#
# The order matters: personal info must come before income (which references
# the employer), and income before deductions (which reference income amounts).
# The final entries — "attachments" and "review" — are always last.
PAGE_ORDER = [
    # ── Personal information ──
    "personal",                  # main taxpayer details (name, address, AHV, etc.)
    "personal/children",         # dynamic table: dependent children
    "personal/supported",        # dynamic table: other supported persons
    "personal/representative",   # optional legal representative
    "personal/gifts-received",   # dynamic table: gifts/inheritances received
    "personal/gifts-given",      # dynamic table: gifts/donations given
    "personal/capital-benefits", # one-off capital lump sums (e.g. inheritance)
    "personal/bank-details",     # IBAN for tax refund payment

    # ── Income ──
    "income",                    # employment salary (Bruttolohn) + self-employment
    "income/pensions",           # AHV/BVG pensions + capital withdrawals
    "income/securities-income",  # dividends and interest from investments
    "income/property-income",    # rental income and Eigenmietwert
    "income/other",              # alimony received + miscellaneous income

    # ── Deductions ──
    "deductions",                # commuting costs (Fahrkosten) + meal deduction
    "deductions/professional",   # Berufsauslagen: flat-rate vs. itemised
    "deductions/debt-interest",  # mortgage and other debt interest (Schuldzinsen)
    "deductions/alimony",        # alimony paid (Unterhaltsbeiträge)
    "deductions/insurance",      # health/accident insurance premiums
    "deductions/medical",        # extraordinary medical expenses
    "deductions/other",          # Pillar 3a, donations, childcare, training, etc.

    # ── Wealth ──
    "wealth",                    # bank accounts + securities (main wealth page)
    "wealth/movable",            # cash and physical gold
    "wealth/insurance",          # insurance policies (surrender value)
    "wealth/vehicles",           # cars, motorcycles, boats, etc.
    "wealth/real-estate",        # owner-occupied property + other assets
    "wealth/debts",              # outstanding loans and liabilities

    # ── Final steps ──
    "attachments",               # upload supporting documents (agent skips filling)
    "review",                    # final review + submit button
]


# ── Locator → Form Path Mapping ───────────────────────────────────────────────
# Maps the ``{page}-{section}`` part of an HTML element locator to the
# corresponding (page_key, section_key) tuple in the form dictionary.
#
# How to read this:
#   Key   = the locator prefix, i.e. everything in "field-{page}-{section}-{name}"
#            up to and including the section part.
#   Value = (page_key, section_key) — the keys to drill into in the form dict.
#
# Example:
#   Locator "field-income-employment-bruttolohn"
#   → prefix "income-employment"
#   → maps to ("income", "employment")
#   → form["income"]["employment"]["bruttolohn"] = <value>
#
# The ``FlaskBridge._apply_fill()`` method splits the locator on "-" to extract
# the prefix and then performs this lookup to find the storage location.
LOCATOR_TO_PATH: dict[str, tuple[str, str]] = {
    # ── Personal ──
    "personal-main":            ("personal", "main"),
    "personal-partner":         ("personal", "partner"),
    "personal-children":        ("personal", "children"),         # dynamic array
    "personal-supported":       ("personal", "supported"),        # dynamic array
    "personal-representative":  ("personal", "representative"),
    "personal-giftsreceived":   ("personal", "giftsreceived"),    # dynamic array
    "personal-giftsgiven":      ("personal", "giftsgiven"),       # dynamic array
    "personal-capitalbenefits": ("personal", "capitalbenefits"),
    "personal-bankdetails":     ("personal", "bankdetails"),

    # ── Income ──
    "income-employment":        ("income", "employment"),
    "income-selfemployment":    ("income", "selfemployment"),
    "income-pension":           ("income", "pension"),
    "income-capitalwithdrawals":("income", "capitalwithdrawals"),
    "income-investment":        ("income", "investment"),
    "income-alimony":           ("income", "alimony"),
    "income-otherincome":       ("income", "otherincome"),
    "income-rental":            ("income", "rental"),

    # ── Deductions ──
    "deductions-berufsauslagen":        ("deductions", "berufsauslagen"),
    "deductions-flatrate":              ("deductions", "flatrate"),
    "deductions-effective":             ("deductions", "effective"),         # dynamic array
    "deductions-fahrkosten":            ("deductions", "fahrkosten"),
    "deductions-verpflegung":           ("deductions", "verpflegung"),
    "deductions-weitereberufsauslagen": ("deductions", "weitereberufsauslagen"),
    "deductions-pillar3a":              ("deductions", "pillar3a"),
    "deductions-insurance":             ("deductions", "insurance"),
    "deductions-schuldzinsen":          ("deductions", "schuldzinsen"),
    "deductions-unterhaltsbeitraege":   ("deductions", "unterhaltsbeitraege"),
    "deductions-kinderbetreuungskosten":("deductions", "kinderbetreuungskosten"),
    "deductions-weiterbildungskosten":  ("deductions", "weiterbildungskosten"),
    "deductions-donations":             ("deductions", "donations"),
    "deductions-medical":               ("deductions", "medical"),
    "deductions-zweiverdienerabzug":    ("deductions", "zweiverdienerabzug"),
    "deductions-otherdeductions":       ("deductions", "otherdeductions"),

    # ── Wealth ──
    "wealth-movableassets":  ("wealth", "movableassets"),
    "wealth-businessshares": ("wealth", "businessshares"),  # dynamic array
    "wealth-securities":     ("wealth", "securities"),      # dynamic array
    "wealth-bankaccounts":   ("wealth", "bankaccounts"),    # dynamic array
    "wealth-insurances":     ("wealth", "insurances"),      # dynamic array
    "wealth-vehicles":       ("wealth", "vehicles"),        # dynamic array
    "wealth-realestate":     ("wealth", "realestate"),
    "wealth-otherassets":    ("wealth", "otherassets"),
    "wealth-debts":          ("wealth", "debts"),           # dynamic array
}


# ── Field Descriptor Helper ───────────────────────────────────────────────────

def _field(
    locator: str,
    label: str,
    ftype: str = "input",
    required: bool = False,
    options: list | None = None,
) -> dict:
    """Build a field-descriptor dictionary for use in ``PAGE_FIELD_DEFS``.

    A field descriptor is the metadata object that the ``scan_page`` MCP tool
    returns to the agent.  The agent reads it to learn:
      - *what* element to target (the locator / HTML id),
      - *what* the field is for (the human-readable label),
      - *what kind* of input it is (text, number, date, select, checkbox…),
      - *whether* it is mandatory, and
      - *what* the currently stored value is (populated at scan time by the bridge).

    Parameters
    ----------
    locator : str
        Full HTML element id, e.g. ``"field-personal-main-firstName"``.
        The agent passes this string to ``fill_field`` when it wants to fill
        or read this field.
    label : str
        Human-readable field name shown in the UI, e.g. ``"First Name"``.
        The agent also uses this to match fields against document data.
    ftype : str, optional
        Input type.  Possible values:
        ``"input"``    — single-line text (default),
        ``"number"``   — numeric input (agent should pass a plain number),
        ``"date"``     — date picker (agent should use YYYY-MM-DD format),
        ``"select"``   — dropdown; valid choices listed in ``options``,
        ``"checkbox"`` — boolean toggle,
        ``"textarea"`` — multi-line text.
    required : bool, optional
        Whether the field is mandatory on the real Swiss tax form.
        Defaults to ``False``.
    options : list | None, optional
        For ``ftype="select"`` only: the list of valid option values.
        Passed straight through to the descriptor so the agent knows which
        values are accepted.

    Returns
    -------
    dict
        A field-descriptor dictionary with keys ``type``, ``locator``,
        ``label``, ``value`` (always ``""`` here; filled in at scan time),
        ``required``, and optionally ``options``.
    """
    return {
        "type": ftype,
        "locator": locator,
        "label": label,
        "value": "",            # populated at scan time by FlaskBridge.scan_page()
        "required": required,
        # Only include "options" key if options were provided (avoids noise for non-selects)
        **({"options": options} if options else {}),
    }


# ── Page Field Definitions ────────────────────────────────────────────────────
# A static catalogue of every field (and button) on every page of the tax form.
#
# Used by ``FlaskBridge.scan_page()`` (called via the ``scan_page`` MCP tool):
# the bridge looks up the current page path in this dict, copies the list,
# injects the current stored value into each descriptor's ``"value"`` key,
# and returns the populated list to the agent.
#
# For **dynamic** pages (those with add-row tables), the list contains a
# ``{"type": "button", ...}`` entry instead of field descriptors.  The bridge's
# ``scan_page`` implementation then appends one descriptor per existing row
# on top of this static entry.
#
# Keys are page path strings matching entries in ``PAGE_ORDER``.
PAGE_FIELD_DEFS: dict[str, list[dict]] = {

    # ── personal ─────────────────────────────────────────────────────────────
    # Main taxpayer identity page.  Includes both the taxpayer and partner
    # sub-sections (partner fields are always rendered; agent skips them if single).
    "personal": [
        # Taxpayer identity
        _field("field-personal-main-firstName",     "First Name",    required=True),
        _field("field-personal-main-lastName",      "Last Name",     required=True),
        _field("field-personal-main-dateofbirth",   "Date of Birth", "date", required=True),
        # Address
        _field("field-personal-main-street",        "Street"),
        _field("field-personal-main-streetNumber",  "Street Number"),
        _field("field-personal-main-apartment",     "Apartment"),
        _field("field-personal-main-zip",           "ZIP Code"),
        _field("field-personal-main-city",          "City"),
        # Contact
        _field("field-personal-main-phone",         "Phone"),
        _field("field-personal-main-email",         "Email"),
        # Swiss-specific identifiers
        _field("field-personal-main-ahvnumber",     "AHV Number", required=True),
        _field("field-personal-main-maritalstatus", "Marital Status", "select",
               options=["single", "married", "divorced", "widowed", "separated"]),
        _field("field-personal-main-religion",      "Religion", "select",
               options=["", "protestant", "catholic", "other", "none"]),
        # Employment info
        _field("field-personal-main-occupation",    "Occupation"),
        _field("field-personal-main-employer",      "Employer"),
        _field("field-personal-main-workplace",     "Workplace"),

        # Partner sub-section (agent fills these only if maritalstatus == "married")
        _field("field-personal-partner-firstName",  "Partner First Name"),
        _field("field-personal-partner-lastName",   "Partner Last Name"),
        _field("field-personal-partner-dateofbirth","Partner Date of Birth", "date"),
        _field("field-personal-partner-ahvnumber",  "Partner AHV Number"),
        _field("field-personal-partner-occupation", "Partner Occupation"),
        _field("field-personal-partner-employer",   "Partner Employer"),
        _field("field-personal-partner-religion",   "Partner Religion", "select",
               options=["", "protestant", "catholic", "other", "none"]),
    ],

    # ── personal/children ────────────────────────────────────────────────────
    # Dynamic table: one row per dependent child.
    # The button entry tells the agent how to add a new row.
    # ``scan_page`` appends live row fields from the current form state.
    "personal/children": [
        {"type": "button", "locator": "btn-add-row-personal-children",
         "label": "+ Add Child", "content": "+ Add Child"},
    ],

    # ── personal/supported ───────────────────────────────────────────────────
    # Dynamic table: financially supported persons (parents, siblings, etc.)
    "personal/supported": [
        {"type": "button", "locator": "btn-add-row-personal-supported",
         "label": "+ Add Supported Person", "content": "+ Add Supported Person"},
    ],

    # ── personal/representative ──────────────────────────────────────────────
    # Optional: if the taxpayer has a tax advisor or legal representative
    "personal/representative": [
        _field("field-personal-representative-name",    "Representative Name"),
        _field("field-personal-representative-address", "Address"),
        _field("field-personal-representative-phone",   "Phone"),
    ],

    # ── personal/gifts-received ──────────────────────────────────────────────
    # Dynamic table: gifts, inheritances, or other wealth transfers received
    "personal/gifts-received": [
        {"type": "button", "locator": "btn-add-row-personal-giftsreceived",
         "label": "+ Add Gift Received", "content": "+ Add Gift Received"},
    ],

    # ── personal/gifts-given ─────────────────────────────────────────────────
    # Dynamic table: donations or gifts given (some are tax-deductible)
    "personal/gifts-given": [
        {"type": "button", "locator": "btn-add-row-personal-giftsgiven",
         "label": "+ Add Gift Given", "content": "+ Add Gift Given"},
    ],

    # ── personal/capital-benefits ────────────────────────────────────────────
    # One-off lump-sum payments (e.g. pension lump sum, severance pay)
    "personal/capital-benefits": [
        _field("field-personal-capitalbenefits-description", "Description"),
        _field("field-personal-capitalbenefits-amount",      "Amount (CHF)", "number"),
    ],

    # ── personal/bank-details ────────────────────────────────────────────────
    # Where the tax authority should send the refund
    "personal/bank-details": [
        _field("field-personal-bankdetails-iban",          "IBAN"),
        _field("field-personal-bankdetails-bankname",      "Bank Name"),
        _field("field-personal-bankdetails-accountholder", "Account Holder"),
    ],

    # ── income ───────────────────────────────────────────────────────────────
    # Main employment income page.  Values come from the Lohnausweis (box 1, 9, 10).
    # Also contains the self-employment toggle/fields.
    "income": [
        {"type": "text", "content": "Employment Income"},
        _field("field-income-employment-bruttolohn",      "Gross Salary / Bruttolohn (CHF)", "number", True),
        _field("field-income-employment-ahvcontributions","AHV/IV/EO Contributions (CHF)", "number"),
        _field("field-income-employment-bvgcontributions","BVG/Pension Contributions (CHF)", "number"),
        {"type": "text", "content": "Self-Employment Income"},
        _field("field-income-selfemployment-revenue",    "Revenue (CHF)", "number"),
        _field("field-income-selfemployment-expenses",   "Expenses (CHF)", "number"),
        _field("field-income-selfemployment-netincome",  "Net Income (CHF)", "number"),
    ],

    # ── income/pensions ──────────────────────────────────────────────────────
    # Swiss pension system: 1st pillar (AHV state pension) + 2nd pillar (BVG)
    # and lump-sum capital withdrawals from the pension fund
    "income/pensions": [
        _field("field-income-pension-ahvpension",           "AHV Pension (CHF)", "number"),
        _field("field-income-pension-bvgpension",           "BVG/Pension Fund (CHF)", "number"),
        _field("field-income-pension-otherpension",         "Other Pension (CHF)", "number"),
        _field("field-income-capitalwithdrawals-amount",    "Capital Withdrawal (CHF)", "number"),
    ],

    # ── income/securities-income ─────────────────────────────────────────────
    # Taxable investment income (withholding tax may already have been deducted)
    "income/securities-income": [
        _field("field-income-investment-dividends", "Dividends (CHF)", "number"),
        _field("field-income-investment-interest",  "Interest Income (CHF)", "number"),
    ],

    # ── income/property-income ───────────────────────────────────────────────
    # Property owners must declare the Eigenmietwert (imputed rent) as income,
    # even if they live in the property themselves (Swiss tax peculiarity)
    "income/property-income": [
        _field("field-income-rental-eigenmietwert",   "Eigenmietwert (CHF)", "number"),
        _field("field-income-rental-rentalincome",    "Rental Income (CHF)", "number"),
        _field("field-income-rental-maintenancecosts","Maintenance Costs (CHF)", "number"),
    ],

    # ── income/other ─────────────────────────────────────────────────────────
    # Alimony and miscellaneous taxable income
    "income/other": [
        _field("field-income-alimony-amount",       "Alimony Received (CHF)", "number"),
        _field("field-income-otherincome-description","Description"),
        _field("field-income-otherincome-amount",   "Amount (CHF)", "number"),
    ],

    # ── deductions ───────────────────────────────────────────────────────────
    # Commuting and meal deductions — the most commonly claimed deductions
    "deductions": [
        _field("field-deductions-fahrkosten-amount",      "Commuting Costs (CHF)", "number"),
        _field("field-deductions-fahrkosten-description", "Description"),
        _field("field-deductions-verpflegung-amount",     "Meal Deduction / Verpflegung (CHF)", "number"),
    ],

    # ── deductions/professional ──────────────────────────────────────────────
    # Berufsauslagen: work-related professional expenses.
    # The taxpayer chooses between:
    #   "flat-rate" — 3 % of gross salary, minimum CHF 2 000, maximum CHF 4 000
    #   "effective" — actual itemised expenses (usually more for high earners)
    "deductions/professional": [
        _field("field-deductions-berufsauslagen-type", "Professional Expenses Type", "select",
               options=["flat-rate", "effective"]),
        _field("field-deductions-flatrate-amount",     "Flat-Rate Amount (CHF)", "number"),
        _field("field-deductions-weitereberufsauslagen-amount",
               "Other Professional Expenses (CHF)", "number"),
        _field("field-deductions-weitereberufsauslagen-description", "Description"),
    ],

    # ── deductions/debt-interest ─────────────────────────────────────────────
    # Interest paid on mortgages and other personal debt (Schuldzinsen)
    "deductions/debt-interest": [
        _field("field-deductions-schuldzinsen-amount", "Debt Interest / Schuldzinsen (CHF)", "number"),
    ],

    # ── deductions/alimony ───────────────────────────────────────────────────
    # Alimony paid to a former spouse or partner (deductible)
    "deductions/alimony": [
        _field("field-deductions-unterhaltsbeitraege-amount",    "Alimony Paid (CHF)", "number"),
        _field("field-deductions-unterhaltsbeitraege-recipient", "Recipient"),
    ],

    # ── deductions/insurance ─────────────────────────────────────────────────
    # Health and accident insurance premiums (Krankenkasse, Unfallversicherung)
    "deductions/insurance": [
        _field("field-deductions-insurance-amount", "Insurance Premiums (CHF)", "number"),
    ],

    # ── deductions/medical ───────────────────────────────────────────────────
    # Out-of-pocket medical expenses above the cantonal deductible threshold
    "deductions/medical": [
        _field("field-deductions-medical-amount", "Medical Expenses (CHF)", "number"),
    ],

    # ── deductions/other ─────────────────────────────────────────────────────
    # All remaining deductions: Pillar 3a, charitable donations, childcare,
    # training costs, dual-income deduction, and a free-text catch-all
    "deductions/other": [
        _field("field-deductions-pillar3a-amount",              "Pillar 3a (CHF)", "number"),
        _field("field-deductions-donations-amount",             "Donations / Spenden (CHF)", "number"),
        _field("field-deductions-donations-recipient",          "Recipient Organization"),
        _field("field-deductions-kinderbetreuungskosten-amount","Childcare Costs (CHF)", "number"),
        _field("field-deductions-weiterbildungskosten-amount",  "Training Costs (CHF)", "number"),
        _field("field-deductions-zweiverdienerabzug-amount",
               "Dual-Income Deduction / Zweiverdienerabzug (CHF)", "number"),
        _field("field-deductions-otherdeductions-description",  "Other Deductions Description"),
        _field("field-deductions-otherdeductions-amount",       "Other Deductions Amount (CHF)", "number"),
    ],

    # ── wealth ───────────────────────────────────────────────────────────────
    # Main wealth page shows bank accounts and securities — both dynamic tables
    "wealth": [
        {"type": "button", "locator": "btn-add-row-wealth-bankaccounts",
         "label": "+ Add Bank Account", "content": "+ Add Bank Account"},
        {"type": "button", "locator": "btn-add-row-wealth-securities",
         "label": "+ Add Security", "content": "+ Add Security"},
    ],

    # ── wealth/movable ────────────────────────────────────────────────────────
    # Cash, precious metals held outside a bank account
    "wealth/movable": [
        _field("field-wealth-movableassets-cashgold", "Cash / Gold (CHF)", "number"),
    ],

    # ── wealth/insurance ──────────────────────────────────────────────────────
    # Life/endowment insurance policies — taxed on surrender value
    "wealth/insurance": [
        {"type": "button", "locator": "btn-add-row-wealth-insurances",
         "label": "+ Add Insurance", "content": "+ Add Insurance"},
    ],

    # ── wealth/vehicles ───────────────────────────────────────────────────────
    # Cars, motorcycles, boats — taxed on estimated current market value
    "wealth/vehicles": [
        {"type": "button", "locator": "btn-add-row-wealth-vehicles",
         "label": "+ Add Vehicle", "content": "+ Add Vehicle"},
    ],

    # ── wealth/real-estate ────────────────────────────────────────────────────
    # Owner-occupied or investment real estate, plus a catch-all for other assets
    "wealth/real-estate": [
        _field("field-wealth-realestate-address",        "Property Address"),
        _field("field-wealth-realestate-eigenmietwert",  "Eigenmietwert (CHF)", "number"),
        _field("field-wealth-realestate-steuerwert",     "Steuerwert / Tax Value (CHF)", "number"),
        _field("field-wealth-otherassets-description",   "Other Assets Description"),
        _field("field-wealth-otherassets-value",         "Other Assets Value (CHF)", "number"),
    ],

    # ── wealth/debts ──────────────────────────────────────────────────────────
    # Outstanding loans (mortgage balance, personal loans, etc.)
    # These are subtracted from gross wealth to get the taxable net wealth
    "wealth/debts": [
        {"type": "button", "locator": "btn-add-row-wealth-debts",
         "label": "+ Add Debt", "content": "+ Add Debt"},
    ],

    # ── attachments ───────────────────────────────────────────────────────────
    # File upload page — the agent cannot fill uploads programmatically.
    # The agent reads this sentinel string and skips the page.
    "attachments": [
        {"type": "text", "content": "File uploads — not programmatically fillable. Return {}."},
    ],

    # ── review ────────────────────────────────────────────────────────────────
    # Final review page with the submit button.
    # The agent clicks the submit button after filling all other pages.
    "review": [
        {"type": "text", "content": "Please review all entries before submitting."},
        {"type": "button", "locator": "btn-submit", "label": "Submit Tax Return",
         "content": "Submit & Export JSON"},
    ],
}


# ── Row Field Definitions ─────────────────────────────────────────────────────
# Column descriptors for every dynamic (add-row) table section.
#
# The ``_inject_array_rows()`` method in ``FlaskBridge`` uses these definitions
# when constructing the list of field descriptors returned by ``scan_page`` for
# a dynamic section.  For each existing row in the form's array, it generates
# one field descriptor per column, with a locator like:
#
#     field-{page}-{section}-{row_index}-{column_name}
#
# Structure: { page_key: { section_key: [ {name, label, type}, … ] } }
ROW_FIELD_DEFS: dict[str, dict[str, list[dict]]] = {
    "personal": {
        # Columns for the children table
        "children": [
            {"name": "name",        "label": "Child Name",     "type": "input"},
            {"name": "dateOfBirth", "label": "Date of Birth",  "type": "date"},
            {"name": "relationship","label": "Relationship",   "type": "input"},
        ],
        # Columns for the supported persons table
        "supported": [
            {"name": "name",         "label": "Name",              "type": "input"},
            {"name": "relationship", "label": "Relationship",      "type": "input"},
            {"name": "contribution", "label": "Contribution (CHF)","type": "number"},
        ],
        # Columns for the gifts received table
        "giftsreceived": [
            {"name": "description", "label": "Description",   "type": "input"},
            {"name": "date",        "label": "Date",          "type": "date"},
            {"name": "amount",      "label": "Amount (CHF)",  "type": "number"},
        ],
        # Columns for the gifts given table
        "giftsgiven": [
            {"name": "description", "label": "Description",   "type": "input"},
            {"name": "date",        "label": "Date",          "type": "date"},
            {"name": "amount",      "label": "Amount (CHF)",  "type": "number"},
        ],
    },
    "wealth": {
        # Columns for the bank accounts table
        "bankaccounts": [
            {"name": "bankName", "label": "Bank Name",      "type": "input"},
            {"name": "balance",  "label": "Balance (CHF)",  "type": "number"},
            {"name": "interest", "label": "Interest (CHF)", "type": "number"},
        ],
        # Columns for the securities (stocks/bonds) table
        "securities": [
            {"name": "name",        "label": "Security Name",      "type": "input"},
            {"name": "isin",        "label": "ISIN",               "type": "input"},
            {"name": "quantity",    "label": "Quantity",           "type": "number"},
            {"name": "value",       "label": "Value (CHF)",        "type": "number"},
            {"name": "grossReturn", "label": "Gross Return (CHF)", "type": "number"},
        ],
        # Columns for the insurance policies table
        "insurances": [
            {"name": "company",        "label": "Company",                "type": "input"},
            {"name": "policyNumber",   "label": "Policy Number",          "type": "input"},
            {"name": "surrenderValue", "label": "Surrender Value (CHF)",  "type": "number"},
        ],
        # Columns for the vehicles table
        "vehicles": [
            {"name": "type",  "label": "Type",          "type": "input"},
            {"name": "brand", "label": "Brand",         "type": "input"},
            {"name": "year",  "label": "Year",          "type": "number"},
            {"name": "value", "label": "Value (CHF)",   "type": "number"},
        ],
        # Columns for the debts table
        "debts": [
            {"name": "creditor", "label": "Creditor",      "type": "input"},
            {"name": "amount",   "label": "Amount (CHF)",  "type": "number"},
        ],
    },
    "deductions": {
        # Columns for the effective (itemised) professional expenses table
        "effective": [
            {"name": "description", "label": "Description",  "type": "input"},
            {"name": "amount",      "label": "Amount (CHF)", "type": "number"},
        ],
    },
}
