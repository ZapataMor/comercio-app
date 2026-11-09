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
set "ADB_CMD=powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%RAIZ%scripts\adb-con-tiempo.ps1" -Adb "%ADB%""

echo.
echo   comercio-app - levantando entorno con el emulador
echo   =================================================
echo.
echo   Desarrollo: Laravel en http://localhost:8000 y Metro en 8081.
echo   Para Docker/HTTPS usa iniciar-preproduccion.ps1 ^(puerto 8443^).
echo.

if not exist "%EMULADOR%" (
    echo   [X] No encuentro el emulador en "%EMULADOR%".
    echo       Revisa ANDROID_HOME o instala "Android Emulator" en Android Studio.
    goto fin
)
if not exist "%ADB%" (
    echo   [X] No encuentro ADB en "%ADB%".
    goto fin
)

findstr /c:"http://localhost:8000" "%RAIZ%frontend\src\config.ts" >nul
if errorlevel 1 (
    echo   [!] frontend\src\config.ts no apunta a http://localhost:8000
    echo       El emulador no llegara a la API hasta que lo cambies.
    echo.
)

REM ---- 1. Emulador (si no hay uno ya encendido) ----
echo   [1/4] Comprobando ADB ^(maximo 20 segundos por comando^)...
%ADB_CMD% start-server
if errorlevel 1 goto fin
set "DISPOSITIVO="
REM Elegir uno explicitamente: adb -e falla si hay varios emuladores abiertos.
for /f "tokens=1,2" %%a in ('%ADB_CMD% devices') do if "%%b"=="device" (
    echo %%a | findstr /b "emulator-" >nul
    if not errorlevel 1 if "!DISPOSITIVO!"=="" set "DISPOSITIVO=%%a"
)
if defined DISPOSITIVO (
    echo   [1/4] Emulador           -^> !DISPOSITIVO! ya estaba encendido
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
echo   Comprobando migraciones de la base de datos local...
pushd "%RAIZ%backend"
php artisan migrate --no-interaction
set "MIGRACION_RESULTADO=!errorlevel!"
popd
if not "%MIGRACION_RESULTADO%"=="0" (
    echo   [X] No se pudo actualizar la base local. Revisa MySQL y backend\.env.
    goto fin
)
echo   [2/4] API Laravel        -^> puerto 8000 ^(+ cola y tareas^)
start "API - Laravel"  /D "%RAIZ%backend"  cmd /k php artisan serve --port=8000
REM La cola envia los push; schedule:work corre las tareas programadas (horarios).
start "Cola - Laravel"  /D "%RAIZ%backend"  cmd /k php artisan queue:work --tries=3
start "Tareas - Laravel"  /D "%RAIZ%backend"  cmd /k php artisan schedule:work

echo   [3/4] Metro React Native -^> puerto 8081
start "Metro - React Native"  /D "%RAIZ%frontend"  cmd /k npm start

REM ---- 4. Esperar a que Android arranque y abrir la app ----
echo   [4/4] Esperando a que el emulador termine de arrancar...
set /a INTENTOS=0
:esperar
set /a INTENTOS+=1
if %INTENTOS% gtr 90 (
    echo   [X] Android no termino de arrancar. Revisa el emulador y vuelve a intentar.
    goto fin
)
if not defined DISPOSITIVO (
    for /f "tokens=1,2" %%a in ('%ADB_CMD% devices') do if "%%b"=="device" (
        echo %%a | findstr /b "emulator-" >nul
        if not errorlevel 1 if "!DISPOSITIVO!"=="" set "DISPOSITIVO=%%a"
    )
)
if not defined DISPOSITIVO (
    timeout /t 2 /nobreak >nul
    goto esperar
)
set "BOOT="
for /f "delims=" %%b in ('%ADB_CMD% -s %DISPOSITIVO% shell getprop sys.boot_completed') do set "BOOT=%%b"
if not "%BOOT:~0,1%"=="1" (
    timeout /t 2 /nobreak >nul
    goto esperar
)
REM Preparar todos: cliente, comerciante y domiciliario pueden usar emuladores distintos.
set /a PREPARADOS=0
for /f "tokens=1,2" %%a in ('%ADB_CMD% devices') do if "%%b"=="device" (
    echo %%a | findstr /b "emulator-" >nul
    if not errorlevel 1 (
        call :preparar_emulador %%a
        if errorlevel 1 goto fin
        set /a PREPARADOS+=1 >nul
    )
)
if %PREPARADOS% equ 0 (
    echo   [X] No hay emuladores conectados. Revisa ADB y vuelve a intentar.
    goto fin
)

echo.
echo   Listo. Deja abiertas las ventanas del emulador, la API, la cola, las tareas y Metro.
echo   Emuladores conectados al entorno local: %PREPARADOS%.
echo.
echo   - Panel admin web: http://localhost:8000
echo   - Recargar la app: pulsa R dos veces en el emulador ^(o r en Metro^).
echo.
echo   Solo si tocaste android/ o instalaste una libreria nativa:
echo       cd frontend  y luego  npm run android
echo.

:fin
pause
exit /b

:preparar_emulador
set "DISPOSITIVO=%~1"
echo         Preparando %DISPOSITIVO% para desarrollo local...
%ADB_CMD% -s %DISPOSITIVO% reverse tcp:8081 tcp:8081
if errorlevel 1 exit /b 1
%ADB_CMD% -s %DISPOSITIVO% reverse tcp:8000 tcp:8000
if errorlevel 1 exit /b 1

REM Staging y debug comparten paquete: que exista no significa que use Metro.
%ADB_CMD% -s %DISPOSITIVO% shell dumpsys package %PAQUETE% | findstr /c:"DEBUGGABLE" >nul
if errorlevel 1 (
    echo         Falta la version de desarrollo. Compilando e instalando debug...
    pushd "%RAIZ%frontend"
    call npm.cmd run android -- --mode debug --device %DISPOSITIVO% --no-packager --active-arch-only
    set "INSTALACION_RESULTADO=!errorlevel!"
    popd
    if not "!INSTALACION_RESULTADO!"=="0" (
        echo   [X] No se pudo instalar la app de desarrollo. Revisa el error anterior.
        exit /b 1
    )
)
echo         Reiniciando la app de desarrollo en %DISPOSITIVO%...
%ADB_CMD% -s %DISPOSITIVO% shell am force-stop %PAQUETE%
if errorlevel 1 exit /b 1
%ADB_CMD% -s %DISPOSITIVO% shell am start -n %PAQUETE%/.MainActivity
exit /b %errorlevel%
