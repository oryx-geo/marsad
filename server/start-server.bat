@echo off
rem MARSAD live analysis: starts the analysis program and the tunnel. Double-click to run.
cd /d "%~dp0"
if "%EARTHDATA_TOKEN%"=="" (
  echo EARTHDATA_TOKEN is not set. Add it in Windows "Edit environment variables for your account", then run this file again.
  pause
  exit /b
)
start "MARSAD analysis" cmd /k python -m uvicorn app:app --host 127.0.0.1 --port 8000
start "MARSAD tunnel" cmd /k devtunnel host
