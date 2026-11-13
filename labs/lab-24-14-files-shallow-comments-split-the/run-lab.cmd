@echo off
rem Lab 24: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-5-ci-cd"
uv run ci_review.py
echo.
pause
