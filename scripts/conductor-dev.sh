#!/usr/bin/env sh
set -eu

if [ -z "${CONDUCTOR_PORT:-}" ]; then
  echo "CONDUCTOR_PORT is required. Run this script from Conductor or export it first." >&2
  exit 1
fi

case "$CONDUCTOR_PORT" in
  ''|*[!0-9]*)
    echo "CONDUCTOR_PORT must be a positive integer, got: $CONDUCTOR_PORT" >&2
    exit 1
    ;;
esac

WEB_PORT="$CONDUCTOR_PORT"
API_PORT=$((CONDUCTOR_PORT + 1))

export BASE_PATH="${BASE_PATH:-/}"
export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://localhost:$API_PORT}"

echo "Starting leave tracker web on http://localhost:$WEB_PORT"
echo "Starting API server on http://localhost:$API_PORT"

pnpm exec concurrently \
  -n api,web \
  -c blue,green \
  "PORT=$API_PORT pnpm run dev:api" \
  "PORT=$WEB_PORT pnpm run dev:web"
