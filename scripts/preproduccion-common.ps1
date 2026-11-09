$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$Docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $Docker) {
    $Docker = @(
        'C:\Program Files\Docker\Docker\resources\bin\docker.exe',
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Docker) { throw 'Instala Docker Desktop y vuelve a ejecutar este script.' }
$env:PATH = "$(Split-Path $Docker);$env:PATH"
$ComposeArgs = @('compose', '--env-file', "$Root\.env.preproduccion", '-f', "$Root\compose.preproduccion.yaml")
function Invoke-Compose {
    & $Docker @ComposeArgs @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose fallo (codigo $LASTEXITCODE)." }
}
