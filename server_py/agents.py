import os
import re
import math
import logging
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
import google.generativeai as genai

# Setup logging
logger = logging.getLogger("tilo_telemetry")

# Helper to run Gemini models with exponential retry backoff
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def generate_content_with_retry(model_name, contents, json_mode=True):
    try:
        model = genai.GenerativeModel(model_name)
        config = {}
        if json_mode:
            config["response_mime_type"] = "application/json"
        
        response = model.generate_content(contents, generation_config=config)
        return response.text
    except Exception as e:
        logger.warning(f"⚠️ Gemini API Error (Retrying...): {e}")
        raise e

# --- AGENTE CLARISA (Cortex Vision - Pro) ---
class AgentClarisa:
    @staticmethod
    def analyze_eye(image_bytes: bytes, mime_type: str) -> dict:
        import json
        logger.info("👁️ Agente Clarisa: Iniciando análisis oculómico de conjuntiva...")
        prompt = """Actúa como un experto en Oculómica y Diagnóstico de Fondo de Ojo Clínico de T.I.L.O.
Analiza la imagen de la conjuntiva palpebral inferior proporcionada.
Tu tarea es estimar la concentración de Hemoglobina (Hb), eGFR, ACR y HbA1c basadas en los marcadores visuales microvasculares.
También debes calcular los Coeficientes Vectoriales de Explicabilidad Contrafactual (StyleX) para los atributos:
1. Conjunctival Pallor (palidez conjuntival) - Rango [0.0, 1.0].
2. Eyelid Margin Pallor (palidez del margen palpebral) - Rango [0.0, 1.0].

Genera la respuesta estrictamente en formato JSON con la siguiente estructura de campos:
{
  "predictions": {
    "hemoglobin": {
      "name": "Hemoglobina Estimada (Hb)",
      "raw_value": "10.8 g/dL",
      "value": "Baja (Anemia Leve)",
      "status": "WARNING",
      "translation": "Tendencia a nivel limítrofe de Hb. Se aconseja evaluar cofactores y optimizar aportes de hierro hemínico."
    },
    "egfr": {
      "name": "Filtrado Glomerular Estimado (eGFR)",
      "raw_value": "74 mL/min/1.73m²",
      "value": "Disminución Leve (Estadio G2)",
      "status": "NORMAL",
      "translation": "Tasa de filtración glomerular conservada para homeostasis."
    },
    "acr": {
      "name": "Relación Albúmina/Creatinina (ACR)",
      "raw_value": "320 mg/g",
      "value": "Severamente Incrementada",
      "status": "CRITICAL",
      "translation": "Presencia de microalbuminuria detectada. Sugiere alteración de permeabilidad de barrera renal."
    },
    "hba1c": {
      "name": "Estimación Ocular de HbA1c",
      "raw_value": "6.1%",
      "value": "Prediabetes (Riesgo Leve)",
      "status": "WARNING",
      "translation": "Control glucémico limítrofe. Sugiere soporte preventivo de sensibilidad a la insulina."
    }
  },
  "stylex_vectors": {
    "conjunctival_pallor": {
      "attribute_id": "ATTR_082",
      "name": "Palidez Conjuntival",
      "influence": 0.84,
      "direction": "Aumento de palidez correlaciona con bajo nivel de Hemoglobina.",
      "description": "Se enfoca en la conjuntiva palpebral inferior. El modelo asocia la palidez de esta mucosa vascularizada con bajas concentraciones de hemoglobina."
    },
    "eyelid_margin_pallor": {
      "attribute_id": "ATTR_114",
      "name": "Palidez del Margen Palpebral",
      "influence": 0.62,
      "direction": "La descoloración del borde del párpado correlaciona con disfunción microvascular y HbA1c de rango prediabético.",
      "description": "Se enfoca en la microvasculatura del margen palpebral y las glándulas de Meibomio, asociando su disfunción con estadios precoces de glicación."
    }
  },
  "confounders": []
}

Responde ÚNICAMENTE con el objeto JSON. No agregues texto adicional, explicaciones ni formato markdown."""
        
        contents = [
            {"mime_type": mime_type, "data": image_bytes},
            prompt
        ]
        
        response_text = generate_content_with_retry("gemini-1.5-pro", contents)
        return json.loads(response_text)

    @staticmethod
    def analyze_tongue(image_bytes: bytes, mime_type: str) -> dict:
        import json
        logger.info("👅 Agente Clarisa: Iniciando diagnóstico lingual...")
        prompt = """Actúa como un Experto en Diagnóstico Lingual de Medicina Tradicional y CTDS del Ecosistema T.I.L.O.
Analiza la imagen de la lengua proporcionada.
Evalúa el color del cuerpo lingual, el color de la saburra, el espesor de la saburra, la humedad, la forma (marcas de dientes, hinchazón) y la presencia de fisuras o grietas.

Genera la respuesta estrictamente en formato JSON con la siguiente estructura de campos:
{
  "predictions": {
    "tongue_color": {
      "name": "Color del Cuerpo Lingual",
      "raw_value": "Rojo Pálido",
      "value": "Deficiencia de Sangre / Qi",
      "status": "WARNING",
      "translation": "Cuerpo lingual pálido compatible con deficiencia sistémica de flujo microvascular periférico."
    },
    "coating_color": {
      "name": "Color de Saburra",
      "raw_value": "Blanca y Delgada",
      "value": "Fisiológica",
      "status": "NORMAL",
      "translation": "Saburra normal compatible con adecuado equilibrio de microbiota oral y digestiva."
    },
    "coating_thickness": {
      "name": "Espesor de Saburra",
      "raw_value": "Gruesa en Zona Posterior",
      "value": "Estancamiento de Humedad o Alimento",
      "status": "WARNING",
      "translation": "Acumulación de saburra en base lingual compatible con lentitud digestiva."
    },
    "moisture": {
      "name": "Humedad Lingual",
      "raw_value": "Seca",
      "value": "Deficiencia de Líquidos Corporales / Calor",
      "status": "WARNING",
      "translation": "Sequedad de mucosas sugerente de necesidad de optimización de hidratación celular."
    },
    "shape": {
      "name": "Forma Lingual",
      "raw_value": "Hinchada con marcas de dientes",
      "value": "Deficiencia de Qi de Bazo / Retención de Humedad",
      "status": "WARNING",
      "translation": "Identación lateral compatible con retención de líquido intersticial."
    },
    "cracks": {
      "name": "Fisuras Linguales",
      "raw_value": "Fisura Central Profunda",
      "value": "Deficiencia Crónica de Yin de Estómago",
      "status": "WARNING",
      "translation": "Grietas en zona media compatibles con historial de irritabilidad de mucosa gástrica."
    }
  },
  "stylex_vectors": {
    "toothmarks_depth": {
      "attribute_id": "ATTR_203",
      "name": "Profundidad de Identaciones",
      "influence": 0.72,
      "direction": "Mayor profundidad indica aumento de retención de humedad y deficiencia energética digestiva.",
      "description": "Evalúa el contorno lateral de la lengua para determinar la marca física de las piezas dentales, indicador de edema celular."
    },
    "coating_density": {
      "attribute_id": "ATTR_210",
      "name": "Densidad de la Saburra",
      "influence": 0.58,
      "direction": "Mayor densidad y coloración amarilla correlacionan con procesos inflamatorios de la mucosa digestiva.",
      "description": "Se enfoca en la reflectancia y rugosidad de la superficie lingual en el tercio medio y base."
    }
  },
  "confounders": []
}

Responde ÚNICAMENTE con el objeto JSON. No agregues texto adicional, explicaciones ni formato markdown."""
        
        contents = [
            {"mime_type": mime_type, "data": image_bytes},
            prompt
        ]
        
        response_text = generate_content_with_retry("gemini-1.5-pro", contents)
        return json.loads(response_text)

    @staticmethod
    def analyze_labs_and_docs(files_data: list) -> dict:
        import json
        logger.info("🤖 Agente Clarisa: Iniciando análisis multimodal de PDFs o laboratorios...")
        prompt = """Eres un "Clinical Data Extractor" (Extractor de Datos Clínicos) del Ecosistema T.I.L.O.
Tu tarea es analizar los documentos de laboratorio, composición corporal (como InBody), electrocardiogramas (ECG), pruebas de alergia o notas médicas que se te proporcionan en formato de imagen o PDF.
Extrae y estructura la información de los archivos en un único objeto JSON.

Reglas de extracción y normalización:
1. Si el documento es un InBody o reporte de composición corporal, extrae métricas como Peso (ej: "78.5 kg"), Masa Músculo Esquelética (MME o Skeletal Muscle Mass, ej: "34.2 kg"), Porcentaje de Grasa Corporal (PGC o Percent Body Fat, ej: "22.1%"), Agua Corporal Total (ACT o Total Body Water, ej: "48.2 L"). Guarda esto en el objeto "body_comp".
2. Si el documento es una Química Sanguínea o estudio de laboratorio, extrae biomarcadores como Glucosa (ej: "105 mg/dL"), Colesterol Total (ej: "210 mg/dL"), Triglicéridos (ej: "165 mg/dL"), Enzimas Hepáticas (TGO/AST, TGP/ALT, GGT en U/L), Hemoglobina (ej: "11.2 g/dL"), etc. Guarda esto en el objeto "labs".
3. Si es una nota médica, ECG, etc., extrae diagnósticos o hallazgos clínicos importantes (como impresiones de ECG, ej: "Ritmo sinusal con bloqueo de rama derecha") y guárdalos en el objeto "imaging".
4. Las alergias encontradas (alimentos, medicamentos, etc., ej: "Gluten", "Nueces") agrégalas a la lista "allergies_detected".

El JSON resultante debe tener esta estructura exacta:
{
  "labs": {
    // Clave: Valor (Ej: "glucose": "88 mg/dL", "cholesterol": "190 mg/dL")
  },
  "imaging": {
    // Claves/Valores de ECG (Ej: "ecg": "Ritmo sinusal sin alteraciones")
  },
  "body_comp": {
    // Claves/Valores de composición corporal (Ej: "weight": "75.4 kg", "skeletal_muscle_mass": "32.1 kg")
  },
  "allergies_detected": [
    // Lista de strings de alergias detectadas (ej: "Gluten", "Penicilina")
  ]
}

Responde ÚNICAMENTE con el objeto JSON. No agregues texto adicional, explicaciones ni formato markdown."""
        
        contents = []
        for file in files_data:
            contents.append({"mime_type": file["mime_type"], "data": file["bytes"]})
        contents.append(prompt)
        
        response_text = generate_content_with_retry("gemini-1.5-pro", contents)
        return json.loads(response_text)

