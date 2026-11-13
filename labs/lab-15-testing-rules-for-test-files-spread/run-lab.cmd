@echo off
rem Lab 15: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-3-multi-agent-research"
uv run rules_sim.py D
echo.
pause
