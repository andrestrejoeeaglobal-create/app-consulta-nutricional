# Server Python (T.I.L.O. Clinical Telemetry Hub)

## Overview
Microservicio backend en FastAPI y Python especializado en telemetría clínica avanzada (Fase 18), puente de hardware directo, procesamiento asíncrono en segundo plano y agentes autónomos especializados (Clarisa, Spark, Tracker, Sanitizer).

## Interface
- `main.py`: Aplicación FastAPI que expone endpoints de escaneo activo, telemetría y tareas en segundo plano.
- `database.py`: Motor SQLAlchemy y sesión de base de datos SQLite con WAL activado.
- `models.py`: Modelos ORM (`ActiveScan`, `BackgroundJob`) para el tracking de estados de hardware y tareas.
- `agents.py`: Clases de agentes clínicos especializados (`AgentClarisa`, `AgentSpark`, `AgentTracker`, `AgentSanitizer`).
- `config.py`: Gestión de variables de entorno y configuración de credenciales (Gemini API).

## Invariants
- El ciclo de vida de los escaneos (`ActiveScan`) debe mantener estados consistentes (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).
- Las tareas asíncronas pesadas deben delegarse obligatoriamente a `BackgroundTasks` para no bloquear las rutas HTTP.
- Los resultados procesados deben almacenar snapshots normalizados en JSON según los esquemas clínicos de T.I.L.O.

## Side Effects
- Escritura y lectura en base de datos SQLite local vía SQLAlchemy.
- Carga de datasets de calibración de resonancia desde `server/uploads/parsed_results.json`.
- Llamadas a la API de Gemini para agentes que requieran razonamiento heurístico adicional.

## Verification
- Run: `python -m py_compile main.py`
