@echo off
rem Start MaRQ (Windows): serves this folder locally and opens the browser. Close this window to stop.
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python run_marq.py %*
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    py -3 run_marq.py %*
  ) else (
    echo Python 3 was not found. Install it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^),
    echo or start any static file server in this folder and open its address in the browser.
    pause
  )
)
