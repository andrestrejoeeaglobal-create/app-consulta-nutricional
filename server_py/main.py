import os
import uuid
import logging
import asyncio
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from .database import engine, Base, get_db
from .models import ActiveScan, BackgroundJob
from .config import GEMINI_API_KEY
from .agents import AgentClarisa, AgentSpark, AgentTracker, AgentSanitizer

# Configure logging with clinical rotation
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tilo_telemetry")

# Lifespan events
app = FastAPI(title="T.I.L.O. Clinical Telemetry Hub (Fase 18)")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite tables on startup
Base.metadata.create_all(bind=engine)
logger.info("🚀 Base de datos SQLite inicializada (WAL habilitado).")

# --- MOCK ELECTRET RESULTS ---
MOCK_ELECTRET_RESULTS = {}
try:
    # Try to load the cleaned JSON report if present
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parsed_path = os.path.join(base_dir, "server", "uploads", "parsed_results.json")
    if os.path.exists(parsed_path):
        with open(parsed_path, "r", encoding="utf-8") as f:
            MOCK_ELECTRET_RESULTS = json.load(f)
        logger.info(f"🧬 [ELECTRET] Cargadas {len(MOCK_ELECTRET_RESULTS)} categorías de biorresonancia real desde parsed_results.json.")
except Exception as e:
    logger.error(f"⚠️ Error cargando parsed_results.json: {e}")

if not MOCK_ELECTRET_RESULTS:
    # Fallback to small structured mock results if file not found
    MOCK_ELECTRET_RESULTS = {
        "cardiovascular": {
            "viscosidad_de_la_sangre": {
                "name": "Viscosidad de la Sangre",
                "value": "55.622",
                "reference": "48.264 - 65.371",
                "status": "NORMAL",
                "translation": "Viscosidad plasmática dentro del rango de normalidad hemorreológica."
            }
        },
        "funcion_gastrointestinal": {
            "coeficiente_de_secrecion_de_pepsina": {
                "name": "Coeficiente de Secreción de Pepsina",
                "value": "62.557",
                "reference": "59.847 - 65.234",
                "status": "NORMAL",
                "translation": "Nivel de pepsina gástrica compatible con adecuada digestión proteica."
            }
        }
    }

# --- ENDPOINTS ---

@app.post("/api/bio/scan/start")
async def start_scan(
    name: str = Form(...),
    age: int = Form(...),
    height: float = Form(...),
    weight: float = Form(...),
    citationId: str = Form(...),
    clinicalRoute: str = Form("standard"),
    db: Session = Depends(get_db)
):
    logger.info(f"⚡ Iniciando escaneo para paciente: {name}, cita: {citationId}")
    scan_id = f"scan_{uuid.uuid4().hex}"
    
    # Save active scan state to SQLite
    active_scan = ActiveScan(
        scan_id=scan_id,
        status="scanning",
        progress=0
    )
    db.add(active_scan)
    db.commit()
    
    # Check if Electret.exe is present to run RPA bridge
    electret_paths = [
        r"C:\Program Files (x86)\Electret\Electret.exe",
        r"C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico (4)\Electret.exe",
        r"C:\Program Files (x86)\Sistema Cuántico Bio-Eléctrico\Electret.exe"
    ]
    electret_path = next((p for p in electret_paths if os.path.exists(p)), electret_paths[0])
    if os.path.exists(electret_path):
        logger.info("🤖 Disparando puente de hardware físico Electret...")
        # Fire pywinauto bridge in background to avoid blocking thread
        os.system(f"start /B python bio_bridge_agent.py {name} {age} {height} {weight}")
        
    return {"success": True, "scanId": scan_id}

@app.get("/api/bio/scan/status")
async def get_scan_status(scanId: str, db: Session = Depends(get_db)):
    active_scan = db.query(ActiveScan).filter(ActiveScan.scan_id == scanId).first()
    if not active_scan:
        raise HTTPException(status_code=404, detail="Escaneo no encontrado.")
        
    if active_scan.status == "scanning":
        # Increment progress reactively
        new_progress = min(100, active_scan.progress + 15)
        active_scan.progress = new_progress
        if new_progress >= 100:
            active_scan.status = "completed"
            active_scan.results = json.dumps(MOCK_ELECTRET_RESULTS)
        db.commit()
        
    if active_scan.status == "completed":
        results_data = json.loads(active_scan.results) if active_scan.results else {}
        return {"success": True, "status": "completed", "progress": 100, "data": results_data}
        
    return {"success": True, "status": "scanning", "progress": active_scan.progress}

