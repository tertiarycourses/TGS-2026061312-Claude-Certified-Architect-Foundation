@echo off
rem Lab 23: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-1-customer-support"
uv run triage.py --pilot
echo.
pause
