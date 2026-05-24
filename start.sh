#!/bin/bash
# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Starting StudyNotebook (Single-Port Unified Product) ==="

# 1. Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
  echo "Installing dependencies (this might take a moment)..."
  npm run setup
fi

# 2. Compile StudyNotebook frontend
if [ ! -d "frontend/dist" ] || [ ! -f "frontend/dist/index.html" ]; then
  echo "Compiling frontend assets..."
  npm run build
fi

# 3. Clean up lingering servers on port 3000
echo "Cleaning up lingering ports..."
lsof -t -i:3000 | xargs kill -9 2>/dev/null
lsof -t -i:5174 | xargs kill -9 2>/dev/null

# 4. Start StudyNotebook in background
echo "Starting StudyNotebook on http://localhost:3000..."
npm start > app.log 2>&1 &
APP_PID=$!

echo $APP_PID > app.pid
echo "Application started successfully."
echo ""
echo "📱 StudyNotebook Link: http://localhost:3000"
echo ""
echo "Log file: tail -f $DIR/app.log"
