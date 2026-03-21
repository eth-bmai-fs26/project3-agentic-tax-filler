"""
think_service.py — Agent brain ported from notebook cells 8 + 11.

Uses an OpenAI-compatible client so it works with Gemini, ETH proxy, or Anthropic.
"""

import json
import logging
import re
import time
from pathlib import Path

from openai import OpenAI

logger = logging.getLogger("think_service")

# ── Guide extraction helpers (from notebook cell 8) ─────────────────────────

def extract_guide_text(html_path: str) -> str:
    """Strip HTML tags and style blocks, return plain text."""
    with open(html_path) as f:
        html = f.read()
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def load_all_guides(guides_folder) -> dict:
    """Load all guide texts from the guides folder. Returns {stem: text}."""
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


PAGE_GUIDE_MAP = {
    "personal": [
        "scheidung-unterhalt-steuern",
    ],
    "income": [
        "freelance-nebenberuf-steuern",
        "pensionierung-kapital-rente",
        "verrechnungssteuer-rueckerstattung",
    ],
    "deductions": [
        "kinderbetreuung-abzug-maximum",
        "krankheitskosten-schwelle-5-prozent",
        "homeoffice-fahrkosten-optimierung",
        "velo-pauschale-fahrkosten",
    ],
    "wealth": [
        "verrechnungssteuer-rueckerstattung",
        "krypto-steuern-privat-professionell",
    ],
}


def get_guides_for_page(page_name: str, all_guides: dict) -> str:
    """Return concatenated guide text relevant to a page."""
    section = page_name.split("/")[0]
    guide_keys = PAGE_GUIDE_MAP.get(section, [])
    if not guide_keys:
        return ""
    parts = []
    for key in guide_keys:
        if key in all_guides:
            parts.append(f"=== Guide: {key} ===\n{all_guides[key][:3000]}")
    return "\n\n".join(parts)


# ── Prompts (verbatim from notebook cell 8) ─────────────────────────────────

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


# ── JSON parsing helper (from notebook cell 9) ──────────────────────────────

def parse_field_mapping(text: str) -> dict:
    """Extract a {locator: value} dict from LLM response."""
    if text is None:
        logger.warning("LLM returned None content")
        return {}
    text = text.strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    logger.warning("Could not parse LLM response: %s...", text[:200])
    return {}


# ── Main think() function (adapted from notebook cell 11) ───────────────────

