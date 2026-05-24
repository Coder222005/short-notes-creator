#!/bin/bash
# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Starting StudyNotebook (Single-Port Unified Product) ==="

# 1. Setup FreeLLMAPI .env if missing
if [ ! -f "freellmapi/.env" ]; then
  echo "Setting up freellmapi/.env configuration..."
  cp freellmapi/.env.example freellmapi/.env
  ENCRYPT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "ENCRYPTION_KEY=$ENCRYPT_KEY" >> freellmapi/.env
fi

# 2. Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "freellmapi/node_modules" ]; then
  echo "Installing dependencies (this might take a moment)..."
  npm install
  cd backend && npm install
  cd ../frontend && npm install
  cd ../freellmapi && npm install
  cd "$DIR"
fi

# 3. Compile StudyNotebook frontend
if [ ! -d "frontend/dist" ] || [ ! -f "frontend/dist/index.html" ]; then
  echo "Compiling frontend assets..."
  npm run build
fi

# 4. Clean up lingering servers on port 3000 and 3001
echo "Cleaning up lingering ports (3000 and 3001)..."
lsof -t -i:3000 | xargs kill -9 2>/dev/null
lsof -t -i:3001 | xargs kill -9 2>/dev/null
lsof -t -i:5174 | xargs kill -9 2>/dev/null

# 5. Start FreeLLMAPI on port 3001
echo "Starting FreeLLMAPI background proxy server on port 3001..."
cd freellmapi
npm run build:server
PORT=3001 npm run start -w server > ../freellmapi.log 2>&1 &
FREELLM_PID=$!
cd "$DIR"

# Wait for FreeLLMAPI to boot up
sleep 3

# 6. Start StudyNotebook in background on port 3000
echo "Starting StudyNotebook on http://localhost:3000..."
npm start > app.log 2>&1 &
APP_PID=$!

echo $APP_PID > app.pid
echo $FREELLM_PID > freellmapi.pid

echo "Application started successfully."
echo ""
echo "📱 StudyNotebook Link: http://localhost:3000"
echo ""
echo "Log file: tail -f $DIR/app.log"
echo "FreeLLMAPI log: tail -f $DIR/freellmapi.log"