# --- AGENTE SPARK (Cortex Vision - Flash) ---
class AgentSpark:
    @staticmethod
    def analyze_wearable_screenshots(files_data: list) -> dict:
        import json
        logger.info("🏃 Agente Spark: Extrayendo telemetría de wearables deportivos...")
        prompt = """Eres un extractor analítico optimizado para interfaces fitness y wearables (Zepp/Fitbit/Garmin/Apple Health/Strava).
Analiza las capturas de pantalla de entrenamientos o resúmenes diarios proporcionadas.
Extrae la duración en segundos (duration), distancia en metros (distance), calorías consumidas en kcal (calories), frecuencia cardíaca promedio en bpm (avg_hr) y frecuencia cardíaca máxima en bpm (max_hr).

El JSON resultante debe tener esta estructura exacta:
{
  "exercise_log": {
    "duration": 3600, // número en segundos
    "distance": 5000, // número en metros
    "calories": 450, // número en kcal
    "avg_hr": 145, // número en bpm
    "max_hr": 175 // número en bpm
  }
}

Responde ÚNICAMENTE con el objeto JSON. No agregues texto adicional, explicaciones ni formato markdown."""
        
        contents = []
        for file in files_data:
            contents.append({"mime_type": file["mime_type"], "data": file["bytes"]})
        contents.append(prompt)
        
        response_text = generate_content_with_retry("gemini-1.5-flash", contents)
        return json.loads(response_text)

