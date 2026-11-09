# Conecta e instala la APK staging en todos los emuladores ya abiertos.
$ErrorActionPreference = 'Stop'
$rootDir = $PSScriptRoot
$sdkDir = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adbPath = Join-Path $sdkDir 'platform-tools\adb.exe'
if (-not (Test-Path $adbPath)) { throw 'No se encuentra ADB. Revisa ANDROID_HOME o instala Android SDK.' }

$devices = @(& $adbPath devices | Where-Object { $_ -match '^(emulator-\d+)\s+device\s*$' } | ForEach-Object { ($_ -split '\s+')[0] })
if ($devices.Count -eq 0) { throw 'Abre al menos un emulador y espera a que termine de arrancar.' }
$apkPath = Join-Path $rootDir 'artifacts\vitrina-preproduccion.apk'
if (-not (Test-Path $apkPath)) {
    & "$rootDir\compilar-preproduccion.ps1" -Architectures x86_64
}
if (-not (Test-Path $apkPath)) { throw 'No se encontro la APK de preproduccion.' }

& curl.exe --silent --show-error --fail --ssl-revoke-best-effort --cacert "$rootDir\artifacts\preproduccion-ca.crt" --output NUL 'https://localhost:8443/up'
if ($LASTEXITCODE -ne 0) { throw 'La API no esta disponible. Ejecuta primero iniciar-preproduccion.ps1.' }

foreach ($device in $devices) {
    Write-Host "Preparando $device..."
    & $adbPath -s $device reverse tcp:8443 tcp:8443
    if ($LASTEXITCODE -ne 0) { throw "No se pudo conectar $device con la API." }
    & $adbPath -s $device install -r $apkPath
    if ($LASTEXITCODE -ne 0) { throw "No se pudo instalar la APK en $device. Consulta el error de Android; no se borraron datos automaticamente." }
    # Reinicia el proceso para que use la APK instalada, conservando la sesion.
    & $adbPath -s $device shell am force-stop com.comercioapp
    & $adbPath -s $device shell am start -n com.comercioapp/.MainActivity
    if ($LASTEXITCODE -ne 0) { throw "No se pudo abrir la app en $device." }
}
Write-Host "Vitrina Pruebas abierta en $($devices.Count) emulador(es), conectada a https://localhost:8443."
Write-Host 'Cuentas demo: cliente@demo.co, comerciante@demo.co, domiciliario@demo.co. Clave: password123.'
