@echo off
title Get app icons
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Extract-AppIcons.ps1"
echo.
echo Done. Tell Claude it finished.
pause
