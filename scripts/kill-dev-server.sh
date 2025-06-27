#!/bin/bash

# Script to kill any existing development server processes

echo "🔍 Looking for processes on port 5174..."

# Find processes using port 5174
PIDS=$(lsof -ti:5174)

if [ -z "$PIDS" ]; then
    echo "✅ No processes found on port 5174"
    exit 0
fi

echo "🔄 Found processes: $PIDS"
echo "🗑️  Killing processes..."

# Kill the processes
for PID in $PIDS; do
    echo "   Killing process $PID"
    kill -9 $PID 2>/dev/null
done

echo "✅ Killed all processes on port 5174"

# Wait a moment for processes to fully terminate
sleep 2

# Verify they're gone
REMAINING_PIDS=$(lsof -ti:5174)
if [ -z "$REMAINING_PIDS" ]; then
    echo "✅ Port 5174 is now free"
else
    echo "⚠️  Some processes may still be running: $REMAINING_PIDS"
fi 