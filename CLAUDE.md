a# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AgenTekki — an MCP server that exposes 9 tools for an AI agent to autonomously file a Zurich tax return against the ZHprivateTax simulator. Built as a teaching exercise with squad-based structure (this is Squad B — Middleware).

## Development Commands

```bash
# Install core dependency
pip install mcp

# For Playwright bridge (real browser automation)
pip install playwright && playwright install chromium

# For PDF reading (optional)
pip install PyPDF2   # or pdfplumber

# For LLM-backed simulated taxpayer (optional)
pip install anthropic   # or openai

# Run locally with mock bridge (no browser needed)
python -c "from mcp_server import MCPServer; s = MCPServer(persona_folder='personas/anna_meier'); print(s.scan_page())"

# Run as standalone MCP server (JSON-RPC over stdio)
python -m mcp_server --persona personas/anna_meier --bridge mock

# Run with real browser (start frontend first at localhost:3000)
python -m mcp_server --persona personas/anna_meier --bridge playwright --url http://localhost:3000 --no-headless

# Register with Claude Code
claude mcp add agentekki -- python -m mcp_server --persona personas/anna_meier --bridge playwright --url http://localhost:3000

# Score a submission against ground truth
python scripts/score.py anna_meier personas/anna_meier/submitted_return.json
python scripts/score.py --all /path/to/agent_output_dir/
```

### EnvDemoV1 (React frontend)

```bash
cd EnvDemoV1 && pnpm install && pnpm dev
```

## Architecture

### Core Pipeline: `mcp_server/`

```
server.py       MCPServer class — all 9 tools, bridge-agnostic. Delegates browser
                operations to an injected BrowserBridge; handles documents and
                guides directly via filesystem.

agent.py        run_agent() — perceive-think-act loop. Students implement
                think(state) → {"tool": ..., "args": {...}} and plug it in.

ask_user.py     Simulated taxpayer — rule-based (qa_pairs.json keyword matching)
                or LLM-backed (Anthropic/OpenAI). Every call is logged and
                unnecessary questions penalized during scoring.

protocol.py     MCP JSON-RPC server over stdio (uses mcp SDK).
__main__.py     CLI entry point with --persona, --bridge, --url flags.
log.py          InteractionLog — records every tool call for scoring.
```

### Browser Bridges: `mcp_server/bridges/`

All bridges implement the `BrowserBridge` ABC (4 methods: `scan_page`, `fill_field`, `click_element`, `submit_form`). Concrete bridges are injected at instantiation — server.py depends only on the ABC.

- **MockBridge** — in-memory simulation of the 6-page tax form (login → personal → income → deductions → wealth → review). No external deps. Default bridge.
- **PlaywrightBridge** — real browser automation. Prefers `window.TaxPortal` JS API, falls back to DOM scraping.
- **ColabBridge** — communicates via `google.colab.output.eval_js()`. Colab-only.

### Personas: `personas/`

Each persona folder contains taxpayer documents the agent reads (profile.json, lohnausweis.txt, bank_statement.csv, etc.) plus a hidden `ground_truth.json` used for scoring. Five personas: anna_meier, priya_chakraborty, marco_laura_bernasconi, thomas_elisabeth_widmer, yuki_tanaka.

### Scoring: `scripts/score.py`

Compares `submitted_return.json` against `ground_truth.json` for a persona. Can score individual personas or batch all.

### Frontend: `EnvDemoV1/`

React + TypeScript + Vite app — the ZHprivateTax simulator UI. Must expose `window.TaxPortal` with `scanPage()`, `fillField()`, `clickElement()`, `submitForm()` for the PlaywrightBridge to use.

### Notebooks: `mcp_server/notebook/`

Jupyter notebooks for the teaching exercise. `project3_agentic_tax_filler_participants.ipynb` is the student-facing version.

## Key Design Decisions

- The 9 MCP tools are discovery-based: the agent must `scan_page()` first to learn available field locators before calling `fill_field()`.
- `list_documents()` hides scoring/output files (ground_truth.json, submitted_return.json, etc.) from the agent.
- On successful `submit_form()`, submission JSON is auto-saved to `{persona_folder}/submitted_return.json`.
- Interaction logs are saved to `{persona_folder}/interaction_log.json` after `run_agent()` completes.