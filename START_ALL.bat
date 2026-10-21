@echo off
echo ========================================================
echo   FestNet - Starting Full System (Backend + Dashboard)
echo ========================================================
echo.

REM Find active local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    echo [IP] Detected IPv4: %%a
)
echo.
echo Make sure GPS.ino BACKEND_IP matches your Wi-Fi IPv4 address!
echo ========================================================
echo.

echo [1/2] Launching Backend Server on port 5001...
start "FestNet Backend Server (Port 5001)" cmd /k "cd Backend\functions && npm run dev"

timeout /t 2 /nobreak >nul

echo [2/2] Launching Dashboard on port 5173...
start "FestNet Dashboard (Port 5173)" cmd /k "cd Dashboard && npm run dev"

echo.
echo ========================================================
echo   All systems started!
echo   - Backend:   http://localhost:5001/api/health
echo   - Dashboard: http://localhost:5173
echo ========================================================
pause
