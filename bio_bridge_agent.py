import time
import sys
import os
import subprocess
import json

# Configurar salida estándar a UTF-8 para evitar errores de codificación con emojis en Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ELECTRET_PATHS = [
    r"C:\Program Files (x86)\Electret\Electret.exe",
    r"C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico (4)\Electret.exe",
    r"C:\PROGRA~3\SISTEM~1\Electret.exe",
    r"C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico\Electret.exe"
]
ELECTRET_PATH = next((p for p in ELECTRET_PATHS if os.path.exists(p)), ELECTRET_PATHS[0])

def launch_electret_elevated():
    """Lanza Electret.exe utilizando la Tarea Programada de Nivel Más Alto o RunAsInvoker sin UAC"""
    print("🚀 BIO-BRIDGE: Intentando arranque autónomo de Electret...")
    
    # Intento 1: Tarea Programada con Nivel de Ejecución Más Alto (Bypass total de UAC)
    try:
        res = subprocess.run(["schtasks", "/run", "/tn", "TILO_Electret_Launcher"], capture_output=True, text=True)
        if res.returncode == 0:
            print("✅ Tarea Programada 'TILO_Electret_Launcher' ejecutada con éxito.")
            time.sleep(4)
            return True
    except Exception as e:
        print(f"⚠️ schtasks no disponible: {e}")

    # Intento 2: Lanzamiento con capa RunAsInvoker en la sesión actual
    try:
        env = os.environ.copy()
        env["__COMPAT_LAYER"] = "RunAsInvoker"
        workdir = os.path.dirname(ELECTRET_PATH)
        subprocess.Popen([ELECTRET_PATH], cwd=workdir, env=env)
        print(f"✅ Electret lanzado directamente vía RunAsInvoker: {ELECTRET_PATH}")
        time.sleep(5)
        return True
    except Exception as e:
        print(f"🔥 Error al lanzar Electret: {e}")
        return False

def start_scan_sequence(patient_name, patient_age, patient_height, patient_weight):
    print(f"🚀 BIO-BRIDGE: Iniciando secuencia RPA para paciente: {patient_name} (Edad: {patient_age}, Talla: {patient_height}cm, Peso: {patient_weight}kg)...")

    # Verificar si ya está en ejecución
    tasklist = subprocess.run(["tasklist", "/fi", "IMAGENAME eq Electret.exe"], capture_output=True, text=True).stdout
    if "Electret.exe" not in tasklist:
        launch_electret_elevated()
    else:
        print("✅ Proceso Electret.exe ya se encuentra activo en memoria.")

    # Conexión con PyWinAuto
    try:
        from pywinauto.application import Application
        from pywinauto.keyboard import send_keys

        app = Application(backend="win32").connect(path=ELECTRET_PATH)
        dlg = app.top_window()
        dlg.set_focus()
        print(f"🎯 Ventana de Electret enfocada: '{dlg.window_text()}'")

        # Secuencia de nuevo paciente
        print("⌨️  Enviando comando: Nuevo Paciente (^n)...")
        send_keys('^n')
        time.sleep(1)

        # Inyección de datos clínicos del titular
        print(f"✍️  Inyectando datos de {patient_name}...")
        safe_name = patient_name.replace(" ", "{SPACE}")
        send_keys(safe_name)
        send_keys('{TAB}')
        send_keys(str(patient_age))
        send_keys('{TAB}')
        send_keys(str(patient_height))
        send_keys('{TAB}')
        send_keys(str(patient_weight))
        time.sleep(1)

        print("⚡ Secuencia de registro completada. Esperando toma del hardware...")
        return True

    except Exception as rpa_err:
        print(f"⚠️ PyWinAuto no pudo automatizar los controles gráficos ({rpa_err}). Se deja la aplicación en primer plano para interacción.")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].endswith('.json'):
        json_path = sys.argv[1]
        try:
            print(f"🔒 Python Bridge: Cargando JSON de paciente: {json_path}")
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            name = data.get('name', 'Jesus Reyes Salgado')
            age = data.get('age', 60)
            height = data.get('height', 178)
            weight = data.get('weight', 85)
            
            start_scan_sequence(name, age, height, weight)
            
            try:
                os.remove(json_path)
            except:
                pass
        except Exception as e:
            print(f"🔥 Error procesando JSON: {e}")
            sys.exit(1)
    else:
        start_scan_sequence("Jesus Reyes Salgado", 60, 178, 85)
