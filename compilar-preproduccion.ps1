param([switch]$Install, [string]$Device = '', [string]$Architectures = 'arm64-v8a,x86_64')
. "$PSScriptRoot\scripts\preproduccion-common.ps1"
$raw = "$Root\frontend\android\app\src\staging\res\raw"
New-Item -ItemType Directory -Force $raw | Out-Null
Invoke-Compose cp https:/data/caddy/pki/authorities/local/root.crt "$raw\staging_ca.crt"
Push-Location "$Root\frontend\android"
try {
    & .\gradlew.bat assembleStaging "-PreactNativeArchitectures=$Architectures" --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion Android staging.' }
} finally { Pop-Location }
$apk = "$Root\frontend\android\app\build\outputs\apk\staging\app-staging.apk"
New-Item -ItemType Directory -Force "$Root\artifacts" | Out-Null
Copy-Item $apk "$Root\artifacts\vitrina-preproduccion.apk" -Force
if ($Install) {
    $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    if ($env:ANDROID_HOME) { $adb = "$env:ANDROID_HOME\platform-tools\adb.exe" }
    $deviceArgs = @()
    if ($Device) { $deviceArgs = @('-s', $Device) }
    & $adb @deviceArgs reverse tcp:8443 tcp:8443
    if ($LASTEXITCODE -ne 0) { throw 'Conecta un dispositivo o inicia un emulador. Usa -Device si hay varios.' }
    & $adb @deviceArgs install -r "$Root\artifacts\vitrina-preproduccion.apk"
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la instalacion de la APK.' }
    & $adb @deviceArgs shell am start -n com.comercioapp/.MainActivity
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo abrir la app.' }
}
Write-Host "APK: $Root\artifacts\vitrina-preproduccion.apk"
