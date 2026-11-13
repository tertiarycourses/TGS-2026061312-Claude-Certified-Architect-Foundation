@echo off
rem Lab 19: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-5-ci-cd"
uv run casekit.py --case UC-39
echo.
pause
