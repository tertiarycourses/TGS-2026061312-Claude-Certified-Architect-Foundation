@echo off
rem Lab 14: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-1-customer-support"
uv run case_review.py CS-02
echo.
pause
