@echo off
rem Lab 28: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-4-developer-productivity"
uv run explorer.py --case UC-D3
echo.
pause
