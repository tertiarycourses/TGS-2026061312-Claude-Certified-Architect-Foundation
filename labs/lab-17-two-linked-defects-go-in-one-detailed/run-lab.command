#!/usr/bin/env bash
# Lab 17: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-3-multi-agent-research" || exit 1
uv run plan_request.py
echo; read -p "Done. Press Enter to close."
