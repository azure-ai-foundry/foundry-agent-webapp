#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Starts native local development (backend + frontend with hot reload)

.DESCRIPTION
    This script:
    - Checks prerequisites (Node.js, .NET, npm packages)
    - Starts ASP.NET Core backend on port 8080 (watch mode)
    - Starts React frontend on port 5173 (HMR)
    - Opens browser to http://localhost:5173
    
    Prerequisites:
    - .NET 9 SDK
    - Node.js 18+
    - frontend/.env.local must exist (created by azd up)

.EXAMPLE
    .\deployment\scripts\start-local-dev.ps1
#>

param(
    [switch]$SkipBrowser,  # Skip opening browser automatically
    [switch]$NonInteractive  # Run without strict health checks (for azd hooks)
)

# Use Continue instead of Stop to be more resilient in automation scenarios
$ErrorActionPreference = "Continue"

# --- Helper Functions ---

function Write-Status {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "`n=== $Message ===" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# --- Prerequisites Check ---

Write-Status "Checking Prerequisites"

# Check .NET SDK
if (-not (Test-Command "dotnet")) {
    Write-Error ".NET SDK not found. Install from: https://dotnet.microsoft.com/download"
    exit 1
}
$dotnetVersion = dotnet --version
Write-Success ".NET SDK: $dotnetVersion"

# Check Node.js
if (-not (Test-Command "node")) {
    Write-Error "Node.js not found. Install from: https://nodejs.org/"
    exit 1
}
$nodeVersion = node --version
Write-Success "Node.js: $nodeVersion"

# Check npm
if (-not (Test-Command "npm")) {
    Write-Error "npm not found. Install Node.js from: https://nodejs.org/"
    exit 1
}
$npmVersion = npm --version
Write-Success "npm: $npmVersion"

# Check frontend dependencies
Write-Status "Checking Frontend Dependencies"
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$frontendPath = Join-Path $projectRoot "frontend"
$nodeModulesPath = Join-Path $frontendPath "node_modules"

if (-not (Test-Path $nodeModulesPath)) {
    Write-Warning "Frontend dependencies not installed. Installing..."
    Write-Host "This may take a few minutes on first run..." -ForegroundColor Gray
    Push-Location $frontendPath
    try {
        npm install --legacy-peer-deps 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Error "npm install failed with exit code $LASTEXITCODE"
            Write-Host "`nTry running manually:" -ForegroundColor Yellow
            Write-Host "  cd frontend" -ForegroundColor White
            Write-Host "  npm install --legacy-peer-deps" -ForegroundColor White
            Pop-Location
            exit 1
        }
        Write-Success "Frontend dependencies installed"
    }
    catch {
        Write-Error "Failed to install frontend dependencies: $_"
        Pop-Location
        exit 1
    }
    finally {
        Pop-Location
    }
} else {
    # Verify node_modules is valid by checking if a key package exists
    $msalPackage = Join-Path $nodeModulesPath "@azure" "msal-react"
    if (-not (Test-Path $msalPackage)) {
        Write-Warning "node_modules appears incomplete or corrupted. Reinstalling..."
        Write-Host "This may take a few minutes..." -ForegroundColor Gray
        Push-Location $frontendPath
        try {
            Remove-Item -Path $nodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
            npm install --legacy-peer-deps 2>&1 | Out-Host
            if ($LASTEXITCODE -ne 0) {
                Write-Error "npm install failed with exit code $LASTEXITCODE"
                Write-Host "`nTry running manually:" -ForegroundColor Yellow
                Write-Host "  cd frontend" -ForegroundColor White
                Write-Host "  rm -r -fo node_modules" -ForegroundColor White
                Write-Host "  npm install --legacy-peer-deps" -ForegroundColor White
                Pop-Location
                exit 1
            }
            Write-Success "Frontend dependencies installed"
        }
        catch {
            Write-Error "Failed to reinstall frontend dependencies: $_"
            Pop-Location
            exit 1
        }
        finally {
            Pop-Location
        }
    } else {
        Write-Success "Frontend dependencies found"
    }
}

