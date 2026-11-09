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
    & "$Root\instalar-app-pruebas.ps1" -Device $Device
}
Write-Host "APK: $Root\artifacts\vitrina-preproduccion.apk"
