"""
REST API routes for persona management (list, get, create).

A "persona" is a fictional taxpayer whose documents (salary statements,
bank statements, etc.) are stored in a folder under ``personas/``.  Each
persona folder contains at minimum a ``profile.json`` with biographical
data and zero or more financial document files.

This module provides three endpoints:

- ``GET  /api/personas``       -- list all available personas
- ``GET  /api/personas/<name>``-- get details for one persona
- ``POST /api/personas``       -- create a new custom persona
                                  (multipart form upload)

How it fits into the project
----------------------------
The React frontend shows a persona picker at startup.  It calls
``GET /api/personas`` to populate the list.  When the user selects a
persona and starts an agent session, the persona name is passed to the
agent service.  The ``POST`` endpoint lets users upload their own
documents to create a brand-new persona without touching the filesystem
manually.

Key concepts for beginners
--------------------------
- **Slug**: A URL-safe, filesystem-safe version of a display name.
  "Anna Meier" becomes "anna_meier".
- **Metadata vs. profile**: ``_PERSONA_META`` holds hard-coded display
  info (color, difficulty) for the built-in personas.  ``profile.json``
  holds the taxpayer's actual data (address, AHV number, etc.).
"""

import json
import re
import unicodedata
from pathlib import Path

from flask import Blueprint, jsonify, request

from backend.config import PERSONAS_DIR

# Create a Blueprint named "personas" with all routes under /api/personas.
bp = Blueprint("personas", __name__, url_prefix="/api/personas")

# ---------------------------------------------------------------------------
# Hard-coded display metadata for the built-in (pre-shipped) personas.
# Custom personas created via the POST endpoint do not appear here --
# their display info comes from their profile.json instead.
# ---------------------------------------------------------------------------
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

# Rotating list of Tailwind CSS color names used to assign a unique color
# to each newly created custom persona (purely cosmetic, for the UI cards).
_CUSTOM_COLORS = ["emerald", "rose", "amber", "sky", "violet", "slate"]
# Counter that keeps track of which color to assign next.  It wraps around
# using modulo, so colors repeat after all six are used.
_color_idx = 0


# ---------------------------------------------------------------------------
# Internal helper functions
# ---------------------------------------------------------------------------

def _get_persona_names() -> list[str]:
    """
    Dynamically discover all persona folders that contain a profile.json.

    Scans the ``PERSONAS_DIR`` directory and returns a sorted list of
    sub-directory names where a ``profile.json`` file exists.  This is the
    single source of truth for "which personas are available".

    Returns
    -------
    list[str]
        Folder names like ``["anna_meier", "yuki_tanaka"]``.
    """
    if not PERSONAS_DIR.exists():
        return []
    names = [
        d.name for d in sorted(PERSONAS_DIR.iterdir())
        if d.is_dir() and (d / "profile.json").exists()
    ]
    return names


def _load_persona(name: str) -> dict:
    """
    Load all information about a single persona into a dict.

    The returned dict combines:
      - Display metadata from ``_PERSONA_META`` (or sensible defaults for
        custom personas).
      - A list of document filenames found in the persona's folder.
      - The parsed contents of ``profile.json``.

    Parameters
    ----------
    name : str
        The folder name of the persona (e.g. "anna_meier").

    Returns
    -------
    dict
        A dict with keys: name, display_name, description, difficulty,
        color, documents (list of filenames), and profile (dict from
        profile.json).
    """
    folder = PERSONAS_DIR / name

    # For custom personas (not in _PERSONA_META), generate a display name
    # by replacing underscores with spaces and title-casing.
    default_meta = {"display_name": name.replace("_", " ").title(), "description": "", "difficulty": "medium", "color": "slate"}
    meta = _PERSONA_META.get(name, default_meta)

    result = {
        "name": name,
        **meta,           # Spread the metadata fields into the result dict
        "documents": [],
        "profile": {},
    }

    # Build the list of document filenames, excluding hidden files (starting
    # with "." or "_") and internal files (ground_truth.json is the answer
    # key, private_notes.json contains NPC hints -- neither should be shown
    # to the user or agent as a "document").
    if folder.exists():
        docs = [
            f.name for f in sorted(folder.iterdir())
            if f.is_file() and not f.name.startswith(".") and not f.name.startswith("_")
            and f.name not in ("ground_truth.json", "private_notes.json")
        ]
        result["documents"] = docs

    # Load the profile.json file if it exists
    profile_path = folder / "profile.json"
    if profile_path.exists():
        try:
            with open(profile_path) as f:
                profile = json.load(f)
                result["profile"] = profile
                # For custom personas (not in _PERSONA_META), override
                # display fields with values from profile.json so users
                # can control how their custom persona appears in the UI.
                if name not in _PERSONA_META:
                    if profile.get("name"):
                        result["display_name"] = profile["name"]
                    if profile.get("brief"):
                        result["description"] = profile["brief"]
                    if profile.get("_color"):
                        result["color"] = profile["_color"]
        except Exception:
            # If profile.json is malformed, we silently ignore it and
            # return whatever metadata we already have.
            pass

    return result


