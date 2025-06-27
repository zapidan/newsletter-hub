#!/bin/bash

# Script to run responsive tests with development server

echo "🔍 Checking if development server is already running..."

# Check if server is already running
if curl -s http://localhost:5174 > /dev/null; then
    echo "✅ Development server is already running on http://localhost:5174"
    echo "🧪 Running responsive tests with existing server..."
    npm run test:e2e:responsive
    exit $?
fi

echo "🚀 Starting development server..."
npm run dev &
DEV_SERVER_PID=$!

# Wait for the server to start
echo "⏳ Waiting for development server to start..."
sleep 10

# Check if server is running
if ! curl -s http://localhost:5174 > /dev/null; then
    echo "❌ Development server failed to start"
    kill $DEV_SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Development server is running on http://localhost:5174"

# Run the responsive tests
echo "🧪 Running responsive tests..."
npm run test:e2e:responsive

# Capture the exit code
TEST_EXIT_CODE=$?

# Clean up
echo "🧹 Cleaning up..."
kill $DEV_SERVER_PID 2>/dev/null

# Exit with the test exit code
exit $TEST_EXIT_CODE 