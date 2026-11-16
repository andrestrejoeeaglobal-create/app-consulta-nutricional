import React from 'react';
import {
    Calendar,
    Clock, Coffee, Moon, Sun, Utensils,
    Navigation, Activity, MapPin, Briefcase, User, Smartphone, Shield,
    Layers, Dumbbell, Zap, RefreshCw, Lock
} from 'lucide-react';
import { resolvePatientSex } from '../../utils/genderConcordance';
import { extractPatientAge } from '../../utils/patientGuideAdapter';
import { useClinicalToast } from '../../hooks/useClinicalToast';

export const TabCalendar = ({
    patientData,
    setPatientData,
    apiContext,
    Accordion,
    openSections,
    toggleSection,
    isPhase20EditMode
}) => {
    const orthoPrescription = patientData?.clinical_dossier?.orthomolecular_prescription || {};
    const isBiosecurityPaused = Boolean(orthoPrescription?.biosecurity_semaphore?.isPaused);
    const orthoSups = Array.isArray(orthoPrescription?.supplements) ? orthoPrescription.supplements : [];
    const has33Plus = !isBiosecurityPaused && orthoSups.some(
        s => s?.status !== 'paused_by_biosecurity' && (s?.id === 'sup_33plus' || s?.name?.includes('33') || s?.cortex?.includes('33'))
    );
    const has34Plus = !isBiosecurityPaused && orthoSups.some(
        s => s?.status !== 'paused_by_biosecurity' && (s?.id === 'sup_34plus' || s?.name?.includes('34') || s?.cortex?.includes('34'))
    );

    // Extraer datos logísticos o usar fallbacks seguros
    const environmentVenue = patientData?.logistics_profile?.environment?.venue || 'HOME';
    const cookType = patientData?.logistics_profile?.cook_type || 'SELF';

    // -------------------------------------------------------------------------
    // MOTOR DE REGLAS DE PERIODIZACIÓN CELULAR (28 DÍAS - CDSS v2.1)
    // -------------------------------------------------------------------------

    // Normalización de Banderas Rojas a Tokens Minúsculos ("tvp", "fractura")
    const normalizeRedFlags = (pathologyList = []) => {
        return pathologyList.map(p => {
            const str = (typeof p === 'string' ? p : p?.nombre || p?.name || '').toLowerCase();
            if (str.includes('trombosis') || str.includes('coágulo') || str.includes('tvp')) return 'tvp';
            if (str.includes('fractura') || str.includes('fisura')) return 'fractura';
            return typeof p === 'string' ? p : (p?.nombre || p?.name || '');
        });
    };

    // 1. Evaluación de Triggers Clínicos y Tetra-Estratificación Etaria (Lactante < 2 | Juvenil 2-17 | Adulto 18-64 | Geriatría ≥ 65)
    const pInfo = patientData?.identityLock?.patientInfo;
    const resolvedChronoAge = extractPatientAge(patientData, null);
    const ageCandidate = resolvedChronoAge !== null ? resolvedChronoAge : 30;
    const isLactante = (ageCandidate < 2) && Boolean(resolvedChronoAge !== null || patientData?.isLactante || (pInfo?.dob_year && (new Date().getFullYear() - pInfo.dob_year < 2)));
    const isJuvenilAdolescente = (!isLactante && ageCandidate < 18) && Boolean(resolvedChronoAge !== null || patientData?.isPediatrico || (pInfo?.dob_year && (new Date().getFullYear() - pInfo.dob_year < 18)));
    const isGeriatric = ageCandidate >= 65 || patientData?.isGeriatrico;
    const isLactanteOrPediatric = isLactante || isJuvenilAdolescente;

    const rawDiag = patientData?.clinical_dossier?.human_approved_diagnosis || patientData?.preliminary_diagnosis || [];
    const diagStrings = rawDiag.map(d => (typeof d === 'string' ? d : (d?.nombre || d?.name || '')).toLowerCase());
    
    const hasGutIssue = diagStrings.some(s => s.includes('absorción') || s.includes('intestinal') || s.includes('digest') || s.includes('leaky') || s.includes('k90')) || patientData?.digestive_profile?.has_issues;
    const hasThyroidIssue = diagStrings.some(s => s.includes('tiroid') || s.includes('hormon')) || patientData?.history?.hasThyroidIssue;
    const hasRenalIssue = diagStrings.some(s => s.includes('renal') || s.includes('riñón')) || (patientData?.vitals?.creatinine > 1.2);
    const hasDVTOrFracture = diagStrings.some(s => s.includes('tvp') || s.includes('trombosis') || s.includes('fractura')) || patientData?.history?.hasDVT || patientData?.history?.hasFracture;

    // 2. Cascadas Algorítmicas de Frecuencia Cardíaca (FCM / LTHR)
    const age = ageCandidate;
    const fcm_estimada = 220 - (age || 30);
    const baseline_metric = patientData?.biomarkers?.lthr || patientData?.biomarkers?.fcm_real || patientData?.vitals?.fc_max || fcm_estimada;
    const isThresholdMetric = !!patientData?.biomarkers?.lthr;

    const zona2Min = Math.round(0.69 * baseline_metric);
    const zona2Max = Math.round(0.83 * baseline_metric);

    // Corrección del parámetro fisiológico (Zone 5)
    const zona5Multiplier = isThresholdMetric ? 1.06 : 0.90;
    const zona5Min = Math.round(zona5Multiplier * baseline_metric);
    const zona5Target = isThresholdMetric 
        ? `> ${zona5Min} lpm (Umbral LTHR)` 
        : `${zona5Min} - ${baseline_metric} lpm (FCM Máx)`;

    // 3. Estructura de las 4 Fases de Periodización Celular (Tetra-Estratificación: Lactante <2 | Juvenil 2-17 | Adulto 18-64 | Geriatría ≥65)
    const periodizationPhases = isLactante ? {
        fase1: {
            nombre_completo: "Fase 1 (Maduración Digestiva y Barrera Intestinal) [Días 1-7]",
            dias: "Días 1-7",
            estado: "ACTIVO",
            gut_lock_status: "✅ Preservación de Mucosa Intestinal Pediátrica y Tolerancia L-OMS.",
            nutrition: "Lactancia Materna a Libre Demanda / Fórmula de Continuación Pediátrica + Introducción Progresiva de Papillas Caseras Monocomponente (Ablactación Guiada).",
            supplementation: "Soporte Nutricional Pediátrico bajo Supervisión del Pediatra Tratante (NOM-043 / COFEPRIS).",
            movement: "Estimulación Psicomotriz Suave: Tiempo Boca Abajo (Tummy Time) 3-5 min varias veces al día + Movilización Pasiva de Extremidades."
        },
        fase2: {
            nombre_completo: "Fase 2 (Diversificación Alimentaria y Tolerancia) [Días 8-14]",
            dias: "Días 8-14",
            estado: "ACTIVO",
            nutrition: "Introducción Guiada de Alimentos Sólidos (BLW / Purés caseros de verduras y frutas). Evaluación de tolerancia alimentaria (Regla de 3 Días).",
            zona2_range: "Estimulación del Gateo Activo y Rodamientos Libres en Tapete de Juego.",
            smr_status: "✅ Juego Interactivo Libre: Coordinación Mano-Boca y Coordinación Motora Gruesa."
        },
        fase3: {
            nombre_completo: "Fase 3 (Neurodesarrollo y Coordinación Psicomotriz) [Días 15-21]",
            dias: "Días 15-21",
            estado: "ACTIVO",
            nutrition: "Inclusión de Proteínas Pediátricas Suaves (Yema de Huevo cocida, Pollo en papilla) + Mantenimiento de Leche Materna / Fórmula Pediátrica.",
            zona5_target: "Juego de Coordinación Motora Fina y Alcanzado de Objetos (Estimulación Cefálica y Sedestación).",
            strength: "Favorecer la Posición Sentada Independiente y Fuerza Troncal en Juego Activo."
        },
        fase4: {
            nombre_completo: "Fase 4 (Consolidación Ponderal y Seguimiento L-OMS) [Días 22-28]",
            dias: "Días 22-28",
            estado: "ACTIVO",
            detox_status: "✅ Monitoreo Ponderal Fisiológico L-OMS: Evaluación de Crecimiento Longitudinal (Peso y Talla en Báscula Pediátrica).",
            activity: "Consolidación de 2 a 3 comidas complementarias al día respetando señales de saciedad + Seguimiento con Pediatra Tratante."
        }
    } : isJuvenilAdolescente ? {
        fase1: {
            nombre_completo: "Fase 1 (Soporte Óseo y Crecimiento Estatural) [Días 1-7]",
            dias: "Días 1-7",
            estado: "ACTIVO",
            gut_lock_status: hasGutIssue 
                ? "🔒 ASIMILACIÓN JUVENIL: Sellado Gut-Lock con Probióticos y Micronutrientes de Desarrollo."
                : "✅ Barrera Intestinal Juvenil Estable.",
            nutrition: "Nutrición para Crecimiento Óseo (Proteína Compleja, Calcio Fisiológico, Vitamina D3, Cero Restricción Calórica Extrema).",
            supplementation: "Multivitamínico Pediátrico / Juvenil Adaptado según Recomendación Clínica.",
            movement: "Juegos Multideportivos y Calistenia Suave: 30-45 min de Actividad Física Divertida y Variada."
        },
        fase2: {
            nombre_completo: "Fase 2 (Energía Escolar y Densidad de Micronutrientes) [Días 8-14]",
            dias: "Días 8-14",
            estado: "ACTIVO",
            nutrition: "Snacks Escolares de Alta Densidad Nutricional (Frutas Frescas, Semillas, Cereales Integrales y Proteínas Limpias).",
            zona2_range: `Deporte Formativo y Recreativo: ${Math.round(0.65 * baseline_metric)} - ${Math.round(0.80 * baseline_metric)} lpm | 3-4 sesiones/semana`,
            smr_status: "✅ Estiramiento Dinámico Juvenil + Movilidad Articular Activa (⛔ Cero Foam Roller Traumático)."
        },
        fase3: {
            nombre_completo: "Fase 3 (Habilidades Motoras y Coordinación Juvenil) [Días 15-21]",
            dias: "Días 15-21",
            estado: "ACTIVO",
            nutrition: "Soporte de Proteínas para Crecimiento Estatural y Reconstrucción Muscular en Desarrollo.",
            zona5_target: "Juegos Veloces y Deporte en Equipo (Aceleraciones Cortas y Trabajo de Agilidad Juvenil).",
            strength: "Entrenamiento de Peso Corporal y Autocarga (Flexiones, Sentadillas, Saltos con Técnica Segura - RIR 3-4)."
        },
        fase4: {
            nombre_completo: "Fase 4 (Consolidación de Hábitos y Crecimiento Ponderal) [Días 22-28]",
            dias: "Días 22-28",
            estado: "ACTIVO",
            detox_status: "✅ Monitoreo Fisiológico de Curva de Crecimiento Puberal y Masa Magra en Desarrollo.",
            activity: "Descarga Activa: Juegos Libres y Seguimiento Ponderal Pediátrico / Hebiátrico."
        }
    } : isGeriatric ? {
        fase1: {
            nombre_completo: "Fase 1 (Estabilización Digestiva y Nutrición Antiinflamatoria Geriátrica) [Días 1-7]",
            dias: "Días 1-7",
            estado: "ACTIVO",
            gut_lock_status: hasGutIssue 
                ? "🔒 COMPUERTA DE ASIMILACIÓN GERIÁTRICA: Sellado de Mucosa Digestiva de Alta Digestibilidad (Glutamina Suave & Probióticos Esporulados)."
                : "✅ Mucosa Digestiva Geriátrica Preservada.",
            nutrition: hasRenalIssue 
                ? "Nutrición Geriátrica de Protección Renal (Proteína Fraccionada 0.8g/kg + Densidad de Micronutrientes)"
                : "Nutrición Inmunointestinal Antiinflamatoria (Cero Gluten/Lácteos, Fácil Masticación y Digestibilidad)",
            supplementation: "Mañana: Soporte Celular 33Plus® (Dosificación Geriátrica) | Noche: Soporte Tisular 34Plus® (Disuelto en 350-500 ml de agua 💧 según tolerancia cardíaca/renal)",
            movement: "Caminatas Ligeras Postprandiales de 10-15 min a paso cómodo + Respiración Diafragmática y Movilidad Articular Suave"
        },
        fase2: {
            nombre_completo: "Fase 2 (Densidad Nutricional y Preservación Muscular Anti-Sarcopenia) [Días 8-14]",
            dias: "Días 8-14",
            estado: "ACTIVO",
            nutrition: "Framework 5x5x5 Geriátrico: Alimentos Defensores Suaves de Fácil Masticación (Polifenoles, Aceite de Oliva VE, Frutos Rojos).",
            zona2_range: `Movilidad Aeróbica Adaptada Geriátrica: ${Math.round(0.60 * baseline_metric)} - ${Math.round(0.75 * baseline_metric)} lpm | 20-30 min (3 sesiones/semana)`,
            smr_status: "✅ Movilización Articular Activa-Asistida + Estiramientos Miofasciales Suaves (⛔ Cero Foam Roller Traumático por Fragilidad Tisular)"
        },
        fase3: {
            nombre_completo: "Fase 3 (Propiocepción, Equilibrio y Prevención de Caídas) [Días 15-21]",
            dias: "Días 15-21",
            estado: "ACTIVO",
            nutrition: "Proteína de Alta Biodisponibilidad Fraccionada (1.0 - 1.2g/kg/día distribuida en 3 comidas para superar la Resistencia Anabólica Geriátrica)",
            zona5_target: "Entrenamiento Funcional Geriátrico: Apoyo Monopodal Asistido, Levantamiento de Silla (Sit-to-Stand) y Prevención Activa de Caídas",
            strength: "Fuerza Funcional con Banda Elástica o Peso Corporal Suave (RPE 4-6 / Esfuerzo Moderado Seguro)"
        },
        fase4: {
            nombre_completo: "Fase 4 (Consolidación de Vitalidad y Monitoreo de Autonomía) [Días 22-28]",
            dias: "Días 22-28",
            estado: "ACTIVO",
            detox_status: "✅ Soporte Fisiológico y Depuración Hepato-Renal Suave con Antioxidantes Puros (Vitamina C, Magnesio, CoQ10).",
            activity: "Mantenimiento de Rutinas de Movilidad Diaria + Evaluación de Autonomía Funcional (Escala Barthel/Katz) y Citas de Seguimiento."
        }
    } : {
        fase1: {
            nombre_completo: "Fase 1 (Remodelación de Barrera y Estabilización de Membrana) [Días 1-7]",
            dias: "Días 1-7",
            estado: "ACTIVO",
            gut_lock_status: hasGutIssue 
                ? "🔒 COMPUERTA DE ASIMILACIÓN ACTIVA: Protocolo de Sellado Epitelial (L-Glutamina, Mucílago, Probióticos Esporulados)."
                : "✅ Barrera Intestinal Estable (Sin hiperpermeabilidad crítica detectada).",
            nutrition: hasRenalIssue 
                ? "Nutrición Basada en Plantas (PLADO - ERC)"
                : hasThyroidIssue 
                    ? "Inmunointestinal (Cero Gluten/Lácteos) + Smart Carbs Cíclicos Tiroideos"
                    : "Inmunointestinal (Cero Gluten / Cero Lácteos / Cero Ultraprocesados)",
            supplementation: "Mañana: Fórmula 33Plus® (Ignición Mitocondrial) | Noche: Fórmula 34Plus® (Ingeniería Tisular en MÍNIMO 500 ml de agua 💧)",
            movement: "Caminatas postprandiales de 20 min (estabilización insulínica) + Respiración diafragmática vagal"
        },
        fase2: {
            nombre_completo: "Fase 2 (Flexibilidad Metabólica y Sincronización de Ejes) [Días 8-14]",
            dias: "Días 8-14",
            estado: "ACTIVO",
            nutrition: "Framework 5x5x5 (Dr. William Li) - Adición de 5 alimentos defensores diarios (Grand Slammers). Cero conteo calórico.",
            zona2_range: `${zona2Min} - ${zona2Max} lpm (${isThresholdMetric ? 'LTHR' : 'FCM'}) | 3-4 sesiones/semana (30-40 min)`,
            smr_status: hasDVTOrFracture 
                ? "⛔ SMR BLOQUEADO (Contraindicación por sospecha de TVP / Fractura)"
                : "✅ SMR (Foam Roller) en hipertonías -> Estiramiento Miofascial dinámico -> Eslingas Oblicuas"
        },
        fase3: {
            nombre_completo: "Fase 3 (Optimización del Exoesqueleto y Capacidad Aeróbica) [Días 15-21]",
            dias: "Días 15-21",
            estado: "ACTIVO",
            nutrition: "Lyon Protocol 2.0: Mínimo 30g proteína de alta calidad por comida (Umbral de Leucina mTOR)",
            zona5_target: `Intervalos 4x4 HIIT en Zona 5: ${zona5Target} | 1-2 sesiones/semana (VO2 Máx)`,
            strength: "Fuerza Neuromuscular Multiarticular Compleja (RIR 1-2)"
        },
        fase4: {
            nombre_completo: "Fase 4 (Depuración Celular y Supercompensación Fisiológica) [Días 22-28]",
            dias: "Días 22-28",
            estado: hasGutIssue ? "⚠️ RETENIDO" : "ACTIVO",
            detox_status: hasGutIssue 
                ? "⚠️ RETENIDO / PENDIENTE DE VALIDACIÓN: Sujeto a Re-evaluación de Zonulina / LBP en suero a las 4 Semanas. Detoxificación profunda Fase 1/2 bloqueada por seguridad."
                : "✅ ACTIVO POR DEFECTO: Depuración Hepática Fase II y precursores de Glutatión habilitados de forma segura.",
            activity: "Tapering Neuroendocrino: Reducción del 40-50% del volumen de entrenamiento manteniendo intensidad."
        }
    };

    const translateVenue = (v) => {
        if (v === 'HOME') return 'Casa';
        if (v === 'WORK') return 'Oficina';
        if (v === 'STREET') return 'Calle / Restaurante';
        return v;
    };

    const translateCook = (c) => {
        if (c === 'SELF') return 'Yo mismo';
        if (c === 'FAMILY') return 'Familia';
        if (c === 'STAFF') return 'Personal';
        if (c === 'BUYING') return 'Pre-hecha';
        return c;
    };

    // -------------------------------------------------------------------------
    // ALGORITMO DETERMINISTA DE EDAD METABÓLICA REVERSIBLE (SSoTT v2.8.4 — Cero Literales Fantasma)
    // -------------------------------------------------------------------------
    const baseAge = resolvedChronoAge !== null ? resolvedChronoAge : ageCandidate;

    // 1. Delta IMC Real (Cero fallback a 26.8; si falta IMC, aporta 0.0)
    const realWeightKg = parseFloat(
        patientData?.clinical_dossier?.bioenergetics?.weightKg ??
        patientData?.vitals?.weight ??
        patientData?.weight_kg
    );
    const realHeightCm = parseFloat(
        patientData?.clinical_dossier?.bioenergetics?.heightCm ??
        patientData?.vitals?.height ??
        patientData?.height_cm
    );
    const bmiVal = parseFloat(
        patientData?.clinical_dossier?.bioenergetics?.bmi ??
        patientData?.bioenergetics?.bmi ??
        patientData?.vitals?.bmi ??
        (realWeightKg > 0 && realHeightCm > 0 ? realWeightKg / Math.pow(realHeightCm / 100, 2) : NaN)
    );
    const deltaIMC = !Number.isFinite(bmiVal) ? 0.0 : (bmiVal >= 30 ? 3.0 : bmiVal >= 25 ? 1.5 : 0.0);

    // 2. Carga Alostática Ponderada y Acotada desde `clinical_dossier.ifm_nodes_matrix` Real
    const rawIfmMatrix = Array.isArray(patientData?.clinical_dossier?.ifm_nodes_matrix)
        ? patientData.clinical_dossier.ifm_nodes_matrix
        : [];
    const getNodeSeverityRank = (statusStr = '') => {
        const st = String(statusStr || '').toUpperCase();
        if (st.includes('CRÍTIC') || st.includes('CRITIC')) return 3;
        if (st.includes('PRIORIDAD_ALTA') || st.includes('ALTA')) return 2;
        if (/^(HOME[ÓO]STASIS|OPTIMO|ÓPTIMO|NORMAL|VALIDADO_NORMAL)$/i.test(st.trim())) return 0;
        return st ? 1 : 0;
    };
    const activeIfmNodes = rawIfmMatrix.filter((node) => {
        if (!node || typeof node !== 'object') return false;
        const cie = String(node.cie10 || '').trim().toUpperCase();
        if (cie === 'Z00.0' || cie === 'Z00.1') return false;
        return getNodeSeverityRank(node.status) > 0;
    });

    const rawIfmLoad = activeIfmNodes.reduce((acc, node) => {
        const rank = getNodeSeverityRank(node.status);
        if (rank === 3) return acc + 0.75;
        if (rank === 2) return acc + 0.50;
        return acc + 0.25;
    }, 0.0);

    // Respaldo honesto si el expediente aún no tiene nodos IFM pero presenta hallazgos reales en Electret (.itemsDict)
    const realVascularRes = parseFloat(
        patientData?.scan_data?.electret_metrics?.cardiovascular?.itemsDict?.resistencia_vascular?.value ??
        patientData?.scan_data?.electret_metrics?.cardiovascular?.resistencia_vascular?.value
    );
    const realNeutralFats = parseFloat(
        patientData?.scan_data?.electret_metrics?.blood_lipids?.itemsDict?.grasas_neutras_mb?.value ??
        patientData?.scan_data?.electret_metrics?.blood_lipids?.grasas_neutras_mb?.value
    );
    const fallbackElectretLoad = activeIfmNodes.length === 0
        ? ((Number.isFinite(realVascularRes) && realVascularRes > 1.2 ? 1.5 : 0.0) +
           (Number.isFinite(realNeutralFats) && realNeutralFats > 1.3 ? 1.0 : 0.0))
        : 0.0;

    const cappedSystemicLoad = Math.min(6.0, rawIfmLoad > 0 ? rawIfmLoad : fallbackElectretLoad);
    const totalAllostaticLoad = isLactanteOrPediatric ? 0.0 : Math.min(8.0, deltaIMC + cappedSystemicLoad);

    const edadMetabolica = Math.round(baseAge + totalAllostaticLoad);
    const deltaSobrecarga = Math.max(0, edadMetabolica - Math.round(baseAge));
    const metaReversion = Math.max(Math.round(baseAge), edadMetabolica - Math.min(5, deltaSobrecarga));

    // Construcción dinámica de los ejes dominantes reales a partir de `ifm_nodes_matrix`
    const sortedDominantNodes = [...activeIfmNodes].sort((a, b) => {
        const rankDiff = getNodeSeverityRank(b.status) - getNodeSeverityRank(a.status);
        if (rankDiff !== 0) return rankDiff;
        const countB = Array.isArray(b.key_biomarkers) ? b.key_biomarkers.length : 0;
        const countA = Array.isArray(a.key_biomarkers) ? a.key_biomarkers.length : 0;
        return countB - countA;
    });
    const topAxisNames = sortedDominantNodes
        .slice(0, 3)
        .map((n) => String(n.nodeName || '').replace(/^\d+\.\s*/, '').trim().toLowerCase())
        .filter(Boolean);
    const joinDynamicAxes = (axes) => {
        if (axes.length === 0) return 'sus indicadores bioenergéticos evaluados';
        if (axes.length === 1) return axes[0];
        const head = axes.slice(0, -1).join('; ');
        const last = axes[axes.length - 1];
        const conj = /^(?:i|hi(?![aeouáéóú]))/iu.test(last) ? ' e ' : ' y ';
        return `${head}${conj}${last}`;
    };
    const dominantAxesProse = joinDynamicAxes(topAxisNames);
    const extraActiveNodesCount = Math.max(0, sortedDominantNodes.length - 3);
    const metabolicCardSubLabel = deltaSobrecarga > 0
        ? (sortedDominantNodes.length > 0
            ? `${sortedDominantNodes.length} ${sortedDominantNodes.length === 1 ? 'Nodo IFM Activo' : 'Nodos IFM Activos'}`
            : 'Sobrecarga Metabólica Reversible')
        : 'Homeostasis Conservada';

    const targetKcalVal =
        patientData?.clinical_dossier?.bioenergetics?.targetKcal ||
        orthoPrescription?.bioenergetics_summary?.targetKcal ||
        patientData?.nutrition?.protocol?.target ||
        2200;
    const targetKcalFormatted = `${String(Math.round(Number(targetKcalVal) || 2200)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')} kcal`;

    // Cálculo dinámico de ventana de seguimiento a 28 días (Ciclo 2 - Período de 28 Días)
    const defaultFollowupDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 28);
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        if (d.getDay() === 6) d.setDate(d.getDate() + 2);
        const raw = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    })();

    const scheduledAppt = patientData?.scheduledAppointment || patientData?.proxima_cita || {};
    const apptDate = scheduledAppt.chosenDate || scheduledAppt.fecha || defaultFollowupDate;
    const apptTime = scheduledAppt.chosenTime || scheduledAppt.horario || '10:00 AM';
    const citationFolio =
        patientData?.profile?.citationId ||
        patientData?.profile?.citaId ||
        patientData?.identificacion?.idCita ||
        patientData?.identificacion?.citaId ||
        apiContext?.citaId ||
        apiContext?.idCita ||
        'S/F';
    const apptFolio = scheduledAppt.folio ? `#SOL-${scheduledAppt.folio}` : `#SOL-${citationFolio}`;
    const patientName = patientData?.profile?.name || patientData?.identificacion?.nombreCompleto || patientData?.identificacion?.nombre || 'Paciente';

    return (
        <div className="space-y-6 font-sans pb-12">
            {/* --- ACORDEÓN PADRE: CALENDARIO Y RUTA DE EJECUCIÓN --- */}
            <Accordion
                title="Calendario y Ruta de Ejecución"
                id="accordion-calendar-parent"
                isOpen={openSections.parentCalendar}
                onToggle={() => toggleSection('parentCalendar')}
                variant="parent"
            >
                <div className="space-y-6">

                    {/* --- CHILD ACCORDION 1: RELOJ BIOLÓGICO Y EDAD METABÓLICA --- */}
                    <Accordion
                        title="Reloj Biológico y Edad Metabólica"
                        id="accordion-metabolic-clock"
                        isOpen={openSections.childMetabolicClock !== undefined ? openSections.childMetabolicClock : true}
                        onToggle={() => toggleSection('childMetabolicClock')}
                    >
                        <div id="card-metabolic-clock" className="bg-tilo-bg-base/40 rounded-2xl p-6 border border-tilo-border space-y-5">
                            
                            {/* Header del Bloque */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-tilo-border">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-tilo-primary/10 border border-tilo-primary/20 flex items-center justify-center text-tilo-primary">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-tilo-text-main">Auditoría Bioenergética y Reología Tisular</div>
                                        <div className="text-[10px] text-tilo-text-muted uppercase font-bold tracking-wider">Matriz Funcional de 7 Nodos IFM (SSoTT)</div>
                                    </div>
                                </div>
                                {deltaSobrecarga > 0 ? (
                                    <span className="bg-[#E30613]/10 text-[#E30613] border border-[#E30613]/20 text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase flex items-center gap-1 w-fit">
                                        <Activity className="w-3 h-3" />
                                        Sobrecarga Reversible: +{deltaSobrecarga} {deltaSobrecarga === 1 ? 'Año' : 'Años'}
                                    </span>
                                ) : (
                                    <span className="bg-tilo-success/10 text-tilo-success border border-tilo-success/20 text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase flex items-center gap-1 w-fit">
                                        <Shield className="w-3 h-3" />
                                        Homeostasis Metabólica Conservada
                                    </span>
                                )}
                            </div>

                            {/* Bento de Edades Comparativas */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-xl border border-tilo-border/60 flex flex-col items-center justify-center text-center transition-all duration-300">
                                    <span className="text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider mb-1">
                                        Edad Cronológica
                                    </span>
                                    <span className="text-2xl font-bold text-tilo-text-main dashboard-data-text">
                                        {Math.round(baseAge)} <span className="text-xs font-normal text-tilo-text-muted">años</span>
                                    </span>
                                    <span className="text-[9px] text-tilo-text-muted mt-1 uppercase font-semibold">Registro de Nacimiento</span>
                                </div>

                                <div className={`${deltaSobrecarga > 0 ? 'bg-[#E30613]/5 dark:bg-[#E30613]/10 border-[#E30613]/20' : 'bg-tilo-success/5 dark:bg-tilo-success/10 border-tilo-success/20'} p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300`}>
                                    <span className={`text-[10px] uppercase font-bold ${deltaSobrecarga > 0 ? 'text-[#E30613]' : 'text-tilo-success'} tracking-wider mb-1`}>
                                        Edad Metabólica Actual
                                    </span>
                                    <span className={`text-2xl font-black ${deltaSobrecarga > 0 ? 'text-[#E30613]' : 'text-tilo-success'} dashboard-data-text`}>
                                        {edadMetabolica} <span className={`text-xs font-semibold ${deltaSobrecarga > 0 ? 'text-[#E30613]/80' : 'text-tilo-success/80'}`}>años</span>
                                    </span>
                                    <span className={`text-[9px] ${deltaSobrecarga > 0 ? 'text-[#E30613]' : 'text-tilo-success'} mt-1 uppercase font-bold`}>{metabolicCardSubLabel}</span>
                                </div>

                                <div className="bg-tilo-success/5 dark:bg-tilo-success/10 p-4 rounded-xl border border-tilo-success/20 flex flex-col items-center justify-center text-center transition-all duration-300">
                                    <span className="text-[10px] uppercase font-bold text-tilo-success tracking-wider mb-1">
                                        Meta Ciclo 1 (28 Días)
                                    </span>
                                    <span className="text-2xl font-black text-tilo-success dashboard-data-text">
                                        {metaReversion} <span className="text-xs font-semibold text-tilo-success/80">años</span>
                                    </span>
                                    <span className="text-[9px] text-tilo-success mt-1 uppercase font-bold">🎯 Objetivo Ciclo 1</span>
                                </div>
                            </div>

                            {/* Párrafo de Poder Empático Basado en `ifm_nodes_matrix` Real */}
                            <div className="bg-white/80 dark:bg-slate-800/80 p-4 rounded-xl border border-tilo-border text-xs text-tilo-text-main leading-relaxed space-y-2">
                                {deltaSobrecarga > 0 ? (
                                    <>
                                        <p>
                                            {resolvePatientSex(patientData).isFemale ? 'Estimada' : 'Estimado'} <strong>{patientName}</strong>: su edad cronológica es de <strong>{Math.round(baseAge)} años</strong>, y el análisis integral de sus ejes de <strong>{dominantAxesProse}</strong>{extraActiveNodesCount > 0 ? ` (junto con ${extraActiveNodesCount} ${extraActiveNodesCount === 1 ? 'nodo funcional adicional' : 'nodos funcionales adicionales'} en vigilancia activa)` : ''} indica que sus células y tejidos operan actualmente con una <strong>Edad Metabólica de {edadMetabolica} años</strong>.
                                        </p>
                                        <p className="text-tilo-text-muted">
                                            Esta diferencia de <strong>+{deltaSobrecarga} {deltaSobrecarga === 1 ? 'año' : 'años'}</strong> refleja un esfuerzo adaptativo adicional para sostener su homeostasis diaria. La excelente noticia es que <strong>esta sobrecarga metabólica es reversible</strong>.
                                        </p>
                                    </>
                                ) : (
                                    <p>
                                        {resolvePatientSex(patientData).isFemale ? 'Estimada' : 'Estimado'} <strong>{patientName}</strong>: su edad cronológica de <strong>{Math.round(baseAge)} años</strong> guarda equilibrio directo con su <strong>Edad Metabólica actual ({edadMetabolica} años)</strong>, reflejando una reserva funcional conservada en sus sistemas evaluados.
                                    </p>
                                )}
                                <p className="font-semibold text-tilo-text-main pt-1 border-t border-tilo-border/60">
                                    {(has33Plus || has34Plus) ? (
                                        <>Al apegarse a su prescripción nutricional de {targetKcalFormatted} y activar la modulación celular con <strong>33Plus®</strong> y la reparación tisular con <strong>34Plus®</strong> conforme a su pauta personalizada, nuestro objetivo en estos primeros 28 días es {deltaSobrecarga > 0 ? <>hacer retroceder su reloj biológico hacia los <strong>{metaReversion} años</strong></> : <>consolidar su vitalidad metabólica en <strong>{metaReversion} años</strong></>}, restaurando la ligereza endotelial y su energía diaria.</>
                                    ) : (
                                        <>Al apegarse a su prescripción nutricional antiinflamatoria de {targetKcalFormatted}, hidratación constante y estudios clínicos de control (manteniendo en pausa preventiva la suplementación concentrada), nuestro objetivo en estos primeros 28 días es {deltaSobrecarga > 0 ? <>hacer retroceder su reloj biológico hacia los <strong>{metaReversion} años</strong></> : <>proteger su equilibrio metabólico en <strong>{metaReversion} años</strong></>} con total bioseguridad.</>
                                    )}
                                </p>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 2: PRÓXIMA CITA DE SEGUIMIENTO --- */}
                    <Accordion
                        title="Próxima Cita de Seguimiento"
                        id="accordion-followup-appointment"
                        isOpen={openSections.childEvolutionRoute !== undefined ? openSections.childEvolutionRoute : true}
                        onToggle={() => toggleSection('childEvolutionRoute')}
                    >
                        <div id="card-followup-appointment" className="bg-tilo-bg-base/40 rounded-2xl p-6 border border-tilo-border space-y-4">
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-tilo-border">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-tilo-primary/10 border border-tilo-primary/20 flex items-center justify-center text-tilo-primary">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-tilo-text-main">Control Clínico y Evaluación de Evolución</div>
                                        <div className="text-[10px] text-tilo-text-muted uppercase font-bold tracking-wider">Ciclo 2 • Período de 28 Días</div>
                                    </div>
                                </div>
                                <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase w-fit">
                                    ⏳ En Proceso de Confirmación
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-3.5 border border-tilo-border/60">
                                    <span className="text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider block mb-1">
                                        Fecha Solicitada
                                    </span>
                                    <span className="text-sm font-bold text-tilo-text-main dashboard-data-text">
                                        {apptDate}
                                    </span>
                                </div>

                                <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-3.5 border border-tilo-border/60">
                                    <span className="text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider block mb-1">
                                        Horario Preferente
                                    </span>
                                    <span className="text-sm font-bold text-tilo-text-main dashboard-data-text">
                                        {apptTime}
                                    </span>
                                    <span className="text-[9px] text-tilo-text-muted block mt-0.5 uppercase">Ventana: 9:00 AM - 6:00 PM</span>
                                </div>

                                <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-3.5 border border-tilo-border/60">
                                    <span className="text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider block mb-1">
                                        Folio de Solicitud
                                    </span>
                                    <span className="text-sm font-mono font-bold text-tilo-primary">
                                        {apptFolio}
                                    </span>
                                    <span className="text-[9px] text-tilo-text-muted block mt-0.5 uppercase">Recepción T.I.L.O.</span>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-tilo-primary/5 border border-tilo-primary/20 flex items-start gap-2.5 text-xs text-tilo-text-muted leading-relaxed">
                                <Shield className="w-4 h-4 text-tilo-primary shrink-0 mt-0.5" strokeWidth={2} />
                                <p>
                                    <strong className="text-tilo-text-main">Garantía de Continuidad:</strong> La cita queda sujeta a la confirmación de recepción. Usted recibirá la notificación oficial de fecha y enlace a través de WhatsApp y en la Plataforma Digital de Equipo en Acción®.
                                </p>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 3: SEGUIMIENTO DIGITAL EQUIPO EN ACCIÓN® --- */}
                    <Accordion
                        title="Seguimiento Digital y Acompañamiento (Equipo en Acción®)"
                        id="accordion-execution-logistics"
                        isOpen={openSections.childExecutionLogistics !== undefined ? openSections.childExecutionLogistics : true}
                        onToggle={() => toggleSection('childExecutionLogistics')}
                    >
                        <div id="card-execution-logistics" className="bg-tilo-bg-base/40 rounded-2xl p-6 border border-tilo-border space-y-4">
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-tilo-border">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-tilo-primary/10 border border-tilo-primary/20 flex items-center justify-center text-tilo-primary">
                                        <Smartphone className="w-4 h-4" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-tilo-text-main">Plataforma Digital Equipo en Acción®</div>
                                        <div className="text-[10px] text-tilo-text-muted uppercase font-bold tracking-wider">Acompañamiento Diario de Hábitos y Bienestar</div>
                                    </div>
                                </div>
                                <span className="bg-tilo-primary/10 text-tilo-primary border border-tilo-primary/20 text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase w-fit">
                                    Sincronización Móvil
                                </span>
                            </div>

                            <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-xl border border-tilo-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1 max-w-xl">
                                    <div className="text-xs font-bold text-tilo-text-main">
                                        Consulte su Guía de Hábitos y Periodización de 28 Días
                                    </div>
                                    <p className="text-xs text-tilo-text-muted leading-relaxed tabular-nums">
                                        {(has33Plus || has34Plus)
                                            ? `Consulte desde su dispositivo su menú de ${targetKcalFormatted}, registre su caminata diaria (6\u00A0000 a 8\u00A0000 pasos/día), confirme sus tomas programadas de 33Plus® y 34Plus® y dé seguimiento a su descanso nocturno.`
                                            : `Consulte desde su dispositivo su menú de ${targetKcalFormatted}, registre su caminata diaria e hidratación constante (mientras se validan sus estudios de control) y dé seguimiento a su descanso nocturno.`}
                                    </p>
                                </div>

                                <div className="shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            useClinicalToast.getState().showToast({
                                                title: "Acompañamiento Digital Equipo en Acción®",
                                                message: "Su guía personalizada de 28 días se encuentra lista para consulta y envío a través de los canales oficiales de Equipo en Acción®.",
                                                type: "info"
                                            });
                                        }}
                                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C75BC] hover:bg-[#155A92] text-white text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
                                    >
                                        <Smartphone className="w-4 h-4" strokeWidth={2} />
                                        Sincronizar Guía Móvil
                                    </button>
                                </div>
                            </div>

                        </div>
                    </Accordion>

                </div>
            </Accordion>
        </div>
    );
};

export default TabCalendar;
