@echo off
rem Start MaRQ (Windows): serves this folder locally and opens the browser. Close this window to stop.
setlocal
cd /d "%~dp0"

rem Double-clicking MaRQ.bat inside a zip runs a lone copy of it from a temporary folder.
if not exist "index.html" goto notextracted
if not exist "run_marq.py" goto notextracted

rem A working Python 3: "python" (the Microsoft Store placeholder of that name fails this
rem test and is skipped), then the "py" launcher.
set "PY="
python -c "import sys; sys.exit(sys.version_info[0] != 3)" >nul 2>nul && set "PY=python"
if not defined PY py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY goto nopython

%PY% run_marq.py %*
if errorlevel 1 goto failed
goto end

:notextracted
echo The MaRQ files (index.html, run_marq.py) are not in this folder:
echo   %CD%
echo If you opened the zip archive directly, extract it first (right-click the zip,
echo "Extract All"), then start MaRQ.bat in the extracted "software" folder.
goto wait

:nopython
echo Python 3 was not found. Install it from https://www.python.org/downloads/
echo (tick "Add python.exe to PATH" during the installation) and start MaRQ.bat again,
echo or start any static file server in this folder and open its address in the browser.
goto wait

:failed
echo.
echo MaRQ stopped with the error shown above.

:wait
echo.
pause

:end
endlocal
