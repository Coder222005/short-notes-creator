#!/bin/bash
# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Stopping StudyNotebook ==="

if [ -f "app.pid" ]; then
  APP_PID=$(cat app.pid)
  echo "Stopping parent process for PID $APP_PID..."
  
  # Terminate processes
  pkill -P $APP_PID 2>/dev/null
  kill $APP_PID 2>/dev/null
  
  rm app.pid
fi

# Clean port 3000 and 5174
echo "Forcefully releasing ports..."
lsof -t -i:3000 | xargs kill -9 2>/dev/null
lsof -t -i:5174 | xargs kill -9 2>/dev/null

echo "StudyNotebook stopped successfully."
