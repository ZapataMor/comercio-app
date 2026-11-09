param(
    [ValidateRange(1, 1000)][int[]]$Users = @(10, 50, 100, 300, 500, 1000),
    [ValidateSet('mixed', 'balanced', 'polling', 'polling-open', 'login')][string]$Profile = 'mixed',
    [string]$Hold = '60s', [string]$Ramp = '15s', [int]$Pause = 3,
    [ValidatePattern('^[a-z0-9-]+$')][string]$Prefix = 'base'
)
. "$PSScriptRoot\scripts\preproduccion-common.ps1"
$LoadArgs = @('compose', '--env-file', "$Root\.env.preproduccion", '-f', "$Root\compose.preproduccion.yaml", '-f', "$Root\compose.carga.yaml", '-p', 'vitrina-carga')
$OutputDir = "$Root\artifacts\carga"
New-Item -ItemType Directory -Force $OutputDir | Out-Null
& $Docker @LoadArgs up -d --no-build --wait --wait-timeout 180
if ($LASTEXITCODE -ne 0) { throw 'Fallo el arranque del entorno independiente de carga.' }
if (-not (Test-Path "$OutputDir\fixtures.json")) {
    & $Docker @LoadArgs exec -T app php /load/fixtures.php
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la preparacion de datos sinteticos.' }
}
& $Docker cp vitrina-carga-https-1:/data/caddy/pki/authorities/local/root.crt "$OutputDir\root.crt"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo exportar la CA de carga.' }
$image = 'grafana/k6@sha256:3e4186aea62e11a45560bfc51e19eeafe82fc07ce069c78aff44b7ff893d9a5e'
$results = @()
$targetIp = (& $Docker inspect vitrina-carga-https-1 --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}').Trim()
foreach ($count in $Users) {
    $name = "$Prefix-$Profile-$count"
    $container = "vitrina-load-$name"
    Write-Host "Iniciando $name"
    & $Docker run -d --name $container --network vitrina-carga_default --cpus 2 --memory 2g --user 0:0 `
        -v "${Root}/load:/scripts:ro" -v "${OutputDir}:/results" `
        -e SSL_CERT_FILE=/results/root.crt -e "TARGET_IP=$targetIp" -e "USERS=$count" -e "PROFILE=$Profile" `
        -e "HOLD=$Hold" -e "RAMP=$Ramp" -e "PAUSE=$Pause" -e "RUN_NAME=$name" `
        $image run --quiet /scripts/scenario.js | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar k6.' }
    $samples = @()
    do {
        $samples += (& $Docker stats --no-stream --format '{{json .}}' vitrina-carga-app-1 vitrina-carga-db-1 vitrina-carga-web-1 vitrina-carga-https-1 $container | ForEach-Object {
            $sample = $_ | ConvertFrom-Json
            $sample | Add-Member -NotePropertyName timeUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -PassThru
        })
        $running = & $Docker inspect $container --format '{{.State.Running}}'
        if ($running -eq 'true') { Start-Sleep -Seconds 3 }
    } while ($running -eq 'true')
    $samples | ConvertTo-Json -Depth 5 | Set-Content "$OutputDir\$name-resources.json"
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Docker logs $container *> "$OutputDir\$name.log"
    } finally { $ErrorActionPreference = $previousErrorAction }
    $exitCode = [int](& $Docker inspect $container --format '{{.State.ExitCode}}')
    $oom = & $Docker inspect $container --format '{{.State.OOMKilled}}'
    $results += [pscustomobject]@{run=$name;users=$count;exitCode=$exitCode;generatorOOM=$oom;timeUtc=[DateTime]::UtcNow.ToString('o')}
    $results | ConvertTo-Json -Depth 4 | Set-Content "$OutputDir\$Prefix-$Profile-runs.json"
    & $Docker rm $container | Out-Null
    Write-Host "Termino $name (codigo $exitCode; 99 indica umbral de rendimiento incumplido)."
    # Recuperacion entre escalones; no seguimos si k6 fallo por infraestructura.
    if ($exitCode -notin @(0, 99, 108)) { throw "Fallo k6 con codigo $exitCode. Consulta $name.log" }
    Start-Sleep -Seconds 10
}
& $Docker @LoadArgs ps
Write-Host "Resultados: $OutputDir"
