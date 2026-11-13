@echo off
rem Lab 11: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-2-code-generation"
uv run simulator.py 5
echo.
pause
