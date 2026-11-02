# Server (Backend Node.js & Electret Hardware Integration)

## Overview
Servidor de backend principal basado en Express 5 y Node.js. Provee la capa de persistencia local en SQLite (`better-sqlite3`), integración con hardware de resonancia cuántica Electret/HID, validación de citas y sesiones en el servidor central de EquipoEnAccion.app, orquestación de inteligencia clínica Cortex (`@google/genai`), y microservicios de puntuación de biomarcadores.

## Interface
- `index.js`: Entrada principal de la API Express (puerto configurado vía `.env`).
- `db.js`: Conexión de alto rendimiento a SQLite con modo WAL (Write-Ahead Logging) habilitado.
- `schema.sql`: Definición DDL del esquema relacional (pacientes, consultas, biomarcadores, citas).
- `routes/authRoutes.js`: Endpoints de autenticación y validación de credenciales clínicas.
- `routes/cortexRoutes.js`: Endpoints para inferencia clínica con Gemini (`@google/genai`).
- `routes/bioRoutes.js`: Endpoints para ingesta y procesamiento de telemetría Electret y sensores.
- `controllers/cortexController.js`: Lógica de orquestación para prompts clínicos especializados.
- `services/BiomarkerScoringEngine.js`: Algoritmo de ponderación y scoring de biomarcadores celulares.
- `services/directElectretEngine.js`: Integración y lectura en bajo nivel del hardware de resonancia.
- `utils/electretParser.js`: Parser y normalizador de lecturas crudas del dispositivo biofísico.

## Invariants
- Integridad de base de datos: Todas las escrituras en `database.sqlite` deben respetar las restricciones de integridad foránea y tipado estricto.
- Compatibilidad de endpoints: Queda prohibido eliminar o cambiar la firma de `/api/clinical/validate-appointment`, `/api/followup/validate-citation`, `/api/cortex/*` y `/api/bio/*`.
- Las sesiones con certificados SSL autofirmados o conexiones a `equipoenaccion.app` deben manejarse mediante el agente seguro configurado en `index.js`.

## Side Effects
- Mutaciones persistentes en `server/database.sqlite`.
- Almacenamiento de archivos temporales e imágenes en `server/uploads/`.
- Llamadas HTTP salientes hacia `equipoenaccion.app` para sincronización y validación de citas.
- Peticiones externas a la API de Google Gemini para razonamiento de IA clínica.

## Verification
- Run: `node --check index.js`
