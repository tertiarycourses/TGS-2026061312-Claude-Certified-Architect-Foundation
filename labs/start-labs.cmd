@echo off
rem Windows: double-click to install (first time) and start the six simulators. Keep this window open during class.
setlocal
title Claude Certified Architect simulators - keep this window open
cd /d "%~dp0"
set "PATH=%USERPROFILE%\.local\bin;%ProgramFiles%\Git\cmd;%ProgramFiles%\Git\usr\bin;%PATH%"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
rem Synced folders stall the Python environment: keep it outside them.
echo %CD% | findstr /i "OneDrive Dropbox" >nul && set "UV_PROJECT_ENVIRONMENT=%LOCALAPPDATA%\ccar-f-labs-venv"
echo == Claude Certified Architect Foundation: six simulators ==
where git >nul 2>nul || (
  echo Installing Git for Windows. Simulators 2 and 5 need it...
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
)
where uv >nul 2>nul || (
  echo Installing uv, the Python manager...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
)
echo Installing the simulators. The first time takes about a minute...
uv sync
if errorlevel 1 (
  echo Install failed. Show this window to your trainer.
  pause
  exit /b 1
)
uv run login.py || uv run login.py --login
echo Starting. Your browser opens in a few seconds. Keep this window open; close it to stop.
uv run serve.py
pause
