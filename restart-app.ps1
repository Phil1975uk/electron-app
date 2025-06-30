# Restart Electron App Script
Write-Host "Restarting Electron App..." -ForegroundColor Yellow

# Stop any running Electron processes
Write-Host "Stopping existing Electron processes..." -ForegroundColor Cyan
$electronProcesses = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcesses) {
    $electronProcesses | Stop-Process -Force
    Write-Host "Stopped $($electronProcesses.Count) Electron process(es)" -ForegroundColor Green
    Start-Sleep -Seconds 2  # Give processes time to fully stop
} else {
    Write-Host "No running Electron processes found" -ForegroundColor Gray
}

# Start the app
Write-Host "Starting Electron app..." -ForegroundColor Cyan
npm run dev 