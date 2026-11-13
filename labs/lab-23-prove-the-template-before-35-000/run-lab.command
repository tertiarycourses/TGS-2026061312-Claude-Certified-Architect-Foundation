#!/usr/bin/env bash
# Lab 23: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-1-customer-support" || exit 1
uv run triage.py --pilot
echo; read -p "Done. Press Enter to close."
