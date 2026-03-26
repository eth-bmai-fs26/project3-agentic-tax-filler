#!/usr/bin/env bash
set -e

# ──────────────────────────────────────────────────────────────
#  AgenTekki — One-Click Setup for macOS
#  Usage:  bash setup_mac.sh
# ──────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✔${RESET} $1"; }
skip() { echo -e "  ${DIM}✔ $1 (already installed)${RESET}"; }
info() { echo -e "  ${CYAN}→${RESET} $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail() { echo -e "  ${RED}✖${RESET} $1"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║          AgenTekki — macOS Setup                        ║${RESET}"
echo -e "${BOLD}║          Agentic Swiss Tax Filler                       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ──────────────────────────────────────────────────────────────
#  Step 1: System Dependencies
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}[1/6] Checking system dependencies...${RESET}"

# Homebrew
if command -v brew &>/dev/null; then
  skip "Homebrew"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  ok "Homebrew installed"
fi

# Python 3.10+ (required for PEP 604 type hints: X | None)
NEED_PYTHON=false
if command -v python3 &>/dev/null; then
  PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
  PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
  PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
  if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ]; then
    skip "Python ($PY_VERSION)"
  else
    warn "Python $PY_VERSION found, but 3.10+ is required"
    NEED_PYTHON=true
  fi
else
  NEED_PYTHON=true
fi

if [ "$NEED_PYTHON" = true ]; then
  info "Installing Python 3.13 via Homebrew..."
  brew install python@3.13
  # Ensure the Homebrew Python is used instead of the system one
  if [ -f /opt/homebrew/bin/python3 ]; then
    export PATH="/opt/homebrew/bin:$PATH"
  elif [ -f /usr/local/bin/python3 ]; then
    export PATH="/usr/local/bin:$PATH"
  fi
  PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
  ok "Python $PY_VERSION installed"
fi

# Node.js
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version 2>&1)
  skip "Node.js ($NODE_VERSION)"
else
  info "Installing Node.js via Homebrew..."
  brew install node
  ok "Node.js installed"
fi

# pnpm
if command -v pnpm &>/dev/null; then
  skip "pnpm"
else
  info "Installing pnpm..."
  npm install -g pnpm
  ok "pnpm installed"
fi

echo ""

# ──────────────────────────────────────────────────────────────
#  Step 2: Python Virtual Environment & Backend Dependencies
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}[2/6] Setting up Python backend...${RESET}"

if [ -d "$REPO_ROOT/.venv" ]; then
  skip "Virtual environment (.venv)"
else
  info "Creating virtual environment..."
  python3 -m venv "$REPO_ROOT/.venv"
  ok "Virtual environment created"
fi

source "$REPO_ROOT/.venv/bin/activate"

# Check if requirements need installing (compare hash)
REQ_HASH_FILE="$REPO_ROOT/.venv/.req_hash"
REQ_HASH=$(md5 -q "$REPO_ROOT/backend/requirements.txt" 2>/dev/null || md5sum "$REPO_ROOT/backend/requirements.txt" | awk '{print $1}')

if [ -f "$REQ_HASH_FILE" ] && [ "$(cat "$REQ_HASH_FILE")" = "$REQ_HASH" ]; then
  skip "Backend dependencies"
else
  info "Installing backend dependencies..."
  pip install -q -r "$REPO_ROOT/backend/requirements.txt"
  echo "$REQ_HASH" > "$REQ_HASH_FILE"
  ok "Backend dependencies installed"
fi

echo ""

# ──────────────────────────────────────────────────────────────
#  Step 3: Frontend Dependencies
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}[3/6] Setting up React frontend...${RESET}"

info "Installing frontend dependencies..."
cd "$REPO_ROOT/frontend"
pnpm install --silent 2>/dev/null || pnpm install
ok "Frontend dependencies ready"
cd "$REPO_ROOT"

echo ""

# ──────────────────────────────────────────────────────────────
#  Step 4: Ollama
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}[4/6] Checking Ollama...${RESET}"

if command -v ollama &>/dev/null; then
  skip "Ollama"
else
  info "Installing Ollama via Homebrew..."
  brew install ollama
  ok "Ollama installed"
fi

echo ""

