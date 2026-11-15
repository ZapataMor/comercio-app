[CmdletBinding()]
param(
    [string]$Adb,
    [int]$IntervaloSegundos = 5,
    # Revisar una sola vez y salir (para arreglar a mano sin dejar la ventana abierta).
    [switch]$UnaVez
)

# Mantiene el adb reverse de desarrollo en TODOS los emuladores encendidos.
# adb reverse es por emulador y se pierde al reiniciarlo o al abrirlo despues del
# lanzador; sin el, la app dice "No se pudo conectar con el servidor".
# 8081 = Metro, 8000 = API Laravel, 8080 = Reverb (cambios en vivo).

$ErrorActionPreference = 'Continue'
$puertos = @(8081, 8000, 8080)

if (-not $Adb) {
    $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    $Adb = Join-Path $sdk 'platform-tools\adb.exe'
}
if (-not (Test-Path $Adb)) { throw "No encuentro ADB en $Adb" }

if (-not $UnaVez) {
    # Un solo vigilante aunque el lanzador se ejecute varias veces.
    $nuevo = $false
    $mutex = New-Object System.Threading.Mutex($true, 'Local\comercio-app-vigilar-emuladores', [ref]$nuevo)
    if (-not $nuevo) {
        Write-Host 'Ya hay otro vigilante de emuladores abierto. Cerrando este.'
        Start-Sleep -Seconds 3
        exit 0
    }
    $Host.UI.RawUI.WindowTitle = 'Emuladores - adb reverse'
    Write-Host "Vigilando emuladores cada $IntervaloSegundos s (puertos $($puertos -join ', ')). Deja esta ventana abierta."
}

function Revisar-Emuladores {
    $dispositivos = @(& $Adb devices 2>$null |
        Where-Object { $_ -match '^(emulator-\d+)\s+device\s*$' } |
        ForEach-Object { ($_ -split '\s+')[0] })

    foreach ($d in $dispositivos) {
        $lista = (& $Adb -s $d reverse --list 2>$null) -join "`n"
        $faltan = @($puertos | Where-Object { $lista -notmatch "tcp:$_ tcp:$_" })
        if ($faltan.Count -eq 0) { continue }

        $rol = (& $Adb -s $d emu avd name 2>$null | Select-Object -First 1)
        if ($rol) { $rol = $rol.Trim() }
        foreach ($p in $faltan) { & $Adb -s $d reverse "tcp:$p" "tcp:$p" *> $null }
        Write-Host ("[{0}] {1} {2} -> reverse {3}" -f (Get-Date -Format 'HH:mm:ss'), $d, $rol, ($faltan -join ', '))
    }
}

if ($UnaVez) {
    Revisar-Emuladores
    exit 0
}

while ($true) {
    Revisar-Emuladores
    Start-Sleep -Seconds $IntervaloSegundos
}
