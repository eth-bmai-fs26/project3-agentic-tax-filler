# AgenTekki — MCP Tax Agent Server

MCP (Model Context Protocol) server that exposes the tools an AI agent needs to autonomously file a Zurich tax return against the ZHprivateTax simulator.

Built by **Squad B** (Middleware) as part of the AgenTekki teaching exercise. This package provides:

- **9 MCP tools** for browser interaction, document reading, knowledge lookup, and human-in-the-loop communication
- **3 browser bridges** — Colab (JS injection), Playwright (real browser), Mock (testing)
- **2 running modes** — direct Python import (Colab notebooks) and standalone MCP protocol server (Claude Code, Gemini CLI, Cursor, etc.)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Package Structure](#package-structure)
3. [Tools Reference](#tools-reference)
4. [Browser Bridges](#browser-bridges)
5. [Usage Modes](#usage-modes)
   - [Colab Notebook](#1-colab-notebook)
   - [Local Testing with Mock](#2-local-testing-with-mock)
   - [Playwright with Real Browser](#3-playwright-with-real-browser)
   - [Standalone MCP Server](#4-standalone-mcp-server-claude-code--gemini-cli)
6. [Agent Loop](#agent-loop)
7. [Simulated Taxpayer (ask_user)](#simulated-taxpayer-ask_user)
8. [Frontend Contract (Squad A)](#frontend-contract-squad-a)
9. [Configuration Reference](#configuration-reference)

---

## Quick Start

### Install dependencies

```bash
# Core (always needed)
pip install mcp

# For Playwright bridge (standalone mode)
pip install playwright
playwright install chromium

# For PDF document reading (optional)
pip install PyPDF2
# or
pip install pdfplumber

# For LLM-backed simulated taxpayer (optional)
pip install anthropic
# or
pip install openai
```

### Run locally with the mock frontend

```python
from mcp_server import MCPServer

server = MCPServer(persona_folder="personas/anna_meier")

page = server.scan_page()
print(page["page_name"], "—", len(page["elements"]), "elements")

server.click_element("btn-nav-income")
server.fill_field("field-income-employment-bruttolohn", 142000)
server.submit_form()
```

### Run as an MCP server for Claude Code

```bash
# Register with Claude Code
claude mcp add agentekki -- python -m mcp_server \
    --persona personas/anna_meier \
    --bridge playwright \
    --url http://localhost:3000

# Then in Claude Code, the 9 tools are available automatically
```

---

## Package Structure

```
mcp_server/
├── __init__.py          Public API — re-exports MCPServer, run_agent, bridges, etc.
├── __main__.py          CLI entry point: python -m mcp_server
├── server.py            MCPServer class — all 9 tools, bridge-agnostic
├── agent.py             run_agent() — the perceive-think-act loop
├── ask_user.py          Simulated taxpayer — LLM-backed and rule-based
├── log.py               InteractionLog — records every tool call for scoring
├── protocol.py          MCP JSON-RPC server over stdio (uses mcp SDK)
└── bridges/
    ├── __init__.py      Bridge exports and lazy loaders
    ├── base.py          BrowserBridge — abstract base class (4 methods)
    ├── colab.py         ColabBridge — google.colab.output.eval_js()
    ├── mock.py          MockBridge + MockFrontend — in-memory fake
    └── playwright.py    PlaywrightBridge — real browser automation
```

### Dependency graph

```
__init__.py ─────┐
                 ├─▶ server.py ──▶ bridges/base.py
__main__.py ─────┤                   ▲
                 ├─▶ protocol.py     │
                 ├─▶ agent.py     bridges/{colab,mock,playwright}.py
                 ├─▶ ask_user.py
                 └─▶ log.py
```

`server.py` depends only on `bridges/base.py` (the ABC). Concrete bridges are injected at instantiation time, so the core is fully decoupled from transport.

---

## Tools Reference

### Browser & UI Tools (Discovery-Based)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `scan_page()` | — | Returns a JSON representation of the current page: page name, validation errors, and all visible elements (inputs, selects, buttons, text) with their locators. |
| `fill_field(locator, value)` | `locator: str`, `value: str\|number` | Enters a value into a form field. The locator must come from a previous `scan_page()` call. |
| `click_element(locator)` | `locator: str` | Clicks a button or link (e.g. `"btn-nav-deductions"` for page navigation). |
| `submit_form()` | — | Submits the completed tax return. Generates `submitted_return.json` for scoring. |

### Document & Knowledge Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_documents()` | — | Lists all files in the persona's document folder. |
| `read_document(filepath)` | `filepath: str` | Reads `.txt`, `.csv`, `.pdf`, or `.json` files. Returns extracted text and structured data (parsed rows for CSV, parsed object for JSON). |
| `list_guides()` | — | Returns available tax guide topics and their file paths. |
| `fetch_guide(url)` | `url: str` | Returns the full text of a specific tax guide. |

### Human-in-the-Loop

| Tool | Parameters | Description |
|------|-----------|-------------|
| `ask_user(question)` | `question: str` | Sends a question to the simulated taxpayer. Every call is logged — unnecessary questions are penalized during scoring. |

### Return schemas

**`scan_page()` returns:**
```json
{
  "page_name": "income",
  "validation_errors": [{"field_id": "...", "message": "..."}],
  "elements": [
    {"type": "input", "locator": "field-income-employment-bruttolohn", "label": "1. Gross Salary (CHF)", "value": "", "required": true},
    {"type": "select", "locator": "field-income-canteen", "label": "Subsidized canteen?", "options": ["Yes", "No"], "value": "No", "required": true},
    {"type": "button", "locator": "btn-nav-deductions", "label": "Continue to Deductions"},
    {"type": "text", "content": "Please declare your employment income here."}
  ]
}
```

**`fill_field()` returns:**
```json
{
  "success": true,
  "field_id": "field-income-employment-bruttolohn",
  "value_set": 142000,
  "error": null,
  "triggered_changes": []
}
```

**`submit_form()` returns:**
```json
{
  "success": true,
  "submission_json": {"field-personal-main-name": "Anna Meier", "...": "..."},
  "errors": [],
  "warnings": []
}
```

---

## Browser Bridges

The `BrowserBridge` ABC defines 4 methods that every bridge must implement:

```python
class BrowserBridge(ABC):
    def scan_page(self) -> dict: ...
    def fill_field(self, locator: str, value: Any) -> dict: ...
    def click_element(self, locator: str) -> dict: ...
    def submit_form(self) -> dict: ...
    @property
    def is_available(self) -> bool: ...
    def close(self): ...  # optional cleanup
```

### MockBridge

In-memory simulation of the 6-page tax form. No external dependencies. Used for unit tests, CI, and local development.

```python
from mcp_server import MCPServer, MockBridge

server = MCPServer(persona_folder="personas/anna_meier", bridge=MockBridge())
```

### ColabBridge

Communicates with a frontend rendered inside a Google Colab cell output via `google.colab.output.eval_js()`. The frontend must expose a `window.TaxPortal` JS object (see [Frontend Contract](#frontend-contract-squad-a)).

```python
from mcp_server import MCPServer
from mcp_server.bridges.colab import ColabBridge

server = MCPServer(persona_folder="personas/anna_meier", bridge=ColabBridge())
```

> Only works inside a Google Colab runtime.

### PlaywrightBridge

Drives a real browser (Chromium/Firefox/WebKit) against the ZHprivateTax simulator. Dual strategy: prefers the `window.TaxPortal` JS API if the frontend exposes it, otherwise falls back to generic DOM scraping.

```python
from mcp_server import MCPServer
from mcp_server.bridges.playwright import PlaywrightBridge

bridge = PlaywrightBridge(
    url="http://localhost:3000",
    headless=True,          # False to see the browser
    browser_type="chromium", # or "firefox", "webkit"
)
server = MCPServer(persona_folder="personas/anna_meier", bridge=bridge)

# Don't forget to clean up
bridge.close()
```

---

## Usage Modes

### 1. Colab Notebook

Students import the package directly and call tools from their `think()` function.

```python
# In a Colab cell:
from mcp_server import MCPServer

server = MCPServer(persona_folder="personas/anna_meier")

# Discover the page
page = server.scan_page()
for el in page["elements"]:
    if el["type"] == "input":
        print(f"  {el['locator']}: {el['label']}")

# Fill fields
server.fill_field("field-income-employment-bruttolohn", 142000)

# Read persona documents
docs = server.list_documents()
for doc in docs:
    content = server.read_document(doc)
    print(f"{doc}: {content['type']}, {len(content['content'])} chars")

# Ask the taxpayer
answer = server.ask_user("Do you work from home regularly?")
print(answer["answer"])
```

### 2. Local Testing with Mock

The `MockBridge` (default) requires no browser, no Colab, no external services. It simulates all 6 pages with realistic field structures.

```python
from mcp_server import MCPServer

server = MCPServer(persona_folder="personas/anna_meier")  # MockBridge by default
```

### 3. Playwright with Real Browser

Start the ZHprivateTax simulator (Squad A's frontend), then point the Playwright bridge at it.

```bash
# Terminal 1: start the frontend
cd zhprivatetax-simulator && npm run dev
# → http://localhost:3000

# Terminal 2: run your agent
python my_agent.py
```

```python
# my_agent.py
from mcp_server import MCPServer
from mcp_server.bridges.playwright import PlaywrightBridge

bridge = PlaywrightBridge(url="http://localhost:3000", headless=False)
server = MCPServer(persona_folder="personas/anna_meier", bridge=bridge)

# Now all tools interact with the real browser
page = server.scan_page()  # scrapes the live DOM
server.fill_field("field-income-employment-bruttolohn", 142000)  # types into real inputs
```

### 4. Standalone MCP Server (Claude Code / Gemini CLI)

Run the package as a proper MCP server that speaks JSON-RPC over stdio. This makes all 9 tools available to any MCP-compatible client.

**Command line:**

```bash
python -m mcp_server \
    --persona personas/anna_meier \
    --bridge playwright \
    --url http://localhost:3000 \
    --no-headless \
    --verbose
```

**Register with Claude Code:**

```bash
claude mcp add agentekki -- python -m mcp_server \
    --persona personas/anna_meier \
    --bridge playwright \
    --url http://localhost:3000
```

**Register with Gemini CLI (via MCP config):**

```json
{
  "mcpServers": {
    "agentekki": {
      "command": "python",
      "args": ["-m", "mcp_server", "--persona", "personas/anna_meier", "--bridge", "mock"]
    }
  }
}
```

**CLI options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--persona` | *(required)* | Path to the persona document folder |
| `--bridge` | `mock` | Bridge type: `mock`, `playwright`, or `colab` |
| `--url` | `http://localhost:3000` | URL for the PlaywrightBridge |
| `--guides` | `guides/` | Path to the tax guides folder |
| `--headless` / `--no-headless` | `--headless` | Show/hide the Playwright browser |
| `--verbose` / `-v` | off | Enable debug logging |

---

## Agent Loop

The `run_agent()` function provides a ready-made perceive-think-act loop. Students implement `think(state) -> action` and plug it in.

```python
from mcp_server import run_agent

def think(state):
    """Decide the next action based on current state.

    Must return: {"tool": "tool_name", "args": {…}}
    Return None or {"tool": "done"} to stop.
    """
    if not state["documents_read"]:
        docs = state.get("last_result", [])
        if not docs:
            return {"tool": "list_documents", "args": {}}
        return {"tool": "read_document", "args": {"filepath": docs[0]}}

    # ... your strategy here ...
    return {"tool": "submit_form", "args": {}}


state = run_agent(
    think_fn=think,
    persona_folder="personas/anna_meier",
    max_steps=50,
)

print(f"Score-relevant fields: {state['form_fields_filled']}")
```

### Agent state structure

The state dict passed to `think()` contains:

```python
{
    "profile": {...},              # persona's profile.json
    "documents_read": [...],       # filenames already processed
    "extracted_data": {...},       # filepath → read_document result
    "form_fields_filled": {...},   # locator → value mapping
    "questions_asked": [...],      # [{question, answer}]
    "searches_done": [...],        # [{tool, args}]
    "notes": [],                   # free-form agent notes
    "warnings": [],                # flags / inconsistencies
    "current_page": "income",      # last known page name
    "step_count": 7,               # current iteration
    "max_steps": 100,              # hard limit
    "done": False,                 # set True on submit or agent signal
    "last_action": {...},          # previous action dict
    "last_result": {...},          # previous tool result
}
```

---

## Simulated Taxpayer (ask_user)

Two implementations are provided:

### Rule-based (default)

Keyword-matching against a Q&A dictionary. Loads from `{persona_folder}/qa_pairs.json` if it exists, otherwise uses hardcoded Anna Meier defaults.

```json
// personas/anna_meier/qa_pairs.json
{
  "canteen": "Yes, Google has a subsidized canteen.",
  "children": "No, no kids.",
  "commute": "I take the ZVV tram. Annual pass.",
  "donations": "CHF 200 to the Swiss Red Cross."
}
```

### LLM-backed

Uses the Anthropic or OpenAI SDK to generate in-character responses.

```python
from mcp_server import MCPServer, make_llm_ask_user

ask_fn = make_llm_ask_user(
    persona_system_prompt="You are Anna Meier, a 29-year-old software engineer at Google Zurich...",
    model="claude-sonnet-4-5-20250929",
)

server = MCPServer(
    persona_folder="personas/anna_meier",
    ask_user_fn=ask_fn,
)
```

---

## Frontend Contract (Squad A)

The frontend (React app or plain HTML/JS) must expose a global `window.TaxPortal` object with 4 methods. All methods **must return JSON strings**.

```javascript
window.TaxPortal = {

  // scanPage() → string (JSON)
  // No parameters.
  // Returns: {page_name, validation_errors, elements}
  scanPage() { ... },

  // fillField(locator: string, value: string|number) → string (JSON)
  // Returns: {success, field_id, value_set, error, triggered_changes}
  fillField(locator, value) { ... },

  // clickElement(locator: string) → string (JSON)
  // Returns: {success, locator, action, new_page}
  clickElement(locator) { ... },

  // submitForm() → string (JSON)
  // No parameters.
  // Returns: {success, submission_json, errors, warnings}
  submitForm() { ... },
};
```

> The PlaywrightBridge also works **without** `window.TaxPortal` by falling back to generic DOM scraping, but the JS API is preferred for reliability.

---

## Configuration Reference

### MCPServer constructor

```python
MCPServer(
    persona_folder: str,              # Path to persona documents (required)
    guides_folder: str | None,        # Path to tax guides (default: "guides/")
    bridge: BrowserBridge | None,     # Browser bridge (default: MockBridge)
    ask_user_fn: callable | None,     # Simulated taxpayer (default: rule-based)
)
```

### Interaction log

Every tool call is recorded in an `InteractionLog` accessible via `server.log`. On `run_agent()` completion, the log is saved to `{persona_folder}/interaction_log.json`.

```python
# Access the log
for entry in server.log.entries:
    print(entry["timestamp"], entry["tool"], entry["duration_ms"], "ms")

# Save manually
server.log.save("my_log.json")
```

### Scoring output

On successful `submit_form()`, the submission JSON is saved to `{persona_folder}/submitted_return.json`. This file is compared against the gold standard by the scoring script (Squad D).
