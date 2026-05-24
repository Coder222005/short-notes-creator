@echo off
echo ====================================================
echo   📚 StudyNotebook - Windows 1-Click Startup Script
echo ====================================================
echo.

:: Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js (version 20+) from https://nodejs.org/
    pause
    exit /b 1
)

:: Step 1: Install dependencies if missing
echo [1/4] Checking and installing dependencies...

if not exist "node_modules\" (
    echo Installing root dependencies...
    call npm install
)

if not exist "backend\node_modules\" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

if not exist "frontend\node_modules\" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

if not exist "freellmapi\node_modules\" (
    echo Installing FreeLLMAPI dependencies...
    cd freellmapi
    call npm install
    cd ..
)

:: Step 2: Setup FreeLLMAPI environmental configs
echo [2/4] Setting up environmental configurations...
if not exist "freellmapi\.env" (
    echo Copying .env template...
    copy freellmapi\.env.example freellmapi\.env >nul
    
    :: Generate a random key for encryption
    echo ENCRYPTION_KEY=39f8d9b1c7a8e5f20384157dbe0293847ac184e92a8c38a2e1d749aef381b8dc >> freellmapi\.env
)

:: Step 3: Build React Frontend static dist
echo [3/4] Building frontend assets...
if not exist "frontend\dist\" (
    echo Compiling React production bundle...
    call npm run build
)

:: Step 4: Build FreeLLMAPI proxy server
echo [4/4] Building FreeLLMAPI proxy server...
if not exist "freellmapi\server\dist\" (
    echo Compiling FreeLLMAPI TypeScript files...
    cd freellmapi
    call npm run build:server
    cd ..
)

:: Step 5: Boot both services
echo.
echo ====================================================
echo   🚀 Booting StudyNotebook Services...
echo ====================================================
echo.
echo * Gateway Client/Backend running on: http://localhost:3000
echo * Proxy backend running on: http://localhost:3001
echo.

:: Start FreeLLMAPI in a background command process
echo Starting FreeLLMAPI Proxy in background...
start /B cmd /c "cd freellmapi && set PORT=3001 && npm run start -w server > ..\freellmapi.log 2>&1"

:: Wait for proxy server to bind to port
timeout /t 3 /nobreak >nul

:: Start Gateway Server (Node server.js on port 3000)
echo Starting StudyNotebook Gateway...
cd backend
call npm start
cd ..
