#!/usr/bin/env bash
# Lab 3: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-2-code-generation" || exit 1
uv run casekit.py --case UC-25
echo; read -p "Done. Press Enter to close."
