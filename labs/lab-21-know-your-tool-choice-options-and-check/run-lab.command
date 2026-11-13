#!/usr/bin/env bash
# Lab 21: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-6-structured-extraction" || exit 1
uv run extract.py --tool-choice forced --max-docs 2
echo; read -p "Done. Press Enter to close."
