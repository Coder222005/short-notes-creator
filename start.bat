@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo   StudyNotebook - Windows 1-Click Startup Script
echo ====================================================
echo.

:: ---------- 0. Resolve project root ----------
set "ROOT=%~dp0"
cd /d "%ROOT%"

:: ---------- 1. Check Node.js ----------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js version 18 or later from https://nodejs.org/
    pause
    exit /b 1
)

:: Check Node.js major version (must be >= 18)
for /f "tokens=1 delims=v." %%V in ('node -v') do set "NODE_MAJOR=%%V"
if !NODE_MAJOR! LSS 18 (
    echo [ERROR] Node.js version is too old. Found: 
    node --version
    echo Please upgrade to Node.js 18 or later from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found:
node --version

:: ---------- 2. Install dependencies ----------
echo.
echo [1/5] Checking and installing dependencies...

if not exist "node_modules\" (
    echo   Installing root dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install root dependencies.
        pause
        exit /b 1
    )
)

if not exist "backend\node_modules\" (
    echo   Installing backend dependencies...
    pushd backend
    call npm install
    popd
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install backend dependencies.
        pause
        exit /b 1
    )
)

if not exist "frontend\node_modules\" (
    echo   Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
)

if not exist "freellmapi\node_modules\" (
    echo   Installing FreeLLMAPI dependencies...
    pushd freellmapi
    call npm install
    popd
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install FreeLLMAPI dependencies.
        pause
        exit /b 1
    )
)

echo [OK] All dependencies installed.

:: ---------- 3. Setup FreeLLMAPI .env ----------
echo.
echo [2/5] Setting up environment configuration...

if not exist "freellmapi\.env" (
    echo   Copying .env template...
    copy "freellmapi\.env.example" "freellmapi\.env" >nul
    for /f "tokens=*" %%K in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "EKEY=%%K"
    echo ENCRYPTION_KEY=!EKEY!>> "freellmapi\.env"
    echo   [OK] .env configured with auto-generated encryption key.
) else (
    echo   [OK] .env already exists.
)

:: ---------- 4. Build frontend ----------
echo.
echo [3/5] Building frontend assets...
if not exist "frontend\dist\" (
    echo   Compiling React production bundle...
    call npm run build
    if !errorlevel! neq 0 (
        echo [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
) else (
    echo   [OK] Frontend already compiled.
)

:: ---------- 5. Build FreeLLMAPI ----------
echo.
echo [4/5] Building FreeLLMAPI proxy server...
if not exist "freellmapi\server\dist\" (
    echo   Compiling FreeLLMAPI TypeScript files...
    pushd freellmapi
    call npm run build:server
    popd
    if !errorlevel! neq 0 (
        echo [ERROR] FreeLLMAPI build failed.
        pause
        exit /b 1
    )
) else (
    echo   [OK] FreeLLMAPI already compiled.
)

:: ---------- 6. Find available port for FreeLLMAPI ----------
echo.
echo [5/5] Starting services...

set "PROXY_PORT=3001"
netstat -aon 2>nul | findstr ":3001 " | findstr "LISTENING" >nul 2>nul
if !errorlevel! equ 0 (
    echo   [WARN] Port 3001 is busy. Trying 3005...
    set "PROXY_PORT=3005"
    netstat -aon 2>nul | findstr ":3005 " | findstr "LISTENING" >nul 2>nul
    if !errorlevel! equ 0 (
        echo   [WARN] Port 3005 is also busy. Trying 3006...
        set "PROXY_PORT=3006"
    )
)

echo.
echo ====================================================
echo   Booting StudyNotebook Services...
echo ====================================================
echo.

:: Start FreeLLMAPI in a separate minimized window
echo   Starting FreeLLMAPI Proxy on port !PROXY_PORT!...

set "FREELLM_DIR=%ROOT%freellmapi"
set "FREELLM_LOG=%ROOT%freellmapi.log"
start "FreeLLMAPI-Proxy" /min cmd /c "cd /d "!FREELLM_DIR!" && set PORT=!PROXY_PORT! && npm run start -w server > "!FREELLM_LOG!" 2>&1"

:: Wait for proxy to initialize
echo   Waiting for FreeLLMAPI to initialize (4 seconds)...
timeout /t 4 /nobreak >nul

:: Start Gateway (server.js has built-in port fallback: 3000, 3002, 3003, 3004)
echo   Starting StudyNotebook Gateway...
echo.
echo ====================================================
echo   READY - Open your browser:
echo.
echo   Gateway:  http://localhost:3000
echo   (If 3000 is busy, check console output below)
echo.
echo   Press Ctrl+C to stop the server.
echo ====================================================
echo.

cd /d "%ROOT%backend"
node server.js