# Validate configuration using dedicated validator
Write-Status "Validating Configuration"
$validatorScript = Join-Path $PSScriptRoot "validate-config.ps1"
if (Test-Path $validatorScript) {
    & $validatorScript
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nConfiguration validation failed. Cannot start local development." -ForegroundColor Red
        exit 1
    }
} else {
    # Fallback: Basic check if validator script doesn't exist
    $envLocalPath = Join-Path $projectRoot "frontend" ".env.local"
    if (-not (Test-Path $envLocalPath)) {
        Write-Error "frontend/.env.local not found."
        Write-Host "`nThis file is created by 'azd up'. Please run:" -ForegroundColor Yellow
        Write-Host "  azd up" -ForegroundColor White
        exit 1
    }
    Write-Success "Configuration file found: frontend/.env.local"
}

# --- Port Cleanup ---

function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    
    # Find process using the port
    $connections = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
    
    if ($connections) {
        foreach ($connection in $connections) {
            # Extract PID from netstat output (last column)
            if ($connection -match '\s+(\d+)\s*$') {
                $processId = $Matches[1]
                try {
                    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "  Found $ServiceName process on port $Port (PID: $processId, Name: $($process.Name))" -ForegroundColor Yellow
                        Write-Host "  Stopping process..." -ForegroundColor Gray
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Milliseconds 500
                        Write-Success "Stopped process $processId"
                    }
                }
                catch {
                    Write-Warning "Could not stop process $processId : $_"
                }
            }
        }
    }
}

Write-Status "Checking for Port Conflicts"

# Check and clean up port 8080 (backend)
Stop-ProcessOnPort -Port 8080 -ServiceName "backend"

# Check and clean up port 5173 (frontend)
Stop-ProcessOnPort -Port 5173 -ServiceName "frontend"

# Verify ports are free
Start-Sleep -Seconds 1
$port8080Free = -not (netstat -ano | Select-String ":8080\s" | Select-String "LISTENING")
$port5173Free = -not (netstat -ano | Select-String ":5173\s" | Select-String "LISTENING")

if ($port8080Free -and $port5173Free) {
    Write-Success "Ports 8080 and 5173 are available"
} else {
    if (-not $port8080Free) { Write-Warning "Port 8080 may still be in use" }
    if (-not $port5173Free) { Write-Warning "Port 5173 may still be in use" }
}

# --- Start Services ---

Write-Status "Starting Local Development" "Green"

# Get project root
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

# Start both servers in parallel
Write-Host "`nStarting backend (ASP.NET Core on port 8080)..." -ForegroundColor Cyan
$backendPath = Join-Path $projectRoot "backend" "WebApp.Api"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host '=== Backend (ASP.NET Core) ===' -ForegroundColor Green; dotnet watch run --no-hot-reload"

Write-Host "Starting frontend (React with HMR on port 5173)..." -ForegroundColor Cyan
$frontendPath = Join-Path $projectRoot "frontend"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host '=== Frontend (React + Vite) ===' -ForegroundColor Blue; npm run dev"

# Give processes a moment to start, then open browser
Write-Host "`nBoth servers starting in parallel..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Open browser
if (-not $SkipBrowser) {
    Write-Host "Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:5173"
}

# --- Success Message ---

Write-Host "`n" -NoNewline
Write-Host "=====================================" -ForegroundColor Green
Write-Host " Local Development Started!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "`nApplication:  " -NoNewline -ForegroundColor Cyan
Write-Host "http://localhost:5173" -ForegroundColor White
Write-Host "Backend API:  " -NoNewline -ForegroundColor Cyan
Write-Host "http://localhost:8080/api/*" -ForegroundColor White
Write-Host "Backend Root: " -NoNewline -ForegroundColor Cyan
Write-Host "http://localhost:8080/" -ForegroundColor White

Write-Host "`nAuthenticated APIs require MSAL-issued tokens (scope: Chat.ReadWrite)." -ForegroundColor Gray

Write-Host "`nFeatures:" -ForegroundColor Yellow
Write-Host "  • React Hot Module Replacement (instant updates)" -ForegroundColor Gray
Write-Host "  • .NET watch mode (auto-recompile)" -ForegroundColor Gray
Write-Host "  • MSAL authentication with your Entra app" -ForegroundColor Gray
Write-Host "  • AI Agent Service integration" -ForegroundColor Gray

Write-Host "`nTo deploy to Azure:" -ForegroundColor Yellow
Write-Host "  azd deploy" -ForegroundColor White

Write-Host "`nTo stop:" -ForegroundColor Yellow
Write-Host "  Close the backend and frontend terminal windows" -ForegroundColor White
Write-Host "  Or press Ctrl+C in each terminal" -ForegroundColor White

Write-Host "`n"
