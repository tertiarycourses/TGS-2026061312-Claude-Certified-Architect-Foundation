#!/usr/bin/env bash
# Lab 18: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-5-ci-cd" || exit 1
uv run casekit.py --case UC-18
echo; read -p "Done. Press Enter to close."
