#!/bin/bash
# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Stopping StudyNotebook & FreeLLMAPI ==="

if [ -f "app.pid" ]; then
  read -r APP_PID FREELLMAPI_PID < app.pid
  echo "Stopping parent process groups..."
  
  # Terminate child processes
  pkill -P $APP_PID 2>/dev/null
  kill $APP_PID 2>/dev/null
  
  pkill -P $FREELLMAPI_PID 2>/dev/null
  kill $FREELLMAPI_PID 2>/dev/null
  
  rm app.pid
fi

# Clean ports
echo "Forcefully cleaning up lingering node servers..."
lsof -t -i:3000 | xargs kill -9 2>/dev/null
lsof -t -i:3001 | xargs kill -9 2>/dev/null
lsof -t -i:5173 | xargs kill -9 2>/dev/null
lsof -t -i:5174 | xargs kill -9 2>/dev/null

echo "All systems stopped successfully."
