@echo off
rem Lab 10: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-5-ci-cd"
uv run casekit.py --case UC-15
echo.
pause
