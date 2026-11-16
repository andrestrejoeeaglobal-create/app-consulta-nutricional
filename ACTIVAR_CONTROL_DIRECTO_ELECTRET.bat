@echo off
title T.I.L.O. - Activador de Permisos Autonomos para Escaner Bioelectrico
color 0b

:: 1. Auto-elevacion con UAC de Windows
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando permisos de administrador de Windows...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo   ECOSISTEMA T.I.L.O. - CONFIGURACION DE CONTROL DIRECTO DE HARDWARE
echo ======================================================================
echo.
echo [1/3] Configurando capa de compatibilidad sin bloqueo UAC en Registro...
powershell -Command "Set-ItemProperty -Path 'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers' -Name 'C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico (4)\Electret.exe' -Value '~ TRANSFORMLEGACYCOLORMANAGED ARM64MISCLIGHTWEIGHTFIXES ARM64FASTSELFMODDISABLED ARM64INTERNALSELFMODRESTRICTED ARM64CHPEDISABLED ARM64JITCACHEDISABLED DISABLEDXMAXIMIZEDWINDOWEDMODE RunAsInvoker ARM64SINGLECORESPECIFIC WIN8RTM' -ErrorAction SilentlyContinue"

echo [2/3] Registrando Tarea Programada de Alta Prioridad 'TILO_Electret_Launcher'...
schtasks /create /tn "TILO_Electret_Launcher" /tr "\"C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico (4)\Electret.exe\"" /sc ONCE /st 00:00 /rl HIGHEST /f

echo.
echo [3/3] Verificando tarea registrada:
schtasks /query /tn "TILO_Electret_Launcher"

echo.
echo ======================================================================
echo   LISTO! AHORA T.I.L.O. PUEDE ARRANCAR EL HARDWARE DE FORMA 100%% AUTONOMA
echo   SIN VOLVER A PEDIR CONFIRMACIONES DE UAC.
echo ======================================================================
echo.
timeout /t 5
