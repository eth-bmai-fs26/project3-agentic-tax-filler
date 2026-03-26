"""
The Agent Brain -- LLM prompting, page navigation, and field filling.

This is the most important module in the backend.  It contains the
``think()`` function, which is the main loop that drives the AI agent.
Originally developed in a Jupyter notebook (cells 8 + 11), it has been
refactored into a standalone service.

What this module does
---------------------
1. **Pre-reads** all of the taxpayer's documents (salary statements,
   bank statements, etc.) so the LLM has full context.
2. **Pre-loads** tax guide documents (HTML/text files with Swiss tax
   rules and thresholds) so the LLM can look up exact rules.
3. **Navigates** through the tax form page by page (personal, income,
   deductions, wealth, review).
4. **Prompts the LLM** for each page: "Given these documents, these
   guides, and these form fields, what values should I fill?"
5. **Fills fields** by calling the MCP server's fill_field tool.
6. **Handles dynamic rows** (e.g., adding rows for multiple children
   or bank accounts).
7. **Interacts with the NPC** (simulated taxpayer) when the LLM needs
   clarifying information.
8. **Submits** the form when the review page is reached.

The module uses an OpenAI-compatible client, which means it works with
Gemini, OpenAI, Anthropic, or a local Ollama server -- all through
the same ``client.chat.completions.create()`` API.

Architecture context
--------------------
::

    agent_service.py  --->  think_service.py (this file)
                                |
                +---------------+----------------+
                |               |                |
           MCPServer      LLM (via API)    Tax Guides
          (tools)        (brain)          (reference docs)
"""

import json
import logging
import re
import time
from pathlib import Path

from openai import OpenAI

# Logger for this module -- messages go to Python's standard logging system.
# The log level can be configured externally (e.g., in app.py or via env vars).
logger = logging.getLogger("think_service")


# ---------------------------------------------------------------------------
# Guide extraction helpers
# ---------------------------------------------------------------------------
# Tax guides are stored as HTML or plain text files in the guides/ folder.
# These functions load and clean them so they can be included in the LLM
# prompt as reference material.
# ---------------------------------------------------------------------------

def extract_guide_text(html_path: str) -> str:
    """
    Strip HTML tags and style blocks from a guide file, returning plain text.

    This is necessary because the guides are stored as HTML files (from
    web scraping), but the LLM needs plain text to process them.

    The cleaning process:
    1. Remove all ``<style>`` blocks (CSS rules are noise for the LLM).
    2. Replace all remaining HTML tags with spaces.
    3. Collapse multiple whitespace characters into single spaces.

    Parameters
    ----------
    html_path : str
        Absolute path to the HTML guide file.

    Returns
    -------
    str
        The cleaned plain-text content of the guide.
    """
    with open(html_path) as f:
        html = f.read()
    # Remove <style>...</style> blocks entirely (CSS is not useful for the LLM)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    # Replace any remaining HTML tags with a space
    text = re.sub(r'<[^>]+>', ' ', html)
    # Collapse multiple whitespace characters into a single space
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def load_all_guides(guides_folder) -> dict:
    """
    Load all guide texts from the guides folder.

    Supports HTML, plain text (.txt), and Markdown (.md) files.

    Parameters
    ----------
    guides_folder : str or Path
        Path to the directory containing guide files.

    Returns
    -------
    dict
        A dictionary mapping the filename stem (without extension) to
        the guide's text content.  For example:
        ``{"velo-pauschale-fahrkosten": "Guide text here..."}``
    """
    guides = {}
    folder = Path(guides_folder)
    if not folder.exists():
        return guides
    for f in sorted(folder.iterdir()):
        if f.suffix == '.html':
            guides[f.stem] = extract_guide_text(str(f))
        elif f.suffix in ('.txt', '.md'):
            guides[f.stem] = f.read_text(encoding='utf-8')
    return guides


# ---------------------------------------------------------------------------
# Page-to-guide mapping
# ---------------------------------------------------------------------------
# Each form section (personal, income, etc.) may have relevant tax guides.
# This mapping tells the agent which guides to include in the LLM prompt
# when processing a particular page.  The keys are the top-level section
# names (derived from the page name by taking the part before "/").
# ---------------------------------------------------------------------------
PAGE_GUIDE_MAP = {
    "personal": [
        "scheidung-unterhalt-steuern",         # Divorce and alimony tax rules
    ],
    "income": [
        "freelance-nebenberuf-steuern",        # Freelance / side-job tax rules
        "pensionierung-kapital-rente",          # Retirement income (pension vs capital)
        "verrechnungssteuer-rueckerstattung",   # Withholding tax refund rules
    ],
    "deductions": [
        "kinderbetreuung-abzug-maximum",        # Childcare deduction caps
        "krankheitskosten-schwelle-5-prozent",  # Medical expenses 5% threshold
        "homeoffice-fahrkosten-optimierung",    # Home office vs commuting trade-off
        "velo-pauschale-fahrkosten",            # Bicycle commuting flat rate
    ],
    "wealth": [
        "verrechnungssteuer-rueckerstattung",   # Withholding tax on dividends
        "krypto-steuern-privat-professionell",  # Crypto tax rules
    ],
}


