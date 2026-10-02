@echo off
rem Double-click to remove the Floating Island hotkeys.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Hotkeys.ps1" -Uninstall
echo.
pause
