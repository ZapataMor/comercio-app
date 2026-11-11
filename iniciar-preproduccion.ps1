param([switch]$Demo, [switch]$TrustCertificate, [switch]$Firebase)
. "$PSScriptRoot\scripts\preproduccion-common.ps1"

function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    [Convert]::ToBase64String($bytes)
}

if (-not (Test-Path "$Root\.env.preproduccion")) {
    $content = @(
        "APP_KEY=base64:$(New-Secret)",
        "DB_PASSWORD=$(New-Secret)",
        "DB_ROOT_PASSWORD=$(New-Secret)",
        'APP_URL=https://localhost:8443',
        'HTTPS_PORT=8443',
        'MAIL_UI_PORT=8025',
        "REVERB_APP_SECRET=$(New-Secret)"
    ) -join "`n"
    [IO.File]::WriteAllText("$Root\.env.preproduccion", $content + "`n")
}
# Entornos creados antes de los cambios en vivo: se agrega la clave de Reverb.
if (-not (Select-String -Path "$Root\.env.preproduccion" -Pattern '^REVERB_APP_SECRET=.+' -Quiet)) {
    $lines = @(Get-Content "$Root\.env.preproduccion" | Where-Object { $_ -notmatch '^REVERB_APP_SECRET=' })
    $lines += "REVERB_APP_SECRET=$(New-Secret)"
    [IO.File]::WriteAllText("$Root\.env.preproduccion", ($lines -join "`n") + "`n")
}
if ($Firebase) {
    $project = (Get-Content "$Root\frontend\android\app\google-services.json" -Raw | ConvertFrom-Json).project_info.project_id
    $credentials = @(Get-ChildItem "$Root\backend\storage\app\firebase" -Filter *.json | Where-Object {
        $account = Get-Content $_.FullName -Raw | ConvertFrom-Json
        $account.type -eq 'service_account' -and $account.project_id -eq $project
    })
    if ($credentials.Count -ne 1) { throw 'Se necesita exactamente una cuenta de servicio Firebase compatible en backend/storage/app/firebase.' }
    $name = $credentials[0].Name
    if ($name -notmatch '^[a-zA-Z0-9._-]+\.json$') { throw 'El nombre del archivo Firebase contiene caracteres no validos.' }
    $lines = @(Get-Content "$Root\.env.preproduccion" | Where-Object { $_ -notmatch '^FIREBASE_CREDENTIALS=' })
    $lines += "FIREBASE_CREDENTIALS=/run/firebase/$name"
    [IO.File]::WriteAllText("$Root\.env.preproduccion", ($lines -join "`n") + "`n")
    Write-Host 'Firebase habilitado con la cuenta local compatible (montada solo para lectura).'
}
& $Docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Abre Docker Desktop y espera a que el motor este listo.' }
Invoke-Compose config --quiet
Invoke-Compose build app web
Invoke-Compose up -d --no-build --wait --wait-timeout 240
if ($Demo) {
    Invoke-Compose exec -T app php artisan db:seed --force
    & "$Root\sincronizar-imagenes-demo.ps1"
}
New-Item -ItemType Directory -Force "$Root\artifacts" | Out-Null
Invoke-Compose cp https:/data/caddy/pki/authorities/local/root.crt "$Root\artifacts\preproduccion-ca.crt"
$url = ((Get-Content "$Root\.env.preproduccion" | Where-Object { $_ -match '^APP_URL=' } | Select-Object -First 1) -replace '^APP_URL=', '').TrimEnd('/')
& curl.exe --silent --show-error --fail --retry 15 --retry-all-errors --retry-delay 2 --ssl-revoke-best-effort --cacert "$Root\artifacts\preproduccion-ca.crt" --output NUL "$url/up"
if ($LASTEXITCODE -ne 0) { throw 'El servidor HTTPS no supero la comprobacion de salud.' }
if ($TrustCertificate) {
    Import-Certificate -FilePath "$Root\artifacts\preproduccion-ca.crt" -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    Write-Host 'CA de preproduccion instalada para el usuario actual de Windows.'
}
Write-Host 'API y panel: https://localhost:8443'
Write-Host 'Correos de prueba: http://localhost:8025'
Write-Host 'CA local: artifacts/preproduccion-ca.crt (incluida en la APK staging para localhost).'
