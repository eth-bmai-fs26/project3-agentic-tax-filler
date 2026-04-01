"""Document catalog — builds descriptions for persona documents.

The Plan phase of the agent sees only document names and descriptions,
not their full content.  This module provides that metadata.
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .server import MCPServer

logger = logging.getLogger("mcp_server.doc_catalog")

# ---------------------------------------------------------------------------
# Known document descriptions (matched by prefix/substring)
# ---------------------------------------------------------------------------

_DESCRIPTIONS: list[tuple[str, str]] = [
    # Profile
    ("profile.json", "Personal information: name, address, date of birth, AHV number, marital status, nationality"),
    # Salary certificates
    ("lohnausweis_marco", "Salary certificate for Marco: gross salary, AHV/BVG contributions, employer, canteen, expenses"),
    ("lohnausweis_laura", "Salary certificate for Laura: gross salary, AHV/BVG contributions, employer, canteen, expenses"),
    ("lohnausweis_thomas", "Salary certificate for Thomas: gross salary (partial year before retirement), AHV/BVG, employer"),
    ("lohnausweis_elisabeth", "Salary certificate for Elisabeth: gross salary, AHV/BVG contributions, employer"),
    ("lohnausweis", "Salary certificate (Lohnausweis): gross salary, AHV/BVG contributions, employer, canteen status, expenses"),
    # Bank statements
    ("bank_statement_joint", "Joint bank account transactions: salary credits, rent, purchases, interest (Zinsabschluss), year-end balance"),
    ("bank_statement", "Bank account transactions: salary credits, rent, purchases, interest (Zinsabschluss), year-end balance"),
    # Pillar 3a
    ("pillar_3a_laura", "Pillar 3a pension confirmation for Laura: annual contribution amount, provider"),
    ("pillar_3a_marco", "Pillar 3a pension confirmation for Marco: annual contribution amount, provider"),
    ("pillar_3a_elisabeth", "Pillar 3a pension confirmation for Elisabeth: annual contribution amount, provider"),
    ("pillar_3a", "Pillar 3a pension confirmation: annual contribution amount, provider"),
    # Transport
    ("zvv_receipt", "Public transport annual pass receipt: ZVV zone, cost, validity period"),
    # Childcare
    ("kita_receipt_blurry", "Childcare (KiTa) receipt — partially blurry: monthly cost, child name, facility"),
    ("kita_receipt", "Childcare (KiTa) receipt: monthly cost, child name, facility name"),
    # Property
    ("property_assessment", "Property tax assessment from Gemeinde: Eigenmietwert, Steuerwert (tax value), address"),
    # Medical
    ("medical_receipts", "Medical expense receipts: doctor visits, prescriptions, therapy costs, amounts"),
    # Freelance
    ("freelance_expenses", "Freelance business expenses: office supplies, software, travel, equipment costs"),
    ("freelance_invoice", "Freelance invoice: client name, service description, amount billed, date"),
    # Securities / investments
    ("securities_portfolio", "Securities portfolio statement: stock holdings, dividends, market values as of Dec 31"),
    ("interactive_brokers", "Interactive Brokers brokerage statement: foreign securities, dividends (USD), capital gains, year-end values"),
    # Retirement
    ("ahv_rentenbescheinigung", "AHV pension certificate: annual pension amount received"),
    ("pensionskasse", "Pension fund (BVG) statement: pension amount, capital withdrawal options"),
    ("freizuegigkeitskonto", "Vested benefits account (Freizügigkeit): account balance, interest earned"),
    # Divorce
    ("divorce_decree", "Divorce decree: date of divorce, custody arrangement, alimony (spousal + child support) amounts"),
    ("email_ex_husband", "Email correspondence with ex-husband: alimony payment details, informal agreements"),
    # Education
    ("german_course_receipt", "German language course receipt: course fee, provider, dates"),
    # Membership / other
    ("physiosuisse_membership", "PhysioSuisse professional membership: annual fee, membership type"),
]


def build_document_catalog(server: "MCPServer") -> list[dict]:
    """Build a catalog of available documents with human-readable descriptions.

    Parameters
    ----------
    server : MCPServer
        An initialised server (used to call ``list_documents()``).

    Returns
    -------
    list[dict]
        Each entry: ``{"filename": str, "description": str}``.
    """
    filenames = server.list_documents()
    catalog = []

    for filename in filenames:
        description = _describe(filename)
        catalog.append({"filename": filename, "description": description})

    logger.info("Document catalog built: %d documents", len(catalog))
    return catalog


def _describe(filename: str) -> str:
    """Match a filename to its description."""
    name_lower = filename.lower()
    stem = filename.rsplit(".", 1)[0].lower() if "." in filename else name_lower

    for prefix, description in _DESCRIPTIONS:
        if stem.startswith(prefix) or prefix in stem:
            return description

    # Fallback: generate from filename
    readable = stem.replace("_", " ").replace("-", " ").title()
    return f"Document: {readable}"
