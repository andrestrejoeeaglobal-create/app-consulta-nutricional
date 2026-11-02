# Functions (Firebase Cloud Functions & Cortex Watcher)

## Overview
Funciones Serverless de Firebase en TypeScript que implementan el "sistema circulatorio reactivo" del ecosistema T.I.L.O. Supervisan cambios en documentos de Firestore en tiempo real para disparar el razonamiento del Cortex Nutricional de forma autónoma.

## Interface
- `src/index.ts`: Trigger Cloud Function `onPatientUpdated` que escucha la colección `/patients/{patientId}` en Firestore.
- `src/cortex/reasoning.ts`: Función de análisis `processPatientBiomarkers` que evalúa cambios en signos vitales, antropometría e historial para emitir dictámenes y planes de micronutrición.

## Invariants
- Condición de disparo: Solo debe invocar el Cortex si detecta alteraciones reales en `signosVitales`, `vitales_antropometria` o `history` para optimizar cuotas y latencia.
- El resultado del razonamiento debe escribirse de forma atómica en la subcolección `patients/{patientId}/cortex_evaluations` con timestamp del servidor.

## Side Effects
- Lectura y escritura en Google Cloud Firestore.
- Invocación de módulos de razonamiento clínico externo o integración con NotebookLM / Gemini.

## Verification
- Run: `npm run build`
