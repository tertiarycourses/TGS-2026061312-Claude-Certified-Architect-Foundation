@echo off
rem Lab 8: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-6-structured-extraction"
uv run extract.py --case UC-11
echo.
pause
