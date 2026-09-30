@echo off
echo Starting Schedule App...
echo.

start "Backend" cmd /c "cd /d D:\KRpj\server && C:\Program Files\nodejs\node.exe index.js"
timeout /t 2 >nul
start "Frontend" cmd /c "cd /d D:\KRpj\server && C:\Program Files\nodejs\node.exe static-server.js"
timeout /t 2 >nul

echo.
echo ========================================
echo   Schedule App is running!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo ========================================
echo.
pause
