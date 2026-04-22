#!/usr/bin/env python3
"""
Swiss Tax Form Scoring Script
Compares an agent's submission.json against ground_truth.json for a persona.

Usage:
    python scripts/score.py anna_meier /path/to/submission.json
    python scripts/score.py --all /path/to/agent_output_dir/
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PERSONAS = [
    "anna_meier",
    "priya_chakraborty",
    "marco_laura_bernasconi",
    "thomas_elisabeth_widmer",
    "yuki_tanaka",
]

REPO_ROOT = Path(__file__).resolve().parent.parent
PERSONAS_DIR = REPO_ROOT / "personas"


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def normalize_string(v: Any) -> str:
    """Lowercase + strip whitespace for string comparison."""
    return str(v).strip().lower()


def to_number(v: Any) -> float | None:
    """Try to parse a value as float. Returns None on failure."""
    if v is None or v == "":
        return None
    try:
        # Remove common formatting chars
        cleaned = str(v).replace(",", "").replace("'", "").replace(" ", "").strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def numbers_match(a: Any, b: Any, tolerance: float = 0.5) -> bool:
    """
    Two numeric values match if |round(a) - round(b)| <= tolerance.
    Default tolerance of 0.5 means rounding to integer and comparing.
    """
    na, nb = to_number(a), to_number(b)
    if na is None or nb is None:
        return False
    return abs(round(na) - round(nb)) <= tolerance


def is_empty(v: Any) -> bool:
    """True if the value is missing / empty / false."""
    if v is None:
        return True
    if isinstance(v, str) and v.strip() == "":
        return True
    if isinstance(v, bool):
        return not v
    return False


def values_match(gt_val: Any, sub_val: Any) -> bool:
    """
    Compare a ground-truth value against a submission value.
    Handles numeric tolerance and case-insensitive string matching.
    """
    # Both empty → match
    if is_empty(gt_val) and is_empty(sub_val):
        return True

    # One empty, one not → mismatch (handled upstream)
    if is_empty(gt_val) or is_empty(sub_val):
        return False

    # Boolean comparison
    if isinstance(gt_val, bool) or isinstance(sub_val, bool):
        return bool(gt_val) == bool(sub_val)

    # Try numeric comparison first
    gt_num = to_number(gt_val)
    sub_num = to_number(sub_val)
    if gt_num is not None and sub_num is not None:
        return numbers_match(gt_num, sub_num)

    # Fall back to string comparison
    return normalize_string(gt_val) == normalize_string(sub_val)


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------

def classify_likely_cause(path: str, persona: str) -> str:
    """
    Heuristic: classify whether an error is due to a missing calculation,
    info in documents, or info genuinely missing.
    """
    # Fields that require arithmetic / formula
    calculation_fields = {
        "flatrate", "berufsauslagen", "verpflegung",
        "zweiverdienerabzug", "medical", "netincome",
    }
    # Fields that just need to be read from a document
    doc_fields = {
        "bruttolohn", "ahvcontributions", "bvgcontributions",
        "firstName", "lastName", "dateofbirth", "ahvnumber",
        "street", "streetNumber", "zip", "city",
        "maritalstatus", "occupation", "employer",
        "interest", "pillar3a", "fahrkosten", "donations",
        "ahvpension", "bvgpension", "capitalwithdrawals",
        "dividends", "revenue", "expenses",
        "eigenmietwert", "steuerwert", "balance",
        "weiterbildungskosten", "kinderbetreuungskosten",
        "schuldzinsen", "amount",
    }
    # Fields genuinely hard to get (no document contains them directly)
    missing_fields = {
        "phone", "email", "religion", "workplace", "apartment",
        "insurance", "vehicles", "cashgold",
    }

    leaf = path.split(".")[-1]

    # Yuki alimony: requires reading decree + email + calculation
    if "alimony" in path and persona == "yuki_tanaka":
        return "requires_calculation"

    # Freizügigkeit: requires reading separate doc
    if "freizuegigkeit" in path.lower() or "freizügigkeit" in path.lower():
        return "info_in_documents"

    if leaf in calculation_fields:
        return "requires_calculation"
    if leaf in missing_fields:
        return "info_missing"
    if leaf in doc_fields:
        return "info_in_documents"

    # Default: treat as extractable from documents
    return "info_in_documents"


# ---------------------------------------------------------------------------
# Core comparison logic
# ---------------------------------------------------------------------------

def flatten_dict(d: dict, prefix: str = "") -> dict[str, Any]:
    """Flatten a nested dict into dot-notation keys."""
    out = {}
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten_dict(v, full_key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    out.update(flatten_dict(item, f"{full_key}[{i}]"))
                else:
                    out[f"{full_key}[{i}]"] = item
        else:
            out[full_key] = v
    return out


def compare_dicts(
    gt: dict,
    sub: dict,
    persona: str,
    path: str = "",
) -> list[dict]:
    """
    Recursively compare ground-truth dict vs submission dict.
    Returns a list of error records.
    """
    errors = []

    for key, gt_val in gt.items():
        if key.startswith("_"):
            continue  # skip metadata

        current_path = f"{path}.{key}" if path else key

        # Ground truth has a list → compare element by element
        if isinstance(gt_val, list):
            sub_val = sub.get(key, []) if isinstance(sub, dict) else []
            if not isinstance(sub_val, list):
                sub_val = []

            for i, gt_item in enumerate(gt_val):
                item_path = f"{current_path}[{i}]"
                if i >= len(sub_val):
                    # Entire array element missing
                    if isinstance(gt_item, dict):
                        for field, fval in gt_item.items():
                            if field.startswith("_"):
                                continue
                            if not is_empty(fval):
                                errors.append({
                                    "path": f"{item_path}.{field}",
                                    "expected": fval,
                                    "got": None,
                                    "error_type": "missing",
                                    "likely_cause": classify_likely_cause(f"{item_path}.{field}", persona),
                                })
                    else:
                        errors.append({
                            "path": item_path,
                            "expected": gt_item,
                            "got": None,
                            "error_type": "missing",
                            "likely_cause": classify_likely_cause(item_path, persona),
                        })
                else:
                    sub_item = sub_val[i]
                    if isinstance(gt_item, dict):
                        errors.extend(compare_dicts(gt_item, sub_item or {}, persona, item_path))
                    else:
                        if not values_match(gt_item, sub_item):
                            errors.append({
                                "path": item_path,
                                "expected": gt_item,
                                "got": sub_item,
                                "error_type": "wrong_value",
                                "likely_cause": classify_likely_cause(item_path, persona),
                            })

            # Extra elements in submission
            sub_val_list = sub.get(key, []) if isinstance(sub, dict) else []
            if isinstance(sub_val_list, list):
                for i in range(len(gt_val), len(sub_val_list)):
                    item_path = f"{current_path}[{i}]"
                    extra_item = sub_val_list[i]
                    if isinstance(extra_item, dict):
                        for field, fval in extra_item.items():
                            if not is_empty(fval):
                                errors.append({
                                    "path": f"{item_path}.{field}",
                                    "expected": None,
                                    "got": fval,
                                    "error_type": "extra",
                                    "likely_cause": classify_likely_cause(f"{item_path}.{field}", persona),
                                })

        # Ground truth has a nested dict
        elif isinstance(gt_val, dict):
            sub_section = sub.get(key, {}) if isinstance(sub, dict) else {}
            if not isinstance(sub_section, dict):
                sub_section = {}
            errors.extend(compare_dicts(gt_val, sub_section, persona, current_path))

        # Scalar value
        else:
            sub_val = sub.get(key) if isinstance(sub, dict) else None

            gt_empty = is_empty(gt_val)
            sub_empty = is_empty(sub_val)

            if gt_empty and not sub_empty:
                errors.append({
                    "path": current_path,
                    "expected": gt_val,
                    "got": sub_val,
                    "error_type": "extra",
                    "likely_cause": classify_likely_cause(current_path, persona),
                })
            elif not gt_empty and sub_empty:
                errors.append({
                    "path": current_path,
                    "expected": gt_val,
                    "got": sub_val,
                    "error_type": "missing",
                    "likely_cause": classify_likely_cause(current_path, persona),
                })
            elif not gt_empty and not sub_empty:
                if not values_match(gt_val, sub_val):
                    errors.append({
                        "path": current_path,
                        "expected": gt_val,
                        "got": sub_val,
                        "error_type": "wrong_value",
                        "likely_cause": classify_likely_cause(current_path, persona),
                    })

    return errors


def score_submission(persona: str, submission_path: str) -> dict:
    """
    Score a single submission.json against ground_truth.json for a persona.
    Returns a results dict with errors and summary.
    """
    gt_path = PERSONAS_DIR / persona / "ground_truth.json"

    if not gt_path.exists():
        print(f"ERROR: ground_truth.json not found at {gt_path}", file=sys.stderr)
        sys.exit(1)

    if not Path(submission_path).exists():
        print(f"ERROR: submission.json not found at {submission_path}", file=sys.stderr)
        sys.exit(1)

    with open(gt_path) as f:
        ground_truth = json.load(f)

    with open(submission_path) as f:
        submission = json.load(f)

    # Strip _meta from ground_truth before comparison
    gt_data = {k: v for k, v in ground_truth.items() if not k.startswith("_")}

    errors = compare_dicts(gt_data, submission, persona)

    # Summary counts
    total_gt_fields = count_non_empty_leaves(gt_data)
    wrong = [e for e in errors if e["error_type"] == "wrong_value"]
    missing = [e for e in errors if e["error_type"] == "missing"]
    extra = [e for e in errors if e["error_type"] == "extra"]
    correct = total_gt_fields - len(wrong) - len(missing)

    score_pct = round(100 * correct / total_gt_fields, 1) if total_gt_fields > 0 else 0.0

    # Cause breakdown (on non-extra errors)
    from collections import Counter
    cause_counts = Counter(
        e["likely_cause"] for e in errors if e["error_type"] != "extra"
    )

    result = {
        "persona": persona,
        "submission_path": str(submission_path),
        "summary": {
            "total_ground_truth_fields": total_gt_fields,
            "correct": correct,
            "wrong_value": len(wrong),
            "missing": len(missing),
            "extra": len(extra),
            "score_percent": score_pct,
        },
        "cause_breakdown": dict(cause_counts),
        "errors": errors,
    }
    return result


def count_non_empty_leaves(d: Any) -> int:
    """Count non-empty leaf values in a nested structure."""
    if isinstance(d, dict):
        return sum(count_non_empty_leaves(v) for k, v in d.items() if not k.startswith("_"))
    if isinstance(d, list):
        return sum(count_non_empty_leaves(item) for item in d)
    return 0 if is_empty(d) else 1


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------

def print_summary_table(result: dict) -> None:
    """Print a human-readable summary to stdout."""
    s = result["summary"]
    persona = result["persona"]
    sep = "=" * 60

    print(sep)
    print(f"  SCORING REPORT — {persona.upper()}")
    print(sep)
    print(f"  Submission:    {result['submission_path']}")
    print(f"  Score:         {s['score_percent']}%  ({s['correct']}/{s['total_ground_truth_fields']} fields correct)")
    print(f"  Wrong value:   {s['wrong_value']}")
    print(f"  Missing:       {s['missing']}")
    print(f"  Extra:         {s['extra']}")
    print()

    if result["cause_breakdown"]:
        print("  Error causes (wrong + missing only):")
        for cause, count in sorted(result["cause_breakdown"].items()):
            print(f"    {cause:<30} {count}")
        print()

    if result["errors"]:
        print("  Detailed errors:")
        print(f"  {'PATH':<45} {'TYPE':<14} {'EXPECTED':<20} {'GOT':<20} CAUSE")
        print("  " + "-" * 115)
        for e in result["errors"]:
            path = e["path"][:44]
            etype = e["error_type"]
            exp = str(e["expected"])[:19] if e["expected"] is not None else "(empty)"
            got = str(e["got"])[:19] if e["got"] is not None else "(empty)"
            cause = e["likely_cause"]
            print(f"  {path:<45} {etype:<14} {exp:<20} {got:<20} {cause}")
    else:
        print("  No errors found — perfect submission!")

    print(sep)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Score a Swiss tax form submission against ground truth."
    )
    parser.add_argument(
        "persona_or_flag",
        help="Persona name (e.g. anna_meier) OR '--all' to score all personas.",
    )
    parser.add_argument(
        "submission_path",
        nargs="?",
        help=(
            "Path to submission.json (for single persona). "
            "When using --all, pass the directory containing "
            "{persona_name}/submission.json files."
        ),
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory to write comparison_report.json files (default: next to submission).",
    )

    args = parser.parse_args()

    all_results = []

    if args.persona_or_flag == "--all":
        # Score all personas
        base_dir = Path(args.submission_path) if args.submission_path else Path(".")
        for persona in PERSONAS:
            sub_path = base_dir / persona / "submission.json"
            if not sub_path.exists():
                print(f"[SKIP] {persona}: no submission.json at {sub_path}")
                continue
            print(f"\n[SCORING] {persona} ...")
            result = score_submission(persona, str(sub_path))
            print_summary_table(result)
            all_results.append(result)

            # Save per-persona report
            out_dir = Path(args.output_dir) if args.output_dir else sub_path.parent
            out_dir.mkdir(parents=True, exist_ok=True)
            report_path = out_dir / "comparison_report.json"
            with open(report_path, "w") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"  Report saved to: {report_path}")

        # Print aggregate summary
        if all_results:
            print("\n" + "=" * 60)
            print("  AGGREGATE SUMMARY")
            print("=" * 60)
            for r in all_results:
                s = r["summary"]
                print(f"  {r['persona']:<40} {s['score_percent']:>6.1f}%  ({s['correct']}/{s['total_ground_truth_fields']})")
            avg = sum(r["summary"]["score_percent"] for r in all_results) / len(all_results)
            print(f"  {'AVERAGE':<40} {avg:>6.1f}%")
            print("=" * 60)

    else:
        # Score single persona
        persona = args.persona_or_flag
        if persona not in PERSONAS:
            print(
                f"ERROR: Unknown persona '{persona}'. Valid options: {', '.join(PERSONAS)}",
                file=sys.stderr,
            )
            sys.exit(1)

        if not args.submission_path:
            print("ERROR: submission_path is required for single-persona scoring.", file=sys.stderr)
            sys.exit(1)

        result = score_submission(persona, args.submission_path)
        print_summary_table(result)

        # Save report
        sub_path = Path(args.submission_path)
        out_dir = Path(args.output_dir) if args.output_dir else sub_path.parent
        out_dir.mkdir(parents=True, exist_ok=True)
        report_path = out_dir / "comparison_report.json"
        with open(report_path, "w") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\nReport saved to: {report_path}")


if __name__ == "__main__":
    main()
