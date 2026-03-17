"""Agent utility functions for the AgenTekki tax agent.

This module contains helper functions used by the think() loop
in the notebook. 

Functions:
    parse_field_mapping: Extract {locator: value} dict from LLM response
    load_all_guides: Load all tax guide files from the guides folder
    extract_guide_text: Strip HTML tags from a guide file
    get_guides_for_page: Get the relevant guides for a given form page
"""

import re
import json
from pathlib import Path


# ═══════════════════════════════════════════════════════════════
# LLM Response Parsing
# ═══════════════════════════════════════════════════════════════

def parse_field_mapping(text):
    """Extract a {locator: value} dict from LLM response.

    The LLM should return a JSON object like:
      {"_thought": "...", "field-id-1": "value1", "field-id-2": "value2"}

    This function handles common LLM quirks:
    - Markdown code fences (```json ... ```)
    - Extra text before/after the JSON
    - Malformed responses (returns {} as safe fallback)
    """
    if text is None:
        print("  [WARN] LLM returned None content")
        return {}
    text = text.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    # Try direct parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fallback: extract first JSON object from the text
    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    print(f"  [WARN] Could not parse LLM response: {text[:200]}...")
    return {}


# ═══════════════════════════════════════════════════════════════
# Tax Guide Loading & Routing
# ═══════════════════════════════════════════════════════════════

def extract_guide_text(html_path: str) -> str:
    """Strip HTML tags and style blocks from a guide file, return plain text.

    Args:
        html_path: Path to an HTML guide file

    Returns:
        Plain text content of the guide
    """
    with open(html_path) as f:
        html = f.read()
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def load_all_guides(guides_folder: str) -> dict:
    """Load all guide texts from the guides folder at startup.

    Reads .html files (strips tags) and .txt/.md files (raw text).
    Called once before the agent loop — zero LLM calls.

    Args:
        guides_folder: Path to the folder containing guide files

    Returns:
        Dict mapping {filename_stem: text_content}
        e.g., {"velo-pauschale-fahrkosten": "The Bicycle Deduction..."}
    """
    guides = {}
    folder = Path(guides_folder)
    if not folder.exists():
        print(f"  ⚠️ Guides folder not found: {guides_folder}")
        return guides

    for f in sorted(folder.iterdir()):
        if f.suffix == '.html':
            guides[f.stem] = extract_guide_text(str(f))
        elif f.suffix in ('.txt', '.md'):
            guides[f.stem] = f.read_text(encoding='utf-8')

    return guides


# Which blog guides to inject for each form section.
# The code looks up the current page type (e.g., "deductions")
# and injects only the relevant guides to save tokens.
PAGE_GUIDE_MAP = {
    "personal": [
        "scheidung-unterhalt-steuern",         # divorce filing rules, Alleinerziehenden-Abzug
    ],
    "income": [
        "freelance-nebenberuf-steuern",        # self-employment rules, CHF 2,300 threshold
        "pensionierung-kapital-rente",          # retirement income classification
        "verrechnungssteuer-rueckerstattung",   # dividend withholding tax
    ],
    "deductions": [
        "kinderbetreuung-abzug-maximum",       # KiTa cap CHF 10,100
        "krankheitskosten-schwelle-5-prozent",  # medical 5% threshold
        "homeoffice-fahrkosten-optimierung",    # home office vs commute trade-off
        "velo-pauschale-fahrkosten",           # CHF 700 bicycle deduction
    ],
    "wealth": [
        "verrechnungssteuer-rueckerstattung",   # securities consistency check
        "krypto-steuern-privat-professionell",  # crypto wealth declaration
    ],
}


def get_guides_for_page(page_name: str, all_guides: dict) -> str:
    """Get the concatenated guide text relevant to a form page.

    For example, when on the "deductions/professional" page, this returns
    the childcare, medical, home-office, and velo guides concatenated.

    Args:
        page_name: Current page (e.g., "deductions/professional")
        all_guides: Dict from load_all_guides()

    Returns:
        Concatenated guide text, or "" if no guides match
    """
    section = page_name.split("/")[0]
    guide_keys = PAGE_GUIDE_MAP.get(section, [])

    if not guide_keys:
        return ""

    parts = []
    for key in guide_keys:
        if key in all_guides:
            parts.append(f"=== Guide: {key} ===\n{all_guides[key][:3000]}")

    if not parts:
        return ""

    return "\n\n".join(parts)