# --- AGENTE TRACKER (XML Parser) ---
class AgentTracker:
    @staticmethod
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371000  # Earth's radius in meters
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = math.sin(dLat/2) * math.sin(dLat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dLon/2) * math.sin(dLon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    @staticmethod
    def parse_tcx(xml_text: str) -> dict:
        logger.info("🧩 Agente Tracker: Parseando archivo TCX...")
        duration = 0
        distance = 0
        calories = 0
        avg_hr = 0
        max_hr = 0

        # Extract TotalTimeSeconds
        durations = re.findall(r"<TotalTimeSeconds>([\d\.]+)</TotalTimeSeconds>", xml_text, re.IGNORECASE)
        for d in durations:
            try:
                duration += float(d)
            except ValueError:
                pass
        duration = round(duration)

        # Extract DistanceMeters
        distances = re.findall(r"<DistanceMeters>([\d\.]+)</DistanceMeters>", xml_text, re.IGNORECASE)
        for dist in distances:
            try:
                distance += float(dist)
            except ValueError:
                pass
        distance = round(distance)

        # Extract Calories
        cals = re.findall(r"<Calories>(\d+)</Calories>", xml_text, re.IGNORECASE)
        for c in cals:
            try:
                calories += int(c)
            except ValueError:
                pass

        # Extract AverageHeartRateBpm/MaximumHeartRateBpm
        avg_hrs = re.findall(r"<AverageHeartRateBpm>[^]*?<Value>(\d+)</Value>", xml_text, re.IGNORECASE | re.DOTALL)
        if avg_hrs:
            hrs = [int(h) for h in avg_hrs]
            avg_hr = round(sum(hrs) / len(hrs))

        max_hrs = re.findall(r"<MaximumHeartRateBpm>[^]*?<Value>(\d+)</Value>", xml_text, re.IGNORECASE | re.DOTALL)
        if max_hrs:
            max_hr = max([int(h) for h in max_hrs])

        # Try trackpoints as fallback
        if avg_hr == 0:
            tp_hrs = re.findall(r"<HeartRateBpm>[^]*?<Value>(\d+)</Value>", xml_text, re.IGNORECASE | re.DOTALL)
            if tp_hrs:
                hrs = [int(h) for h in tp_hrs]
                avg_hr = round(sum(hrs) / len(hrs))
                max_hr = max(hrs + [max_hr])

        return {
            "duration": duration,
            "distance": distance,
            "calories": calories,
            "avg_hr": avg_hr,
            "max_hr": max_hr
        }

    @staticmethod
    def parse_gpx(xml_text: str) -> dict:
        logger.info("🧩 Agente Tracker: Parseando archivo GPX...")
        # Get trackpoints
        trackpoints = []
        trkpts = re.findall(r'<trkpt\s+lat=["\']([\d\.-]+)["\']\s+lon=["\']([\d\.-]+)["\']', xml_text, re.IGNORECASE)
        for t in trkpts:
            trackpoints.append({"lat": float(t[0]), "lon": float(t[1])})

        # Get times
        times = re.findall(r"<time>([^<]+)</time>", xml_text, re.IGNORECASE)

        duration = 0
        if len(times) >= 2:
            try:
                fmt = "%Y-%m-%dT%H:%M:%SZ"
                t0_str = times[0].replace(".000", "")
                tN_str = times[-1].replace(".000", "")
                t0 = datetime.strptime(t0_str[:19] + "Z", fmt)
                tN = datetime.strptime(tN_str[:19] + "Z", fmt)
                duration = max(0, round((tN - t0).total_seconds()))
            except Exception:
                pass

        distance = 0
        for i in range(len(trackpoints) - 1):
            p1 = trackpoints[i]
            p2 = trackpoints[i+1]
            distance += AgentTracker.haversine(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
        distance = round(distance)

        # Get HRs
        hrs_str = re.findall(r"<(?:(?:gpxtpx|ns3):)?hr>(\d+)</(?:(?:gpxtpx|ns3):)?hr>", xml_text, re.IGNORECASE)
        hrs = [int(h) for h in hrs_str]
        
        avg_hr = 0
        max_hr = 0
        if hrs:
            avg_hr = round(sum(hrs) / len(hrs))
            max_hr = max(hrs)

        calories = 0
        if distance > 0:
            calories = round((distance / 1000) * 65)
        elif duration > 0:
            calories = round((duration / 60) * 7.5)

        return {
            "duration": duration,
            "distance": distance,
            "calories": calories,
            "avg_hr": avg_hr,
            "max_hr": max_hr
        }

    @staticmethod
    def parse_workout(file_path: str, filename: str) -> dict:
        name = filename.lower()
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            xml_text = f.read()
            
        if name.endswith(".tcx") or name.endswith(".tcx.xml"):
            return AgentTracker.parse_tcx(xml_text)
        elif name.endswith(".gpx") or name.endswith(".gpx.xml"):
            return AgentTracker.parse_gpx(xml_text)
        return None

# --- AGENTE SANITIZER (Garbage Collector) ---
class AgentSanitizer:
    @staticmethod
    def clean_files(file_paths: list):
        for path in file_paths:
            try:
                if path and os.path.exists(path):
                    os.remove(path)
                    logger.info(f"🧹 Agente Sanitizer: Archivo temporal eliminado físicamente: {path}")
            except Exception as e:
                logger.error(f"⚠️ Agente Sanitizer: No se pudo eliminar {path}: {e}")
