@echo off
REM ============================================================
REM  comercio-app - Arranque con el EMULADOR de Android (sin telefono)
REM  Doble clic: abre el emulador, la API, Metro y la app.
REM  Requisito: haber creado un emulador en Android Studio (Device Manager).
REM ============================================================

REM ---- CONFIGURACION: deja vacio para usar el primer emulador que exista ----
set "AVD="
REM ---------------------------------------------------------------------------

setlocal EnableDelayedExpansion
set "RAIZ=%~dp0"
set "PAQUETE=com.comercioapp"
title Iniciar comercio-app en el emulador

set "SDK=%ANDROID_HOME%"
if "%SDK%"=="" set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "EMULADOR=%SDK%\emulator\emulator.exe"
set "ADB=%SDK%\platform-tools\adb.exe"

echo.
echo   comercio-app - levantando entorno con el emulador
echo   =================================================
echo.

if not exist "%EMULADOR%" (
    echo   [X] No encuentro el emulador en "%EMULADOR%".
    echo       Revisa ANDROID_HOME o instala "Android Emulator" en Android Studio.
    goto fin
)

findstr /c:"10.0.2.2" "%RAIZ%frontend\src\config.ts" >nul
if errorlevel 1 (
    echo   [!] frontend\src\config.ts no apunta a http://10.0.2.2:8000
    echo       El emulador no llegara a la API hasta que lo cambies.
    echo.
)

REM ---- 1. Emulador (si no hay uno ya encendido) ----
"%ADB%" start-server >nul 2>&1
"%ADB%" devices | findstr /b "emulator-" >nul
if not errorlevel 1 (
    echo   [1/4] Emulador           -^> ya estaba encendido
) else (
    if "%AVD%"=="" (
        REM Las lineas con espacios son avisos del emulador, no nombres de AVD
        for /f "tokens=1,2" %%a in ('"%EMULADOR%" -list-avds') do if "%%b"=="" if "!AVD!"=="" set "AVD=%%a"
    )
    if "!AVD!"=="" (
        echo   [X] No hay ningun emulador creado.
        echo       Android Studio -^> Device Manager -^> Create Device -^> Pixel 7 -^> API 36
        goto fin
    )
    echo   [1/4] Emulador           -^> !AVD!
    start "Emulador - !AVD!" "%EMULADOR%" -avd !AVD!
)

REM ---- 2. API y 3. Metro ----
echo   [2/4] API Laravel        -^> puerto 8000
start "API - Laravel"  /D "%RAIZ%backend"  cmd /k php artisan serve --port=8000

echo   [3/4] Metro React Native -^> puerto 8081
start "Metro - React Native"  /D "%RAIZ%frontend"  cmd /k npm start

REM ---- 4. Esperar a que Android arranque y abrir la app ----
echo   [4/4] Esperando a que el emulador termine de arrancar...
"%ADB%" -e wait-for-device
:esperar
set "BOOT="
for /f "delims=" %%b in ('"%ADB%" -e shell getprop sys.boot_completed 2^>nul') do set "BOOT=%%b"
if not "%BOOT:~0,1%"=="1" (
    timeout /t 2 /nobreak >nul
    goto esperar
)
"%ADB%" -e reverse tcp:8081 tcp:8081 >nul

"%ADB%" -e shell pm list packages %PAQUETE% | findstr /c:"package:%PAQUETE%" >nul
if errorlevel 1 (
    echo         La app no esta instalada: compilando e instalando ^(la 1a vez tarda^)...
    start "Instalar app - npm run android"  /D "%RAIZ%frontend"  cmd /k npm run android
) else (
    echo         Abriendo la app...
    "%ADB%" -e shell am start -n %PAQUETE%/.MainActivity >nul
)

echo.
echo   Listo. Deja abiertas las ventanas del emulador, la API y Metro.
echo.
echo   - Web del PC: http://localhost:8000
echo   - Recargar la app: pulsa R dos veces en el emulador ^(o r en Metro^).
echo.
echo   Solo si tocaste android/ o instalaste una libreria nativa:
echo       cd frontend  y luego  npm run android
echo.

:fin
pause
