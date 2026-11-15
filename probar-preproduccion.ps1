param([switch]$SkipUnitTests)
. "$PSScriptRoot\scripts\preproduccion-common.ps1"
if (-not $SkipUnitTests) {
    Invoke-Compose --profile test build tests
    Invoke-Compose --profile test run --rm --no-deps tests
    try {
        Invoke-Compose --profile test run --rm tests-mysql
    } finally {
        Invoke-Compose --profile test stop db-tests
    }
    Push-Location "$Root\frontend"
    try {
        & npm.cmd test -- --runInBand --silent --testTimeout=30000
        if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas de React Native.' }
        & npx.cmd tsc --noEmit
        if ($LASTEXITCODE -ne 0) { throw 'Fallo la comprobacion TypeScript.' }
    } finally { Pop-Location }
}

# curl valida HTTPS contra nuestra CA; no se desactiva la verificacion TLS.
$BaseUrl = 'https://localhost:8443'
$configuredUrl = Get-Content "$Root\.env.preproduccion" | Where-Object { $_ -match '^APP_URL=' } | Select-Object -First 1
if ($configuredUrl) { $BaseUrl = $configuredUrl.Substring(8).TrimEnd('/') }
$Ca = "$Root\artifacts\preproduccion-ca.crt"
function Invoke-Api([string]$Path, [string]$Method = 'GET', [object]$Body = $null, [string]$Token = '', [int]$Status = 200, [switch]$Text) {
    # La CA local no publica CRL/OCSP. Schannel valida cadena y nombre, y
    # comprueba revocacion cuando hay un punto de distribucion disponible.
    $curlArgs = @('--silent', '--show-error', '--ssl-revoke-best-effort', '--cacert', $Ca, '--write-out', "`n%{http_code}", '-X', $Method, '-H', 'Accept: application/json')
    if ($Token) { $curlArgs += @('-H', "Authorization: Bearer $Token") }
    # El JSON va en un archivo UTF-8 sin BOM: por tuberia, PowerShell le antepone
    # el BOM (segun el perfil) y Laravel recibe el cuerpo vacio.
    $bodyFile = $null
    if ($null -ne $Body) {
        $bodyFile = Join-Path $env:TEMP "vitrina-api-$([Guid]::NewGuid().ToString('N')).json"
        [IO.File]::WriteAllText($bodyFile, ($Body | ConvertTo-Json -Depth 10 -Compress), (New-Object System.Text.UTF8Encoding $false))
        $curlArgs += @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
    }
    $curlArgs += "$BaseUrl$Path"
    try { $result = & curl.exe @curlArgs } finally { if ($bodyFile) { Remove-Item $bodyFile -ErrorAction SilentlyContinue } }
    if ($LASTEXITCODE -ne 0) { throw "Fallo HTTPS: $Path" }
    $lines = @($result)
    if ([int]$lines[-1] -ne $Status) { throw "${Method} ${Path}: esperado $Status, obtenido $($lines[-1]). $($lines[0])" }
    Write-Host "OK $Method $Path ($Status)"
    $json = ($lines[0..($lines.Count - 2)] -join "`n")
    if ($json -and -not $Text) { $json | ConvertFrom-Json }
}
Invoke-Api /up -Text | Out-Null
Invoke-Api /api/barrios | Out-Null
Invoke-Api /api/user -Status 401 | Out-Null
Invoke-Api /api/login POST @{email='inexistente@staging.example';password='incorrecta'} -Status 422 | Out-Null

