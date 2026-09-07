@echo off
title Stop Gemini Canvas Server
echo ========================================================
echo   Stopping Gemini Canvas Extractor Server on Port 8000...
echo ========================================================

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Stopping process PID %%a...
    taskkill /F /PID %%a 2>nul
    set FOUND=1
)

if "%FOUND%"=="1" (
    echo.
    echo Server on port 8000 stopped successfully.
) else (
    echo.
    echo No server process was currently running on port 8000.
)

echo.
echo You can double-click start.bat anytime to run the server again.
pause
