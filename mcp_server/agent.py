"""Agent runner -- the perceive-think-act loop that students' think() plugs into.

This module implements the classic **agent loop** pattern used in AI:

    1. PERCEIVE  -- the agent reads the current state (form fields, documents, etc.)
    2. THINK     -- the student-written ``think_fn`` decides which tool to call next
    3. ACT       -- the chosen tool is executed, and the state is updated

The loop repeats until the agent signals "done" or hits the step limit.

Why it exists
-------------
Students write only the ``think()`` function.  This module provides all the
surrounding infrastructure: initializing the MCP server, loading the persona
profile, managing the state dictionary, executing tools, logging results, and
printing progress to the console.

How it fits into the architecture
---------------------------------
::

    Student's think_fn
         |
         v
    run_agent()  (this file)
         |
         v
    MCPServer.execute()  -->  BrowserBridge / document reader / ask_user
"""

import json
import logging
from pathlib import Path
from typing import Any, Callable

from .server import MCPServer
from .bridges.base import BrowserBridge

# Logger scoped to this module -- messages appear as "mcp_server.agent".
logger = logging.getLogger("mcp_server.agent")


def run_agent(
    think_fn: Callable[[dict], dict | None],
    persona_folder: str,
    guides_folder: str | None = None,
    bridge: BrowserBridge | None = None,
    ask_user_fn: Callable | None = None,
    max_steps: int = 100,
) -> dict:
    """Run the full perceive-think-act agent loop.

    This is the main entry point that students call to run their agent.
    It wires together the MCPServer, the student's ``think_fn``, and the
    state dictionary, then loops until the agent is done.

    Parameters
    ----------
    think_fn : callable
        The student's decision function.  It receives the current ``state``
        dict and must return either:
        - ``{"tool": "<tool_name>", "args": {<arguments>}}`` to call a tool, or
        - ``None`` (or ``{"tool": "done"}``) to signal that the agent is finished.
    persona_folder : str
        Path to the folder containing the taxpayer's documents
        (e.g. ``"personas/anna_meier"``).  Must contain a ``profile.json``.
    guides_folder : str | None
        Path to the folder with tax guide files.  Defaults to ``"guides/"``.
    bridge : BrowserBridge | None
        The browser bridge to use for form interaction.  If ``None``, a
        ``MockBridge`` (in-memory fake) is used automatically.
    ask_user_fn : callable | None
        A custom function for simulating the taxpayer's answers.  If ``None``,
        a rule-based keyword matcher is used as a fallback.
    max_steps : int
        Safety limit -- the loop stops after this many iterations even if
        the agent has not signaled "done".  Prevents infinite loops.

    Returns
    -------
    dict
        The final agent state dictionary, including:
        - ``"interaction_log"``: list of all tool calls (for scoring)
        - ``"form_fields_filled"``: which fields were filled and with what values
        - ``"questions_asked"``: every question posed to the simulated taxpayer
        - ``"documents_read"``: which files the agent examined
        - ``"step_count"``: how many loop iterations were executed
    """

    # -----------------------------------------------------------------------
    # 1. Create the MCPServer -- this object exposes all 9 tools.
    # -----------------------------------------------------------------------
    server = MCPServer(
        persona_folder=persona_folder,
        guides_folder=guides_folder,
        bridge=bridge,
        ask_user_fn=ask_user_fn,
    )

    # -----------------------------------------------------------------------
    # 2. Load the taxpayer's profile from profile.json.
    #    This gives the agent basic info (name, brief description) about the
    #    person whose tax return it is filling out.
    # -----------------------------------------------------------------------
    profile_path = Path(persona_folder) / "profile.json"
    if profile_path.exists():
        with open(profile_path) as f:
            profile = json.load(f)
    else:
        # Provide a sensible default so the agent can still run
        profile = {"name": "Unknown", "brief": "No profile found."}

    # -----------------------------------------------------------------------
    # 3. Initialize the state dictionary.
    #    This is the single source of truth that the think_fn reads and that
    #    gets updated after every tool call.  Think of it as the agent's
    #    "working memory".
    # -----------------------------------------------------------------------
    state = {
        "profile": profile,               # taxpayer's profile data
        "documents_read": [],              # list of file paths already read
        "extracted_data": {},              # filepath -> content from read_document
        "form_fields_filled": {},          # locator -> value for fields filled so far
        "questions_asked": [],             # list of {question, answer} dicts
        "searches_done": [],               # list of guide lookups performed
        "notes": [],                       # free-form notes the agent can store
        "warnings": [],                    # warnings encountered during the run
        "current_page": None,              # which form page the browser is on
        "step_count": 0,                   # how many loop iterations have run
        "max_steps": max_steps,            # the cap (provided for think_fn reference)
        "done": False,                     # flag: True when the agent is finished
        "last_action": None,               # the most recent tool call dict
        "last_result": None,               # the result of the most recent tool call
    }

    # Print a banner so the user can see the run has started
    print(f"=== AgenTekki Agent Loop ===")
    print(f"Persona: {profile.get('name', 'Unknown')}")
    print(f"Max steps: {max_steps}\n")

    # -----------------------------------------------------------------------
    # 4. The main agent loop: perceive -> think -> act
    # -----------------------------------------------------------------------
    while not state["done"] and state["step_count"] < max_steps:
        state["step_count"] += 1
        print(f"--- Step {state['step_count']} ---")

        # THINK: ask the student's function what to do next
        action = think_fn(state)

        # If think_fn returns None or {"tool": "done"}, the agent is finished
        if action is None or action.get("tool") == "done":
            state["done"] = True
            print("Agent signaled done.")
            break

        # ACT: execute the chosen tool via the MCPServer
        try:
            result = server.execute(action)
        except Exception as e:
            # If a tool raises an exception, capture it as an error result
            # instead of crashing the whole loop
            result = {"error": str(e)}
            logger.error("Tool execution error: %s", e)

        # UPDATE: record what happened and update the state dictionary
        state["last_action"] = action
        state["last_result"] = result
        _update_state(state, action, result)

        # Print a short summary of this step for the console
        print(f"  Action: {action['tool']}({action.get('args', {})})")
        if isinstance(result, dict) and result.get("error"):
            print(f"  Error: {result['error']}")
        print()

    # -----------------------------------------------------------------------
    # 5. Post-loop: save the interaction log and print a summary.
    # -----------------------------------------------------------------------
    if state["step_count"] >= max_steps:
        print(f"WARNING: Max steps ({max_steps}) reached.")

    # Save the full interaction log (every tool call) to a JSON file in the
    # persona folder.  This file is used by the grading / scoring system.
    log_path = Path(persona_folder) / "interaction_log.json"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    server.log.save(str(log_path))

    # Also attach the log data to the state dict so the caller can inspect it
    state["interaction_log"] = server.log.export()
    print(f"\n=== Agent finished in {state['step_count']} steps ===")
    print(f"  Questions asked: {len(state['questions_asked'])}")
    print(f"  Documents read:  {len(state['documents_read'])}")
    print(f"  Fields filled:   {len(state['form_fields_filled'])}")

    return state


