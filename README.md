# AgenTekki — Agentic Swiss Tax Filler

AgenTekki is an AI-powered agent that autonomously fills out Zurich Canton tax return forms. It reads taxpayer documents (salary certificates, bank statements, pension confirmations), interprets them using an LLM, and fills the correct fields across a multi-page tax form — all without human intervention.

The system supports multiple LLM backends including local models via **Ollama**, making it fully usable offline with no API keys required.

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Taxpayer   │     │  Agent Loop  │     │  React Form    │
│  Documents  │────▶│  (LLM +      │────▶│  (auto-filled  │
│  + Profile  │     │   MCP Tools) │     │   in real-time)│
└─────────────┘     └──────────────┘     └────────────────┘
```

1. **Select a persona** — Each persona represents a taxpayer with a unique financial situation and a set of uploaded documents (salary certificates, bank statements, receipts, etc.)
2. **Agent starts** — The LLM-powered agent reads the persona's documents, interprets the financial data, and maps values to the correct tax form fields
3. **Watch it fill** — The React frontend updates in real-time as the agent navigates through Personal, Income, Deductions, and Wealth sections
4. **Review & download** — Once complete, review the filled form, see an accuracy score (if ground truth exists), and download the result as JSON

---

## Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **pnpm**
- **Ollama** (for local LLM — no API key needed)

### One-Click Setup

The setup scripts handle everything: installing dependencies, downloading Ollama, choosing an LLM model, and launching the app.

**macOS:**
```bash
bash setup_mac.sh
```

**Windows (PowerShell):**
See PDF instructions on Windows Launch

The script will:
1. Install Python, Node.js, and pnpm if missing
2. Create a virtual environment and install backend dependencies
3. Install frontend dependencies via pnpm
4. Install Ollama if missing
5. Let you choose from 4 LLM models:
   - `gemma3:1b` (~1 GB) — Fastest, lower accuracy
   - `gemma3:4b` (~3 GB) — Balanced speed/quality
   - `gemma3:12b` (~8 GB) — **Recommended**, best accuracy
   - `llama3.1:8b` (~5 GB) — Solid alternative
6. Download the selected model and launch everything

Once running, open **http://localhost:5173** in your browser.

> If you re-run the script, it will skip everything already installed and jump straight to model selection and launch.

### Manual Setup

If you prefer to set things up yourself, which is not advised, here is how you go about it:

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd project3-agentic-tax-filler

# 2. Python backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# 3. React frontend
cd "frontend"
pnpm install
cd ..

# 4. Install and start Ollama
brew install ollama        # macOS (or: winget install Ollama.Ollama on Windows)
ollama serve &             # Start the server
ollama pull gemma3:12b     # Download the model

# 5. Launch the app
export LLM_PROVIDER=ollama
export LLM_MODEL=gemma3:12b
bash start.sh
```

### Using Cloud LLM Providers

To use a cloud provider instead of Ollama:

```bash
# Gemini
export LLM_PROVIDER=gemini
export GEMINI_API_KEY=AIza...

# OpenAI
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-...

# Anthropic
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-...

bash start.sh
```

---

## Architecture

### System Overview

- **Flask Backend** (`backend/`) — REST API managing sessions, personas, and the agent loop. Exposes SSE streams for real-time progress updates.
- **React Frontend** (`frontend/`) — Multi-page tax form UI built with React 19, TypeScript, and Vite. Shows live updates as the agent fills fields.
- **MCP Server** (`mcp_server/`) — Model Context Protocol server exposing 9 domain-specific tools the agent uses to interact with the form.
- **Bridge Pattern** — Abstraction layer between the agent and the form, with multiple implementations for different environments.

### LLM Support

AgenTekki is **LLM-agnostic** — it uses the OpenAI-compatible SDK to communicate with any provider:

| Provider | Default Model | Requires |
|----------|--------------|----------|
| **Ollama** (local) | `gemma3:12b` | Ollama installed, no API key |
| Gemini | `gemini-2.5-flash` | `GEMINI_API_KEY` |
| OpenAI | `gpt-4o-mini` | `OPENAI_API_KEY` |
| Anthropic | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |

### Project Structure

