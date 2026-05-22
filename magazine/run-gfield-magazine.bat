@echo off
setlocal
cd /d "%~dp0personal-gemini-proxy"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
node server.js
