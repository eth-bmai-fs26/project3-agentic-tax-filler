"""Agent runner — the perceive-think-act loop that students' think() plugs into."""

import json
import logging
from pathlib import Path
from typing import Any, Callable

from .server import MCPServer
from .bridges.base import BrowserBridge

logger = logging.getLogger("mcp_server.agent")


def run_agent(
    think_fn: Callable[[dict], dict | None],
    persona_folder: str,
    guides_folder: str | None = None,
    bridge: BrowserBridge | None = None,
    ask_user_fn: Callable | None = None,
    max_steps: int = 100,
) -> dict:
    """Run the full agent loop.

    Parameters
    ----------
    think_fn : callable
        The student's ``think(state) → {"tool": ..., "args": ...}`` function.
    persona_folder : str
        Path to the persona's document folder.
    guides_folder : str | None
        Path to the tax guides folder.
    bridge : BrowserBridge | None
        Browser bridge.  Defaults to MockBridge.
    ask_user_fn : callable | None
        Custom ask_user implementation.
    max_steps : int
        Maximum number of loop iterations.

    Returns
    -------
    dict — final agent state including interaction log.
    """
    server = MCPServer(
        persona_folder=persona_folder,
        guides_folder=guides_folder,
        bridge=bridge,
        ask_user_fn=ask_user_fn,
    )

    # Load profile
    profile_path = Path(persona_folder) / "profile.json"
    if profile_path.exists():
        with open(profile_path) as f:
            profile = json.load(f)
    else:
        profile = {"name": "Unknown", "brief": "No profile found."}

    state = {
        "profile": profile,
        "documents_read": [],
        "extracted_data": {},
        "form_fields_filled": {},
        "questions_asked": [],
        "searches_done": [],
        "notes": [],
        "warnings": [],
        "current_page": None,
        "step_count": 0,
        "max_steps": max_steps,
        "done": False,
        "last_action": None,
        "last_result": None,
    }

    print(f"=== AgenTekki Agent Loop ===")
    print(f"Persona: {profile.get('name', 'Unknown')}")
    print(f"Max steps: {max_steps}\n")

    while not state["done"] and state["step_count"] < max_steps:
        state["step_count"] += 1
        print(f"--- Step {state['step_count']} ---")

        action = think_fn(state)

        if action is None or action.get("tool") == "done":
            state["done"] = True
            print("Agent signaled done.")
            break

        try:
            result = server.execute(action)
        except Exception as e:
            result = {"error": str(e)}
            logger.error("Tool execution error: %s", e)

        state["last_action"] = action
        state["last_result"] = result
        _update_state(state, action, result)

        print(f"  Action: {action['tool']}({action.get('args', {})})")
        if isinstance(result, dict) and result.get("error"):
            print(f"  Error: {result['error']}")
        print()

    if state["step_count"] >= max_steps:
        print(f"WARNING: Max steps ({max_steps}) reached.")

    log_path = Path(persona_folder) / "interaction_log.json"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    server.log.save(str(log_path))

    state["interaction_log"] = server.log.export()
    print(f"\n=== Agent finished in {state['step_count']} steps ===")
    print(f"  Questions asked: {len(state['questions_asked'])}")
    print(f"  Documents read:  {len(state['documents_read'])}")
    print(f"  Fields filled:   {len(state['form_fields_filled'])}")

    return state


def _update_state(state: dict, action: dict, result: Any):
    tool = action["tool"]
    args = action.get("args", {})

    if tool == "read_document":
        fp = args.get("filepath", "")
        if fp not in state["documents_read"]:
            state["documents_read"].append(fp)
        if isinstance(result, dict) and "content" in result:
            state["extracted_data"][fp] = result

    elif tool == "fill_field":
        if isinstance(result, dict) and result.get("success"):
            state["form_fields_filled"][args.get("locator", "")] = args.get("value")

    elif tool == "ask_user":
        state["questions_asked"].append({
            "question": args.get("question", ""),
            "answer": result.get("answer", "") if isinstance(result, dict) else "",
        })

    elif tool == "scan_page":
        if isinstance(result, dict):
            state["current_page"] = result.get("page_name")

    elif tool == "submit_form":
        if isinstance(result, dict) and result.get("success"):
            state["done"] = True

    elif tool in ("list_guides", "fetch_guide"):
        state["searches_done"].append({"tool": tool, "args": args})
