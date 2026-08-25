
import time
import sys
import os

# Configurar salida estándar a UTF-8 para evitar errores de codificación con emojis en Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from pywinauto.application import Application
from pywinauto.keyboard import send_keys

# CONFIGURACIÓN
# Ajusta esta ruta a donde realmente está el Electret.exe en tu PC
ELECTRET_PATHS = [
    r"C:\Program Files (x86)\Electret\Electret.exe",
    r"C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico (4)\Electret.exe",
    r"C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico\Electret.exe"
]
ELECTRET_PATH = next((p for p in ELECTRET_PATHS if os.path.exists(p)), ELECTRET_PATHS[0])


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
    if len(sys.argv) > 1 and sys.argv[1].endswith('.json'):
        import json
        json_path = sys.argv[1]
        try:
            print(f"🔒 Python Bridge: Cargando JSON de paciente de forma segura desde: {json_path}")
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            name = data.get('name', 'Paciente Demo')
            age = data.get('age', 30)
            height = data.get('height', 170)
            weight = data.get('weight', 70)
            
            start_scan_sequence(name, age, height, weight)
            
            # Intentar eliminar el archivo temporal una vez procesado
            try:
                os.remove(json_path)
                print(f"🧹 Archivo temporal removido: {json_path}")
            except Exception as e:
                print(f"⚠️ No se pudo remover archivo temporal: {e}")
        except Exception as e:
            print(f"🔥 Error al procesar el JSON: {e}")
            sys.exit(1)
    else:
        # Prueba manual
        start_scan_sequence("Test User", 30, 175, 75)
