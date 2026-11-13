#!/usr/bin/env bash
# Lab 12: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-4-developer-productivity" || exit 1
uv run explorer.py --case UC-37
echo; read -p "Done. Press Enter to close."
