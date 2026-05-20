#!/usr/bin/env bash

set -euo pipefail

OUTPUT_PATH="./tmp/head"
WEBSITE_ID="cmgu3cd8q000pv8osmwgdl8hd"

print_usage() {
  cat <<'EOF'
Usage: reset-head.sh [--output <path>] [--website-id <id>]

Options:
  --output       Destination directory for the generated head app (default: ./tmp/head)
  --website-id   Website identifier used by the UCS generator (default: cmgu3cd8q000pv8osmwgdl8hd)
  -h, --help     Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT_PATH="${2:-}"
      if [[ -z "$OUTPUT_PATH" ]]; then
        echo "error: --output requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    --website-id)
      WEBSITE_ID="${2:-}"
      if [[ -z "$WEBSITE_ID" ]]; then
        echo "error: --website-id requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "error: unknown option '$1'" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

echo "Resetting generated head at ${OUTPUT_PATH}"

if [[ -d "$OUTPUT_PATH" ]]; then
  echo "Removing existing directory..."
  rm -rf "$OUTPUT_PATH"
fi

echo "Ensuring esbuild binary matches current platform..."
pnpm rebuild esbuild >/dev/null

echo "Generating new head project..."
GEN_CMD=(pnpm tsx scripts/generate-head/index.ts --provider ucs --website-id "$WEBSITE_ID" --output "$OUTPUT_PATH" --force)
echo "> ${GEN_CMD[*]}"
"${GEN_CMD[@]}"

ENV_FILES=(".env" ".env.local")
for env_file in "${ENV_FILES[@]}"; do
  if [[ -f "$env_file" ]]; then
    echo "Copying ${env_file} into generated project..."
    cp "$env_file" "$OUTPUT_PATH/$env_file"
  fi
done

echo "Installing dependencies..."
pnpm --dir "$OUTPUT_PATH" install

echo "Starting development server (press Ctrl+C to stop)..."
pnpm --dir "$OUTPUT_PATH" dev

echo "Head generation complete. Dev server running."
