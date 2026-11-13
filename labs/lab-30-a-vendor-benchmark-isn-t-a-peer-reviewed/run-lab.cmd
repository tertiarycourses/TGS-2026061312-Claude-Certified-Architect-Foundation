@echo off
rem Lab 30: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-3-multi-agent-research"
uv run research_system.py --case UC-24
echo.
pause
