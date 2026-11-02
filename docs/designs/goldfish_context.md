# Reglas Inmutables de Auditoría — Protocolo Goldfish (EGM)

> **Ubicación:** `docs/designs/goldfish_context.md`  
> **Propósito:** Definir las restricciones, directrices normativas y contratos arquitectónicos no negociables para la App de Consulta Nutricional (Ecosistema T.I.L.O.® & Equipo en Acción®).  
> **Destinatarios obligatorios:** Todo subagente auditor del enjambre Goldfish (`egm-design`, `egm-codebase-details`, `egm-implementation-readiness`, `egm-zoom-out`, `egm-comprehension`, `egm-structural`, `egm-style`, `egm-synthesizer`).

---

## 1. Declaración de Misión y Filosofía de Auditoría

Los subagentes Goldfish operan en un entorno sin memoria de conversaciones previas (*zero-context*), evaluando de manera crítica los documentos de diseño (`design_draft.md`), especificaciones técnicas y planes de implementación.

Todo dictamen de auditoría emitido por un Goldfish debe contrastar la propuesta técnica contra las siguientes **Condiciones Bloqueantes Ineludibles**. Cualquier propuesta o cambio que infrinja cualquiera de estos pilares debe ser clasificada de inmediato como **BLOCKER / CRITICAL FAIL**.

---

## 2. Condiciones Bloqueantes Ineludibles para Subagentes Goldfish

### 🔴 A. Exclusividad de la Dualidad Biológica 🔴 33Plus® y 🟢 34Plus® (Confidencialidad de Fórmulas)

1. **Cuarentena y Prohibición de Fórmulas en Prueba:**
   - **PROHIBICIÓN ESTRICTA:** Queda terminantemente prohibido incluir, mencionar o prescribir "Super Malla Biológica Tropical" o cualquier otra fórmula experimental o en fase de prueba en cualquier archivo de diseño (`design_draft.md`, `concepts_brief.md`), frontend (`client/`, `client_followup/`), backend (`cortexController.js`, `SafetyEngine.js`) o base de datos.
2. **Doctrina Circadiana de 4 Tomas Diarias (Dualidad Comercial Exclusiva):**
   - El motor de prescripción ortomolecular (`buildOrthomolecularPrescription`) prescribirá **única y exclusivamente** nuestras dos fórmulas maestras comerciales:
     - **FASE DIURNA — TOMA 1 (04:00 AM / Al despertar) & TOMA 2 (09:30 AM / Media mañana):**  
       **🔴 33Plus®** en **300 ml de agua tibia** (ignición mitocondrial, producción limpia de ATP, optimización microvascular endotelial y enfoque cognitivo; con conmutación de bioseguridad NOM-028 libre de estimulantes si hay interacción simpaticomimética).
     - **FASE VESPERTINA Y NOCTURNA — TOMA 3 (15:00 PM / Media tarde) & TOMA 4 (20:30 PM / Previa al sueño):**  
       **🟢 34Plus®** en **MÍNIMO 500 ml de agua 💧** (reparación tisular, cross-linking de colágeno, modulación de permeabilidad mucosa enterocitaria y anabolismo tisular profundo en el pico somatotrópico de las 21:00 hrs).

---

### 🎨 B. Cumplimiento Estricto de la Skill `clinical-branding-guide`

1. **Paleta Semántica 60-30-10:**
   - **60% Lienzo Dominante:** Blanco Clínico / Slate Claro (`#FAFAFA` o `#F8FAFC`). Modo Oscuro basado en Grafito/Carbón (`#0F172A` a `#1E1E1E`). Prohibido terminantemente el uso de negro puro (`#000000`) en superficies generales para evitar fatiga visual y halación retiniana.
   - **30% Soporte Estructural:** Azul Corporativo (`#1C75BC`) y Navy Deep (`#0F172A`).
   - **10% Acentos Biosemánticos y de Acción (Efecto Von Restorff):**
     - **Rojo 33Plus® (`#B70E0C` / `#E30613`):** Ignición mitocondrial, alertas metabólicas agudas, fatiga severa y termogénesis cognitiva.
     - **Verde 34Plus® (`#3AAA35`):** Homeostasis celular, modulación metabólica, salud intestinal y regeneración tisular.
     - **Rosa Institucional (`#F29FC5`):** Empatía clínica, soporte humanizado y acompañamiento.
     - **Amarillo Oficial (`#FFCC00`):** Atención retiniana y advertencias sutiles.
2. **Tipografía y Jerarquía Visual:**
   - **Prototype:** Confinada exclusivamente al Imagotipo Principal de Equipo en Acción® y a los nombres comerciales de las fórmulas (`33Plus®`, `34Plus®`).
   - **Sansation / Inter / SF Pro:** Tipografías oficiales para cuerpo de texto, dosificaciones, telemetría, tablas analíticas y notas SOAP.
