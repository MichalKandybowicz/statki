#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

copy_env_if_missing() {
  EXAMPLE_FILE="$1/.env.example"
  TARGET_FILE="$1/.env"

  if [ -f "$TARGET_FILE" ]; then
    return
  fi

  if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$TARGET_FILE"
    echo "Utworzono $TARGET_FILE z .env.example"
  fi
}

copy_env_if_missing "$SERVER_DIR"
copy_env_if_missing "$CLIENT_DIR"

echo "Instalowanie zaleznosci backendu..."
npm --prefix "$SERVER_DIR" install

echo "Instalowanie zaleznosci frontendu..."
npm --prefix "$CLIENT_DIR" install

echo "Setup zakonczony. Uzyj: npm run dev"

