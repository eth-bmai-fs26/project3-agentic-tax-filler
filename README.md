# AgenTekki — Agentic Swiss Tax Filler

AgenTekki is an AI-powered agent that autonomously fills out Zurich Canton tax return forms. It reads taxpayer documents (salary certificates, bank statements, pension confirmations), interprets them using an LLM, and fills the correct fields across a multi-page tax form — all without human intervention.

The system supports multiple LLM backends including local models via **Ollama**, making it fully usable offline with no API keys required.

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Taxpayer    │     │  Agent Loop  │     │  React Form    │
│  Documents   │────▶│  (LLM +      │────▶│  (auto-filled  │
│  + Profile   │     │   MCP Tools) │     │   in real-time)│
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
```powershell
powershell -ExecutionPolicy Bypass -File setup_windows.ps1
```

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

If you prefer to set things up yourself:

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
│       └── flask_bridge.py     # In-memory form state bridge
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