3. **Cero Sombras Negras Puras (`#000000` Prohibido):**
   - Prohibido el uso de sombras `box-shadow` o `drop-shadow` basadas en negro puro (`#000000` o `rgba(0,0,0,...)`). Toda elevación debe generarse mediante tokens basados en Slate-900 (`#0F172A`) con opacidades controladas (`rgba(15, 23, 42, 0.05)` a `rgba(15, 23, 42, 0.16)`).
4. **Ergonomía Táctil y Touch Safety (Thumb Zone):**
   - **Touch Target Mínimo:** Mínimo inviolable de `48px x 48px` (o `44px x 44px` en iOS / Web compacta) para cualquier elemento interactivo.
   - **Hit Margin (Aislamiento Táctil):** Separación perimetral libre de colisión de al menos `8px a 12px`.
   - **Protección Crítica en Rojo 33Plus®:** Todo botón interactivo con acento Rojo 33Plus® debe contar con un Hit Margin de al menos `12px` e implementar obligatoriamente un patrón de UX con confirmación secundaria (doble pulsación o gesto de deslizamiento / *slide-to-confirm*).
5. **Imagotipo Oficial en Header (`TCK-2026-GOV-HEADER-001`):**
   - Ubicado de forma obligatoria en el **extremo superior izquierdo** del `<header>` principal con altura fluida `h-10 sm:h-12 w-auto object-contain`.

---

### 📋 C. Integridad Clínica y Normativa NOM-004

1. **Algoritmo PENULTIMATE-LAST con Apellidos Compuestos:**
   - Captura, separación e indexación obligatoria de: Primer Apellido, Segundo Apellido y Nombre(s).
   - **Soporte Léxico de Apellidos Compuestos Mexicanos:** Debe agrupar preposiciones y contracciones (`de`, `del`, `la`, `las`, `los`, `san`, `santa`, `mc`, `mac`) como un solo token léxico indivisible (ej. "De la Torre", "Del Río", "San Martín") antes de determinar Paterno, Materno y Nombre(s).
2. **Validación Síncrona `onBlur`:**
   - Todo campo clínico regulado bajo la NOM-004 debe validarse de forma síncrona en el evento `onBlur` con resaltes sutiles en Amarillo Oficial (`#FFCC00`) o Rojo 33Plus® (`#B70E0C`).
3. **Cifrado de Datos Sensibles en Reposo y Retrocompatibilidad:**
   - Cifrado criptográfico mediante algoritmo **AES-256-GCM** en `session_persistence` de SQLite.
   - **Retrocompatibilidad Obligatoria:** La rutina `decryptClinicalData` debe detectar si un registro es JSON plano legado (comienza con `{` o no contiene el formato `iv:authTag:encrypted`) para devolverlo íntegro sin corromper el histórico de la base de datos.
4. **Bitácora de Auditoría Inmutable (SHA-256 Hash Chain):**
   - Encadenamiento criptográfico estricto de eventos de expediente (`prevHash` + `metadata` $\rightarrow$ `currentHash`).

---

### ⚡ D. Blindaje de Telemetría Electret, Nutrición NutriKeto y T.I.L.O.®

1. **Resolución Canónica del Acrónimo T.I.L.O.®:**
   - En todo texto, componente o reporte, resolver única y estrictamente como: **"Transformación Inteligente y Logro Optimizado"**.
2. **Fidelidad Cuántica Bioeléctrica Electret:**
   - Preservación íntegra de las **36 categorías analíticas** y los **245 biomarcadores** del escáner cuántico. Prohibido perder la línea base $T_0$ en base de datos.
3. **Reglas de Exclusión Nutricional Universales Inviolables:**
   - Toda recomendación dietética o plan NutriKeto debe cumplir de forma universal para todo paciente:
     - 🚫 **0 Picante**
     - 🚫 **0 Cerdo**
     - 🚫 **0 Azúcares refinados**
4. **Mapeo Completo en `distillClinicalSerum`:**
   - Obligatoria la ingesta de Fase 9 (semanas de gestación y lactancia hacia Nodos 3 y 4) y Fase 12 (aversiones y rechazos como exclusión forzada en el menú NutriKeto).

---

### 🛡️ E. Resiliencia de Microservicios y Blindaje de UI

1. **Resiliencia en Puente Express ➔ FastAPI:**
   - Toda llamada HTTP de `server/` (:3000) hacia `server_py/` (:8000) debe contar con un timeout estricto de `3500ms` (`AbortSignal.timeout(3500)`) y bloque `try/catch` con fallback local a Node.js en caso de que el microservicio de Python se encuentre inactivo.
2. **Blindaje de la App de Consulta Nutricional (`client/`):**
   - Las **Fases 0 a la 18 permanecen 100% blindadas e inmutables**.
   - No regresión de rutas, endpoints o controladores preexistentes.

---

*Documento de gobernanza inmutable para el protocolo Elephant-Goldfish Model (EGM).*
