@echo off
rem Lab 17: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-3-multi-agent-research"
uv run plan_request.py
echo.
pause
