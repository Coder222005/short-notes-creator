@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo   StudyNotebook - Windows Stop Script
echo ====================================================
echo.

echo Stopping all Node.js processes related to StudyNotebook...

:: Kill processes on known ports
for %%P in (3000 3001 3002 3003 3004 3005 3006 5174) do (
    for /f "tokens=5" %%A in ('netstat -aon 2^>nul ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        echo   Killing process on port %%P - PID: %%A
        taskkill /f /pid %%A >nul 2>nul
    )
)

echo.
echo [OK] StudyNotebook stopped successfully.
pause