def get_guides_for_page(page_name: str, all_guides: dict) -> str:
    """
    Return concatenated guide text relevant to a specific form page.

    The page name (e.g., "deductions/professional") is split at "/" to
    get the top-level section ("deductions"), which is looked up in
    ``PAGE_GUIDE_MAP`` to find relevant guide keys.  Each matching guide
    is truncated to 3000 characters to keep the prompt within LLM token
    limits.

    Parameters
    ----------
    page_name : str
        The current form page name (e.g., "income/pensions").
    all_guides : dict
        All loaded guides from ``load_all_guides()``.

    Returns
    -------
    str
        Concatenated guide texts, or empty string if no guides apply.
    """
    # Extract the top-level section from the page name
    # e.g., "deductions/professional" -> "deductions"
    section = page_name.split("/")[0]
    guide_keys = PAGE_GUIDE_MAP.get(section, [])
    if not guide_keys:
        return ""
    parts = []
    for key in guide_keys:
        if key in all_guides:
            # Truncate each guide to 3000 chars to avoid blowing up the prompt
            parts.append(f"=== Guide: {key} ===\n{all_guides[key][:3000]}")
    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# LLM System Prompts
# ---------------------------------------------------------------------------
# These prompt strings are sent to the LLM as the "system" message.
# They instruct the LLM on its role, the expected response format,
# and the rules it must follow.
#
# BASE_PROMPT: The core instructions that apply to every page.
# SECTION_PROMPTS: Additional instructions specific to each form section
#   (personal, income, deductions, wealth, attachments, review).
# POLICY_KB_TEXT: A condensed "knowledge base" of Zurich tax policy rules
#   that the LLM should reference for thresholds, formulas, and edge cases.
# ---------------------------------------------------------------------------

BASE_PROMPT = """You are an expert Swiss tax accountant AI filling a Zurich tax return.

You will be shown:
1. ALL the taxpayer's documents (pre-read for you)
2. The fields on the CURRENT form page (with their locators, labels, and current values)
3. A history of what you already filled on previous pages
4. RELEVANT TAX GUIDES with the rules and thresholds you need for this page

Your task: decide which fields to fill on this page and what values to use.
IMPORTANT: Use the TAX GUIDES provided to look up exact amounts, thresholds, and formulas. Do NOT guess tax rules from memory.

## Response Format
Return ONLY a JSON object mapping field locators to values:
{"field-locator-1": "value1", "field-locator-2": "value2", ...}

If NO fields on this page need filling (irrelevant section), return: {}

Include a "_thought" key to explain your reasoning and cite which guide rule you applied:
{"_thought": "Per Wegleitung Section 2.2: field 14.1 = Ja → meal deduction CHF 1,600", "field-deductions-verpflegung-amount": "1600"}

## Rules
- ONLY use locators shown in the current page fields — NEVER guess locators.
- For married couples: check if the form has separate fields for each spouse or expects totals.
- If a field already has the correct value, do NOT include it in your response.
- If a field is required but you have no data for it, skip it (don't make up values).
- If a section has no relevant data, return {} — do NOT fill fields with empty strings, "None", "0", or placeholder text like "Please provide...".
- NEVER write a human-readable message into a form field. If you need information from the user, note it in _thought — do not put it in a field value.
- Donations (Spenden) go in the DEDUCTIONS section (deductions/other), NOT in "gifts given".
- Always cite the specific guide rule in your _thought when applying a threshold or formula.

## When to use ask_user
If the current section includes "## Fields to verify with taxpayer", you
MUST use "_ask_user" for EVERY field listed there — even if you think the
documents already contain the answer. The taxpayer often has verbal knowledge
that supplements or corrects the documents. Ask ONE question at a time:
{"_ask_user": "How much did you pay for childcare per month?", "field-x": "value"}
Do NOT ask about fields that are NOT listed under "Fields to verify".
Do NOT skip listed fields — the taxpayer interaction is required for grading.

"""

