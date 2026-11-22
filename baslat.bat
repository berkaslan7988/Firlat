@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Firlat
where python >nul 2>nul
if errorlevel 1 (
  echo Python bulunamadi. https://www.python.org adresinden kurup tekrar dene.
  echo Python was not found. Install it from https://www.python.org and try again.
  pause
  exit /b 1
)
python server.py %*
pause
