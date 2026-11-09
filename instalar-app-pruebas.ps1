param([string]$Device = '')
$ErrorActionPreference = 'Stop'
$apk = Join-Path $PSScriptRoot 'artifacts\vitrina-preproduccion.apk'
if (-not (Test-Path -LiteralPath $apk)) { throw 'Primero compila la aplicación de pruebas.' }
$adb = (Get-Command adb.exe -ErrorAction SilentlyContinue).Source
if (-not $adb) { $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" }
if ($env:ANDROID_HOME) { $adb = "$env:ANDROID_HOME\platform-tools\adb.exe" }

$salida = @(& $adb devices)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar ADB. Comprueba que Android Studio esté abierto.' }
$dispositivos = @($salida | ForEach-Object {
    if ($_ -match '^(\S+)\s+device\s*$') { $Matches[1] }
})
if ($Device) {
    if ($Device -notin $dispositivos) { throw "El dispositivo '$Device' no está conectado o autorizado." }
} else {
    $emuladores = @($dispositivos | Where-Object { $_ -match '^emulator-' })
    if ($emuladores.Count -eq 1) { $Device = $emuladores[0] }
    elseif ($dispositivos.Count -eq 1) { $Device = $dispositivos[0] }
    elseif ($dispositivos.Count -eq 0) { throw 'No hay dispositivos autorizados. Abre el emulador y vuelve a ejecutar este comando.' }
    else { throw "Hay varios dispositivos. Ejecuta con -Device seguido del identificador elegido: $($dispositivos -join ', ')" }
}

Write-Host "Instalando la aplicación compilada en $Device..."
& $adb -s $Device reverse tcp:8443 tcp:8443
if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar el dispositivo con el servidor de pruebas.' }
& $adb -s $Device install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar la aplicación.' }
& $adb -s $Device shell am force-stop com.comercioapp
if ($LASTEXITCODE -ne 0) { throw 'No se pudo cerrar la aplicación anterior.' }
& $adb -s $Device shell am start -n com.comercioapp/.MainActivity
if ($LASTEXITCODE -ne 0) { throw 'No se pudo abrir la aplicación actualizada.' }
Write-Host 'Aplicación actualizada y abierta.'
