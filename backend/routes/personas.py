"""Personas API routes."""

import json
import re
import unicodedata
from pathlib import Path

from flask import Blueprint, jsonify, request

from backend.config import PERSONAS_DIR

bp = Blueprint("personas", __name__, url_prefix="/api/personas")

# Persona metadata (display info not in files)
_PERSONA_META = {
    "anna_meier": {
        "display_name": "Anna Meier",
        "description": "Single professional, employment income, standard deductions",
        "difficulty": "easy",
        "color": "emerald",
    },
    "marco_laura_bernasconi": {
        "display_name": "Marco & Laura Bernasconi",
        "description": "Married couple, dual income, children, property",
        "difficulty": "hard",
        "color": "rose",
    },
    "priya_chakraborty": {
        "display_name": "Priya Chakraborty",
        "description": "Expat employee, international considerations, pillar 3a",
        "difficulty": "medium",
        "color": "amber",
    },
    "thomas_elisabeth_widmer": {
        "display_name": "Thomas & Elisabeth Widmer",
        "description": "Retired couple, pension income, investment portfolio",
        "difficulty": "medium",
        "color": "sky",
    },
    "yuki_tanaka": {
        "display_name": "Yuki Tanaka",
        "description": "Self-employed freelancer, complex deductions, securities",
        "difficulty": "hard",
        "color": "violet",
    },
    "konstantinos_chasiotis": {
        "display_name": "Konstantinos Chasiotis",
        "description": "Junior data engineer, Greek expat, standard deductions",
        "difficulty": "easy",
        "color": "emerald",
    },
    "sophie_mueller": {
        "display_name": "Sophie Müller",
        "description": "Marketing manager, divorced, one child, alimony",
        "difficulty": "medium",
        "color": "rose",
    },
    "li_wei_zhang": {
        "display_name": "Li Wei Zhang",
        "description": "Research scientist, married, dual income, two children",
        "difficulty": "hard",
        "color": "sky",
    },
    "elena_rossi": {
        "display_name": "Elena Rossi",
        "description": "Restaurant owner, widowed, self-employed, property income",
        "difficulty": "hard",
        "color": "amber",
    },
    "david_steiner": {
        "display_name": "David Steiner",
        "description": "PhD student, part-time TA, education deductions",
        "difficulty": "easy",
        "color": "violet",
    },
}

_CUSTOM_COLORS = ["emerald", "rose", "amber", "sky", "violet", "slate"]
_color_idx = 0


def _get_persona_names() -> list[str]:
    """Dynamically discover all persona folders that contain a profile.json."""
    if not PERSONAS_DIR.exists():
        return []
    names = [
        d.name for d in sorted(PERSONAS_DIR.iterdir())
        if d.is_dir() and (d / "profile.json").exists()
    ]
    return names


def _load_persona(name: str) -> dict:
    folder = PERSONAS_DIR / name
    # For custom personas, try to read display info from profile.json
    default_meta = {"display_name": name.replace("_", " ").title(), "description": "", "difficulty": "medium", "color": "slate"}
    meta = _PERSONA_META.get(name, default_meta)

    result = {
        "name": name,
        **meta,
        "documents": [],
        "profile": {},
    }

    # Document list (exclude hidden files)
    if folder.exists():
        docs = [
            f.name for f in sorted(folder.iterdir())
            if f.is_file() and not f.name.startswith(".") and not f.name.startswith("_")
            and f.name not in ("ground_truth.json", "private_notes.json")
        ]
        result["documents"] = docs

    # Profile info from profile.json if exists
    profile_path = folder / "profile.json"
    if profile_path.exists():
        try:
            with open(profile_path) as f:
                profile = json.load(f)
                result["profile"] = profile
                # For custom personas, use profile fields for display
                if name not in _PERSONA_META:
                    if profile.get("name"):
                        result["display_name"] = profile["name"]
                    if profile.get("brief"):
                        result["description"] = profile["brief"]
                    if profile.get("_color"):
                        result["color"] = profile["_color"]
        except Exception:
            pass

    return result


def _slugify(text: str) -> str:
    """Convert display name to a filesystem-safe slug."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text or "custom_persona"


@bp.route("/", methods=["GET"])
@bp.route("", methods=["GET"])
def list_personas():
    names = _get_persona_names()
    personas = [_load_persona(name) for name in names]
    return jsonify(personas)


@bp.route("/<name>", methods=["GET"])
def get_persona(name: str):
    names = _get_persona_names()
    if name not in names:
        return jsonify({"error": f"Unknown persona: {name}"}), 404
    return jsonify(_load_persona(name))


@bp.route("", methods=["POST"])
@bp.route("/", methods=["POST"])
def create_persona():
    """Create a new custom persona from multipart form data.

    Expected form fields:
      - name (str, required)
      - address (str)
      - date_of_birth (str)
      - ahv_number (str)
      - marital_status (str)
      - nationality (str)
      - brief (str)

    Expected files:
      - documents (one or more files)
    """
    global _color_idx

    name = request.form.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    slug = _slugify(name)
    folder = PERSONAS_DIR / slug

    # Ensure unique folder name
    if folder.exists():
        i = 2
        while (PERSONAS_DIR / f"{slug}_{i}").exists():
            i += 1
        slug = f"{slug}_{i}"
        folder = PERSONAS_DIR / slug

    folder.mkdir(parents=True, exist_ok=True)

    # Assign a color
    color = _CUSTOM_COLORS[_color_idx % len(_CUSTOM_COLORS)]
    _color_idx += 1

    # Build profile.json
    profile = {
        "name": name,
        "address": request.form.get("address", ""),
        "date_of_birth": request.form.get("date_of_birth", ""),
        "ahv_number": request.form.get("ahv_number", ""),
        "zivilstand": request.form.get("marital_status", ""),
        "nationality": request.form.get("nationality", "CH"),
        "permit": None,
        "brief": request.form.get("brief", ""),
        "_color": color,
    }

    with open(folder / "profile.json", "w") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)

    # Save uploaded documents
    files = request.files.getlist("documents")
    for file in files:
        if file.filename:
            safe_name = Path(file.filename).name  # strip directory components
            file.save(str(folder / safe_name))

    return jsonify(_load_persona(slug)), 201
