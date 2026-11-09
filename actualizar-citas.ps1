param([string]$Device = '', [string]$Architectures = 'arm64-v8a,x86_64')
$ErrorActionPreference = 'Stop'

# Actualiza el entorno local existente sin volver a sembrar datos de demostración.
& "$PSScriptRoot\iniciar-preproduccion.ps1"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar el backend de pruebas.' }

# La aplicación incluye el JavaScript nuevo: instalarla reemplaza la compilación anterior.
& "$PSScriptRoot\compilar-preproduccion.ps1" -Install -Device $Device -Architectures $Architectures
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar la aplicación actualizada.' }

Write-Host 'Citas y almuerzo listos. Configura el horario en Mi Tienda y abre Agenda de citas.'
