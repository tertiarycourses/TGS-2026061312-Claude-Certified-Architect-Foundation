#!/bin/bash
# Mac: double-click to install (first time) and start the six simulators. Keep this window open during class.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" PYTHONUTF8=1 PYTHONIOENCODING=utf-8
case "$PWD" in  # iCloud (Desktop & Documents), Dropbox and OneDrive stall the Python environment: keep it outside
  "$HOME/Documents"*|"$HOME/Desktop"*|*"Mobile Documents"*|*CloudStorage*|*Dropbox*|*OneDrive*) export UV_PROJECT_ENVIRONMENT="$HOME/.cache/ccar-f-labs-venv";;
esac
echo "== Claude Certified Architect Foundation: six simulators =="
if ! command -v uv >/dev/null; then
  echo "Installing uv (Python manager)..."; curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
echo "Installing the simulators (first time takes about a minute)..."
uv sync || { echo "Install failed. Show this window to your trainer."; read -r; exit 1; }
uv run login.py || uv run login.py --login
echo "Starting. Your browser opens in a few seconds. Keep this window open; close it to stop."
uv run serve.py