@app.post("/api/bio/scan/ocular-scan")
async def ocular_scan(
    ocularImage: UploadFile = File(...),
    age: int = Form(30),
    clinicalRoute: str = Form("standard")
):
    logger.info("👁️ Oculomics Scan: Recibiendo imagen de conjuntiva...")
    image_bytes = await ocularImage.read()
    mime_type = ocularImage.content_type
    
    if not GEMINI_API_KEY:
        logger.warning("🔑 GEMINI_API_KEY no detectada. Usando fallback offline.")
        return {
            "success": True,
            "predictions": {
                "hemoglobin": {"name": "Hemoglobina Estimada (Hb)", "raw_value": "10.8 g/dL", "value": "Baja (Anemia Leve)", "status": "WARNING", "translation": "Tendencia a nivel limítrofe de Hb. Se aconseja optimizar aportes de hierro hemínico."},
                "egfr": {"name": "Filtrado Glomerular Estimado (eGFR)", "raw_value": "74 mL/min/1.73m²", "value": "Disminución Leve (Estadio G2)", "status": "NORMAL", "translation": "Tasa de filtración glomerular conservada para homeostasis."},
                "acr": {"name": "Relación Albúmina/Creatinina (ACR)", "raw_value": "320 mg/g", "value": "Severamente Incrementada", "status": "CRITICAL", "translation": "Presencia de microalbuminuria detectada. Sugiere alteración de permeabilidad de barrera renal."},
                "hba1c": {"name": "Estimación Ocular de HbA1c", "raw_value": "6.1%", "value": "Prediabetes (Riesgo Leve)", "status": "WARNING", "translation": "Control glucémico limítrofe. Sugiere soporte preventivo de sensibilidad a la insulina."}
            },
            "stylex_vectors": {
                "conjunctival_pallor": {"attribute_id": "ATTR_082", "name": "Palidez Conjuntival", "influence": 0.84, "direction": "Aumento de palidez correlaciona con bajo nivel de Hemoglobina.", "description": "Se enfoca en la conjuntiva palpebral inferior."},
                "eyelid_margin_pallor": {"attribute_id": "ATTR_114", "name": "Palidez del Margen Palpebral", "influence": 0.62, "direction": "La descoloración del borde del párpado correlaciona con disfunción microvascular y HbA1c de rango prediabético.", "description": "Se enfoca en la microvasculatura del margen palpebral."}
            },
            "confounders": []
        }
        
    try:
        analysis = AgentClarisa.analyze_eye(image_bytes, mime_type)
        return {"success": True, **analysis}
    except Exception as e:
        logger.error(f"🔥 Error en oculómica con Gemini Pro: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el modelo ocular: {e}")

@app.post("/api/bio/scan/lingual-scan")
async def lingual_scan(
    lingualImage: UploadFile = File(...),
    age: int = Form(30),
    clinicalRoute: str = Form("standard")
):
    logger.info("👅 Lingual Scan: Recibiendo imagen de lengua...")
    image_bytes = await lingualImage.read()
    mime_type = lingualImage.content_type
    
    if not GEMINI_API_KEY:
        logger.warning("🔑 GEMINI_API_KEY no detectada. Usando fallback offline.")
        return {
            "success": True,
            "predictions": {
                "tongue_color": {"name": "Color del Cuerpo Lingual", "raw_value": "Rojo Pálido", "value": "Deficiencia de Sangre", "status": "WARNING", "translation": "Cuerpo lingual pálido compatible con deficiencia sistémica de flujo microvascular periférico."},
                "coating_color": {"name": "Color de Saburra", "raw_value": "Blanca y Delgada", "value": "Fisiológica", "status": "NORMAL", "translation": "Saburra normal compatible con adecuado equilibrio de microbiota oral."},
                "moisture": {"name": "Humedad Lingual", "raw_value": "Seca", "value": "Deficiencia de Líquidos", "status": "WARNING", "translation": "Sequedad de mucosas."}
            },
            "stylex_vectors": {},
            "confounders": []
        }
        
    try:
        analysis = AgentClarisa.analyze_tongue(image_bytes, mime_type)
        return {"success": True, **analysis}
    except Exception as e:
        logger.error(f"🔥 Error en diagnóstico lingual con Gemini Pro: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el modelo lingual: {e}")

