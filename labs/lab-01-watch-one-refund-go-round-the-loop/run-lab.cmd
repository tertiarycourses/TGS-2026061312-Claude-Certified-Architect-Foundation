@echo off
rem Lab 1: runs the same live simulation as the website, in a terminal.
cd /d "%~dp0..\simulators\simulator-1-customer-support"
uv run support_agent.py --case CS-01
echo.
pause