SECTION_PROMPTS = {
    "personal": """## Personal Details — FILL EVERY FIELD YOU HAVE DATA FOR
- **Name, Address, DOB, AHV**: Extract from profile.json. Parse address into street, streetNumber, zip, city.
- **Marital status**: "single", "married", "divorced", "widowed", or "separated".
- **Occupation & Employer**: Extract from the Lohnausweis.
- **Partner fields**: Always visible. Fill ALL partner fields if married, using partner data from profile.json and partner's Lohnausweis. Leave empty if not married.
- **Children**: Fill BOTH name AND dateOfBirth. Include "_rows_needed": N if rows need adding.
- **Filing status after divorce**: Consult the DIVORCE GUIDE for rules on filing status and the critical date.
- **Bank details**: Fill IBAN/bank name ONLY if available in documents. Do not invent.
""",

    "income": """## Income Section — CONSULT THE GUIDES FOR CLASSIFICATION RULES

### Employment Income
- Use Lohnausweis fields: Bruttolohn (field 1), AHV (field 9), BVG (field 10).
- Dienstaltersgeschenke (field 6) are ALREADY INCLUDED in Bruttolohn (field 1). Do NOT add them separately.
- For married couples: sum both Lohnausweise if only one set of fields exists.
- Interest income: sum ALL "Zinsabschluss" entries from bank statement CSV.

### Self-Employment Income
- Consult the FREELANCE GUIDE for rules on declaring revenue, expenses, and the AHV threshold.
- If the taxpayer has freelance invoices, fill revenue, expenses, and netincome fields.
- If NO self-employment, leave fields empty (do NOT fill with 0).

### Retirement Income
- Consult the RETIREMENT GUIDE for how to classify pensions vs capital withdrawals.
- Capital withdrawals go on the Kapitalbezüge form, NOT regular income.
- Freizügigkeitskonto: balance = wealth, interest = income.

### Investment Income
- Consult the VERRECHNUNGSSTEUER GUIDE for dividend withholding tax rules.
- Foreign dividends: convert to CHF using ESTV year-end exchange rate.
- Capital gains from private investing are TAX-FREE — do NOT declare as income.

### Alimony
- Consult the DIVORCE GUIDE for the critical distinction between spousal support (taxable) and child support (NOT taxable).
""",

    "deductions": """## Deductions Section — CONSULT THE GUIDES FOR ALL THRESHOLDS AND FORMULAS

### Verpflegungspauschale (Meal Deduction)
- Check Lohnausweis field 14.1 and consult the POLICY RULES for the exact amounts.
- Part-time: prorate by Pensum percentage.
- For couples: calculate EACH spouse separately, then sum.

### Berufsauslagen (Professional Expenses)
- Consult the POLICY RULES for the Pauschale formula (percentage, min, max).
- Show your calculation in _thought.
- You MUST fill the weitereberufsauslagen-amount field with the calculated Pauschale value. Do not just set the type — also fill the amount.
- If claiming flat-rate: do NOT also claim individual professional expenses separately.

### Fahrkosten (Commuting Costs)
- Consult the FAHRKOSTEN and VELO-PAUSCHALE GUIDES for what qualifies.
- SBB Halbtax is NOT a commuting deduction.
- Consult the HOME OFFICE GUIDE if the taxpayer works from home — there's a trade-off.

### Pillar 3a
- Consult the POLICY RULES for the maximum per person.
- For couples: sum both if both have confirmations, cap each individually.

### Debt Interest (Schuldzinsen)
- Sum ALL mortgage interest payments from bank statement. Count monthly entries carefully.

### Childcare (Kinderbetreuungskosten)
- Consult the CHILDCARE GUIDE for the Zurich cantonal cap and age limits.
- If receipts exceed the cap, claim only up to the cap.

### Medical Expenses (Krankheitskosten)
- Consult the MEDICAL GUIDE for the 5% threshold rule.
- Calculate the threshold FIRST. If costs are below threshold, enter NOTHING (not the raw amount).

### Zweiverdienerabzug (Dual-Income Deduction)
- Consult the POLICY RULES for the exact Zurich cantonal amount.
- Applies when BOTH spouses are employed.

### Alleinerziehenden-Abzug (Single Parent Deduction)
- Consult the DIVORCE GUIDE — divorced/single parents with primary custody may qualify.
- If the taxpayer is divorced/single AND has children living with them, claim this deduction.
- Look for a field for this deduction on the form. If no dedicated field exists, add it under otherdeductions.

### Donations
- Consult the POLICY RULES for minimum threshold and qualifying organizations.
- Check bank statement for "Spende" entries.
""",

    "wealth": """## Wealth Section — CONSULT THE GUIDES FOR DECLARATION RULES

### Bank Accounts
- Balance: use the LAST line of the bank statement CSV (Dec 31 balance).
- Interest: sum ALL "Zinsabschluss" entries.
- Include "_rows_needed": N if rows need adding.

### Securities
- Consult the VERRECHNUNGSSTEUER GUIDE — if Swiss dividends exist, claim the 35% refund.
- Foreign securities: convert to CHF using ESTV year-end exchange rate.
- Fill the Wertschriftenverzeichnis completely — empty securities with declared dividends is a red flag.

### Real Estate
- Use Steuerwert from Gemeinde assessment (NOT market value).
- Eigenmietwert: use Kantonssteuer value.
- If property documents are missing but the address is known, fill the address field anyway.
- Mortgage interest: deductible. Mortgage balance: declare as debt.

### Debts
- Mortgage outstanding balance: use the amount from property docs if available.
- If mortgage interest payments exist but no balance document, leave amount field EMPTY.
- Fill the creditor name if identifiable from documents.

### Dynamic Rows
- Include "_rows_needed": N if rows need adding.
- If rows already exist, fill directly.
""",

    "attachments": """## Attachments
- File upload fields cannot be programmatically filled. Return {} for this section.
""",

    "review": """## Review
- This is the final review page. Return {} — the code will handle submission.
""",
}