def _update_state(state: dict, action: dict, result: Any):
    """Update the agent's state dictionary based on the tool that just ran.

    After every tool call, we need to record what happened so that the
    ``think_fn`` can see up-to-date information on the next iteration.
    This function inspects which tool was called and updates the relevant
    part of the state dictionary.

    Parameters
    ----------
    state : dict
        The agent's mutable state dictionary (modified in place).
    action : dict
        The action that was just executed, e.g.
        ``{"tool": "fill_field", "args": {"locator": "...", "value": "..."}}``.
    result : Any
        The return value from ``MCPServer.execute(action)``.
    """
    tool = action["tool"]
    args = action.get("args", {})

    if tool == "read_document":
        # Track which documents the agent has read (avoid duplicates)
        fp = args.get("filepath", "")
        if fp not in state["documents_read"]:
            state["documents_read"].append(fp)
        # Store the extracted content so think_fn can use it later
        if isinstance(result, dict) and "content" in result:
            state["extracted_data"][fp] = result

    elif tool == "fill_field":
        # Record the locator and value of successfully filled fields
        if isinstance(result, dict) and result.get("success"):
            state["form_fields_filled"][args.get("locator", "")] = args.get("value")

    elif tool == "ask_user":
        # Keep a log of every question/answer exchange with the taxpayer
        state["questions_asked"].append({
            "question": args.get("question", ""),
            "answer": result.get("answer", "") if isinstance(result, dict) else "",
        })

    elif tool == "scan_page":
        # Remember which form page the browser is currently showing
        if isinstance(result, dict):
            state["current_page"] = result.get("page_name")

    elif tool == "submit_form":
        # A successful submission means the agent is done
        if isinstance(result, dict) and result.get("success"):
            state["done"] = True

    elif tool in ("list_guides", "fetch_guide"):
        # Record any guide lookups for auditing / scoring
        state["searches_done"].append({"tool": tool, "args": args})
