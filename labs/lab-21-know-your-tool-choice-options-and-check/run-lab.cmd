@echo off
rem Lab 21: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-6-structured-extraction"
uv run extract.py --tool-choice forced --max-docs 2
echo.
pause
