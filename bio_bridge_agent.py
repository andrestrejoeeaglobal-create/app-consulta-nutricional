
import time
import sys
import os
from pywinauto.application import Application
from pywinauto.keyboard import send_keys

# CONFIGURACIÓN
# Ajusta esta ruta a donde realmente está el Electret.exe en tu PC
ELECTRET_PATH = r"C:\Program Files (x86)\Electret\Electret.exe" 

def start_scan_sequence(patient_name, patient_age, patient_height, patient_weight):
    print(f"🚀 BIO-BRIDGE: Iniciando secuencia para {patient_name}...")

    # 1. ABRIR / CONECTAR A LA APP
    try:
        app = Application(backend="win32").connect(path=ELECTRET_PATH)
        print("✅ Aplicación ya estaba abierta. Conectado.")
    except:
        print("⚠️ Aplicación cerrada. Iniciando...")
        app = Application(backend="win32").start(ELECTRET_PATH)
        time.sleep(5) # Esperar carga

    # Obtener ventana principal (El título varía, ajustar con Spy++)
    dlg = app.window(title_re=".*Electret.*") 
    dlg.set_focus()

    # 2. NAVEGACIÓN (RPA - Ajustar según atajos de teclado del programa)
    # Ejemplo: Si Ctrl+N abre nuevo paciente
    print("⌨️  Enviando comando: Nuevo Paciente")
    send_keys('^n') 
    time.sleep(1)

    # 3. INYECCIÓN DE DATOS
    # Esto depende de los campos. Ejemplo genérico:
    print(f"✍️  Escribiendo datos: {patient_name}")
    send_keys(patient_name.replace(" ", "{SPACE}"))
    send_keys('{TAB}')
    send_keys(str(patient_age))
    send_keys('{TAB}')
    send_keys(str(patient_height))
    send_keys('{TAB}')
    send_keys(str(patient_weight))
    
    # 4. DISPARAR ESCANEO
    print("⚡ ACTIVANDO SENSOR...")
    # Opción A: Atajo de teclado (Ej: F5)
    # send_keys('{F5}') 
    # Opción B: Clic en botón (Requiere mapeo de ID)
    # dlg.Button_Start.click()
    
    print("✅ Secuencia de inicio completada. Esperando hardware...")

if __name__ == "__main__":
    # Prueba manual
    start_scan_sequence("Test User", 30, 175, 75)