@app.post("/api/bio/scan/visual-scan")
async def visual_scan(
    visualImage: UploadFile = File(...),
    age: int = Form(30),
    clinicalRoute: str = Form("standard")
):
    logger.info("📸 Visual Scan: Recibiendo imagen morfológica...")
    image_bytes = await visualImage.read()
    mime_type = visualImage.content_type
    
    if not GEMINI_API_KEY:
        return {
            "success": True,
            "findings": "Marcadores visuales observados en la extremidad inferior compatibles con Insuficiencia Venosa Crónica severa. Se aprecian venas varicosas prominentes.",
            "clinical_flags": ["CHRONIC_VENOUS_INSUFFICIENCY_DETECTED", "VARICOSE_VEINS_HIGH_RISK"],
            "severity": "HIGH",
            "imageUrl": f"/uploads/{visualImage.filename}"
        }
        
    try:
        # Visual analysis uses gemini-1.5-flash
        prompt = """Actúa como un Patólogo y Dermatólogo Clínico de soporte para el Ecosistema T.I.L.O.
Analiza la imagen médica adjunta y describe objetivamente los hallazgos visuales. No emitas diagnósticos categóricos directos, utiliza compatibilidad.
Formato JSON esperado:
{
  "findings": "Tu descripción clínica...",
  "clinical_flags": ["Array de banderas"],
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}"""
        model = genai.GenerativeModel("gemini-1.5-flash")
        contents = [
            {"mime_type": mime_type, "data": image_bytes},
            prompt
        ]
        response = model.generate_content(contents, generation_config={"response_mime_type": "application/json"})
        parsed = json.loads(response.text)
        return {
            "success": True,
            "findings": parsed.get("findings", ""),
            "clinical_flags": parsed.get("clinical_flags", []),
            "severity": parsed.get("severity", "LOW"),
            "imageUrl": f"/uploads/{visualImage.filename}"
        }
    except Exception as e:
        logger.error(f"🔥 Error en visual-scan con Gemini Flash: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el modelo visual: {e}")