POLICY_KB_TEXT = """
=== ZURICH TAX POLICY RULES (Wegleitung) ===

1. INCOME CLASSIFICATION
- Dienstaltersgeschenke (field 6) are ALREADY INCLUDED in Bruttolohn (field 1). Do NOT add them as separate income or add them to Bruttolohn again.
- Lohnausweis (Formular 11) is authoritative for employment income.
- Bruttolohn (field 1) = gross salary. Dienstaltersgeschenke (field 6) are ALREADY INCLUDED in field 1.
- Spesenvergütungen (field 13) are NOT income — do not add or re-claim.
- Two Lohnausweise (job change): sum both gross salaries.
- Self-employment: declare as Nebentätigkeit. If total > CHF 2,300/year → AHV registration required.
- AHV/BVG pensions: ordinary income. Capital withdrawals: separate, reduced-rate taxation.
- Freizügigkeitskonto: balance = wealth, interest = income.
- Bank interest: sum all Zinsabschluss entries.
- Swiss dividends: declare gross. Claim 35% Verrechnungssteuer refund.
- Foreign dividends: convert to CHF at ESTV year-end rate.
- Private capital gains (stocks, crypto): TAX-FREE.
- Spousal support received: taxable income. Child support received: NOT income.

2. DEDUCTIONS
- Verpflegung: field 14.1 Ja → CHF 1,600; Nein → CHF 3,200. Prorate for part-time.
- Berufsauslagen Pauschale: 3% of Nettolohn (field 12), min CHF 2,000, max CHF 4,000 per person.
- Fahrkosten: annual public transport pass. Velo-Pauschale CHF 700 for qualifying distances.
- Home office: CHF 3/day but reduces commuting deduction proportionally.
- Pillar 3a: max CHF 7,056 (employed with BVG), max CHF 35,280 (self-employed without BVG).
- Donations: min CHF 100, to recognized organizations.
- Kinderbetreuung: max CHF 10,100 per child, under 14 years.
- Medical: deductible ONLY above 5% of net income.
- Zweiverdienerabzug: CHF 5,900 (Zurich Kantonssteuer) when both spouses employed.
- Alleinerziehenden-Abzug: for single/divorced parents with primary custody.
- Schuldzinsen: sum all mortgage interest payments.
- No double-counting: flat-rate Berufsauslagen covers all professional expenses.

3. PROPERTY
- Eigenmietwert: declare as income (use Kantonssteuer value from Gemeinde assessment).
- Steuerwert: declare as wealth.
- Mortgage interest: deductible. Mortgage balance: declare as debt.
- Mortgage in bank statement but no property docs → ask user for Eigenmietwert/Steuerwert.

4. WEALTH
- Bank balances as of Dec 31.
- Securities: market value Dec 31. Fill Wertschriftenverzeichnis.
- Crypto: market value Dec 31. Private gains TAX-FREE.
- Dividends declared → securities register MUST be populated (consistency check).

5. FILING STATUS
- Divorce finalized before Dec 31 → file separately for full year.
- Quellensteuer transition: declare full-year income, enter Quellensteuer as credit.
"""


# ---------------------------------------------------------------------------
# JSON parsing helper
# ---------------------------------------------------------------------------
# LLMs don't always return clean JSON.  They might wrap it in markdown
# code fences (```json ... ```), add explanatory text before/after, or
# produce slightly malformed output.  This function tries multiple
# strategies to extract a valid JSON dict from the LLM's raw text.
# ---------------------------------------------------------------------------

def parse_field_mapping(text: str) -> dict:
    """
    Extract a {locator: value} dict from the LLM's response text.

    The LLM is instructed to return a JSON object, but in practice it
    may wrap the JSON in markdown code fences or add surrounding text.
    This function handles those cases with three strategies:

    1. If the text is wrapped in triple backticks, strip them first.
    2. Try to parse the entire text as JSON directly.
    3. If that fails, use a regex to find the first JSON-like object
       in the text and parse that.

    Parameters
    ----------
    text : str
        The raw text content from the LLM's response.

    Returns
    -------
    dict
        A dictionary mapping field locators to values, or an empty dict
        if parsing fails entirely.
    """
    if text is None:
        logger.warning("LLM returned None content")
        return {}
    text = text.strip()

    # Strategy 1: Strip markdown code fence wrappers.
    # LLMs often return ```json\n{...}\n``` instead of plain JSON.
    if text.startswith("```"):
        # Split on ``` and take the content between the first pair
        text = text.split("```")[1]
        # If the code fence had a language tag like "json", remove it
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    # Strategy 2: Try direct JSON parsing of the entire text.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Strategy 3: Regex extraction -- find the first JSON-like object
    # in the text.  This handles cases where the LLM adds explanatory
    # text before or after the JSON.
    # The regex looks for { ... } allowing one level of nesting.
    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    # If all strategies fail, log a warning and return empty dict.
    # The agent will treat this as "nothing to fill on this page".
    logger.warning("Could not parse LLM response: %s...", text[:200])
    return {}


# ---------------------------------------------------------------------------
# Main think() function -- the agent's brain
# ---------------------------------------------------------------------------

