#!/usr/bin/env bash
# Start both Flask backend and React frontend

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check API key requirements based on provider
LLM_PROVIDER="${LLM_PROVIDER:-gemini}"
if [ "$LLM_PROVIDER" = "ollama" ]; then
  OLLAMA_HOST="${OLLAMA_BASE_URL:-http://localhost:11434}"
  echo "🦙 Using Ollama at $OLLAMA_HOST (model: ${LLM_MODEL:-gemma3:12b})"
  if ! curl -sf "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
    echo "⚠️  Ollama does not appear to be running. Start it with: ollama serve"
    exit 1
  fi
elif [ "$LLM_PROVIDER" = "gemini" ] && [ -z "$GEMINI_API_KEY" ]; then
  echo "⚠️  GEMINI_API_KEY is not set. Export it before running:"
  echo "   export GEMINI_API_KEY=AIza..."
  exit 1
elif [ "$LLM_PROVIDER" = "openai" ] && [ -z "$OPENAI_API_KEY" ]; then
  echo "⚠️  OPENAI_API_KEY is not set."
  exit 1
elif [ "$LLM_PROVIDER" = "anthropic" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  ANTHROPIC_API_KEY is not set."
  exit 1
fi

# Activate virtual environment if present
if [ -f "$REPO_ROOT/.venv/bin/activate" ]; then
  source "$REPO_ROOT/.venv/bin/activate"
fi

# Start Flask backend
echo "🔧 Starting Flask backend on http://localhost:5001 ..."
cd "$REPO_ROOT"
python3 -m backend.app &
BACKEND_PID=$!

sleep 1

echo "⚡ Starting React frontend on http://localhost:5173 ..."
cd "$REPO_ROOT/frontend"
export PATH="/opt/homebrew/bin:$PATH"
pnpm dev &
FRONTEND_PID=$!

echo ""
echo "✅ Running:"
echo "   Backend:  http://localhost:5001"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT
wait
