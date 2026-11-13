@echo off
rem Lab 16: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-2-code-generation"
uv run casekit.py --case UC-8
echo.
pause