# ──────────────────────────────────────────────────────────────
#  Step 5: LLM Model Selection
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}[5/6] Choose your LLM model${RESET}"
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║                   Choose Your LLM Model                     ║${RESET}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}║${RESET}                                                            ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}  ${CYAN}[1]${RESET} gemma3:1b    ${DIM}(~1 GB)${RESET}   ⚡ Fastest — low accuracy        ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}      ${DIM}Good for quick testing, weak at tax form details${RESET}   ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}                                                            ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}  ${CYAN}[2]${RESET} gemma3:4b    ${DIM}(~3 GB)${RESET}   ⚖️  Balanced — decent accuracy    ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}      ${DIM}Good trade-off between speed and quality${RESET}           ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}                                                            ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}  ${GREEN}[3]${RESET} gemma3:12b   ${DIM}(~8 GB)${RESET}   🎯 Recommended — best accuracy   ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}      ${DIM}Most accurate for Swiss tax forms (needs 8GB+ RAM)${RESET} ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}                                                            ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}  ${CYAN}[4]${RESET} llama3.1:8b  ${DIM}(~5 GB)${RESET}   🔄 Alternative — solid overall   ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}      ${DIM}Good general-purpose model, Meta's Llama family${RESET}    ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}                                                            ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}  ${DIM}Note: Larger models need more RAM and are slower, but${RESET}   ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}  ${DIM}produce significantly more accurate tax form results.${RESET}  ${BOLD}║${RESET}"
echo -e "${BOLD}║${RESET}                                                            ${BOLD}║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""

MODELS=("gemma3:1b" "gemma3:4b" "gemma3:12b" "llama3.1:8b")

while true; do
  echo -ne "  Enter choice ${DIM}[1-4, default=3]${RESET}: "
  read -r choice
  choice="${choice:-3}"
  if [[ "$choice" =~ ^[1-4]$ ]]; then
    break
  fi
  warn "Please enter a number between 1 and 4."
done

SELECTED_MODEL="${MODELS[$((choice - 1))]}"
echo ""
info "Selected: ${BOLD}$SELECTED_MODEL${RESET}"

# Check if model is already downloaded
if ollama list 2>/dev/null | grep -q "$SELECTED_MODEL"; then
  skip "Model $SELECTED_MODEL already downloaded"
else
  info "Downloading $SELECTED_MODEL (this may take a few minutes)..."
  echo ""

  # Start ollama serve temporarily if not running
  OLLAMA_WAS_RUNNING=true
  if ! curl -sf http://localhost:11434/api/tags &>/dev/null; then
    OLLAMA_WAS_RUNNING=false
    ollama serve &>/dev/null &
    OLLAMA_TEMP_PID=$!
    sleep 2
  fi

  ollama pull "$SELECTED_MODEL"
  ok "Model $SELECTED_MODEL downloaded"

  # Stop temporary ollama serve if we started it
  if [ "$OLLAMA_WAS_RUNNING" = false ] && [ -n "$OLLAMA_TEMP_PID" ]; then
    kill "$OLLAMA_TEMP_PID" 2>/dev/null || true
    wait "$OLLAMA_TEMP_PID" 2>/dev/null || true
    sleep 1
  fi
fi

echo ""

# ──────────────────────────────────────────────────────────────
#  Step 6: Launch Everything
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}[6/6] Launching AgenTekki...${RESET}"

# Export environment variables
export LLM_PROVIDER=ollama
export LLM_MODEL="$SELECTED_MODEL"

# Start Ollama serve if not already running
OLLAMA_PID=""
if curl -sf http://localhost:11434/api/tags &>/dev/null; then
  skip "Ollama server already running"
else
  info "Starting Ollama server..."
  ollama serve &>/dev/null &
  OLLAMA_PID=$!
  sleep 2
  ok "Ollama server started"
fi

# Activate venv (in case it was lost)
source "$REPO_ROOT/.venv/bin/activate"

# Start Flask backend
info "Starting Flask backend..."
cd "$REPO_ROOT"
python3 -m backend.app &
BACKEND_PID=$!
sleep 1

# Start React frontend
info "Starting React frontend..."
cd "$REPO_ROOT/frontend"
export PATH="/opt/homebrew/bin:$PATH"
pnpm dev &
FRONTEND_PID=$!
cd "$REPO_ROOT"

sleep 2

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  ✅ AgenTekki is running!${RESET}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "   ${BOLD}Frontend:${RESET}  ${CYAN}http://localhost:5173${RESET}"
echo -e "   ${BOLD}Backend:${RESET}   ${CYAN}http://localhost:5001${RESET}"
echo -e "   ${BOLD}Ollama:${RESET}    ${CYAN}http://localhost:11434${RESET}"
echo -e "   ${BOLD}Model:${RESET}     $SELECTED_MODEL"
echo ""
echo -e "   Open ${BOLD}${CYAN}http://localhost:5173${RESET} in your browser to start."
echo -e "   Press ${BOLD}Ctrl+C${RESET} to stop all services."
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${RESET}"
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null
  [ -n "$OLLAMA_PID" ]   && kill "$OLLAMA_PID"   2>/dev/null
  echo -e "${GREEN}Stopped all services.${RESET}"
  exit 0
}
trap cleanup INT TERM

wait
