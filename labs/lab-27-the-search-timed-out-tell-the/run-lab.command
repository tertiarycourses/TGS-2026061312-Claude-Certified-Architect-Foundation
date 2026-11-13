#!/usr/bin/env bash
# Lab 27: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-3-multi-agent-research" || exit 1
uv run research_system.py
echo; read -p "Done. Press Enter to close."
