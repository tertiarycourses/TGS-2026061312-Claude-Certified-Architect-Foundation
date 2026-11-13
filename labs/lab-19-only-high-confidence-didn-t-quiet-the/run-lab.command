#!/usr/bin/env bash
# Lab 19: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-5-ci-cd" || exit 1
uv run casekit.py --case UC-39
echo; read -p "Done. Press Enter to close."
