#!/bin/bash
# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "   StudyNotebook Desktop Packager (.dmg / .exe / AppImage) "
echo "=========================================================="
echo ""

# 1. Install root Electron development tools
echo "Step 1: Installing packaging tools in root..."
npm install

# 2. Build the Vite frontend assets
echo "Step 2: Compiling frontend static files..."
npm run build

# 3. Compile the installer for the host platform
echo "Step 3: Building installer bundle..."
if [ "$(uname)" == "Darwin" ]; then
  echo "Detected macOS - building DMG..."
  npm run dist:mac
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  echo "Detected Linux - building AppImage..."
  npm run dist:linux
else
  echo "Building Windows NSIS EXE..."
  npm run dist:win
fi

echo ""
echo "=========================================================="
echo " Done! Packaged assets are located in: ./dist-desktop/ "
echo "=========================================================="
