# App de Consulta Nutricional — Contrato Arquitectónico

> **Ecosistema T.I.L.O.® & Equipo en Acción®**  
> *Transformación Inteligente y Logro Optimizado*  
> Documento vivo de contrato arquitectónico, subsistemas, interfaces, invariantes y verificación de sistema.

---

## 1. System Overview

El sistema **App de Consulta Nutricional** es una plataforma integral de grado clínico para diagnóstico bioeléctrico, anamnesis multidimensional, prescripción ortomolecular y seguimiento evolutivo de pacientes. Combina interfaces de usuario reactivas y hápticas (React 19), subsistemas de adquisición física mediante resonancia cuántica bioeléctrica (Escáner Electret HID/USB), motores de inferencia clínica impulsados por inteligencia artificial neuro-simbólica (Google Gemini / Cortex Nutricional v3.1), un hub de procesamiento sensorial de alta precisión (FastAPI), y almacenamiento seguro relacional cifrado (SQLite AES-256-GCM retrocompatible y bitácora SHA-256 Hash Chain bajo la NOM-004).

---

## 2. Mapa de Subsistemas y Límites Arquitectónicos

```mermaid
graph TD
    subgraph Frontend Tier
        Client["client/ (Puerto 5173)<br/>SPA React 19 + Vite<br/>Consulta Clínica Continua & Matter.js<br/>(Fases 0 a 18 Blindadas + Fase 19 Córtex)"]
        Followup["client_followup/ (Puerto 5174)<br/>SPA React 19 + Vite<br/>Revaloración Longitudinal SOAP & Recharts<br/>Gemelo Digital a 28 Días"]
    end

    subgraph Backend & Integration Tier
        ServerNode["server/ (Puerto 3000)<br/>Express 5 + better-sqlite3<br/>Cortex Controller v3.1 & Hardware Bridge<br/>Orquestador BFF & Validador NOM-004"]
        CryptoVault["server/utils/cryptoVault.js<br/>Cifrado AES-256-GCM (Retrocompatible) & Bitácora SHA-256"]
        ServerPy["server_py/ (Puerto 8000)<br/>FastAPI + Python<br/>Hub Sensorial: AgentClarisa (StyleX Oculomics/Tongue)<br/>AgentSpark (OCR Fitness) & AgentTracker (TCX/GPX)"]
        Functions["functions/<br/>Firebase Cloud Functions (TS)<br/>Triggers Reactivos Firestore"]
    end

    subgraph Hardware & Adquisición
        Hardware["Escáner Cuántico Bioeléctrico Electret<br/>(36 Categorías / 245 Biomarcadores)"]
        Bridge["server/services/directHardwareDriver.py<br/>read_hid_sensor.py / bio_bridge_agent.py"]
    end

    subgraph Persistence & External
        DB[(SQLite: server/database.sqlite<br/>session_persistence & audit_ledger)]
        ExternalAPI["equipoenaccion.app<br/>(Sincronización Central de Citas)"]
        AI["Google Gemini API<br/>(Cortex Nutricional Reasoning)"]
    end

    Client -->|REST API / HTTP| ServerNode
    Followup -->|REST API / HTTP| ServerNode
    Hardware --> Bridge --> ServerNode
    ServerNode -->|Delegación Sensorial HTTP (Timeout 3500ms + Fallback)| ServerPy
    ServerNode --> CryptoVault --> DB
    ServerNode --> ExternalAPI
    ServerNode --> AI
    Functions --> AI
```

### Detalle de Subsistemas:

1. **`client/` (App 1 — Consulta Nutricional Principal):**
   - **Tecnología:** React 19, Vite, Tailwind CSS, Lucide Icons, Matter.js (física de formulación), Framer Motion.
   - **Puerto:** `5173`.
   - **Alcance:** Orquesta la consulta clínica estructurada en 21 fases continuas. **Fases 0 a la 18 estrictamente blindadas**. Fase 19 (Córtex) ingesta el Suero Clínico 360° y prescribe exclusivamente la **Dualidad Comercial Maestro 🔴 33Plus® y 🟢 34Plus® en 4 tomas circadianas** junto con el protocolo NutriKeto.
   - **Estado:** Blindada bajo regla de oro institucional.

