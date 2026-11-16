# Script de Elevación Unificada para Ecosistema T.I.L.O.
# Configura el lanzamiento autónomo de Electret sin bloqueos de UAC

$ErrorActionPreference = "Stop"

Write-Host "⚡ Configurando permisos y bypass de elevacion UAC para Electret.exe..." -ForegroundColor Cyan

# 1. Modificar capa de compatibilidad en HKLM
$hklmPath = "HKLM:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers"
$regName = "C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico (4)\Electret.exe"

try {
    $currentVal = (Get-ItemProperty -Path $hklmPath -Name $regName -ErrorAction SilentlyContinue).$regName
    if ($currentVal) {
        $newVal = $currentVal -replace "\bRUNASADMIN\b", "RunAsInvoker"
        Set-ItemProperty -Path $hklmPath -Name $regName -Value $newVal
        Write-Host "✅ HKLM AppCompatFlags actualizado a RunAsInvoker." -ForegroundColor Green
    }
} catch {
    Write-Warning "No se pudo actualizar HKLM directamente: $_"
}

# 2. Registrar Tarea Programada con Nivel de Ejecución Más Alto (HighestAvailable)
try {
    $action = New-ScheduledTaskAction -Execute $regName -WorkingDirectory "C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico (4)"
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    Register-ScheduledTask -TaskName "TILO_Electret_Launcher" -Action $action -Principal $principal -Settings $settings -Force
    Write-Host "✅ Tarea Programada 'TILO_Electret_Launcher' registrada con exito (RunLevel: Highest)." -ForegroundColor Green
} catch {
    Write-Warning "Fallo al registrar la tarea programada: $_"
}

Write-Host "🎉 Configuracion completada. Ahora T.I.L.O. puede ejecutar Electret.exe de forma 100% autonoma." -ForegroundColor Cyan
Start-Sleep -Seconds 2
