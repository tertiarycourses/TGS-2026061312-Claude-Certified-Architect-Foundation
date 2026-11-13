@echo off
rem Windows: double-click to save your Anthropic API key for the labs (writes labs\.env).
cd /d "%~dp0"
where python >nul 2>nul && (python set_api_key.py --force) || (uv run --no-project set_api_key.py --force)
pause
