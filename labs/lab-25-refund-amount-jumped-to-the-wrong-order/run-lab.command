#!/usr/bin/env bash
# Lab 25: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-1-customer-support" || exit 1
uv run support_agent.py --case CS-12
echo; read -p "Done. Press Enter to close."
