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
#
# Tambien repone la zona horaria: el emulador no sabe traducir la de Windows
# ("SA Pacific Standard Time" -> vendor.qemu.timezone=Unknown/Unknown) y tras un
# arranque en frio queda en GMT. El modo dia/noche de la app depende de esa hora.

$ErrorActionPreference = 'Continue'
$puertos = @(8081, 8000, 8080)
$zona = 'America/Bogota'

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

function Obtener-Rol([string]$d) {
    $rol = (& $Adb -s $d emu avd name 2>$null | Select-Object -First 1)
    if ($rol) { $rol.Trim() } else { '' }
}

function Revisar-Emuladores {
    $dispositivos = @(& $Adb devices 2>$null |
        Where-Object { $_ -match '^(emulator-\d+)\s+device\s*$' } |
        ForEach-Object { ($_ -split '\s+')[0] })

    foreach ($d in $dispositivos) {
        # Solo con el arranque terminado: antes, "cmd alarm" aun no existe.
        $estado = @(& $Adb -s $d shell 'getprop sys.boot_completed; getprop persist.sys.timezone' 2>$null)
        if ($estado.Count -ge 2 -and "$($estado[0])".Trim() -eq '1' -and "$($estado[1])".Trim() -ne $zona) {
            & $Adb -s $d shell settings put global auto_time_zone 0 *> $null
            & $Adb -s $d shell cmd alarm set-timezone $zona *> $null
            Write-Host ("[{0}] {1} {2} -> zona {3} (estaba en {4})" -f (Get-Date -Format 'HH:mm:ss'), $d, (Obtener-Rol $d), $zona, "$($estado[1])".Trim())
        }

        $lista = (& $Adb -s $d reverse --list 2>$null) -join "`n"
        $faltan = @($puertos | Where-Object { $lista -notmatch "tcp:$_ tcp:$_" })
        if ($faltan.Count -eq 0) { continue }

        foreach ($p in $faltan) { & $Adb -s $d reverse "tcp:$p" "tcp:$p" *> $null }
        Write-Host ("[{0}] {1} {2} -> reverse {3}" -f (Get-Date -Format 'HH:mm:ss'), $d, (Obtener-Rol $d), ($faltan -join ', '))
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