2. **`client_followup/` (App 2 — Portal de Revaloración y Gemelo Digital):**
   - **Tecnología:** React 19, Vite, Tailwind CSS, Recharts, Lucide Icons.
   - **Puerto:** `5174`.
   - **Alcance:** Gemelo Digital a 28 días, revaloración de pacientes sin datos hardcodeados, notas de evolución SOAP dinámicas (`EvolutionNoteSOAP`), y cálculo bioeléctrico de deltas reales (`useDeltaElectret`).

3. **`server/` (Backend Núcleo Node.js / Express 5):**
   - **Tecnología:** Node.js, Express 5, `better-sqlite3`, `dotenv`, `cors`, `multer`.
   - **Puerto:** `3000` (o variable `PORT`).
   - **Rutas Principales:**
     - `/api/auth`: Autenticación clínica y sesiones (`authRoutes.js`).
     - `/api/bio`: Ingesta de hardware, telemetría cuántica y pacientes (`bioRoutes.js`).
     - `/api/cortex`: Síntesis IFM 360°, prescripción dual de 4 tomas y aprobación con deltas RLHF (`cortexRoutes.js`).
     - `/api/followup`: Validación de citas, comparación longitudinal cuántica de 245 biomarcadores y generación de notas SOAP.

4. **`server_py/` (Hub Sensorial Multimodal FastAPI):**
   - **Tecnología:** Python 3.11+, FastAPI, Uvicorn, Pydantic, Tenacity.
   - **Puerto:** `8000`.
   - **Alcance:** Motor sensorial pesado: `AgentClarisa` (Oculómica palpebral y glosodiagnóstico con vectores explicativos StyleX en Gemini 1.5 Pro), `AgentSpark` (OCR de tableros fitness) y `AgentTracker` (Parser de archivos de entrenamiento TCX/GPX). Consumido con timeout estricto de 3500ms y fallback local a Node.js.

5. **`functions/` (Firebase Cloud Functions):**
   - **Tecnología:** TypeScript, Node.js 18/20, Firebase Admin SDK.
   - **Alcance:** Triggers reactivos en Firestore para sincronización en la nube.

6. **`docs/designs/` (Gobernanza Arquitectónica y Documentos EGM):**
   - `goldfish_context.md`: Reglas inmutables de revisión de diseño y condiciones bloqueantes.
   - `concepts_brief.md`: Diagnóstico del enjambre y mapa de telemetría Fases 1–18.
   - `design_draft.md`: Especificación técnica formal detallada para implementación.
   - `consolidated_review_report.md`: Dictamen colegiado del enjambre de subagentes Goldfish.

---

## 3. Interfaces y Contratos de Comunicación

| Emisor | Receptor | Protocolo | Formato / Contrato |
| :--- | :--- | :--- | :--- |
| `client/` (Fase 19) | `server/` | POST `/api/cortex/synthesize-dossier` | Payload filtrado en red (< 12 KB) tras presincronización basal completa $T_0$ |
| `client/` (Fase 19) | `server/` | POST `/api/cortex/approve-dossier` | Sello de expediente con metadatos RLHF y bitácora SHA-256 |
| `client_followup/` | `server/` | POST `/api/followup/validate-citation` | Consulta por Llave Maestra (`userId`) con retorno del snapshot basal completo $T_0$ |
| `client_followup/` | `server/` | POST `/api/followup/longitudinal-compare` | Comparación bioeléctrica cuántica de 245 biomarcadores ($T_0$ vs $T_1$) con BRS Score |
| `server/` | `server_py/` | HTTP REST (`:8000`) | Delegación sensorial con `AbortSignal.timeout(3500)` y fallback local síncrono |
| `server/` | SQLite (`database.sqlite`) | Cifrado simétrico AES-256-GCM | `session_persistence` cifrado con retrocompatibilidad JSON plano + `audit_ledger` SHA-256 |
| `server/` | `equipoenaccion.app` | HTTPS / REST (`CITA_AG`) | Sincronización de citas y validación de vigencia |

---

## 4. Invariantes del Motor y Reglas Inmutables

