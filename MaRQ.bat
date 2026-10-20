@echo off
rem Start MaRQ (Windows), the same as double-clicking MaRQ.exe: serves this folder locally
rem and opens the browser. Falls back to Python when MaRQ.exe is missing or blocked.
rem Close this window to stop MaRQ.
setlocal
rem pushd also works on a network path (\\server\share), where cd cannot go
pushd "%~dp0"

rem Double-clicking MaRQ.bat inside a zip runs a lone copy of it from a temporary folder.
if not exist "index.html" goto notextracted
if not exist "run_marq.py" goto notextracted

rem Full paths: some systems do not run programs from the current folder by name.
if not exist "%~dp0MaRQ.exe" goto python
"%~dp0MaRQ.exe" --help >nul 2>nul
if errorlevel 1 goto python
"%~dp0MaRQ.exe" %*
goto end

:python
rem A working Python 3: "python" (the Microsoft Store placeholder of that name fails this
rem test and is skipped), then the "py" launcher.
set "PY="
python -c "import sys; sys.exit(sys.version_info < (3, 7))" >nul 2>nul && set "PY=python"
if not defined PY py -3 -c "import sys; sys.exit(sys.version_info < (3, 7))" >nul 2>nul && set "PY=py -3"
if not defined PY goto nopython

%PY% "%~dp0run_marq.py" %*
if errorlevel 1 goto failed
goto end

:notextracted
echo The MaRQ files (index.html, run_marq.py) are not in this folder:
echo   "%CD%"
echo If you opened the zip archive directly, extract it first (right-click the zip,
echo "Extract All"), then start MaRQ in the extracted folder.
goto wait

:nopython
echo MaRQ.exe could not run here (it may have been blocked or removed by security
echo software) and Python 3 was not found either. Either allow MaRQ.exe (see README.md,
echo "If MaRQ does not start"), or install Python from https://www.python.org/downloads/
echo (tick "Add python.exe to PATH") and start MaRQ.bat again.
goto wait

:failed
echo.
echo MaRQ stopped with the error shown above.

:wait
echo.
pause

:end
popd
endlocal
