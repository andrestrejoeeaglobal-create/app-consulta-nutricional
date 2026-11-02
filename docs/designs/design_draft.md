# Especificación Técnica de Diseño Arquitectónico (Design Draft)
## Ecosistema T.I.L.O.® & Equipo en Acción® — Protocolo Elephant-Goldfish Model (EGM)

> **Ubicación:** `docs/designs/design_draft.md`  
> **Versión:** 3.2.0-CONSOLIDATED (Post-Auditoría Colegiada Goldfish)  
> **Fecha:** Noviembre 2026  
> **Estado:** Especificación Técnica Blindada y Consolidada tras Revisión Colegiada (`/egm:egm-review`)  
> **Acrónimo Institucional:** **T.I.L.O.® = "Transformación Inteligente y Logro Optimizado"**  
> **Documentos de Referencia:** [`docs/designs/goldfish_context.md`](file:///c:/Users/andre/App%20de%20consulta%20nutricional/docs/designs/goldfish_context.md), [`docs/designs/concepts_brief.md`](file:///c:/Users/andre/App%20de%20consulta%20nutricional/docs/designs/concepts_brief.md), [`README.md`](file:///c:/Users/andre/App%20de%20consulta%20nutricional/README.md), [`.agents/AGENTS.md`](file:///c:/Users/andre/App%20de%20consulta%20nutricional/.agents/AGENTS.md) y `clinical-branding-guide`.  
> **Principio de Inviolabilidad:** La UI y flujos clínicos de las Fases 0 a la 18 de la App 1 (`client/`) permanecen **100% blindados e inmutables**.

---

## 0. Marco de Gobernanza Institucional y Glosario Clínico

### 0.1 Cláusula de Blindaje Inviolable y Protocolo de Excepción (Regla 7 de `.agents/AGENTS.md`)
La **App de Consulta Nutricional** (`client/`) se declara **OFICIALMENTE COMPLETA Y FUNCIONAL EN SU TOTALIDAD**.
* Las **Fases 0 a la 18 de la App 1 permanecen bajo congelamiento de código estricto e inviolable**.
* **Protocolo de Excepción Obligatorio:** Cualquier intervención o modificación futura en archivos dentro de `client/` (específicamente la modularización de `client/src/components/interview/Fase19_DiagnosticoIntegral.jsx` y `client/src/ClinicalRules.js`) requerirá ineludiblemente:
  1. La presentación formal previa de un **Plan de Implementación detallado** (`implementation_plan.md`).
  2. La **autorización expresa, afirmativa y por escrito con doble confirmación del Director (Andrés Trejo)**.
  3. Queda prohibida la edición de cualquier archivo dentro de `client/` sin dicho consentimiento explícito.

### 0.2 Glosario Terminológico Médico, Normativo y Tecnológico

| Término / Acrónimo | Definición Clínica y Alcance Técnico |
| :--- | :--- |
| **T.I.L.O.®** | **Transformación Inteligente y Logro Optimizado.** Plataforma propietaria de telemetría clínica y orquestación neuro-simbólica. |
| **IFM** | *Institute for Functional Medicine.* Matriz de 7 Nodos Fisiopatológicos: Asimilación, Biotransformación, Bioenergética, Comunicación, Transporte, Defensa/Piel e Integridad Estructural. |
| **HPA** | Eje Hipotálamo-Pituitaria-Adrenal (*Hypothalamic-Pituitary-Adrenal Axis*). Eje neuroendocrino que regula la respuesta al estrés y el cortisol. |
| **NOM-004-SSA3-2012** | Norma Oficial Mexicana del Expediente Clínico. Rige la autenticidad, confidencialidad, inmutabilidad y retención de registros médicos. |
| **NOM-028-SSA2-2009** | Norma Oficial Mexicana para la Prevención, Tratamiento y Control de las Adicciones (conmutación de seguridad en adaptógenos estimulantes). |
| **R24H** | Recordatorio de 24 Horas. Evaluación nutricional cuantitativa de ingesta y horarios en la Fase 14. |
| **FFQ** | Cuestionario de Frecuencia de Alimentos (*Food Frequency Questionnaire*). Análisis de periodicidad de ingesta en la Fase 15. |
| **BRS** | *Biorresonance Restoration Score.* Puntuación cuantitativa (0–100) que mide la magnitud de normalización bioeléctrica entre $T_0$ y $T_1$. |
| **Tokens Tailwind v4** | Arquitectura nativa de diseño clínico en `client_followup/src/index.css` que sustituye dependencias pesadas mediante tokens CSS estándar, sin sombras negras `#000000`. |

---

## 1. Arquitectura General y Topología del Sistema

```mermaid
graph TB
    subgraph ClientTier ["Frontends React 19 (Vite)"]
        App1["client/ (Puerto 5173)<br/>App 1: Consulta Clínica Continua<br/>Fases 0 a 18 Blindadas + Fase 19 (Córtex)"]
        App2["client_followup/ (Puerto 5174)<br/>App 2: Portal de Revaloración Longitudinal<br/>Gemelo Digital & SOAP NOM-004"]
    end

    subgraph BFFTier ["Backend Orchestrator (Node.js / Express 5)"]
        Express["server/ (Puerto 3000)<br/>Córtex Controller v3.2<br/>BFF Orchestrator & Bioelectric Engine"]
        Vault["server/utils/cryptoVault.js<br/>AES-256-GCM (12-byte IV) & SHA-256 Hash Chain"]
        DB[(SQLite: server/database.sqlite<br/>session_persistence & audit_ledger)]
    end

    subgraph SensoryTier ["Sensory Processing Hub (Python / FastAPI)"]
        FastAPI["server_py/ (Puerto 8000)<br/>AgentClarisa (Oculomics & Glosodiagnóstico)<br/>AgentSpark (Wearables OCR) & AgentTracker (TCX/GPX)"]
    end

    subgraph ExternalServices ["Servicios Externos & Hardware"]
        ElectretHW["Escáner Cuántico Bioeléctrico Electret<br/>(36 Categorías / 245 Biomarcadores)"]
        GeminiAPI["Google Gemini Pro / Flash<br/>(Motor Neuro-Simbólico Córtex)"]
        CentralEA["equipoenaccion.app<br/>(Sincronización Central de Citas)"]
    end

    App1 -->|POST /api/cortex/presync-baseline| Express
    App1 -->|POST /api/cortex/synthesize-dossier| Express
    App1 -->|POST /api/cortex/approve-dossier| Express
    App2 -->|POST /api/followup/validate-citation| Express
    App2 -->|POST /api/followup/longitudinal-compare| Express
    App2 -->|POST /api/followup/generate-soap| Express

    Express -->|Persistencia Cifrada AES-256-GCM| Vault --> DB
    Express -->|HTTP con Timeout 3500ms y Fallback Local| FastAPI
    Express -->|Inferencia por Nodos IFM (Lotes)| GeminiAPI
    Express <-->|CITA_AG Sync| CentralEA
    ElectretHW -->|HID USB Raw Tramas| Express
```

---

## 2. Eje 1: Destilador Clínico 360° en Fase 19 y Dualidad Ortomolecular Exclusiva

### 2.1 Preservación Canónica de la Línea Base Cuántica ($T_0$) antes del Podado de Red
* **Problema Resuelto:** El podado de red previo eliminaba biomarcadores en rango `NORMAL`, imposibilitando la comparación longitudinal a 28 días.
* **Solución Arquitectónica:**
  - En [`client/src/components/interview/Fase19_DiagnosticoIntegral.jsx`](file:///c:/Users/andre/App%20de%20consulta%20nutricional/client/src/components/interview/Fase19_DiagnosticoIntegral.jsx):
    - Al ingresar a la Fase 19, se dispara una sincronización silenciosa hacia el endpoint canónico:
      ```http
      POST /api/cortex/presync-baseline
      Content-Type: application/json
      {
        "citationId": "12345",
        "rawPatientData": { ... },
        "electret245Baseline": { ... }
      }
      ```
    - Express persiste el snapshot $T_0$ íntegro con las **36 categorías analíticas y los 245 biomarcadores completos** en `session_persistence` (cifrado con AES-256-GCM y retrocompatible).
    - Posteriormente, `pruneTelemetryPayloadForNetwork` envía únicamente el payload estilizado (< 12 KB) a `/api/cortex/synthesize-dossier`.

### 2.2 Reestructuración Exhaustiva de `distillClinicalSerum` en `server/controllers/cortexController.js`
La función `distillClinicalSerum` ingiere las Fases 1 a 18 con guardas de tipo defensivas y sin dependencias no declaradas:

```javascript
/**
 * Destila el Suero Clínico Integrado 360° mapeando Fases 1 a 18 hacia la Matriz IFM.
 * @param {Object} patientData Snapshot clínico acumulado
 * @param {boolean} isLactanteExplicit Indicador de lactante
 * @returns {Object} { nodes: Array<IFMNode>, hasHighSerumCalciumOrCalcification: boolean, anamnesis360Context: Object }
 */
function distillClinicalSerum(patientData, isLactanteExplicit = false) {
    // Declaración e inicialización estricta de variables de control clínico
    let hasHighSerumCalciumOrCalcification = false;

    const nodesMap = {
        NODO_1_ASIMILACION: { id: 'NODO_1_ASIMILACION', number: 1, name: '1. Asimilación y Barrera Intestinal', anomalies: [] },
        NODO_2_BIOTRANSFORMACION: { id: 'NODO_2_BIOTRANSFORMACION', number: 2, name: '2. Biotransformación y Eliminación Hepatorrenal', anomalies: [] },
        NODO_3_ENERGIA: { id: 'NODO_3_ENERGIA', number: 3, name: '3. Bioenergética Mitocondrial y Metabolismo Lipídico-Glucémico', anomalies: [] },
        NODO_4_COMUNICACION: { id: 'NODO_4_COMUNICACION', number: 4, name: '4. Comunicación Neuroendocrina y Ritmo Circadiano', anomalies: [] },
        NODO_5_TRANSPORTE: { id: 'NODO_5_TRANSPORTE', number: 5, name: '5. Transporte Cardiovascular y Reología Microcirculatoria', anomalies: [] },
        NODO_6_DEFENSA: { id: 'NODO_6_DEFENSA', number: 6, name: '6. Defensa Inmunológica, Piel y Respuesta Inflamatoria', anomalies: [] },
        NODO_7_ESTRUCTURAL: { id: 'NODO_7_ESTRUCTURAL', number: 7, name: '7. Integridad Estructural, Matriz Ósea y Biotensegridad', anomalies: [] }
    };

    const pushAnomaly = (nodeKey, source, label, detail, severity = 'MODERADA') => {
        if (!label && !detail) return;
        nodesMap[nodeKey].anomalies.push({ source, label: String(label).trim(), detail: String(detail).trim(), severity });
    };

    // A. INGESTA DE FASE 3: MOTIVO PRINCIPAL & SUFRIMIENTO CLÍNICO
    const clinicalContext = patientData.clinical_context || {};
    const patientQuote = clinicalContext.patient_quote || patientData.motivo || "";
    const specificAilment = clinicalContext.specific_ailment || "";
    const emotionalAnchor = clinicalContext.emotional_anchor || "";
    if (patientQuote || specificAilment) {
        pushAnomaly('NODO_4_COMUNICACION', 'CHIEF_COMPLAINT', 'Motivo de Consulta y Carga Alostática', 
            `Voz del Paciente: "${patientQuote}". Afección específica: ${specificAilment}. Ancla emocional: ${emotionalAnchor}`, 'MODERADA');
    }

    // B. INGESTA DE FASE 4: ANTECEDENTES HEREDOFAMILIARES (AHF)
    const rawFamily = patientData.history?.family_structured || patientData.history?.family_history || [];
    const familyHistory = Array.isArray(rawFamily) ? rawFamily : [];
    familyHistory.forEach(item => {
        const disease = (typeof item === 'object' ? item.disease || item.condicion : item) || '';
        const kin = (typeof item === 'object' ? item.relationship || item.parentesco : 'Familiar') || '';
        if (disease) {
            const upper = disease.toUpperCase();
            if (upper.includes('DIABET') || upper.includes('GLUCOSA') || upper.includes('METABOL')) {
                pushAnomaly('NODO_3_ENERGIA', 'AHF', `Carga Familiar: ${disease} (${kin})`, 'Riesgo genético metabólico y disglucemia', 'ALTA');
            } else if (upper.includes('HIPERTENSI') || upper.includes('INFARTO') || upper.includes('CARDIO')) {
                pushAnomaly('NODO_5_TRANSPORTE', 'AHF', `Carga Familiar: ${disease} (${kin})`, 'Predisposición a rigidez endotelial y riesgo cardiovascular', 'ALTA');
            } else if (upper.includes('CANCER') || upper.includes('AUTOINMUNE') || upper.includes('TIROID')) {
                pushAnomaly('NODO_6_DEFENSA', 'AHF', `Carga Familiar: ${disease} (${kin})`, 'Vulnerabilidad inflamatoria / inmunológica', 'MODERADA');
            }
        }
    });

    // C. INGESTA DE FASE 5 Y 6: ANTECEDENTES PATOLÓGICOS Y QUIRÚRGICOS (APP)
    const rawPathologies = patientData.history?.pathologies || patientData.antecedentesPersonales || [];
    const pathologies = Array.isArray(rawPathologies) ? rawPathologies : [];
    pathologies.forEach(p => {
        const name = (typeof p === 'object' ? p.name || p.patologia : p) || '';
        const upper = name.toUpperCase();
        if (upper.includes('COLECIST') || upper.includes('VESÍCULA') || upper.includes('VESICULA')) {
            pushAnomaly('NODO_1_ASIMILACION', 'SURGICAL', 'Colecistectomía Declarada', 'Pérdida de reservorio biliar; requiere emulsión enzimática y modulación lipídica estricta.', 'ALTA');
        } else if (upper.includes('GASTRITIS') || upper.includes('REFLUJO') || upper.includes('COLITIS') || upper.includes('DISBIOSIS')) {
            pushAnomaly('NODO_1_ASIMILACION', 'APP_DIGESTIVE', `Patología Digestiva: ${name}`, 'Compromiso mucoso / permeabilidad epitelial', 'ALTA');
        } else if (upper.includes('HÍGADO GRASO') || upper.includes('HIGADO GRASO') || upper.includes('HEPAT')) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'APP_HEPATIC', `Sobrecarga Hepática: ${name}`, 'Sobrecarga de biotransformación Fase I/II', 'ALTA');
        }
    });

    // D. INGESTA DE FASE 9: ESTADO FISIOLÓGICO Y REPRODUCTIVO
    const physio = patientData.physio || {};
    const isPregnant = physio.is_pregnant === true || clinicalContext.isPregnant === true;
    const isLactating = physio.is_lactating === true;
    const gestationWeeks = parseInt(physio.gestation_weeks || 0, 10);
    if (isPregnant) {
        pushAnomaly('NODO_3_ENERGIA', 'PHYSIO_STATE', 'Estado Gestacional Activo', 
            `Semana de gestación: ${gestationWeeks || 'No precisada'}. Prioridad de balance energético y soporte de micronutrientes fetoplacentario.`, 'CRÍTICA');
        pushAnomaly('NODO_4_COMUNICACION', 'PHYSIO_STATE', 'Modulación Neuroendocrina Gestacional', 
            'Ajuste hormonal progesterona/prolactina y control glucémico estricto.', 'ALTA');
    } else if (isLactating) {
        pushAnomaly('NODO_3_ENERGIA', 'PHYSIO_STATE', 'Lactancia Materna Activa', 
            'Incremento en demanda hídrica y calórica; prescripción adaptada libre de estimulantes.', 'ALTA');
    }

    // E. INGESTA DE FASE 10 Y 11: CRONOBIOLOGÍA, SUEÑO, ESTRÉS Y TOXICOMANÍAS
    const lifestyle = patientData.lifestyle || {};
    const sleep = lifestyle.sleep || patientData.habitos?.sueno || {};
    const stress = lifestyle.stress || patientData.habitos?.estres || {};
    const toxic = lifestyle.toxic_habits || patientData.habitos?.toxicos || {};

    if (sleep.insomnia || sleep.quality === 'POOR' || (sleep.hours && sleep.hours < 6)) {
        pushAnomaly('NODO_4_COMUNICACION', 'LIFESTYLE_SLEEP', 'Disrupción Circadiana / Deuda de Sueño', 
            `Horas reportadas: ${sleep.hours || '<6'} h/noche. Calidad: ${sleep.quality || 'Mala'}. Insomnio: ${sleep.insomnia ? 'Sí' : 'No'}`, 'ALTA');
    }
    if (stress.level === 'HIGH' || stress.level === 'SEVERE' || parseInt(stress.score || 0) >= 8) {
        pushAnomaly('NODO_4_COMUNICACION', 'LIFESTYLE_STRESS', 'Carga Alostática Elevada (Eje HPA)', 
            `Nivel de estrés percibido: ${stress.level || stress.score}/10. Riesgo de hipercortisolemia y resistencia a la insulina`, 'ALTA');
    }
    if (toxic.smoking || toxic.alcohol_frequency === 'FREQUENT') {
        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'TOXIC_BURDEN', 'Exposición a Xenobióticos / Tóxicos', 
            `Tabaco: ${toxic.smoking ? 'Activo' : 'No'}. Alcohol: ${toxic.alcohol_frequency || 'Ocasional'}`, 'MODERADA');
    }

    // F. INGESTA DE FASE 12 Y 13: PREFERENCIAS, AVERSIÓN Y RESTRICCIONES ALIMENTARIAS
    const nutritionPrefs = patientData.nutrition?.preferences || {};
    const dietEval = patientData.evaluacionDietetica?.preferencias || {};
    const rawExcluded = Array.isArray(nutritionPrefs.excluded_ingredients)
        ? nutritionPrefs.excluded_ingredients
        : (Array.isArray(nutritionPrefs.dislikes) ? nutritionPrefs.dislikes : []);
    const textAversions = dietEval.aversiones ? String(dietEval.aversiones).split(/[,;]/).map(s => s.trim()) : [];
    const combinedExclusions = Array.from(new Set([...rawExcluded, ...textAversions])).filter(Boolean);

    // G. INGESTA DE FASE 16 Y 17: ANTROPOMETRÍA, PRESIÓN ARTERIAL Y GLUCOSA CAPILAR
    const vitals = patientData.vitals || patientData.signosVitales || {};
    const biometria = patientData.biometria || {};
    const bp = vitals.bloodPressure || {};
    const sys = parseInt(bp.systolic || vitals.ta_sistolica || 0, 10);
    const dia = parseInt(bp.diastolic || vitals.ta_diastolica || 0, 10);
    const glu = parseFloat(vitals.glucose || vitals.glucosa || 0);
    const waist = parseFloat(biometria.cintura || patientData.cintura || 0);
    const hip = parseFloat(biometria.cadera || patientData.cadera || 0);
    const icc = (waist > 0 && hip > 0) ? (waist / hip).toFixed(2) : null;

    if (sys >= 130 || dia >= 85) {
        pushAnomaly('NODO_5_TRANSPORTE', 'VITALS_BP', `Tensión Arterial Elevada (${sys}/${dia} mmHg)`, 
            'Riesgo de sobrecarga vascular y disfunción endotelial', sys >= 140 || dia >= 90 ? 'CRÍTICA' : 'ALTA');
    }
    if (glu >= 100) {
        pushAnomaly('NODO_3_ENERGIA', 'VITALS_GLUCOSE', `Glucosa Capilar Alterada (${glu} mg/dL)`, 
            glu >= 126 ? 'Glucemia en rango compatible con diabetes' : 'Disglucemia basal en ayuno', 'CRÍTICA');
    }
    if (icc && ((patientData.sexo === 'F' && icc > 0.85) || (patientData.sexo !== 'F' && icc > 0.90))) {
        pushAnomaly('NODO_3_ENERGIA', 'ANTHRO_ICC', `Riesgo Cardiometabólico Visceral (ICC: ${icc})`, 
            `Cintura: ${waist} cm, Cadera: ${hip} cm. Adiposidad troncular profunda`, 'ALTA');
    }

    // H. INGESTA DE FASE 18: ESCÁNER BIOELÉCTRICO ELECTRET, OCULAR, LINGUAL Y LABS OCR
    const electretCats = patientData?.scan_data?.electret_metrics || patientData?.electretTelemetry?.categories || {};
    if (electretCats && typeof electretCats === 'object') {
        Object.entries(electretCats).forEach(([catKey, catData]) => {
            const items = Array.isArray(catData?.items) ? catData.items : (Array.isArray(catData) ? catData : []);
            items.forEach(item => {
                const st = String(item.status || item.level || '').toUpperCase();
                if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'NORMALES') {
                    const pName = item.name || item.parameter || item.label || catKey;
                    const valStr = `${item.value ?? ''} ${item.unit || ''} (Estado: ${st})`.trim();
                    const up = pName.toUpperCase();
                    if (up.includes('CALCIFICACI') || up.includes('CALCIO') || up.includes('OSTEOCALCINA')) {
                        hasHighSerumCalciumOrCalcification = true;
                    }
                    if (up.includes('COLESTEROL') || up.includes('TRIGLIC') || up.includes('GLUCOSA') || up.includes('ATP') || up.includes('INSULINA')) {
                        pushAnomaly('NODO_3_ENERGIA', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (up.includes('HÍGADO') || up.includes('HIGADO') || up.includes('RIÑÓN') || up.includes('RINON') || up.includes('TOXIN')) {
                        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (up.includes('INTESTIN') || up.includes('ABSORCI') || up.includes('DISBIOSIS')) {
                        pushAnomaly('NODO_1_ASIMILACION', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (up.includes('VASCULAR') || up.includes('ARTERIAL') || up.includes('MICROCIRCULAC')) {
                        pushAnomaly('NODO_5_TRANSPORTE', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (up.includes('INMUNE') || up.includes('INFLAMAC') || up.includes('LINF')) {
                        pushAnomaly('NODO_6_DEFENSA', 'ELECTRET', pName, valStr, 'MODERADA');
                    } else if (up.includes('COLÁGENO') || up.includes('COLAGENO') || up.includes('HUESO') || up.includes('ARTICUL')) {
                        pushAnomaly('NODO_7_ESTRUCTURAL', 'ELECTRET', pName, valStr, 'MODERADA');
                    }
                }
            });
        });
    }

    const nodes = Object.values(nodesMap).map(node => ({
        ...node,
        hasAnomalies: node.anomalies.length > 0,
        anomaliesCount: node.anomalies.length
    }));

    return {
        nodes,
        hasHighSerumCalciumOrCalcification,
        anamnesis360Context: {
            chiefComplaint: patientQuote,
            pathologiesCount: pathologies.length,
            highRiskVitals: sys >= 130 || glu >= 100,
            combinedExclusions,
            isPregnant,
            gestationWeeks
        }
    };
}
```

---

### 2.3 Prescripción Ortomolecular Dual Comercial Exclusiva (🔴 33Plus® y 🟢 34Plus®)

> [!IMPORTANT]
> **Confidencialidad y Cuarentena de Fórmulas:** Queda terminantemente prohibido incorporar o citar fórmulas en fase experimental o "Super Malla Biológica Tropical".
> El motor ortomolecular comercial prescribe **única y exclusivamente** nuestras dos fórmulas maestras bajo el protocolo circadiano de 4 tomas diarias:

```javascript
/**
 * Genera la prescripción ortomolecular dual bajo cronobiología circadiana de 4 tomas.
 * @param {Object} patientData Snapshot clínico del paciente
 * @param {Object} clinicalContext Contexto bioeléctrico y alertas
 * @returns {Object} Prescripción estructurada oficial
 */
function buildOrthomolecularPrescription(patientData, clinicalContext = {}) {
    const isHypertensive = (patientData.vitals?.bloodPressure?.systolic >= 140) || false;
    const hasAddictionRisk = patientData.lifestyle?.toxic_habits?.nom028_risk === true;
    const isPregnantOrLactating = patientData.physio?.is_pregnant === true || patientData.physio?.is_lactating === true;

    // Regla de Conmutación de Bioseguridad NOM-028 / Gestación
    const switch33PlusToDecaf = isPregnantOrLactating || (hasAddictionRisk && isHypertensive);

    return {
        protocolName: "Protocolo Circadiano Dual de Restauración Celular (33Plus® & 34Plus®)",
        dietaryPlan: {
            regimen: "NutriKeto Personalizado",
            universalExclusions: ["0 Picante", "0 Cerdo", "0 Azúcares refinados"],
            patientSpecificExclusions: clinicalContext.combinedExclusions || []
        },
        circadianSchedule: [
            {
                tomaNumber: 1,
                timeSlot: "04:00 hrs (Al Despertar / Alba)",
                phase: "FASE DIURNA — Ignición Mitocondrial y Biogénesis",
                formula: switch33PlusToDecaf ? "🔴 33Plus® (Variante Modulada Sin Estimulantes)" : "🔴 33Plus® (Fórmula Maestra de Ignición)",
                dosage: "1 sobre (10g) diluido en 300 ml de agua tibia",
                clinicalObjective: "Inducción rápida de ATP mitocondrial, oxigenación cerebral y activación del ciclo de Krebs.",
                waterVolumeMl: 300
            },
            {
                tomaNumber: 2,
                timeSlot: "09:30 hrs (Media Mañana)",
                phase: "FASE DIURNA — Rendimiento Cognitivo y Estabilidad Metabólica",
                formula: switch33PlusToDecaf ? "🔴 33Plus® (Variante Modulada Sin Estimulantes)" : "🔴 33Plus® (Fórmula Maestra de Ignición)",
                dosage: "1 sobre (10g) diluido en 300 ml de agua a temperatura ambiente",
                clinicalObjective: "Sostén de neurotransmisores catecolaminérgicos, concentración sostenida y modulación termogénica limpia.",
                waterVolumeMl: 300
            },
            {
                tomaNumber: 3,
                timeSlot: "15:00 hrs (Media Tarde)",
                phase: "FASE VESPERTINA — Homeostasis Tisular y Desinflamación",
                formula: "🟢 34Plus® (Fórmula Maestra de Regeneración Tisular)",
                dosage: "1 sobre (10g) diluido en 500 ml de agua purificada 💧",
                clinicalObjective: "Reparación de la barrera enterocitaria intestinal, alcalinización sistémica y modulación del estrés oxidativo vespertino.",
                waterVolumeMl: 500
            },
            {
                tomaNumber: 4,
                timeSlot: "20:30 hrs (Previa al Sueño / 21:00 hrs Anabolismo)",
                phase: "FASE NOCTURNA — Reconstrucción Miofascial y Carga Anabólica Somatotrópica",
                formula: "🟢 34Plus® (Fórmula Maestra de Regeneración Tisular)",
                dosage: "1 sobre (10g) diluido en 500 ml de agua purificada 💧",
                clinicalObjective: "Inducción del anabolismo profundo nocturno de las 21:00 hrs, cross-linking de colágeno tipo I/III, remineralización y detoxificación de matriz celular.",
                waterVolumeMl: 500
            }
        ]
    };
}
```

---

## 3. Eje 2: Gemelo Digital Evolutivo en `client_followup/` y Orquestación Backend

### 3.1 Desmantelamiento del Mock Pediátrico y Conexión Basal $T_0$
* En [`client_followup/src/App.jsx`](file:///c:/Users/andre/App%20de%20consulta%20nutricional/client_followup/src/App.jsx):
  - Erradicar `age: 12 meses` y `sex: 'F'`.
  - Reemplazar por hidratación dinámica desde `POST /api/followup/validate-citation`, que recupera el snapshot basal real $T_0$ de SQLite (`session_persistence`).
  - Incorporar en el `<header>` el Imagotipo Oficial Completo de Equipo en Acción® en la esquina superior izquierda con dimensiones `h-10 sm:h-12 w-auto object-contain` (`TCK-2026-GOV-HEADER-001`).

### 3.2 Motor de Comparación Cuántica de 245 Biomarcadores (`useDeltaElectret.js`)
* Realiza el contraste exacto de los 245 biomarcadores del escáner Electret entre el estudio inicial ($T_0$) y la revaloración a 28 días ($T_1$).
* **Fórmula Matemática del BRS (Biorresonance Restoration Score):**
  $$BRS = \max\left(0, \min\left(100, 100 - \left( \frac{\sum_{i=1}^{N} w_i \cdot \delta_i}{\text{MaxTheoreticalDelta}} \times 100 \right)\right)\right)$$
  Donde:
  - $w_i = 1.5$ para biomarcadores críticos (cardiovasculares, glucemia, función hepatorrenal).
  - $w_i = 1.0$ para biomarcadores metabólicos estándar.
  - $\delta_i = 0$ si el biomarcador migró de Anormal $\rightarrow$ Normal; $\delta_i = 1$ si persiste Anormal; $\delta_i = 2$ si empeoró.
* **Escala de Decisión Clínica del BRS:**
  - `85 – 100`: Recuperación Homeostática Sobresaliente (Mantener cronobiología actual).
  - `70 – 84`: Respuesta Favorable Moderada (Ajustar dosificación hídrica o micronutrientes).
  - `50 – 69`: Meseta Metabólica (Requiere titulación ortomolecular intensiva).
  - `< 50`: Alerta Clínica Persistente (Notificación al médico para revisión presencial).

### 3.3 Nota de Evolución Dinámica SOAP NOM-004 (`EvolutionNoteSOAP.jsx`)
* El componente genera la estructura canónica exigida por la NOM-004-SSA3-2012:
  - **S (Subjetivo):** Evolución sintomática reportada por el paciente, apego a tomas 1-4 y tolerancia digestiva.
  - **O (Objetivo):** Delta biométrico (peso, IMC, cintura, TA) y correlación de los 245 biomarcadores con delta BRS.
  - **A (Análisis):** Juicio clínico automatizado del Córtex IFM evaluando la velocidad de regeneración tisular y clearance mitocondrial.
  - **P (Plan):** Continuidad o ajuste de 🔴 33Plus® / 🟢 34Plus®, adecuación NutriKeto (respetando 0 Picante, 0 Cerdo, 0 Azúcares y aversiones) y cita de control subsecuente.

### 3.4 Despachador Resiliente de Agentes Sensoriales con Circuit Breaker (`server/services/sensoryBridge.js`)

```javascript
/**
 * Puente de Resiliencia Express -> FastAPI (:8000) con AbortSignal nativo y Circuit Breaker.
 */
class SensoryCircuitBreaker {
    constructor(threshold = 2, coolDownMs = 60000) {
        this.failures = 0;
        this.threshold = threshold;
        this.coolDownMs = coolDownMs;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = 0;
    }

    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    recordFailure() {
        this.failures++;
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.coolDownMs;
            console.warn(`⚡ Sensory Circuit Breaker ABIERTO por ${this.coolDownMs / 1000}s.`);
        }
    }

    canAttempt() {
        if (this.state === 'CLOSED') return true;
        if (this.state === 'OPEN' && Date.now() > this.nextAttempt) {
            this.state = 'HALF_OPEN';
            return true;
        }
        return false;
    }
}

const circuitBreaker = new SensoryCircuitBreaker();

/**
 * Despacha llamadas hacia el Sensory Hub de Python con fallback local de Gemini Flash.
 */
async function callSensoryHubWithFallback(endpoint, body, localFallbackFn) {
    if (!circuitBreaker.canAttempt()) {
        console.warn(`⚠️ Circuito Sensory OPEN. Ejecutando fallback local directo sin esperar timeout.`);
        return await localFallbackFn();
    }

    try {
        const response = await fetch(`http://localhost:8000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3500)
        });

        if (!response.ok) throw new Error(`Sensory Hub HTTP ${response.status}`);
        const data = await response.json();
        circuitBreaker.recordSuccess();
        return data;
    } catch (err) {
        circuitBreaker.recordFailure();
        console.warn(`⚠️ Falla en Sensory Hub (${endpoint}): ${err.message}. Activando fallback local Node.js.`);
        return await localFallbackFn();
    }
}
```

---

## 4. Eje 3: Criptoseguridad NOM-004 y Gobernanza de Interfaz

### 4.1 Cifrado AES-256-GCM Retrocompatible y Bitácora SHA-256 Hash Chain (`server/utils/cryptoVault.js`)

> [!IMPORTANT]
> **Cumplimiento NIST SP 800-38D:** El IV para AES-256-GCM debe ser estrictamente de **12 bytes (96 bits)** para maximizar la velocidad computacional y garantizar interoperabilidad completa con WebCrypto y plataformas móviles.

```javascript
const crypto = require('crypto');
const { db } = require('../db');

