@echo off
setlocal

rem ---------------------------------------------------------------
rem  Vamoss - start the site on this computer.
rem  Double-click this file. Close the window (or press Ctrl+C) to stop.
rem ---------------------------------------------------------------

cd /d "%~dp0"

title Vamoss - local site

echo.
echo   ==========================================
echo     VAMOSS - starting the local site
echo   ==========================================
echo.

rem --- is Node installed? ---
where node >nul 2>nul
if errorlevel 1 (
    echo   [X] Node.js was not found on this computer.
    echo.
    echo       The site needs it to run. Install the LTS version from:
    echo         https://nodejs.org
    echo       then double-click this file again.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODEVER=%%v
echo   Node %NODEVER% found.

rem --- is the server file here? ---
if not exist "server.js" (
    echo   [X] server.js is missing from this folder.
    echo       Make sure start.bat sits next to server.js.
    echo.
    pause
    exit /b 1
)

rem --- install dependencies the first time only ---
if not exist "node_modules" (
    echo   First run - installing dependencies, this takes a moment...
    echo.
    call npm install --no-fund --no-audit
    if errorlevel 1 (
        echo.
        echo   [X] npm install failed. Scroll up to see why.
        echo.
        pause
        exit /b 1
    )
    echo.
)

echo   Shop:   http://localhost:3000
echo   Orders: http://localhost:3000/admin.html
echo.
echo   Press Ctrl+C or close this window to stop the site.
echo.

rem --- open the browser once the server is up (skip with --no-open) ---
if /i not "%~1"=="--no-open" (
    start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"
)

rem --- run the server in this window so you can see what it prints ---
node server.js

rem --- if we get here the server stopped ---
echo.
echo   The site has stopped.
echo.
echo   If that was not on purpose, the usual cause is that port 3000
echo   is already in use - close the other window and try again.
echo.
pause
endlocal
