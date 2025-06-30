@echo off
echo Installing dependencies...
npm install

echo.
echo Building the application...
npm run build-installer

echo.
echo Build complete! Check the dist folder for the installer.
pause 