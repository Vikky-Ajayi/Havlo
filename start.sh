#!/bin/bash
set -e

# Start backend API in background
uvicorn app.main:app --host localhost --port 8000 --reload &
BACKEND_PID=$!

# Start frontend dev server
cd havlo_frontend && npm run dev

# If frontend exits, kill backend
kill $BACKEND_PID 2>/dev/null || true
