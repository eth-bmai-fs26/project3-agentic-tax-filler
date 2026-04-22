# ──────────────────────────────────────────────────────────────
#  AgenTekki — One-Click Setup for Windows
#  Usage:  powershell -ExecutionPolicy Bypass -File setup_windows.ps1
# ──────────────────────────────────────────────────────────────

param(
    [string]$FrontendPath = ".\frontend",
    [string]$BackendPath  = ".\backend"
)

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

$pythonInstalled = $false
$pythonCmd = $null

# Check for 'python' first
try {
    $version = python --version 2>&1
    if ($version -match "Python \d+\.\d+") {
        $pythonInstalled = $true
        $pythonCmd = "python"
    }
} catch {}

# If not found, check for 'python3'
if (-not $pythonInstalled) {
    try {
        $version = python3 --version 2>&1
        if ($version -match "Python \d+\.\d+") {
            $pythonInstalled = $true
            $pythonCmd = "python3"
        }
    } catch {}
}

if ($pythonInstalled) {

    Write-Skip "Python is already installed ($pythonCmd): $version" -ForegroundColor Green
} else {
    Write-Info "Python not found. Installing via winget..." -ForegroundColor Yellow

    winget install --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent

    # Refresh PATH for the current session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    # Determine which command works after install
    try {
        $version = python --version 2>&1
        if ($version -match "Python \d+\.\d+") {
            $pythonCmd = "python"
        }
    } catch {}

    if (-not $pythonCmd) {
        try {
            $version = python3 --version 2>&1
            if ($version -match "Python \d+\.\d+") {
                $pythonCmd = "python3"
            }
        } catch {}
    }

    if ($pythonCmd) {
        Write-Ok "Python installed successfully ($pythonCmd): $version"
    } else {
        Write-Ward "Python was installed but you may need to restart your terminal for PATH changes to take effect."
    }
}

# Node.js
if (Test-CommandExists "node") {
    $nodeVer = & node --version 2>&1
    Write-Skip "Node.js ($nodeVer)"
} else {
    if ($hasWinget) {
        Write-Info "Installing Node.js via winget..."
        winget install OpenJS.NodeJS --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
	npm install -g pnpm
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Ok "Node.js installed"
    } else {
        Write-Fail "Node.js is not installed. Please install it from https://nodejs.org/ and re-run this script."
    }
}

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

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Launching React + Flask Application"   -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# --- Validate paths ---
if (-not (Test-Path $FrontendPath)) {
    Write-Host "[ERROR] Frontend path not found: $FrontendPath" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $BackendPath)) {
    Write-Host "[ERROR] Backend path not found: $BackendPath" -ForegroundColor Red
    exit 1
}

$FrontendPath = Resolve-Path $FrontendPath
$BackendPath  = Resolve-Path $BackendPath

# Create log directory
$LogDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# Track all processes for cleanup
$processes = @()

# -------------------------------------------------------
# 2. Flask Backend
# -------------------------------------------------------
Write-Info "[Backend] Starting Flask server..." 

& $venvActivate
$backendProc = Start-Process python -ArgumentList "-m", "backend.app" `
    -WorkingDirectory (Split-Path $BackendPath -Parent) `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput "$LogDir\backend.log" `
    -RedirectStandardError  "$LogDir\backend-error.log"
$processes += $backendProc

# Wait until Flask is ready
$timeout = 30; $elapsed = 0
while ($elapsed -lt $timeout) {
    try {
        Invoke-WebRequest -Uri "http://localhost:5001/ping" -UseBasicParsing | Out-Null
        Write-Ok "[Backend]  Ready on http://localhost:5001" -ForegroundColor Yellow
        break
    } catch {
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
}
if ($elapsed -ge $timeout) {
    Write-Warn "[Backend]  WARNING: Did not respond within ${timeout}s"
    Write-Warn "[Backend]  Check logs: $LogDir\backend-error.log"
}

# -------------------------------------------------------
# 3. React Frontend
# -------------------------------------------------------
Write-Info "[Frontend] Starting React dev server..." 
$frontendProc = Start-Process cmd -ArgumentList "/c", "pnpm run dev" `
    -WorkingDirectory $FrontendPath `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput "$LogDir\frontend.log" `
    -RedirectStandardError  "$LogDir\frontend-error.log"
$processes += $frontendProc

# Wait until React is ready (longer timeout — React builds are slow)
$timeout = 60; $elapsed = 0
while ($elapsed -lt $timeout) {
    try {
        Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 | Out-Null
        Write-Ok "[Frontend] Ready on http://localhost:5173" 
        break
    } catch {
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
}
if ($elapsed -ge $timeout) {
    Write-Warn "[Frontend] WARNING: Did not respond within ${timeout}s"
    Write-Warn "[Frontend] Check logs: $LogDir\frontend-error.log"
}

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  All servers launched"                            -ForegroundColor Cyan
Write-Host "  Ollama   -> http://localhost:11434"              -ForegroundColor Magenta
Write-Host "  Flask    -> http://localhost:5001"               -ForegroundColor Yellow
Write-Host "  React    -> http://localhost:5173"               -ForegroundColor Green
Write-Host ""
Write-Host "  Logs in: $LogDir"                                -ForegroundColor DarkGray
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Enter to stop all servers..." -ForegroundColor DarkGray

# Wait for user input to shut down
Read-Host | Out-Null
 
# -------------------------------------------------------
# Cleanup
# -------------------------------------------------------
Write-Host ""
Write-Host "Shutting down servers..." -ForegroundColor Cyan

deactivate
 
foreach ($proc in $processes) {
    if ($proc -and -not $proc.HasExited) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped PID $($proc.Id) ($($proc.ProcessName))" -ForegroundColor DarkGray
        } catch {
            Write-Host "  Could not stop PID $($proc.Id)" -ForegroundColor Red
        }
    }
}
 
# Also kill any child node processes spawned by npm start
if ($frontendProc) {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.StartTime -ge $frontendProc.StartTime
    } | Stop-Process -Force -ErrorAction SilentlyContinue
}
 
Write-Host ""
Write-Host "All servers stopped. Goodbye!" -ForegroundColor Cyan
