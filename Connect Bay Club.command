#!/bin/zsh
set -e
cd "${0:A:h}"
npm run setup:login
echo
echo "Bay Club is connected. You can close this window."
read -k 1 "?Press any key to close..."
