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

# 4. Clean up lingering servers on known ports
echo "Cleaning up lingering ports..."
for PORT_NUM in 3000 3001 3002 3003 3004 3005 3006 5174; do
  lsof -t -i:$PORT_NUM 2>/dev/null | xargs kill -9 2>/dev/null
done

# 5. Find available port for FreeLLMAPI
PROXY_PORT=3001
if lsof -i:$PROXY_PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3001 is busy, trying 3005..."
  PROXY_PORT=3005
  if lsof -i:$PROXY_PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port 3005 is busy, trying 3006..."
    PROXY_PORT=3006
  fi
fi

# 6. Start FreeLLMAPI on available port
echo "Starting FreeLLMAPI background proxy server on port $PROXY_PORT..."
cd freellmapi
npm run build:server
PORT=$PROXY_PORT npm run start -w server > ../freellmapi.log 2>&1 &
FREELLM_PID=$!
cd "$DIR"

# Wait for FreeLLMAPI to boot up
sleep 3

# 7. Start StudyNotebook Gateway (server.js has built-in port fallback: 3000 → 3002 → 3003 → 3004)
echo "Starting StudyNotebook Gateway (with auto port fallback)..."
npm start > app.log 2>&1 &
APP_PID=$!

echo $APP_PID > app.pid
echo $FREELLM_PID > freellmapi.pid

echo ""
echo "Application started successfully."
echo ""
echo "📱 StudyNotebook Link: http://localhost:3000"
echo "   (If port 3000 was busy, check app.log for the actual port)"
echo ""
echo "Log file: tail -f $DIR/app.log"
echo "FreeLLMAPI log: tail -f $DIR/freellmapi.log"