```
project3-agentic-tax-filler/
├── setup_mac.sh                # One-click setup (macOS)
├── setup_windows.ps1           # One-click setup (Windows)
├── start.sh                    # Launch backend + frontend
│
├── backend/                    # Flask REST API
│   ├── app.py                  # App factory, CORS, blueprints
│   ├── config.py               # LLM provider config, paths
│   ├── routes/
│   │   ├── personas.py         # GET/POST /api/personas
│   │   └── agent_routes.py     # Session create/run/stream/score
│   ├── services/
│   │   ├── agent_service.py    # Session management, LLM client
│   │   └── think_service.py    # Agent loop (perceive-think-act)
│   └── bridges/
│       ├── flask_bridge.py     # In-memory form state bridge
│       └── form_model.py       # Form schema, field definitions, page order
│
├── frontend/             # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/              # Form pages (Personal, Income, etc.)
│   │   ├── components/         # UI components
│   │   ├── context/            # React contexts (Form, Session)
│   │   └── api/client.ts       # Backend API client
│   └── package.json
│
├── mcp_server/                 # MCP protocol server
│   ├── server.py               # 9 MCP tools
│   ├── agent.py                # Agent loop
│   ├── ask_user.py             # Simulated taxpayer (NPC)
│   └── bridges/                # Mock, Colab, Playwright bridges
│
├── personas/                   # Taxpayer personas + documents
│   ├── anna_meier/
│   ├── marco_laura_bernasconi/
│   └── ...
│
├── guides/                     # Zurich Canton tax reference guides
└── scripts/
    └── score.py                # Evaluate agent accuracy vs ground truth
```

---

## For Students — Understanding the Codebase

This section is written for readers who are new to the project or to software engineering. It explains the key ideas behind the code in plain language before you dive into individual files.

### The Big Picture

Think of AgenTekki as a robot tax accountant. Like a human accountant, it:

1. **Reads documents** — salary slips, bank statements, pension letters
2. **Understands the numbers** — which number goes in which tax box
3. **Fills in the form** — types values into the correct fields
4. **Asks questions when stuck** — "Did you have a company canteen?"

The "brain" of the robot is a Large Language Model (LLM) — the same technology behind ChatGPT. The LLM reads the documents and decides what to write. The rest of the code is infrastructure: a web form for the user to see, an API to coordinate everything, and a set of "tools" the LLM can call.

---

### Key Concept 1 — The Agent Loop

The core logic lives in `backend/services/think_service.py`. The agent follows a simple loop:

```
For each page of the tax form:
  1. Read all the taxpayer's documents (once, at the start)
  2. Call scan_page() → get the list of fields on this page
  3. Ask the LLM: "Given these documents, what should I fill in?"
  4. The LLM responds with a JSON object of field → value pairs
  5. Call fill_field() for each pair
  6. Move to the next page
```

This "perceive → think → act" pattern is called an **agent loop** and is the foundation of most AI agents.

---

### Key Concept 2 — MCP Tools

MCP stands for **Model Context Protocol**. It is a standard way to give an LLM a set of "tools" it can call — similar to how you might give a calculator to a human doing maths.

The 9 tools exposed in `mcp_server/server.py` are:

| Tool | What it does |
|------|-------------|
| `scan_page()` | "What fields are on the current page?" |
| `fill_field(locator, value)` | "Type this value into this field" |
| `click_element(locator)` | "Click this button" |
| `submit_form()` | "Submit the completed form" |
| `list_documents()` | "What documents does this taxpayer have?" |
| `read_document(filepath)` | "Read the contents of this document" |
| `list_guides()` | "What tax guides are available?" |
| `fetch_guide(topic)` | "Get the full text of this tax guide" |
| `ask_user(question)` | "Ask the taxpayer a question" |

The LLM decides which tools to call and in what order. The tools do the actual work. This separation means you could swap out the LLM for a different one and the tools would still work the same way.

---

### Key Concept 3 — The Bridge Pattern

The agent needs to interact with a "form" — but what form? In different scenarios the form might be:

- A real browser window running the React app (for demos)
- A fake in-memory dictionary (for fast testing)
- A Google Colab notebook (for students running in the cloud)

To handle all these cases without rewriting the agent, the code uses a **Bridge**: an abstract interface (`mcp_server/bridges/base.py`) that defines four operations any "form" must support:

```
navigate_to_page(path)   → go to a specific page
scan_page()              → list all fields and their current values
fill_field(locator, val) → write a value into a field
click_element(locator)   → click a button
```

Four concrete bridges implement this interface:

| Bridge | Where the form lives |
|--------|---------------------|
| `FlaskBridge` | In-memory Python dict (synced to React via API) |
| `MockBridge` | In-memory Python dict (no frontend) |
| `PlaywrightBridge` | Real Chromium browser window |
| `ColabBridge` | Google Colab notebook via JS injection |

When you run the app normally, `FlaskBridge` is used. The agent fills an in-memory dictionary on the server, and the React frontend polls the API every 1.5 seconds to show the latest values to the user in real time.

---

### Key Concept 4 — The Locator Convention

Every form field has a unique HTML `id` that follows this pattern:

```
field-{page}-{section}-{fieldname}
```

Example: `field-personal-main-firstName`

This `id` is called a **locator**. When the agent calls `fill_field("field-personal-main-firstName", "Anna")`, the bridge:

1. Splits the locator to extract the prefix: `personal-main`
2. Looks up `personal-main` in `LOCATOR_TO_PATH` (in `form_model.py`) → `("personal", "main")`
3. Stores the value: `form["personal"]["main"]["firstName"] = "Anna"`

This convention is defined once (in `form_model.py`) and used consistently everywhere — in React's `FormField.tsx`, in `flask_bridge.py`, and in the agent's prompts.

---

### Key Concept 5 — Real-Time Updates via SSE

The user watching the browser sees fields filling in as the agent works. How does the frontend know when a field has been updated?

The answer is **Server-Sent Events (SSE)** — a one-way stream of messages from the server to the browser. When the agent fills a field, the Flask backend pushes an event into a queue. The browser, which has an open SSE connection, receives the event and the React state updates automatically.

The relevant files:
- `backend/routes/agent_routes.py` — the `/stream` endpoint that opens the SSE connection
- `frontend/src/hooks/useSSE.ts` — the React hook that listens for SSE events
- `frontend/src/context/SessionContext.tsx` — polls `GET /api/sessions/{id}/form` every 1.5 s to refresh the displayed form values

---

### Key Concept 6 — The Persona System

A **persona** is a fictional Swiss taxpayer used for testing. Each one has a folder under `personas/` containing:

- `profile.json` — basic info (name, AHV number, address, etc.)
- `lohnausweis.txt` — salary certificate (the most important document)
- `bank_statement.csv` — bank transaction history
- Other documents as relevant (Pillar 3a, rental income, etc.)
- `ground_truth.json` — the correct answers, used to score the agent
- `private_notes.json` — verbal knowledge the NPC taxpayer "knows" (not in any document)
- `qa_pairs.json` — keyword → answer pairs for the rule-based NPC simulation

The `ask_user` tool simulates asking the real taxpayer a question. Three implementations exist (all in `mcp_server/ask_user.py`):
- **Rule-based** — keyword matching from `qa_pairs.json`, no LLM needed, great for fast tests
- **LLM-backed** — an LLM role-plays the taxpayer from a system prompt
- **NPC with private notes** — the most realistic: an LLM role-plays using `private_notes.json` as hidden knowledge

---

### Key Concept 7 — Form State Management in React

All form data lives in one central place: `FormContext` (`frontend/src/context/FormContext.tsx`). This is a React Context — a global state store that every component in the app can read and write without passing data through props.

The form data is a deeply nested object that mirrors the Python `make_empty_form()` dictionary in `backend/bridges/form_model.py`. Both sides must stay in sync.

Important things `FormContext` does:
- Provides `updateField(page, section, name, value)` to any component
- Auto-calculates the Berufsauslagen flat-rate deduction whenever Bruttolohn changes
- Exposes `window.__taxPortalBridge` so the agent can manipulate the form directly when running in a browser
- Uses `deepMerge` to apply partial updates from the API without overwriting unchanged fields

---

### Walking Through a Complete Agent Run

Here is a step-by-step trace of what happens when you click "Start Agent" on a persona:

1. **Frontend** calls `POST /api/sessions` → backend creates a session object and returns a `session_id`
2. **Frontend** calls `POST /api/sessions/{id}/run` → backend spawns a background thread running `run_session()`
3. **Backend thread** creates a `FlaskBridge` (empty in-memory form) and an `MCPServer` wrapping it
4. **Backend thread** calls `think()` (in `think_service.py`), which:
   - Reads all documents from the persona folder into memory (one LLM call per document)
   - Iterates through `PAGE_ORDER` (28 pages)
   - For each page: calls `scan_page()`, asks the LLM to fill it, calls `fill_field()` for each answer
   - If the page has dynamic tables (e.g. children, securities), adds rows first
   - If the LLM needs info not in any document, calls `ask_user()` to ask the NPC
5. **After each `fill_field` call**, the `FlaskBridge` pushes an SSE event to the session's queue
6. **Frontend** receives SSE events and polls `GET /api/sessions/{id}/form` every 1.5 s to refresh displayed values
7. **When all pages are done**, the agent calls `submit_form()` → backend saves `submitted_return.json`
8. **Frontend** calls `GET /api/sessions/{id}/score` → backend runs `score.py` and returns accuracy metrics
9. **ScoreCard modal** appears showing the final accuracy percentage and field-by-field comparison

---

## Personas

AgenTekki ships with 9 pre-built taxpayer personas, each with realistic Swiss tax scenarios and supporting documents:

| Persona | Scenario | Difficulty |
|---------|----------|------------|
| **Anna Meier** | Single professional, employment income, standard deductions | Easy |
| **Konstantinos Chasiotis** | Junior data engineer, Greek expat, standard deductions | Easy |
| **David Steiner** | PhD student, part-time TA, education deductions | Easy |
| **Priya Chakraborty** | Expat employee, international considerations, Pillar 3a | Medium |
| **Thomas & Elisabeth Widmer** | Retired couple, pension income, investment portfolio | Medium |
| **Sophie Mueller** | Marketing manager, divorced, one child, alimony | Medium |
| **Marco & Laura Bernasconi** | Married couple, dual income, children, property | Hard |
| **Yuki Tanaka** | Self-employed freelancer, complex deductions, securities | Hard |
| **Li Wei Zhang** | Research scientist, married, dual income, two children | Hard |
| **Elena Rossi** | Restaurant owner, widowed, self-employed, property income | Hard |

Each persona folder (`personas/<name>/`) contains:
- `profile.json` — Biographical data (name, address, AHV number, marital status)
- `lohnausweis.txt` — Salary certificate
- `bank_statement.csv` — Bank transactions
- Additional documents as relevant: Pillar 3a confirmations, receipts, rental income, etc.
- `ground_truth.json` — Expected correct answers (for scoring)

### Custom Personas

You can create your own personas through the UI:
1. Click **"+ Create Persona"** on the dashboard
2. Fill in the taxpayer profile (name, address, DOB, AHV number, marital status)
3. Upload documents (salary statements, bank statements, receipts)
4. The new persona appears in the Pending Tax Forms list

---

## Frontend Features

### Dashboard
- **Pending Tax Forms** — All personas ready to be processed, with document counts and one-click start
- **Completed Tax Forms** — Previously processed personas with accuracy scores and JSON download

### Tax Form
The form covers all sections of the Zurich Canton tax return:
- **Personal** — Taxpayer details, children, supported persons, bank details
- **Income** — Employment, pensions, securities income, property income, other income
- **Deductions** — Commuting costs, professional expenses, debt interest, insurance, Pillar 3a, medical costs
- **Wealth** — Securities, bank accounts, movable assets, real estate, debts
- **Review** — Summary of all filled fields and final submission

