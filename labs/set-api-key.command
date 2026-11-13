#!/bin/bash
# Mac: double-click to save your Anthropic API key for the labs (writes labs/.env).
cd "$(dirname "$0")" || exit 1
python3 set_api_key.py --force
echo "Press Enter to close."; read -r
