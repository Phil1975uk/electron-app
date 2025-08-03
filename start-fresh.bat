@echo off
echo Starting Electron app with fresh cache...

REM Clear any existing cache files
if exist "renderer\data\hypaCsvCache.json" del "renderer\data\hypaCsvCache.json"
if exist "debug-log.txt" del "debug-log.txt"

REM Clear Electron cache directory if it exists
if exist "%APPDATA%\card-creator-desktop" rmdir /s /q "%APPDATA%\card-creator-desktop"

echo Cache cleared. Starting app...
npm start 