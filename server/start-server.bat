@echo off
rem MARSAD live analysis: starts the analysis program and the tunnel. Double-click to run.
cd /d "%~dp0"
if "%EARTHDATA_TOKEN%"=="" (
  echo EARTHDATA_TOKEN is not set. Add it in Windows "Edit environment variables for your account", then run this file again.
  pause
  exit /b
)
if not exist tunnel-domain.txt (
  echo The file tunnel-domain.txt is missing. Put your ngrok address in it, for example: my-name.ngrok-free.app
  pause
  exit /b
)
set /p MARSAD_DOMAIN=<tunnel-domain.txt
start "MARSAD analysis" cmd /k python -m uvicorn app:app --host 127.0.0.1 --port 8000
start "MARSAD tunnel" cmd /k ngrok http --url=%MARSAD_DOMAIN% 8000
