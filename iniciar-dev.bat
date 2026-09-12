@echo off
REM ============================================================
REM  comercio-app - Arranque del entorno de desarrollo
REM  Doble clic para levantar todo lo necesario para el dia a dia.
REM ============================================================

REM ---- CONFIGURACION: cambia esto si tu telefono tiene otra IP ----
set "TELEFONO=192.168.1.5:5555"
REM -----------------------------------------------------------------

set "RAIZ=%~dp0"
title Iniciar entorno comercio-app

echo.
echo   comercio-app - levantando entorno de desarrollo
echo   ===============================================
echo.
echo   IPs de este PC (la del WiFi es la que va en frontend\src\config.ts):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo      %%a
echo.

echo   [1/3] API Laravel        -^> puerto 8000
start "API - Laravel"  /D "%RAIZ%backend"  cmd /k php artisan serve --host=0.0.0.0 --port=8000

echo   [2/3] Telefono por WiFi  -^> %TELEFONO%
start "ADB - Telefono"  cmd /k "adb connect %TELEFONO% && adb devices"

echo   [3/3] Metro React Native -^> puerto 8081
start "Metro - React Native"  /D "%RAIZ%frontend"  cmd /k npm start

echo.
echo   Listo. Se abrieron 3 ventanas, dejalas corriendo.
echo.
echo   - Movil: abre la app desde el icono del telefono.
echo   - PC:    abre http://localhost:8000 en el navegador.
echo.
echo   Solo si tocaste android/ o instalaste una libreria nativa:
echo       cd frontend  y luego  npm run android
echo.
echo   Si la app abre pero no carga datos, revisa que la IPv4 de
echo   arriba coincida con la de frontend\src\config.ts
echo.
pause
