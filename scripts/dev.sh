#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

# Free ports used by server (5000) and client (5173) in case of stale processes
free_port() {
  lsof -ti tcp:"$1" | xargs kill -9 2>/dev/null || true
}

free_port 3001
free_port 5173

cleanup() {
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
}

npm --prefix "$SERVER_DIR" run dev &
SERVER_PID=$!

npm --prefix "$CLIENT_DIR" run dev &
CLIENT_PID=$!

trap cleanup INT TERM EXIT

wait "$SERVER_PID" "$CLIENT_PID"

