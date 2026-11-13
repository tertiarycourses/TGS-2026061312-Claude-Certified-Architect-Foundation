#!/usr/bin/env bash
# Lab 24: runs the same live simulation as the website, in a terminal.
cd "$(dirname "$0")/../simulators/simulator-5-ci-cd" || exit 1
uv run ci_review.py
echo; read -p "Done. Press Enter to close."
