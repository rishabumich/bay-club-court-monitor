#!/bin/zsh
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from https://nodejs.org and run this again."
  read -k 1 "?Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing the monitor's local dependencies..."
  npm install
fi

npm run setup:telegram
echo
read -k 1 "?Telegram is connected. Press any key to close..."