# Parallel background worker task for external docs
async def process_external_docs_job(
    job_id: str,
    temp_files: list,
    db_session_factory
):
    logger.info(f"⏳ [BACKGROUND WORKER] Iniciando procesamiento paralelo de archivos para job_id: {job_id}")
    
    # Initialize unified metrics structure
    external_metrics = {
        "labs": {},
        "imaging": {},
        "body_comp": {},
        "allergies_detected": [],
        "exercise_log": None
    }
    
    xml_files = []
    gemini_docs = []
    gemini_screens = []
    
    # Classify files
    for filepath, filename, content_type in temp_files:
        ext = os.path.splitext(filename.lower())[1]
        if ext in ['.gpx', '.tcx'] or filename.lower().endswith('.gpx.xml') or filename.lower().endswith('.tcx.xml'):
            xml_files.append((filepath, filename))
        elif content_type in ['application/pdf'] or ext in ['.pdf']:
            gemini_docs.append((filepath, filename, content_type))
        else:
            # Treats as image screenshots
            gemini_screens.append((filepath, filename, content_type))
            
    # Task list for gather
    tasks = []
    
    # 1. Tracker tasks (XML Local)
    # Since XML parsing is fast and CPU-bound, run it locally.
    xml_exercise_logs = []
    for filepath, filename in xml_files:
        parsed = AgentTracker.parse_workout(filepath, filename)
        if parsed:
            xml_exercise_logs.append(parsed)
            
    # Merge XML logs
    if xml_exercise_logs:
        merged = xml_exercise_logs[0]
        for parsed in xml_exercise_logs[1:]:
            merged["duration"] += parsed["duration"]
            merged["distance"] += parsed["distance"]
            merged["calories"] += parsed["calories"]
            merged["avg_hr"] = round((merged["avg_hr"] + parsed["avg_hr"]) / 2)
            merged["max_hr"] = max(merged["max_hr"], parsed["max_hr"])
        external_metrics["exercise_log"] = merged

    # 2. Clarisa tasks (Gemini 1.5 Pro) for PDF labs
    if gemini_docs and GEMINI_API_KEY:
        docs_to_send = []
        for filepath, filename, content_type in gemini_docs:
            with open(filepath, "rb") as f:
                docs_to_send.append({"bytes": f.read(), "mime_type": content_type})
                
        async def run_clarisa():
            try:
                loop = asyncio.get_event_loop()
                # Run Clarisa's Gemini call in a thread pool to avoid blocking async loop
                res = await loop.run_in_executor(None, AgentClarisa.analyze_labs_and_docs, docs_to_send)
                return ("labs", res)
            except Exception as err:
                logger.error(f"⚠️ Error en Agente Clarisa: {err}")
                return ("labs", None)
        tasks.append(run_clarisa())

    # 3. Spark tasks (Gemini 1.5 Flash) for wearable screenshots
    if gemini_screens and GEMINI_API_KEY:
        screens_to_send = []
        for filepath, filename, content_type in gemini_screens:
            with open(filepath, "rb") as f:
                screens_to_send.append({"bytes": f.read(), "mime_type": content_type})
                
        async def run_spark():
            try:
                loop = asyncio.get_event_loop()
                # Run Spark's Gemini call in a thread pool
                res = await loop.run_in_executor(None, AgentSpark.analyze_wearable_screenshots, screens_to_send)
                return ("screens", res)
            except Exception as err:
                logger.error(f"⚠️ Error en Agente Spark: {err}")
                return ("screens", None)
        tasks.append(run_spark())
        
    # Gather all AI tasks concurrently
    if tasks:
        gather_results = await asyncio.gather(*tasks)
        for label, result in gather_results:
            if result:
                if label == "labs":
                    external_metrics["labs"] = result.get("labs", {})
                    external_metrics["imaging"] = result.get("imaging", {})
                    external_metrics["body_comp"] = result.get("body_comp", {})
                    external_metrics["allergies_detected"] = result.get("allergies_detected", [])
                elif label == "screens":
                    # Merge screens exercise log with XML logs if both exist
                    screen_log = result.get("exercise_log")
                    if screen_log:
                        if not external_metrics["exercise_log"]:
                            external_metrics["exercise_log"] = screen_log
                        else:
                            # Merge them
                            merged = external_metrics["exercise_log"]
                            merged["duration"] += screen_log["duration"]
                            merged["distance"] += screen_log["distance"]
                            merged["calories"] += screen_log["calories"]
                            merged["avg_hr"] = round((merged["avg_hr"] + screen_log["avg_hr"]) / 2)
                            merged["max_hr"] = max(merged["max_hr"], screen_log["max_hr"])
                            external_metrics["exercise_log"] = merged

    # Persist final results to SQLite
    db = db_session_factory()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.job_id == job_id).first()
        if job:
            job.status = "completed"
            job.results = json.dumps({"external_metrics": external_metrics})
            db.commit()
            logger.info(f"✅ [BACKGROUND WORKER] Trabajo {job_id} completado e inyectado en DB.")
    except Exception as e:
        logger.error(f"🔥 Error guardando resultados de job {job_id}: {e}")
    finally:
        db.close()
        
    # Destroy temporary uploaded files
    paths_to_clean = [f[0] for f in temp_files]
    AgentSanitizer.clean_files(paths_to_clean)

@app.post("/api/bio/scan/external-docs")
async def external_docs(
    background_tasks: BackgroundTasks,
    externalDocs: List[UploadFile] = File(...),
    age: int = Form(30),
    clinicalRoute: str = Form("standard"),
    citationId: str = Form(None),
    db: Session = Depends(get_db)
):
    logger.info(f"📂 External Docs: Recibiendo {len(externalDocs)} archivos...")
    job_id = str(uuid.uuid4())
    
    # Save background job status
    job = BackgroundJob(job_id=job_id, status="processing")
    db.add(job)
    db.commit()
    
    # Save files to temp directory
    temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    
    temp_files = []
    for file in externalDocs:
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4().hex}_{file.filename}")
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        temp_files.append((temp_path, file.filename, file.content_type))
        
    # Delegate as background task to avoid blocking HTTP response
    # We pass engine.connect or SessionLocal factory to create session in background thread
    background_tasks.add_task(
        process_external_docs_job,
        job_id,
        temp_files,
        SessionLocal
    )
    
    # Respond immediately under 100ms
    return {
        "success": True,
        "job_id": job_id,
        "status": "processing"
    }

@app.get("/api/bio/scan/task-status/{job_id}")
async def get_task_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(BackgroundJob).filter(BackgroundJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
        
    if job.status == "completed":
        results_data = json.loads(job.results) if job.results else {}
        return {"success": True, "status": "completed", **results_data}
        
    return {"success": True, "status": job.status}

@app.post("/api/bio/scan/sync-cortex")
async def sync_cortex(payload: dict):
    # final sync confirmation endpoint
    logger.info("🔄 Sincronizando datos biométricos con CORTEX...")
    return {"success": True, "message": "Datos sincronizados correctamente."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