def _slugify(text: str) -> str:
    """
    Convert a human-readable display name to a filesystem-safe slug.

    The process:
    1. Normalize Unicode characters (e.g., accented letters) to their
       ASCII equivalents using NFKD decomposition.
    2. Convert to lowercase and strip whitespace.
    3. Remove any character that is not a word character, whitespace, or hyphen.
    4. Replace runs of whitespace/hyphens with a single underscore.

    Examples:
        "Anna Meier"     -> "anna_meier"
        "Jean-Pierre"    -> "jean_pierre"

    Parameters
    ----------
    text : str
        The display name to convert.

    Returns
    -------
    str
        A slug safe for use as a folder name.
    """
    # NFKD normalization splits accented characters into base + accent,
    # then .encode("ascii", "ignore") drops the accents.
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    # Remove everything that is not a word character (\w), whitespace, or hyphen
    text = re.sub(r"[^\w\s-]", "", text)
    # Collapse whitespace and hyphens into single underscores
    text = re.sub(r"[\s-]+", "_", text)
    return text or "custom_persona"


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

@bp.route("/", methods=["GET"])
@bp.route("", methods=["GET"])
def list_personas():
    """
    List all available personas.

    Returns a JSON array of persona objects, each containing display
    metadata, document lists, and profile data.  The frontend uses this
    to render the persona selection cards.

    HTTP responses:
        200 -- always succeeds (empty list if no personas found)
    """
    names = _get_persona_names()
    personas = [_load_persona(name) for name in names]
    return jsonify(personas)


@bp.route("/<name>", methods=["GET"])
def get_persona(name: str):
    """
    Get details for a single persona by folder name.

    Path parameter:
        name -- the persona's folder name (e.g. "anna_meier")

    HTTP responses:
        200 -- persona found, returns its data
        404 -- no persona with that name exists
    """
    names = _get_persona_names()
    if name not in names:
        return jsonify({"error": f"Unknown persona: {name}"}), 404
    return jsonify(_load_persona(name))


@bp.route("", methods=["POST"])
@bp.route("/", methods=["POST"])
def create_persona():
    """
    Create a new custom persona from multipart form data.

    The frontend sends a multipart/form-data request with text fields for
    the persona's biographical info and file attachments for their
    financial documents.

    Expected form fields:
      - name (str, required) -- display name of the taxpayer
      - address (str)        -- home address
      - date_of_birth (str)  -- date of birth
      - ahv_number (str)     -- Swiss social security number
      - marital_status (str) -- e.g. "single", "married"
      - nationality (str)    -- two-letter country code, defaults to "CH"
      - brief (str)          -- short description of the persona

    Expected files:
      - documents (one or more files) -- salary statements, bank
        statements, etc.

    The function creates a new folder under ``PERSONAS_DIR``, writes a
    ``profile.json``, and saves the uploaded documents.

    HTTP responses:
        201 -- persona created successfully
        400 -- name field is missing or empty
    """
    global _color_idx

    name = request.form.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    # Convert the display name to a filesystem-safe folder name
    slug = _slugify(name)
    folder = PERSONAS_DIR / slug

    # If a folder with this slug already exists, append a number to make
    # it unique (e.g., "anna_meier_2", "anna_meier_3", ...)
    if folder.exists():
        i = 2
        while (PERSONAS_DIR / f"{slug}_{i}").exists():
            i += 1
        slug = f"{slug}_{i}"
        folder = PERSONAS_DIR / slug

    # Create the persona folder (and any missing parent directories)
    folder.mkdir(parents=True, exist_ok=True)

    # Assign a color from the rotating palette for the UI card
    color = _CUSTOM_COLORS[_color_idx % len(_CUSTOM_COLORS)]
    _color_idx += 1

    # Build the profile.json content from the submitted form fields
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

    # Write profile.json to disk
    with open(folder / "profile.json", "w") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)

    # Save each uploaded document file into the persona folder.
    # Path(file.filename).name strips any directory components the browser
    # may have included (security measure to prevent path traversal).
    files = request.files.getlist("documents")
    for file in files:
        if file.filename:
            safe_name = Path(file.filename).name
            file.save(str(folder / safe_name))

    return jsonify(_load_persona(slug)), 201