def think(server, persona_folder: str, api_key: str, model: str,
          guides_dir=None, sse_queue=None, max_steps: int = 100,
          llm_client: OpenAI | None = None) -> dict:
    """
    Code-driven navigation + per-page LLM field mapping.

    Parameters
    ----------
    server : MCPServer
        MCPServer instance with FlaskBridge attached.
    persona_folder : str
        Absolute path to the persona's document folder.
    api_key : str
        API key for the LLM provider (used only if llm_client is None).
    model : str
        Model ID string.
    guides_dir : Path | None
        Path to guides folder. If None or missing, runs without guides.
    sse_queue : queue.Queue | None
        If provided, log events are emitted as SSE {type: "log"} events.
    max_steps : int
        Maximum navigation steps.
    llm_client : openai.OpenAI | None
        Pre-built OpenAI-compat client. If None, one is built from api_key
        assuming Gemini endpoint.

    Returns
    -------
    dict with keys: submission, filled_history, log
    """
    persona_path = Path(persona_folder)
    persona_name = persona_path.name

    # Logging helper
    log_lines = []
    def log(msg: str):
        logger.info(msg)
        log_lines.append(msg)
        if sse_queue is not None:
            try:
                sse_queue.put_nowait({"type": "log", "message": msg})
            except Exception:
                pass

    # ── 0. Build LLM client (OpenAI-compat) ─────────────────────
    if llm_client is not None:
        oai_client = llm_client
    else:
        # Default: Gemini via OpenAI-compat endpoint
        oai_client = OpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )

    # ── 1. Pre-read all documents ────────────────────────────────
    log(f"📌 think() starting for persona: {persona_name}")
    log("Pre-reading all documents...")
    doc_list = server.list_documents()
    all_docs = {}
    for filepath in doc_list:
        doc = server.read_document(filepath)
        all_docs[filepath] = doc
        log(f"  📄 {filepath} ({doc['type']}, {len(doc.get('content', ''))} chars)")

    docs_text = "\n\n".join(
        f"=== {name} ===\n{doc['content'][:8000]}"
        for name, doc in all_docs.items()
    )
    log(f"✅ Pre-read {len(all_docs)} documents.\n")

    # ── 2. Pre-load guides ───────────────────────────────────────
    log("📚 Pre-loading tax guides...")
    all_guides = load_all_guides(guides_dir) if guides_dir else {}
    log(f"✅ Loaded {len(all_guides)} guides: {list(all_guides.keys())}")

    # ── 3. State tracking ────────────────────────────────────────
    filled_history: dict = {}
    llm_calls = 0
    total_fields_filled = 0

    # ── 3b. NPC hints helper ─────────────────────────────────────
    def _get_npc_hints(section: str) -> str:
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
            if not field.startswith(section + "."):
                continue
            patterns = c.get("question_patterns", [])
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

    # ── 4. Helper: ask LLM to fill one page ─────────────────────
    def ask_llm_for_page(page_name: str, fields: list) -> dict:
        nonlocal llm_calls, docs_text

        section = page_name.split("/")[0]
        section_prompt = SECTION_PROMPTS.get(section, "")
        npc_hints = _get_npc_hints(section)
        system_msg = BASE_PROMPT + "\n" + section_prompt + ("\n" + npc_hints if npc_hints else "")

        history_lines = []
        for prev_page, prev_fields in filled_history.items():
            entries = ", ".join(
                f"{k}={v}" for k, v in prev_fields.items() if not str(k).startswith("_")
            )
            if entries:
                history_lines.append(f"  {prev_page}: {entries}")
        history_text = "\n".join(history_lines) if history_lines else "  (none yet)"

        fillable = [f for f in fields if f.get("type") not in ("button", "text")]
        if not fillable:
            return {}

        fields_desc = json.dumps(fillable, indent=2)

        guide_text = get_guides_for_page(page_name, all_guides)
        guides_section = ""
        if guide_text or POLICY_KB_TEXT:
            guides_section = f"""

## TAX GUIDES (consult these for rules, thresholds, and formulas)
{POLICY_KB_TEXT}

{guide_text}
"""

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

        time.sleep(3)  # rate limiting

        for attempt in range(3):
            try:
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

    # ── 5. Helper: fill fields from mapping ──────────────────────
    def fill_page(mapping: dict, page_name: str) -> dict:
        nonlocal total_fields_filled
        filled = {}
        thought = mapping.pop("_thought", None)
        if thought:
            log(f"  🧠 {thought}")

        for locator, value in mapping.items():
            if str(locator).startswith("_"):
                continue
            result = server.fill_field(locator, str(value))
            if result.get("success"):
                filled[locator] = value
                total_fields_filled += 1
                log(f"  ✅ {locator} = {value}")
            else:
                log(f"  ❌ {locator}: {result.get('error', 'unknown error')}")

        if filled:
            filled_history[page_name] = filled
        return filled

    # ── 6. Helper: handle dynamic rows ───────────────────────────
    def add_rows_if_needed(page_name: str, elements: list, num_rows_needed: int = 0):
        add_btns = [e for e in elements
                    if e.get("type") == "button"
                    and "add-row" in (e.get("locator") or "").lower()]

        if not add_btns:
            return None

        existing_rows: set = set()
        for e in elements:
            loc = e.get("locator") or ""
            match = re.search(r'-(\d+)-', loc)
            if match:
                existing_rows.add(int(match.group(1)))
        num_existing = len(existing_rows)

        rows_to_add = max(0, (num_rows_needed or 1) - num_existing)

        if rows_to_add > 0:
            for _ in range(rows_to_add):
                for btn in add_btns:
                    loc = btn.get("locator")
                    if loc:
                        log(f"  ➕ Adding row: {loc}")
                        server.click_element(loc)
            return server.scan_page()

        return None

    # ── 7. Auto-navigate to form ─────────────────────────────────
    initial = server.scan_page()
    page_name = initial.get("page_name", "")
    if not initial.get("elements") or page_name in ("root", "overview", ""):
        log("⚡ Root/overview page — auto-navigating to form...")
        for locator in ["tab-nav-form", "btn-nav-personal", "btn-login"]:
            result = server.click_element(locator)
            if result.get("success") and result.get("new_page"):
                log(f"  Navigated to: {result['new_page']}")
                break

    # ── 8. Main navigation loop ───────────────────────────────────
    log("🚀 Starting code-driven navigation...\n")
    step = 0
    visited: set = set()

    while step < max_steps:
        step += 1
        page_data = server.scan_page()
        page_name = page_data.get("page_name", "unknown")
        elements = page_data.get("elements", [])

        if page_name in ("root", "overview", ""):
            log(f"  ⏭️ Skipping {page_name} — not a form page")
            server.click_element("tab-nav-form")
            continue

        if page_name in visited:
            log(f"  ⏭️ Already visited {page_name}, skipping")
            nav = server.click_element("btn-next")
            if not nav.get("new_page"):
                break
            continue
        visited.add(page_name)

        log(f"--- Page {step}: {page_name} ---")

        if page_name == "review":
            log("📋 Review page reached — submitting...")
            result = server.submit_form()
            log(f"  ✅ Submitted!")
            log(f"\n📊 Summary: {llm_calls} LLM calls, {total_fields_filled} fields filled, {step} pages visited")
            return {"submission": result, "filled_history": filled_history, "log": log_lines}

        new_scan = add_rows_if_needed(page_name, elements)
        if new_scan:
            elements = new_scan.get("elements", [])

        fillable = [e for e in elements if e.get("type") not in ("button", "text")]
        required_empty = [e for e in fillable if e.get("required") and not e.get("value")]

        if not fillable:
            log(f"  ⏭️ No fillable fields — skipping")
        else:
            log(f"  📝 {len(fillable)} fillable fields ({len(required_empty)} required & empty)")

            mapping = ask_llm_for_page(page_name, elements)

            # NPC interaction loop
            ask_user_iterations = 0
            while "_ask_user" in mapping and ask_user_iterations < 3:
                ask_user_iterations += 1
                question = mapping.pop("_ask_user")
                if isinstance(question, list):
                    question = question[0]
                if not question:
                    log("  ⚠️ Empty question from LLM, skipping NPC call")
                    break
                log(f"  ❓ Main LLM asks: {question}")

                # Phase 1: show question + typing indicator
                try:
                    server._bridge.notify_ask_user(question, "")
                except Exception:
                    pass

                result = server.ask_user(question)
                answer = result["answer"]
                log(f"  💬 NPC answers: {answer}")

                # Phase 2: update popup with actual answer
                try:
                    server._bridge.notify_ask_user(question, answer)
                    time.sleep(8)  # pause so user can watch typing animation
                except Exception:
                    pass

                docs_text += f"\n\n=== Taxpayer Answer ===\nQ: {question}\nA: {answer}"
                mapping = ask_llm_for_page(page_name, elements)

            if mapping:
                rows_needed = int(mapping.pop("_rows_needed", 0))
                if rows_needed > 0:
                    new_scan = add_rows_if_needed(page_name, elements, rows_needed)
                    if new_scan:
                        elements = new_scan.get("elements", [])
                        mapping = ask_llm_for_page(page_name, elements)
                        if mapping:
                            mapping.pop("_rows_needed", None)

                fill_page(mapping, page_name)
            else:
                log(f"  ⏭️ LLM returned empty mapping — nothing to fill")

        nav_result = server.click_element("btn-next")
        if nav_result.get("success") and nav_result.get("new_page"):
            log(f"  ➡️ Navigated to: {nav_result['new_page']}")
        else:
            log(f"  ⚠️ btn-next failed, trying sidebar...")
            for nav_target in ["nav-income", "nav-deductions", "nav-wealth",
                               "nav-attachments", "nav-review"]:
                r = server.click_element(nav_target)
                if r.get("success") and r.get("new_page"):
                    log(f"  ➡️ Sidebar jump to: {r['new_page']}")
                    break
            else:
                log(f"  ❌ Cannot navigate further — stopping")
                break

    log(f"⚠️ Max steps ({max_steps}) reached without submitting.")
    log(f"📊 Summary: {llm_calls} LLM calls, {total_fields_filled} fields filled, {step} pages visited")
    return {"submission": None, "filled_history": filled_history, "log": log_lines}
