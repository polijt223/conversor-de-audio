@echo off
title AudioPulse - Conversor de Audio Local
color 0B

echo ========================================================
echo        AudioPulse - Conversor de Audio Local
echo ========================================================
echo.
echo Iniciando servidor local con motor FFmpeg...
echo.

:: Iniciar el navegador despues de 2 segundos en segundo plano
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3050'"

:: Ejecutar servidor Node.js
npm start

pause
