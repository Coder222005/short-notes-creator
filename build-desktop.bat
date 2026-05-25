@echo off
echo ==========================================================
echo    StudyNotebook Desktop Packager (.dmg / .exe / AppImage)
echo ==========================================================
echo.

echo Step 1: Installing packaging tools in root...
call npm install

echo Step 2: Compiling frontend static files...
call npm run build

echo Step 3: Building installer bundle...
call npm run dist:win

echo.
echo ==========================================================
echo  Done! Packaged assets are located in: .\dist-desktop\
echo ==========================================================
pause
