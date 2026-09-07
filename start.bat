@echo off
title Gemini Canvas Extractor Server
echo ========================================================
echo   Starting Gemini Canvas Artifact Extractor Server...
echo ========================================================
cd /d "%~dp0"
python -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
