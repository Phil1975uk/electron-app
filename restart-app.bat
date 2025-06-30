@echo off
echo 🔄 Restarting Electron App...

echo ⏹️  Stopping existing Electron processes...
taskkill /f /im electron.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Stopped Electron processes
    timeout /t 2 /nobreak >nul
) else (
    echo ℹ️  No running Electron processes found
)

echo 🚀 Starting Electron app...
npm run dev 