def think(server, persona_folder: str, api_key: str, model: str,
          guides_dir=None, sse_queue=None, max_steps: int = 100,
          llm_client: OpenAI | None = None) -> dict:
    """
    Run the full AI agent loop: navigate the tax form, prompt the LLM
    for field values, fill them in, and submit.

    This is the central function of the entire project.  It orchestrates
    everything:
    - Reading the taxpayer's documents
    - Loading tax reference guides
    - Iterating through form pages in order
    - Asking the LLM what to fill on each page
    - Handling dynamic rows (children, bank accounts, etc.)
    - Interacting with the simulated taxpayer (NPC) for clarifications
    - Submitting the completed form

    Parameters
    ----------
    server : MCPServer
        The MCP tool server with a FlaskBridge attached.  Provides
        tools like scan_page(), fill_field(), read_document(), etc.
    persona_folder : str
        Absolute path to the persona's document folder.
    api_key : str
        Raw API key for the LLM provider (used only if ``llm_client``
        is None).
    model : str
        Model identifier string (e.g., "gemini-2.5-flash").
    guides_dir : Path or None
        Path to the guides folder containing tax reference documents.
        If None or the folder does not exist, the agent runs without
        guide context.
    sse_queue : queue.Queue or None
        If provided, log events are pushed here as SSE events so the
        frontend can display real-time progress.
    max_steps : int
        Safety limit on the number of page navigation steps to prevent
        infinite loops.  Default is 100.
    llm_client : openai.OpenAI or None
        A pre-built OpenAI-compatible client.  If None, one is created
        using ``api_key`` (assumes Gemini endpoint).

    Returns
    -------
    dict
        A dictionary with three keys:
        - ``submission``: the form submission result (or None if max
          steps reached without submitting)
        - ``filled_history``: dict mapping page names to the fields
          that were filled on each page
        - ``log``: list of log message strings
    """
    persona_path = Path(persona_folder)
    persona_name = persona_path.name

    # --- Logging helper ---
    # All log messages are stored in log_lines (returned to the caller)
    # and also pushed onto the SSE queue (for the frontend) and to the
    # Python logger (for server-side debugging).
    log_lines = []
    def log(msg: str):
        """Log a message to all three destinations: logger, list, and SSE queue."""
        logger.info(msg)
        log_lines.append(msg)
        if sse_queue is not None:
            try:
                sse_queue.put_nowait({"type": "log", "message": msg})
            except Exception:
                pass

    # ── Step 0. Build LLM client (OpenAI-compatible) ─────────────
    # If a pre-built client was provided, use it.  Otherwise, create one
    # that points to the Gemini OpenAI-compat endpoint.
    if llm_client is not None:
        oai_client = llm_client
    else:
        oai_client = OpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )

    # ── Step 1. Pre-read all taxpayer documents ───────────────────
    # We read every document upfront and concatenate them into a single
    # text block (docs_text).  This is included in every LLM prompt so
    # the model has full context about the taxpayer's financial situation.
    log(f"📌 think() starting for persona: {persona_name}")
    log("Pre-reading all documents...")
    doc_list = server.list_documents()
    all_docs = {}
    for filepath in doc_list:
        doc = server.read_document(filepath)
        all_docs[filepath] = doc
        log(f"  📄 {filepath} ({doc['type']}, {len(doc.get('content', ''))} chars)")

    # Build a single text block with all documents, each truncated to 8000
    # chars to stay within LLM context window limits.
    docs_text = "\n\n".join(
        f"=== {name} ===\n{doc['content'][:8000]}"
        for name, doc in all_docs.items()
    )
    log(f"✅ Pre-read {len(all_docs)} documents.\n")

    # ── Step 2. Pre-load tax reference guides ─────────────────────
    # Guides contain Swiss tax rules (thresholds, formulas, edge cases).
    # They are included in the LLM prompt so the model can cite specific
    # rules instead of guessing from training data.
    log("📚 Pre-loading tax guides...")
    all_guides = load_all_guides(guides_dir) if guides_dir else {}
    log(f"✅ Loaded {len(all_guides)} guides: {list(all_guides.keys())}")

    # ── Step 3. Initialize state tracking variables ───────────────
    # filled_history: tracks which fields were filled on each page
    #   (shown to the LLM so it knows what was done on previous pages)
    # llm_calls: counter for how many LLM API calls were made
    # total_fields_filled: counter for successfully filled fields
    filled_history: dict = {}
    llm_calls = 0
    total_fields_filled = 0

    # ── Step 3b. NPC hints helper ─────────────────────────────────
    def _get_npc_hints(section: str) -> str:
        """
        Load NPC interaction hints from private_notes.json for a section.

        Some fields cannot be determined from documents alone -- the agent
        must ask the simulated taxpayer.  ``private_notes.json`` contains
        a list of "clarifications" that specify which fields require a
        taxpayer question and what to ask.

        This function filters the clarifications to only those relevant
        to the current form section (personal, income, deductions, wealth)
        and formats them as instructions for the LLM.

        Parameters
        ----------
        section : str
            The top-level form section name (e.g., "deductions").

        Returns
        -------
        str
            A formatted string of hints to append to the LLM prompt,
            or an empty string if no hints apply.
        """
        notes_path = persona_path / "private_notes.json"
        if not notes_path.exists():
            return ""
        try:
            private_notes = json.loads(notes_path.read_text(encoding="utf-8"))
        except Exception:
            return ""
        clarifications = private_notes.get("clarifications", [])
        relevant = []
        for c in clarifications:
            field = c.get("field", "")
            # Only include hints for fields that belong to the current section.
            # Fields are namespaced like "deductions.pillar3a.amount".
            if not field.startswith(section + "."):
                continue
            patterns = c.get("question_patterns", [])
            # Use the first question pattern as the suggested question
            question = patterns[0] if patterns else field
            relevant.append(
                f"- Field `{field}`: ALWAYS ask the taxpayer to confirm this field — "
                f"documents alone may not have all the information needed. "
                f"Suggested question: '{question}'"
            )
        if not relevant:
            return ""
        return "\n## Fields to verify with taxpayer (ALWAYS use ask_user for these fields)\n" + \
               "\n".join(relevant) + "\n"

    # ── Step 4. Helper: ask the LLM to fill one page ──────────────
    def ask_llm_for_page(page_name: str, fields: list) -> dict:
        """
        Build a prompt for the current page and send it to the LLM.

        This function constructs a detailed prompt containing:
        - The system prompt (BASE_PROMPT + section-specific instructions + NPC hints)
        - All taxpayer documents
        - What was filled on previous pages (history)
        - Tax reference guides relevant to this page
        - The list of fillable fields on the current page

        It then calls the LLM API and parses the response into a dict
        mapping field locators to values.

        Parameters
        ----------
        page_name : str
            The current page name (e.g., "deductions/professional").
        fields : list
            The list of field element dicts from scan_page().

        Returns
        -------
        dict
            A mapping of field locators to values the LLM wants to fill.
            May include special keys like "_thought", "_ask_user",
            "_rows_needed".
        """
        nonlocal llm_calls, docs_text

        # Determine the top-level section (e.g., "income" from "income/pensions")
        section = page_name.split("/")[0]
        # Build the system message by combining the base prompt with
        # section-specific instructions and NPC hints
        section_prompt = SECTION_PROMPTS.get(section, "")
        npc_hints = _get_npc_hints(section)
        system_msg = BASE_PROMPT + "\n" + section_prompt + ("\n" + npc_hints if npc_hints else "")

        # Build the "previously filled" history text so the LLM knows
        # what it already did (avoids contradictions and duplication)
        history_lines = []
        for prev_page, prev_fields in filled_history.items():
            entries = ", ".join(
                f"{k}={v}" for k, v in prev_fields.items() if not str(k).startswith("_")
            )
            if entries:
                history_lines.append(f"  {prev_page}: {entries}")
        history_text = "\n".join(history_lines) if history_lines else "  (none yet)"

        # Filter out non-fillable elements (buttons, static text).
        # The LLM should only see fields it can actually write to.
        fillable = [f for f in fields if f.get("type") not in ("button", "text")]
        if not fillable:
            return {}

        fields_desc = json.dumps(fillable, indent=2)

        # Build the guides section -- include both the general policy
        # knowledge base and any page-specific guides
        guide_text = get_guides_for_page(page_name, all_guides)
        guides_section = ""
        if guide_text or POLICY_KB_TEXT:
            guides_section = f"""

## TAX GUIDES (consult these for rules, thresholds, and formulas)
{POLICY_KB_TEXT}

{guide_text}
"""

        # Assemble the final user message with all context
        user_msg = f"""## Taxpayer Documents
{docs_text}

## Previously Filled
{history_text}
{guides_section}
## Current Page: {page_name}
Fields on this page:
{fields_desc}

Return a JSON object mapping field locators to the values you want to fill.
If no fields apply, return {{}}.
"""

        # Brief delay for rate limiting -- prevents hitting API rate limits
        # when processing many pages in quick succession
        time.sleep(3)

        # Retry loop: up to 3 attempts to handle transient API errors
        # (rate limits, network issues, etc.)
        for attempt in range(3):
            try:
                # For Ollama (local), send extra options to set the context
                # window size.  Detected by checking if the base URL contains
                # the default Ollama port "11434".
                extra = {"options": {"num_ctx": 16384}} if "11434" in str(getattr(oai_client, "base_url", "")) else {}
                response = oai_client.chat.completions.create(
                    model=model,
                    max_tokens=1024,
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    extra_body=extra or None,
                )
                break
            except Exception as e:
                err_str = str(e).lower()
                # Check if it's a rate limit error (HTTP 429)
                if "rate" in err_str or "quota" in err_str or "429" in err_str:
                    if attempt < 2:
                        log(f"  ⏳ Rate limited, waiting 45s...")
                        time.sleep(45)
                    else:
                        raise
                elif attempt < 2:
                    log(f"  ⚠️ LLM error (attempt {attempt+1}): {e}, retrying...")
                    time.sleep(10)
                else:
                    raise

        llm_calls += 1
        llm_text = response.choices[0].message.content or ""
        return parse_field_mapping(llm_text)

    # ── Step 5. Helper: fill fields from the LLM's mapping ────────
    def fill_page(mapping: dict, page_name: str) -> dict:
        """
        Apply the LLM's field mapping to the virtual form.

        Iterates over each locator/value pair in the mapping and calls
        ``server.fill_field()`` to write the value.  Skips internal keys
        (those starting with "_").  Logs success or failure for each field.

        Parameters
        ----------
        mapping : dict
            The LLM's response: {locator: value, ...}.
            May contain "_thought" (logged but not filled).
        page_name : str
            The current page name (for tracking in filled_history).

        Returns
        -------
        dict
            Only the successfully filled {locator: value} pairs.
        """
        nonlocal total_fields_filled
        filled = {}

        # Extract and log the LLM's reasoning (not a form field)
        thought = mapping.pop("_thought", None)
        if thought:
            log(f"  🧠 {thought}")

        for locator, value in mapping.items():
            # Skip internal/metadata keys (start with "_")
            if str(locator).startswith("_"):
                continue
            result = server.fill_field(locator, str(value))
            if result.get("success"):
                filled[locator] = value
                total_fields_filled += 1
                log(f"  ✅ {locator} = {value}")
            else:
                log(f"  ❌ {locator}: {result.get('error', 'unknown error')}")

        # Record what was filled on this page (for the history shown
        # to the LLM on subsequent pages)
        if filled:
            filled_history[page_name] = filled
        return filled

    # ── Step 6. Helper: handle dynamic rows ───────────────────────
    def add_rows_if_needed(page_name: str, elements: list, num_rows_needed: int = 0):
        """
        Add dynamic rows to array sections (children, bank accounts, etc.).

        Some form sections have a variable number of rows (e.g., multiple
        children or multiple bank accounts).  This function:
        1. Finds "add row" buttons on the page.
        2. Counts how many rows already exist by looking for row-index
           patterns (like "-0-", "-1-") in element locators.
        3. Clicks the add-row button enough times to reach the needed
           number of rows.
        4. Returns a fresh scan of the page (with the new row fields).

        Parameters
        ----------
        page_name : str
            Current page name (for logging).
        elements : list
            Current element list from scan_page().
        num_rows_needed : int
            How many rows the LLM says it needs.  If 0, defaults to 1.

        Returns
        -------
        dict or None
            A new scan_page() result if rows were added, or None if no
            rows needed to be added.
        """
        # Find all "add row" buttons on this page
        add_btns = [e for e in elements
                    if e.get("type") == "button"
                    and "add-row" in (e.get("locator") or "").lower()]

        if not add_btns:
            return None

        # Count existing rows by looking for row-index patterns in locators.
        # A locator like "field-personal-children-0-name" contains "-0-",
        # indicating row index 0.  We collect all unique row indices.
        existing_rows: set = set()
        for e in elements:
            loc = e.get("locator") or ""
            match = re.search(r'-(\d+)-', loc)
            if match:
                existing_rows.add(int(match.group(1)))
        num_existing = len(existing_rows)

        # Calculate how many rows to add (never negative)
        rows_to_add = max(0, (num_rows_needed or 1) - num_existing)

        if rows_to_add > 0:
            # Click the add-row button the required number of times
            for _ in range(rows_to_add):
                for btn in add_btns:
                    loc = btn.get("locator")
                    if loc:
                        log(f"  ➕ Adding row: {loc}")
                        server.click_element(loc)
            # Re-scan the page to get the updated element list
            # (now includes fields for the newly added rows)
            return server.scan_page()

        return None

    # ── Step 7. Auto-navigate from root/overview to the first form page ──
    # When the agent starts, the form might be showing a root or overview
    # page that has no fillable fields.  We try to navigate to the
    # actual form by clicking common navigation elements.
    initial = server.scan_page()
    page_name = initial.get("page_name", "")
    if not initial.get("elements") or page_name in ("root", "overview", ""):
        log("⚡ Root/overview page — auto-navigating to form...")
        for locator in ["tab-nav-form", "btn-nav-personal", "btn-login"]:
            result = server.click_element(locator)
            if result.get("success") and result.get("new_page"):
                log(f"  Navigated to: {result['new_page']}")
                break

    # ── Step 8. Main navigation loop ──────────────────────────────
    # This is the core loop that drives the agent through the form.
    # For each page, it:
    #   a) Scans the page for fields
    #   b) Skips non-form pages and already-visited pages
    #   c) Adds dynamic rows if needed
    #   d) Asks the LLM what to fill
    #   e) Handles NPC interactions (ask_user)
    #   f) Fills the fields
    #   g) Navigates to the next page
    # The loop ends when the review page is reached (form is submitted)
    # or when max_steps is exceeded.
    log("🚀 Starting code-driven navigation...\n")
    step = 0
    visited: set = set()   # Track visited pages to avoid revisiting

    while step < max_steps:
        step += 1
        page_data = server.scan_page()
        page_name = page_data.get("page_name", "unknown")
        elements = page_data.get("elements", [])

        # Skip non-form pages (root, overview, etc.)
        if page_name in ("root", "overview", ""):
            log(f"  ⏭️ Skipping {page_name} — not a form page")
            server.click_element("tab-nav-form")
            continue

        # Skip already-visited pages to prevent infinite loops
        if page_name in visited:
            log(f"  ⏭️ Already visited {page_name}, skipping")
            nav = server.click_element("btn-next")
            if not nav.get("new_page"):
                break
            continue
        visited.add(page_name)

        log(f"--- Page {step}: {page_name} ---")

        # If we've reached the review page, submit the form and exit
        if page_name == "review":
            log("📋 Review page reached — submitting...")
            result = server.submit_form()
            log(f"  ✅ Submitted!")
            log(f"\n📊 Summary: {llm_calls} LLM calls, {total_fields_filled} fields filled, {step} pages visited")
            return {"submission": result, "filled_history": filled_history, "log": log_lines}

        # Check if this page needs dynamic rows added before filling
        new_scan = add_rows_if_needed(page_name, elements)
        if new_scan:
            elements = new_scan.get("elements", [])

        # Identify fillable fields (excluding buttons and static text)
        fillable = [e for e in elements if e.get("type") not in ("button", "text")]
        required_empty = [e for e in fillable if e.get("required") and not e.get("value")]

        if not fillable:
            log(f"  ⏭️ No fillable fields — skipping")
        else:
            log(f"  📝 {len(fillable)} fillable fields ({len(required_empty)} required & empty)")

            # Ask the LLM what values to fill on this page
            mapping = ask_llm_for_page(page_name, elements)

            # --- NPC interaction loop ---
            # If the LLM includes "_ask_user" in its response, it wants to
            # ask the simulated taxpayer a clarifying question.  We forward
            # the question to the NPC, get an answer, append the Q&A to
            # the document context, and re-ask the LLM.  This can happen
            # up to 3 times per page to prevent infinite loops.
            ask_user_iterations = 0
            while "_ask_user" in mapping and ask_user_iterations < 3:
                ask_user_iterations += 1
                question = mapping.pop("_ask_user")
                # Handle edge case where question is a list instead of a string
                if isinstance(question, list):
                    question = question[0]
                if not question:
                    log("  ⚠️ Empty question from LLM, skipping NPC call")
                    break
                log(f"  ❓ Main LLM asks: {question}")

                # Phase 1: Notify the frontend that a question is being asked
                # (shows a typing indicator in the UI)
                try:
                    server._bridge.notify_ask_user(question, "")
                except Exception:
                    pass

                # Send the question to the NPC and get an answer
                result = server.ask_user(question)
                answer = result["answer"]
                log(f"  💬 NPC answers: {answer}")

                # Phase 2: Update the frontend popup with the actual answer
                try:
                    server._bridge.notify_ask_user(question, answer)
                    # Pause briefly so the user can see the typing animation
                    # in the UI before it disappears
                    time.sleep(8)
                except Exception:
                    pass

                # Append the Q&A to the document context so the LLM has
                # the taxpayer's answer available on the next call
                docs_text += f"\n\n=== Taxpayer Answer ===\nQ: {question}\nA: {answer}"
                # Re-ask the LLM with the updated context
                mapping = ask_llm_for_page(page_name, elements)

            # --- Fill fields from the mapping ---
            if mapping:
                # Check if the LLM requested additional rows (e.g., for
                # multiple bank accounts)
                rows_needed = int(mapping.pop("_rows_needed", 0))
                if rows_needed > 0:
                    new_scan = add_rows_if_needed(page_name, elements, rows_needed)
                    if new_scan:
                        elements = new_scan.get("elements", [])
                        # Re-ask the LLM now that the new row fields are visible
                        mapping = ask_llm_for_page(page_name, elements)
                        if mapping:
                            mapping.pop("_rows_needed", None)

                fill_page(mapping, page_name)
            else:
                log(f"  ⏭️ LLM returned empty mapping — nothing to fill")

        # --- Navigate to the next page ---
        nav_result = server.click_element("btn-next")
        if nav_result.get("success") and nav_result.get("new_page"):
            log(f"  ➡️ Navigated to: {nav_result['new_page']}")
        else:
            # If btn-next fails (e.g., we're at the last sub-page of a section),
            # try jumping to the next section via the sidebar navigation
            log(f"  ⚠️ btn-next failed, trying sidebar...")
            for nav_target in ["nav-income", "nav-deductions", "nav-wealth",
                               "nav-attachments", "nav-review"]:
                r = server.click_element(nav_target)
                if r.get("success") and r.get("new_page"):
                    log(f"  ➡️ Sidebar jump to: {r['new_page']}")
                    break
            else:
                # If even sidebar navigation fails, we're stuck -- stop
                log(f"  ❌ Cannot navigate further — stopping")
                break

    # If we exit the loop without submitting, it means we hit max_steps
    log(f"⚠️ Max steps ({max_steps}) reached without submitting.")
    log(f"📊 Summary: {llm_calls} LLM calls, {total_fields_filled} fields filled, {step} pages visited")
    return {"submission": None, "filled_history": filled_history, "log": log_lines}