1. **Exclusividad de la Dualidad Comercial (🔴 33Plus® y 🟢 34Plus®):**
   - Prohibido prescribir fórmulas en prueba o experimentales.
   - **Fase Diurna:** Tomas 1 (04:00 AM) y 2 (09:30 AM) con 🔴 33Plus® en 300 ml de agua tibia.
   - **Fase Vespertina/Nocturna:** Tomas 3 (15:00 PM) y 4 (20:30 PM) con 🟢 34Plus® en mínimo 500 ml de agua 💧.

2. **Gobernanza Visual y Ergonómica (`clinical-branding-guide`):**
   - **Paleta Semántica 60-30-10:** 60% Blanco Clínico / Slate Claro (`#FAFAFA` o `#F8FAFC`), 30% Azul Corporativo (`#1C75BC`) y Navy Deep (`#0F172A`), 10% Acentos Clínicos (Rojo 33Plus® `#B70E0C`, Verde 34Plus® `#3AAA35`, Rosa Institucional `#F29FC5`, Amarillo Oficial `#FFCC00`).
   - **Cero Sombras Negras Puras (`#000000` Prohibido):** Prohibido el uso de `#000000` o `rgba(0,0,0,...)` en elevaciones; uso obligatorio de sombras calibradas en Slate-900 (`#0F172A`).
   - **Tipografía:** `Prototype` para logotipo y nombres comerciales; `Sansation` / `Inter` para cuerpo clínico, telemetría y tablas.
   - **Touch Ergonomics & Safety:** Touch target mínimo de `48px x 48px` con Hit Margin de `8px a 12px`. Hit Margin obligatorio de **`12px` con confirmación secundaria** (doble pulsación o *slide-to-confirm*) para acciones en Rojo 33Plus®.
   - **Header Oficial (`TCK-2026-GOV-HEADER-001`):** Imagotipo oficial completo de Equipo en Acción® en la esquina superior izquierda del `<header>`.

3. **Integridad Normativa NOM-004:**
   - **Algoritmo PENULTIMATE-LAST:** Captura, separación e indexación de Primer Apellido, Segundo Apellido y Nombre(s) con soporte para apellidos compuestos mexicanos (`de`, `del`, `la`, `san`, etc.).
   - **Validación Síncrona `onBlur`:** Todo campo obligatorio del expediente se valida síncronamente al desenfocar.
   - **Cifrado AES-256-GCM:** Todos los snapshots clínicos en SQLite se almacenan cifrados en reposo con soporte para JSON plano previo.
   - **Bitácora Inmutable SHA-256:** Encadenamiento criptográfico estricto de eventos (`prevHash` $\rightarrow$ `currentHash`).

4. **Fidelidad Bioeléctrica Electret y T.I.L.O.®:**
   - Resolución canónica del acrónimo T.I.L.O.® como **"Transformación Inteligente y Logro Optimizado"**.
   - Preservación íntegra de las **36 categorías analíticas** y los **245 biomarcadores** del escáner cuántico.
   - Reglas de exclusión nutricional universales e inviolables para todo paciente: **0 Picante, 0 Cerdo, 0 Azúcares refinados**.

5. **Blindaje de Código y No Regresión:**
   - Fases 0 a 18 de la App 1 (`client/`) 100% blindadas e inmutables.
   - Prohibido eliminar o renombrar rutas, endpoints o controladores existentes.

---

## 5. Verificación, Sintaxis y Comandos de Ejecución

### Instalación de dependencias:
```powershell
npm run install:all
```

### Ejecución en Desarrollo:
```powershell
# Iniciar Cliente Principal (5173) y Servidor Node (3000) concurrentemente
npm run dev

# Iniciar únicamente el Cliente de Consulta Principal
npm run dev:client

# Iniciar el Portal de Seguimiento y Revaloración (5174)
npm run dev:followup

# Iniciar el Servidor Backend Express (3000)
npm run dev:server
```

### Compilación y Verificación de Build:
```powershell
# Build del portal de seguimiento
npm run build:followup

# Build de Cloud Functions (TypeScript)
cd functions && npm run build
```

---

*Contrato arquitectónico y operativo del Ecosistema T.I.L.O.® & Equipo en Acción®.*
