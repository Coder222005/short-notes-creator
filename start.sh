#!/bin/bash
# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Starting StudyNotebook & FreeLLMAPI ==="

# 1. Setup FreeLLMAPI env if needed
if [ ! -f "freellmapi/.env" ]; then
  echo "Setting up FreeLLMAPI environment configuration..."
  cp freellmapi/.env.example freellmapi/.env
  ENCRYPT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "ENCRYPTION_KEY=$ENCRYPT_KEY" >> freellmapi/.env
fi

# 2. Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "freellmapi/node_modules" ]; then
  echo "Installing dependencies (this might take a moment)..."
  # Update root package setup script to include freellmapi if not added
  npm run setup
fi

# 3. Compile StudyNotebook frontend
if [ ! -d "frontend/dist" ] || [ ! -f "frontend/dist/index.html" ]; then
  echo "Compiling frontend assets..."
  npm run build
fi

# 4. Clean up lingering servers on ports
echo "Cleaning up lingering ports..."
lsof -t -i:3000 | xargs kill -9 2>/dev/null
lsof -t -i:3001 | xargs kill -9 2>/dev/null
lsof -t -i:5173 | xargs kill -9 2>/dev/null
lsof -t -i:5174 | xargs kill -9 2>/dev/null

# 5. Start FreeLLMAPI proxy in background
echo "Starting FreeLLMAPI proxy (backend: port 3001, dashboard: port 5173)..."
cd freellmapi
npm run dev > ../freellmapi.log 2>&1 &
FREELLMAPI_PID=$!
cd ..

# 6. Start StudyNotebook in background
echo "Starting StudyNotebook (port 3000)..."
npm start > app.log 2>&1 &
APP_PID=$!

echo "$APP_PID $FREELLMAPI_PID" > app.pid
echo "Application and proxy started successfully."
echo ""
echo "📱 StudyNotebook Portal: http://localhost:3000"
echo "⚙️ FreeLLMAPI Dashboard:  http://localhost:5173"
echo ""
echo "Log files:"
echo " - App Logs: tail -f $DIR/app.log"
echo " - FreeLLMAPI Logs: tail -f $DIR/freellmapi.log"