const ENCRYPTION_KEY = Buffer.from(process.env.CLINICAL_ENCRYPTION_KEY || '01234567890123456789012345678901', 'utf8'); // 32 bytes

// Esquema SQL de la Bitácora Inmutable NOM-004
db.exec(`
    CREATE TABLE IF NOT EXISTS audit_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        current_hash TEXT NOT NULL
    );
`);

/**
 * Cifra datos clínicos con AES-256-GCM y vector estándar NIST de 12 bytes.
 */
function encryptClinicalData(plainText) {
    if (!plainText) return "";
    const iv = crypto.randomBytes(12); // NIST SP 800-38D Standard
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra registros de SQLite garantizando retrocompatibilidad con JSON plano existente.
 */
function decryptClinicalData(cipherText) {
    if (!cipherText || typeof cipherText !== 'string') return cipherText;
    const trimmed = cipherText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || !trimmed.includes(':')) {
        return trimmed; // Retrocompatibilidad para expedientes legados en SQLite
    }

    const parts = trimmed.split(':');
    if (parts.length !== 3) return trimmed;

    try {
        const [ivHex, authTagHex, encryptedHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error("❌ Error descifrando registro clínico:", e.message);
        return trimmed;
    }
}

/**
 * Registra un evento inmutable en el ledger SHA-256 Hash Chain bajo la NOM-004.
 */
function appendAuditLedger({ actorId, action, patientId, payload }) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const lastEntry = db.prepare('SELECT current_hash FROM audit_ledger ORDER BY id DESC LIMIT 1').get();
    const prevHash = lastEntry ? lastEntry.current_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    const currentHash = crypto.createHash('sha256')
        .update(`${prevHash}:${timestamp}:${actorId}:${action}:${patientId}:${payloadHash}`)
        .digest('hex');

    const stmt = db.prepare(`
        INSERT INTO audit_ledger (timestamp, actor_id, action, patient_id, payload_hash, prev_hash, current_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(timestamp, actorId, action, patientId, payloadHash, prevHash, currentHash);

    return { prevHash, currentHash, timestamp };
}

/**
 * Valida la integridad criptográfica de toda la cadena de custodia del expediente.
 */
function verifyLedgerIntegrity() {
    const rows = db.prepare('SELECT * FROM audit_ledger ORDER BY id ASC').all();
    let expectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const row of rows) {
        if (row.prev_hash !== expectedPrev) {
            return { valid: false, brokenAtId: row.id, reason: 'PREV_HASH_MISMATCH' };
        }
        const recalculation = crypto.createHash('sha256')
            .update(`${row.prev_hash}:${row.timestamp}:${row.actor_id}:${row.action}:${row.patient_id}:${row.payload_hash}`)
            .digest('hex');
        if (recalculation !== row.current_hash) {
            return { valid: false, brokenAtId: row.id, reason: 'CURRENT_HASH_CORRUPTED' };
        }
        expectedPrev = row.current_hash;
    }
    return { valid: true, totalEntries: rows.length };
}

module.exports = {
    encryptClinicalData,
    decryptClinicalData,
    appendAuditLedger,
    verifyLedgerIntegrity
};
```

---

### 4.2 Algoritmo Onomástico PENULTIMATE-LAST con Apellidos Compuestos Mexicanos (`server/utils/nom004Utils.js`)

```javascript
/**
 * Normaliza nombres y apellidos bajo la NOM-004 resolviendo partículas compuestas múltiples ("De la Torre", "De los Santos", "San Martín").
 * @param {string} fullName Cadena completa con el nombre del paciente
 * @returns {Object} { firstName, paternalLastName, maternalLastName, fullNameNormalized }
 */
function parsePenultimateLastName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: '', paternalLastName: '', maternalLastName: '', fullNameNormalized: '' };
    }

    const clean = fullName.trim().replace(/\s+/g, ' ');
    if (!clean) return { firstName: '', paternalLastName: '', maternalLastName: '', fullNameNormalized: '' };

    // Diccionario de conectores y contracciones mexicanas
    const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'mc', 'mac', 'y']);

    // Expresión regular pre-tokenizadora para unir partículas compuestas indivisibles
    let normalizedCompound = clean
        .replace(/\b(de\s+la|de\s+las|de\s+los|de|del|san|santa)\s+/gi, (match) => `${match.trim()}_`);

    const rawTokens = normalizedCompound.split(' ').filter(Boolean);
    const tokens = rawTokens.map(t => t.replace(/_/g, ' '));

    if (tokens.length === 1) {
        return { firstName: tokens[0], paternalLastName: '', maternalLastName: '', fullNameNormalized: tokens[0] };
    }
    if (tokens.length === 2) {
        return { firstName: tokens[0], paternalLastName: tokens[1], maternalLastName: '', fullNameNormalized: `${tokens[0]} ${tokens[1]}` };
    }
    if (tokens.length === 3) {
        return { firstName: tokens[0], paternalLastName: tokens[1], maternalLastName: tokens[2], fullNameNormalized: `${tokens[0]} ${tokens[1]} ${tokens[2]}` };
    }

    // Regla PENULTIMATE-LAST: El penúltimo elemento es el Paterno, el último es el Materno, el resto es el Nombre de Pila
    const maternalLastName = tokens[tokens.length - 1];
    const paternalLastName = tokens[tokens.length - 2];
    const firstName = tokens.slice(0, tokens.length - 2).join(' ');

    return {
        firstName,
        paternalLastName,
        maternalLastName,
        fullNameNormalized: `${firstName} ${paternalLastName} ${maternalLastName}`
    };
}

module.exports = { parsePenultimateLastName };
```

---

### 4.3 Especificación de Interfaz de `BiosecureActionButton`

* **Ubicación:** `client_followup/src/components/ui/BiosecureActionButton.jsx`
* **Ergonomía Táctil:** Altura y anchura mínima de 48px (`min-w-[48px] min-h-[48px]`), Hit Margin perimetral de 12px.
* **Máquina de Estados:** `IDLE` $\rightarrow$ `CONFIRMING` (temporizador de 3.5s con barra de progreso) $\rightarrow$ `TRIGGERED`.
* **Contrato de Props:**
  ```typescript
  interface BiosecureActionButtonProps {
      label: string;
      confirmLabel?: string;
      onConfirm: () => void | Promise<void>;
      variant?: 'danger-33plus' | 'primary-ea' | 'secondary-slate';
      hitMarginPx?: 12;
      confirmTimeoutMs?: 3500;
  }
  ```

---

## 5. Matriz de Componentes y Estado de Blindaje

| Archivo / Componente | Estatus de Blindaje | Responsabilidad en la Solución |
| :--- | :---: | :--- |
| `client/src/App.jsx` (Fases 0 a 18) | 🔒 **100% INMUTABLE** | Cero modificaciones. Se respeta íntegramente la captura clínica existente. |
| `client/src/components/interview/Fase19_DiagnosticoIntegral.jsx` | 🛠️ Sujeto a Protocolo Regla 7 | Sincronización $T_0$ de 245 biomarcadores a `POST /api/cortex/presync-baseline`. |
| `client/src/ClinicalRules.js` | 🛠️ Sujeto a Protocolo Regla 7 | Restricción universal: 0 Picante, 0 Cerdo y 0 Azúcares refinados para todo paciente. |
| `server/controllers/cortexController.js` | 🛠️ Backend Core | `distillClinicalSerum` 360° (con Fases 9 y 12/13), prescripción dual exclusiva 🔴 33Plus® y 🟢 34Plus®. |
| `server/utils/cryptoVault.js` | 🆕 Nuevo Vault | AES-256-GCM (IV 12-byte NIST) + Bitácora SQLite SHA-256 Hash Chain. |
| `server/utils/nom004Utils.js` | 🆕 Nuevo Util | Parser PENULTIMATE-LAST con soporte de apellidos compuestos múltiples. |
| `server/services/sensoryBridge.js` | 🆕 Nuevo Puente | Despachador genérico Express ➔ FastAPI con Circuit Breaker, `AbortSignal.timeout(3500)` y fallback local. |
| `client_followup/src/App.jsx` | 🛠️ Followup Core | Desmantelar mock ("12 Meses/Femenino"), hidratar $T_0$ real, Imagotipo EA (`TCK-2026-GOV-HEADER-001`). |
| `client_followup/src/components/EvolutionNoteSOAP.jsx` | 🛠️ Followup SOAP | Dinamizar nota SOAP con telemetría H7 y deltas de los 245 biomarcadores. |
| `client_followup/src/hooks/useDeltaElectret.js` | 🛠️ Followup Engine | Conexión con `/api/followup/longitudinal-compare` para cálculo delta real y BRS Score. |
| `client_followup/src/index.css` | 🛠️ Tokens CSS | Tokens nativos Tailwind v4, sombras Slate-900, cero `#000000`. |

---

*Especificación técnica formal consolidada y blindada tras la revisión de los 5 subagentes Goldfish.*