# Crea una cuenta temporal en la BD de staging y la elimina al terminar.
$email = "smoke-$([Guid]::NewGuid().ToString('N'))@staging.example"
$password = "Smoke-$([Guid]::NewGuid().ToString('N'))"
# El registro exige confirmar el celular: en staging (WHATSAPP_DRIVER=log) el codigo sale en el log de la app.
$telefono = '30' + (Get-Random -Minimum 10000000 -Maximum 99999999)
Invoke-Api /api/telefono/codigo POST @{telefono=$telefono} | Out-Null
$codigo = $null
for ($attempt = 0; $attempt -lt 10 -and -not $codigo; $attempt++) {
    $logs = Invoke-Compose logs --since 2m app 2>&1 | Out-String
    $match = [regex]::Matches($logs, "C.digo para $telefono`: (\d{6})") | Select-Object -Last 1
    if ($match) { $codigo = $match.Groups[1].Value } else { Start-Sleep -Seconds 1 }
}
if (-not $codigo) { throw 'No aparecio el codigo de WhatsApp de prueba en el log de la app.' }
$verificacion = (Invoke-Api /api/telefono/verificar POST @{telefono=$telefono;codigo=$codigo}).verificacion
$registered = Invoke-Api /api/register POST @{name='Prueba';apellidos='Preproduccion';email=$email;password=$password;password_confirmation=$password;direccion='Calle 1 # 2-3';barrio='Centro';telefono=$telefono;verificacion=$verificacion;acepta_terminos=$true} -Status 201
$token = $registered.token
if (-not $token) { throw 'El registro no devolvio un token.' }
try {
    $login = Invoke-Api /api/login POST @{email=$email;password=$password}
    Invoke-Api /api/user -Token $token | Out-Null
    Invoke-Api /api/dashboard -Token $token | Out-Null
    Invoke-Api /api/negocios -Token $token | Out-Null
    # Propiedades: listado, mapa, publicar con una foto, sumar otra de a una y borrar.
    Invoke-Api /api/propiedades -Token $token | Out-Null
    Invoke-Api /api/propiedades/mapa -Token $token | Out-Null
    $foto = Join-Path $env:TEMP "vitrina-smoke-$([Guid]::NewGuid().ToString('N')).png"
    [IO.File]::WriteAllBytes($foto, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGN8tkCDARtgwio6aCUAVGkBvvkFvtIAAAAASUVORK5CYII='))
    try {
        $multipart = @('--silent', '--show-error', '--ssl-revoke-best-effort', '--cacert', $Ca, '-H', 'Accept: application/json', '-H', "Authorization: Bearer $token")
        $creada = & curl.exe @multipart -F tipo=eventos -F 'titulo=Patio smoke' -F 'descripcion=Prueba de preproduccion' -F precio=500000 -F 'direccion=Calle 1 # 2-3' -F barrio=Centro -F lat=11.38 -F lng=-72.24 -F capacidad=50 -F 'contacto_nombre=Prueba' -F contacto_telefono=3001112233 -F "imagenes[0]=@$foto;type=image/png" "$BaseUrl/api/propiedades" | ConvertFrom-Json
        if (-not $creada.propiedad.id) { throw "POST /api/propiedades no creo la propiedad: $($creada | ConvertTo-Json -Compress)" }
        Write-Host 'OK POST /api/propiedades (201)'
        $conFoto = & curl.exe @multipart -F "foto=@$foto;type=image/png" "$BaseUrl/api/propiedades/$($creada.propiedad.id)/fotos" | ConvertFrom-Json
        if (@($conFoto.propiedad.galeria).Count -ne 2) { throw 'POST /api/propiedades/{id}/fotos no sumo la foto.' }
        Write-Host 'OK POST /api/propiedades/{id}/fotos (200)'
        Invoke-Api "/api/propiedades/$($creada.propiedad.id)" -Token $token | Out-Null
        Invoke-Api "/api/propiedades/$($creada.propiedad.id)" DELETE -Token $token | Out-Null
    } finally { Remove-Item $foto -ErrorAction SilentlyContinue }
    Invoke-Api /api/password/codigo POST @{email=$email} | Out-Null
    Start-Sleep -Seconds 2
    $mail = Invoke-RestMethod 'http://localhost:8025/api/v1/messages'
    if (-not ($mail.messages | Where-Object { @($_.To | ForEach-Object { $_.Address }) -contains $email })) { throw 'No llego el correo de recuperacion a Mailpit.' }
    Write-Host 'OK correo de recuperacion recibido en Mailpit'
    $queueSubject = "Cola preproduccion $([Guid]::NewGuid().ToString('N'))"
    $queueCommand = "Illuminate\Support\Facades\Mail::to('$email')->queue((new Illuminate\Mail\Mailable)->subject('$queueSubject')->html('Prueba del trabajador de cola.'));"
    Invoke-Compose exec -T -e XDG_CONFIG_HOME=/tmp/psysh app php artisan tinker --execute=$queueCommand
    $received = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $mail = Invoke-RestMethod 'http://localhost:8025/api/v1/messages'
        if ($mail.messages | Where-Object { $_.Subject -eq $queueSubject }) { $received = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $received) { throw 'El trabajador no proceso el correo encolado en 20 segundos.' }
    Write-Host 'OK trabajador de cola envio el correo a Mailpit'
    Invoke-Api /api/logout POST -Token $login.token | Out-Null
    Invoke-Api /api/user -Token $login.token -Status 401 | Out-Null
} finally {
    Invoke-Api /api/cuenta DELETE @{password=$password} -Token $token | Out-Null
}
Invoke-Compose exec -T app php artisan schedule:list
Invoke-Compose exec -T app php artisan queue:failed
Invoke-Compose ps
Write-Host 'Pruebas de preproduccion completadas.'
