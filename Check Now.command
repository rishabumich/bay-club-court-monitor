#!/bin/zsh
set -e
cd "${0:A:h}"
npm run monitor:once
echo
read -k 1 "?Check complete. Press any key to close..."
