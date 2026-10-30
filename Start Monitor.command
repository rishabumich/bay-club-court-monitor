#!/bin/zsh
set -e
cd "${0:A:h}"
if [[ ! -f "data/browser-profile/.connected" ]]; then
  echo "First-time Bay Club connection: a browser will open for you to sign in."
  echo
  npm run setup:login
  echo
fi
echo "Watching Santa Clara every 5 minutes. Keep this window open."
echo "Press Control-C to stop."
echo
npm run monitor
echo
read -k 1 "?Monitor stopped. Press any key to close..."
