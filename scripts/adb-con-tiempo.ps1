[CmdletBinding(PositionalBinding = $false)]
param(
    [Parameter(Mandatory = $true)][string]$Adb,
    [int]$TimeoutSeconds = 20,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$AdbArguments
)

# No dejar el lanzador esperando indefinidamente a un servidor ADB bloqueado.
$ErrorActionPreference = 'Stop'
$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = $Adb
$process.StartInfo.Arguments = $AdbArguments -join ' '
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.CreateNoWindow = $true
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
try {
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        $process.Kill()
        [Console]::Error.WriteLine("ADB no respondio en $TimeoutSeconds segundos: $($AdbArguments -join ' ')")
        [Console]::Error.WriteLine('Cierra otros comandos ADB y ejecuta: taskkill /F /IM adb.exe')
        [Console]::Error.WriteLine('Despues vuelve a ejecutar iniciar-emulador.bat.')
        exit 124
    }
    [Console]::Out.Write($stdout.GetAwaiter().GetResult())
    [Console]::Error.Write($stderr.GetAwaiter().GetResult())
    exit $process.ExitCode
} finally {
    $process.Dispose()
}