### Real-Time Agent Monitoring
- Live status bar showing agent progress and fields filled count
- Page-by-page navigation locking (can't jump ahead of the agent)
- Sidebar highlights which sections the agent has completed
- Score card displayed on completion with accuracy percentage

---

## MCP Server

The MCP (Model Context Protocol) server exposes 9 tools that the agent uses to interact with the tax form. It can also run as a standalone server for use with Claude Code, Gemini CLI, Cursor, or any MCP-compatible client.

### Tools Reference

| Tool | Description |
|------|-------------|
| `scan_page()` | Returns all visible elements on the current page (inputs, selects, buttons) with their locators |
| `fill_field(locator, value)` | Sets a form field value. Locator must come from a previous `scan_page()` call |
| `click_element(locator)` | Clicks a button or navigation link |
| `submit_form()` | Submits the completed tax return and generates `submitted_return.json` |
| `list_documents()` | Lists all files in the persona's document folder |
| `read_document(filepath)` | Reads `.txt`, `.csv`, `.pdf`, or `.json` files with automatic parsing |
| `list_guides()` | Returns available Zurich Canton tax guide topics |
| `fetch_guide(url)` | Returns the full text of a specific tax guide |
| `ask_user(question)` | Sends a question to the simulated taxpayer (logged and penalized if unnecessary) |

### Browser Bridges

| Bridge | Use Case |
|--------|----------|
| `FlaskBridge` | In-memory server-side form state (default, used with the React frontend) |
| `MockBridge` | In-memory simulation for testing — no browser needed |
| `ColabBridge` | Google Colab integration via JavaScript injection |
| `PlaywrightBridge` | Real browser automation via Playwright |

### Standalone MCP Server

Run the MCP server for use with external AI tools:

```bash
# Register with Claude Code
claude mcp add agentekki -- python -m mcp_server \
    --persona personas/anna_meier \
    --bridge playwright \
    --url http://localhost:3000

# Run directly
python -m mcp_server \
    --persona personas/anna_meier \
    --bridge mock \
    --verbose
```

| Flag | Default | Description |
|------|---------|-------------|
| `--persona` | *(required)* | Path to the persona document folder |
| `--bridge` | `mock` | Bridge type: `mock`, `playwright`, or `colab` |
| `--url` | `http://localhost:3000` | URL for the PlaywrightBridge |
| `--guides` | `guides/` | Path to the tax guides folder |
| `--headless` / `--no-headless` | `--headless` | Show/hide the Playwright browser |
| `--verbose` / `-v` | off | Enable debug logging |

---

## Scoring

AgenTekki evaluates how accurately the agent filled the tax form by comparing against ground truth answers:

```bash
# Score a single persona
python3 -m scripts.score --persona anna_meier

# Score all personas
python3 -m scripts.score --all
```

The scoring system compares each filled field against expected values, normalizing strings and numbers for fair comparison. Scores are displayed as percentages on the dashboard after each completed run.

---

## Swiss Tax Concepts Glossary

For readers unfamiliar with the Swiss tax system, here are the key terms used throughout the codebase:

| Term | Meaning |
|------|---------|
| **AHV** | Swiss state pension system (1st pillar). Every Swiss resident has an AHV number (like a social security number). |
| **BVG** | Occupational pension fund (2nd pillar). Employer and employee both contribute. |
| **Pillar 3a** | Voluntary private pension savings account. Contributions are tax-deductible up to an annual limit. |
| **Lohnausweis** | Official salary certificate issued by every employer in Switzerland. Contains gross salary, AHV/BVG deductions, and other income. The most important document for tax filing. |
| **Bruttolohn** | Gross salary before deductions. |
| **Berufsauslagen** | Professional/work-related expenses (e.g. tools, work clothing, home office). Either declared as a flat-rate (3% of salary) or itemised. |
| **Fahrkosten** | Commuting costs from home to workplace. |
| **Verpflegung** | Meal/subsistence costs incurred while working away from a company canteen. |
| **Schuldzinsen** | Interest paid on debts (e.g. mortgage interest). Deductible up to a limit. |
| **Unterhaltsbeiträge** | Alimony/maintenance payments. Paid alimony is deductible; received alimony is taxable income. |
| **Eigenmietwert** | Imputed rental value. Swiss law requires homeowners to declare the theoretical rent they would pay if they rented their own property — this counts as taxable income. |
| **Steuerwert** | The official tax assessment value of real estate, set by the canton. |
| **Zweiverdienerabzug** | "Dual-earner deduction" — a special deduction for married couples where both spouses work. |
| **Zugangscode** | The access code mailed to taxpayers each year to log into the online tax portal. |

---

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `gemini` | LLM backend: `ollama`, `gemini`, `openai`, `anthropic` |
| `LLM_MODEL` | Auto per provider | Override the model name |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama API endpoint |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |

### Ports

| Service | URL |
|---------|-----|
| React Frontend | http://localhost:5173 |
| Flask Backend | http://localhost:5001 |
| Ollama API | http://localhost:11434 |
