@echo off
REM FestNet Backend Startup Script
REM Starts the Location & Crowd Tracking backend server

echo ========================================
echo  FestNet Backend Server Startup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found:
node --version
echo.

REM Check if we're in the correct directory
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Please run this script from Backend/functions directory
    pause
    exit /b 1
)

echo [OK] Found package.json
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed successfully
    echo.
)

REM Get local IP address
echo ========================================
echo  Network Configuration
echo ========================================
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP:~1!
    echo Your computer IP: !IP!
)
echo.
echo Backend will be available at:
echo   - http://localhost:5001
echo   - http://YOUR_IP:5001
echo.
echo Make sure ESP32 is configured to use your IP address
echo ========================================
echo.

REM Start the server
echo Starting backend server...
echo.
npm run dev

pause
