Write-Host "Starting Electron app with fresh cache..." -ForegroundColor Green

# Clear any existing cache files
if (Test-Path "renderer\data\hypaCsvCache.json") {
    Remove-Item "renderer\data\hypaCsvCache.json" -Force
    Write-Host "Cleared hypaCsvCache.json" -ForegroundColor Yellow
}

if (Test-Path "debug-log.txt") {
    Remove-Item "debug-log.txt" -Force
    Write-Host "Cleared debug-log.txt" -ForegroundColor Yellow
}

# Clear Electron cache directory if it exists
$electronCachePath = "$env:APPDATA\card-creator-desktop"
if (Test-Path $electronCachePath) {
    Remove-Item $electronCachePath -Recurse -Force
    Write-Host "Cleared Electron cache directory" -ForegroundColor Yellow
}

Write-Host "Cache cleared. Starting app..." -ForegroundColor Green
npm start 