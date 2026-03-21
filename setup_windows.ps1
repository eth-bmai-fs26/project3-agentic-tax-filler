# ──────────────────────────────────────────────────────────────
#  AgenTekki — One-Click Setup for Windows
#  Usage:  powershell -ExecutionPolicy Bypass -File setup_windows.ps1
# ──────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

# ── Helpers ──────────────────────────────────────────────────

function Write-Ok($msg)   { Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "  ✔ $msg (already installed)" -ForegroundColor DarkGray }
function Write-Info($msg)  { Write-Host "  → $msg" -ForegroundColor Cyan }
function Write-Warn($msg)  { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "  ✖ $msg" -ForegroundColor Red; exit 1 }

function Test-CommandExists($cmd) {
    $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Test-WingetAvailable {
    Test-CommandExists "winget"
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor White
Write-Host "║          AgenTekki — Windows Setup                      ║" -ForegroundColor White
Write-Host "║          Agentic Swiss Tax Filler                       ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

# ──────────────────────────────────────────────────────────────
#  Step 1: System Dependencies
# ──────────────────────────────────────────────────────────────
Write-Host "[1/6] Checking system dependencies..." -ForegroundColor White

$hasWinget = Test-WingetAvailable

# Python 3
if (Test-CommandExists "python") {
    $pyVer = & python --version 2>&1
    Write-Skip "Python ($pyVer)"
} elseif (Test-CommandExists "python3") {
    $pyVer = & python3 --version 2>&1
    Write-Skip "Python ($pyVer)"
} else {
    if ($hasWinget) {
        Write-Info "Installing Python 3.13 via winget..."
        winget install Python.Python.3.13 --accept-source-agreements --accept-package-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Ok "Python installed"
    } else {
        Write-Fail "Python 3 is not installed. Please install it from https://www.python.org/downloads/ and re-run this script."
    }
}

# Determine python command
$pythonCmd = if (Test-CommandExists "python3") { "python3" } else { "python" }

# Node.js
if (Test-CommandExists "node") {
    $nodeVer = & node --version 2>&1
    Write-Skip "Node.js ($nodeVer)"
} else {
    if ($hasWinget) {
        Write-Info "Installing Node.js via winget..."
        winget install OpenJS.NodeJS --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Ok "Node.js installed"
    } else {
        Write-Fail "Node.js is not installed. Please install it from https://nodejs.org/ and re-run this script."
    }
}

# pnpm
if (Test-CommandExists "pnpm") {
    Write-Skip "pnpm"
} else {
    Write-Info "Installing pnpm..."
    npm install -g pnpm
    Write-Ok "pnpm installed"
}

Write-Host ""

# ──────────────────────────────────────────────────────────────
#  Step 2: Python Virtual Environment & Backend Dependencies
# ──────────────────────────────────────────────────────────────
Write-Host "[2/6] Setting up Python backend..." -ForegroundColor White

$venvPath = Join-Path $RepoRoot ".venv"
$venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"

if (Test-Path $venvPath) {
    Write-Skip "Virtual environment (.venv)"
} else {
    Write-Info "Creating virtual environment..."
    & $pythonCmd -m venv $venvPath
    Write-Ok "Virtual environment created"
}

# Activate venv
& $venvActivate

# Check if requirements need installing (compare hash)
$reqFile = Join-Path $RepoRoot "backend\requirements.txt"
$reqHashFile = Join-Path $venvPath ".req_hash"
$reqHash = (Get-FileHash $reqFile -Algorithm MD5).Hash

$needsInstall = $true
if (Test-Path $reqHashFile) {
    $storedHash = Get-Content $reqHashFile -Raw
    if ($storedHash.Trim() -eq $reqHash) {
        $needsInstall = $false
        Write-Skip "Backend dependencies"
    }
}

if ($needsInstall) {
    Write-Info "Installing backend dependencies..."
    pip install -q -r $reqFile
    Set-Content -Path $reqHashFile -Value $reqHash
    Write-Ok "Backend dependencies installed"
}

Write-Host ""

# ──────────────────────────────────────────────────────────────
#  Step 3: Frontend Dependencies
# ──────────────────────────────────────────────────────────────
Write-Host "[3/6] Setting up React frontend..." -ForegroundColor White

$frontendDir = Join-Path $RepoRoot "frontend"
Write-Info "Installing frontend dependencies..."
Push-Location $frontendDir
pnpm install --silent 2>$null
if ($LASTEXITCODE -ne 0) { pnpm install }
Pop-Location
Write-Ok "Frontend dependencies ready"

Write-Host ""

# ──────────────────────────────────────────────────────────────
#  Step 4: Ollama
# ──────────────────────────────────────────────────────────────
Write-Host "[4/6] Checking Ollama..." -ForegroundColor White

if (Test-CommandExists "ollama") {
    Write-Skip "Ollama"
} else {
    if ($hasWinget) {
        Write-Info "Installing Ollama via winget..."
        winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Ok "Ollama installed"
    } else {
        Write-Fail "Ollama is not installed. Please install it from https://ollama.com/download and re-run this script."
    }
}

Write-Host ""

# ──────────────────────────────────────────────────────────────
#  Step 5: LLM Model Selection
# ──────────────────────────────────────────────────────────────
Write-Host "[5/6] Choose your LLM model" -ForegroundColor White
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor White
Write-Host "║                   Choose Your LLM Model                     ║" -ForegroundColor White
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor White
Write-Host "║                                                              ║" -ForegroundColor White
Write-Host "║  " -NoNewline -ForegroundColor White; Write-Host "[1]" -NoNewline -ForegroundColor Cyan; Write-Host " gemma3:1b    " -NoNewline; Write-Host "(~1 GB)" -NoNewline -ForegroundColor DarkGray; Write-Host "   ⚡ Fastest — low accuracy        ║" -ForegroundColor White
Write-Host "║      " -NoNewline -ForegroundColor White; Write-Host "Good for quick testing, weak at tax form details" -NoNewline -ForegroundColor DarkGray; Write-Host "   ║" -ForegroundColor White
Write-Host "║                                                              ║" -ForegroundColor White
Write-Host "║  " -NoNewline -ForegroundColor White; Write-Host "[2]" -NoNewline -ForegroundColor Cyan; Write-Host " gemma3:4b    " -NoNewline; Write-Host "(~3 GB)" -NoNewline -ForegroundColor DarkGray; Write-Host "   ⚖️  Balanced — decent accuracy    ║" -ForegroundColor White
Write-Host "║      " -NoNewline -ForegroundColor White; Write-Host "Good trade-off between speed and quality" -NoNewline -ForegroundColor DarkGray; Write-Host "           ║" -ForegroundColor White
Write-Host "║                                                              ║" -ForegroundColor White
Write-Host "║  " -NoNewline -ForegroundColor White; Write-Host "[3]" -NoNewline -ForegroundColor Green; Write-Host " gemma3:12b   " -NoNewline; Write-Host "(~8 GB)" -NoNewline -ForegroundColor DarkGray; Write-Host "   🎯 Recommended — best accuracy   ║" -ForegroundColor White
Write-Host "║      " -NoNewline -ForegroundColor White; Write-Host "Most accurate for Swiss tax forms (needs 8GB+ RAM)" -NoNewline -ForegroundColor DarkGray; Write-Host " ║" -ForegroundColor White
Write-Host "║                                                              ║" -ForegroundColor White
Write-Host "║  " -NoNewline -ForegroundColor White; Write-Host "[4]" -NoNewline -ForegroundColor Cyan; Write-Host " llama3.1:8b  " -NoNewline; Write-Host "(~5 GB)" -NoNewline -ForegroundColor DarkGray; Write-Host "   🔄 Alternative — solid overall   ║" -ForegroundColor White
Write-Host "║      " -NoNewline -ForegroundColor White; Write-Host "Good general-purpose model, Meta's Llama family" -NoNewline -ForegroundColor DarkGray; Write-Host "    ║" -ForegroundColor White
Write-Host "║                                                              ║" -ForegroundColor White
Write-Host "║  " -NoNewline -ForegroundColor White; Write-Host "Note: Larger models need more RAM and are slower, but" -NoNewline -ForegroundColor DarkGray; Write-Host "   ║" -ForegroundColor White
Write-Host "║  " -NoNewline -ForegroundColor White; Write-Host "produce significantly more accurate tax form results." -NoNewline -ForegroundColor DarkGray; Write-Host "  ║" -ForegroundColor White
Write-Host "║                                                              ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

$models = @("gemma3:1b", "gemma3:4b", "gemma3:12b", "llama3.1:8b")

do {
    $choice = Read-Host "  Enter choice [1-4, default=3]"
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "3" }
} while ($choice -notmatch '^[1-4]$')

$selectedModel = $models[[int]$choice - 1]
Write-Host ""
Write-Info "Selected: $selectedModel"

# Check if model is already downloaded
$ollamaList = & ollama list 2>&1 | Out-String
if ($ollamaList -match [regex]::Escape($selectedModel)) {
    Write-Skip "Model $selectedModel already downloaded"
} else {
    Write-Info "Downloading $selectedModel (this may take a few minutes)..."
    Write-Host ""

    # Start ollama serve temporarily if not running
    $ollamaWasRunning = $true
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    } catch {
        $ollamaWasRunning = $false
        $ollamaTemp = Start-Process ollama -ArgumentList "serve" -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 3
    }

    & ollama pull $selectedModel

    Write-Ok "Model $selectedModel downloaded"

    # Stop temporary ollama serve
    if (-not $ollamaWasRunning -and $null -ne $ollamaTemp) {
        Stop-Process -Id $ollamaTemp.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

Write-Host ""

# ──────────────────────────────────────────────────────────────
#  Step 6: Launch Everything
# ──────────────────────────────────────────────────────────────
Write-Host "[6/6] Launching AgenTekki..." -ForegroundColor White

# Set environment variables
$env:LLM_PROVIDER = "ollama"
$env:LLM_MODEL = $selectedModel

# Start Ollama serve if not already running
$ollamaProc = $null
try {
    $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Skip "Ollama server already running"
} catch {
    Write-Info "Starting Ollama server..."
    $ollamaProc = Start-Process ollama -ArgumentList "serve" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Ok "Ollama server started"
}

# Activate venv
& $venvActivate

# Start Flask backend
Write-Info "Starting Flask backend..."
$backendProc = Start-Process $pythonCmd -ArgumentList "-m backend.app" -WorkingDirectory $RepoRoot -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 1

# Start React frontend
Write-Info "Starting React frontend..."
$frontendProc = Start-Process pnpm -ArgumentList "dev" -WorkingDirectory $frontendDir -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ AgenTekki is running!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "   Frontend:  " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Backend:   " -NoNewline; Write-Host "http://localhost:5001" -ForegroundColor Cyan
Write-Host "   Ollama:    " -NoNewline; Write-Host "http://localhost:11434" -ForegroundColor Cyan
Write-Host "   Model:     $selectedModel"
Write-Host ""
Write-Host "   Open " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan -NoNewline; Write-Host " in your browser to start."
Write-Host "   Press " -NoNewline; Write-Host "Ctrl+C" -ForegroundColor White -NoNewline; Write-Host " to stop all services."
Write-Host ""

# Wait and cleanup on exit
try {
    Write-Host "  (Waiting... press Ctrl+C to stop)" -ForegroundColor DarkGray
    while ($true) {
        Start-Sleep -Seconds 1
        # Check if any process has exited unexpectedly
        if ($backendProc.HasExited -and $frontendProc.HasExited) {
            Write-Warn "Both backend and frontend have stopped."
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "Shutting down..." -ForegroundColor Yellow

    if ($null -ne $frontendProc -and -not $frontendProc.HasExited) {
        Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $backendProc -and -not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $ollamaProc -and -not $ollamaProc.HasExited) {
        Stop-Process -Id $ollamaProc.Id -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Stopped all services." -ForegroundColor Green
}
