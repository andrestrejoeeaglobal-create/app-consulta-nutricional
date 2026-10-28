import React from 'react';
import {
    Clock, Coffee, Moon, Sun, Utensils,
    Navigation, Activity, MapPin, Briefcase, User, Smartphone, Shield,
    Layers, Dumbbell, Zap, RefreshCw, Lock
} from 'lucide-react';

export const TabCalendar = ({
    patientData,
    setPatientData,
    apiContext,
    Accordion,
    openSections,
    toggleSection,
    isPhase20EditMode
}) => {
    const has33Plus = patientData?.advanced_supplementation?.some(s => s.name?.includes('33') || s.cortex?.includes('33'));
    const has34Plus = patientData?.advanced_supplementation?.some(s => s.name?.includes('34') || s.cortex?.includes('34'));

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
    const ageCandidate = parseFloat(pInfo?.age !== undefined ? pInfo.age : (patientData?.identificacion?.edad !== undefined ? patientData.identificacion.edad : (patientData?.edad ?? 30))) || 30;
    const isLactante = (ageCandidate < 2) && Boolean(patientData?.isLactante || (pInfo?.dob_year && (new Date().getFullYear() - pInfo.dob_year < 2)));
    const isJuvenilAdolescente = (!isLactante && ageCandidate < 18) && Boolean(patientData?.isPediatrico || (pInfo?.dob_year && (new Date().getFullYear() - pInfo.dob_year < 18)));
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
            supplementation: "Mañana: Soporte Celular 33+ (Dosificación Geriátrica) | Noche: Soporte Tisular 34+ (Disuelto en 350-500 ml de agua 💧 según tolerancia cardíaca/renal)",
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
            supplementation: "Mañana: Fórmula 33+ (Ignición Mitocondrial) | Noche: Fórmula 34+ (Ingeniería Tisular en MÍNIMO 500 ml de agua 💧)",
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
    // ALGORITMO DETERMINISTA DE EDAD METABÓLICA REVERSIBLE (BIOENERGÉTICA T.I.L.O.)
    // -------------------------------------------------------------------------
    const baseAge = parseFloat(ageCandidate) || 60;

    // 1. Delta IMC (Sobrepeso fisiológico >= 25 kg/m2)
    const bmiVal = parseFloat(patientData?.bioenergetics?.bmi || patientData?.vitals?.bmi || (patientData?.weight_kg && patientData?.height_cm ? (patientData.weight_kg / Math.pow(patientData.height_cm/100, 2)) : 26.8)) || 26.8;
    const deltaIMC = bmiVal >= 30 ? 4.0 : bmiVal >= 25 ? 2.5 : 0.0;

    // 2. Delta Vascular (Resistencia Vascular, Viscosidad, Bloqueo de Rama D)
    const vascularRes = parseFloat(patientData?.scan_data?.electret_metrics?.cardiovascular?.resistencia_vascular?.value || 1.58);
    const hasVascularRisk = vascularRes > 1.2 || diagStrings.some(s => s.includes('reactividad') || s.includes('hipertens') || s.includes('i10') || s.includes('vascular'));
    const deltaVascular = hasVascularRisk ? 3.0 : 1.0;

    // 3. Delta Lipídico (Cristal de Colesterol, Grasas Neutras)
    const hasLipidRisk = diagStrings.some(s => s.includes('colesterol') || s.includes('e78') || s.includes('lipíd')) || (parseFloat(patientData?.scan_data?.electret_metrics?.blood_lipids?.grasas_neutras_mb?.value || 1.946) > 1.3);
    const deltaLipidico = hasLipidRisk ? 2.0 : 0.5;

    // 4. Delta TMB / Eficiencia Bioenergética
    const deltaTMB = -0.5;

    // Cálculo Determinista de Edad Metabólica
    const edadMetabolica = Math.round(baseAge + deltaIMC + deltaVascular + deltaLipidico + deltaTMB); // 67 años
    const deltaSobrecarga = Math.max(0, edadMetabolica - Math.round(baseAge)); // +7 años
    const metaReversion = Math.max(Math.round(baseAge), edadMetabolica - 5); // 62 años

    // Datos de la Próxima Cita de Seguimiento
    const scheduledAppt = patientData?.scheduledAppointment || {};
    const apptDate = scheduledAppt.chosenDate || 'Lunes, 23 de noviembre de 2026';
    const apptTime = scheduledAppt.chosenTime || '10:00 AM';
    const apptFolio = scheduledAppt.folio ? `#SOL-${scheduledAppt.folio}` : '#SOL-62801';
    const patientName = patientData?.identificacion?.nombre || patientData?.identificacion?.nombreCompleto || 'Jesús Reyes Salgado';

    return (
        <div className="space-y-6 font-sans pb-12">
            {/* --- ACORDEÓN PADRE: PLAN DE ACCIÓN Y SEGUIMIENTO EJECUTIVO --- */}
            <Accordion
                title="Plan de Acción y Seguimiento Ejecutivo"
                id="accordion-calendar-parent"
                isOpen={openSections.parentCalendar !== undefined ? openSections.parentCalendar : true}
                onToggle={() => toggleSection('parentCalendar')}
                variant="parent"
            >
                <div className="flex flex-col gap-6 pt-2">

                    {/* ========================================================= */}
                    {/* TARJETA 1: RELOJ BIOLÓGICO Y EDAD METABÓLICA REVERSIBLE */}
                    {/* ========================================================= */}
                    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/20 flex items-center justify-center text-[#1C75BC]">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                                        Reloj Biológico & Edad Metabólica
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Auditoría Bioenergética y Resistencia Endotelial
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E30613]/10 text-[#E30613] border border-[#E30613]/20">
                                    <Activity className="w-3.5 h-3.5" />
                                    Sobrecarga Reversible: +{deltaSobrecarga} Años
                                </span>
                            </div>
                        </div>

                        {/* Comparativo de Edades Bento */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
                            <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Edad Cronológica
                                </span>
                                <span className="text-3xl font-black text-slate-800">
                                    {Math.round(baseAge)} <span className="text-sm font-semibold text-slate-500">años</span>
                                </span>
                                <span className="text-[10px] text-slate-400 mt-1 font-medium">Fecha de Nacimiento</span>
                            </div>

                            <div className="bg-[#E30613]/5 p-4 rounded-xl border border-[#E30613]/20 flex flex-col items-center justify-center text-center shadow-xs relative">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#E30613] mb-1">
                                    Edad Metabólica Actual
                                </span>
                                <span className="text-3xl font-black text-[#E30613]">
                                    {edadMetabolica} <span className="text-sm font-semibold text-[#E30613]/80">años</span>
                                </span>
                                <span className="text-[10px] text-[#E30613]/90 mt-1 font-bold">Sobrecarga Vascular & Lipídica</span>
                            </div>

                            <div className="bg-[#3AAA35]/5 p-4 rounded-xl border border-[#3AAA35]/20 flex flex-col items-center justify-center text-center shadow-xs">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3AAA35] mb-1">
                                    Meta de Reversión (28 Días)
                                </span>
                                <span className="text-3xl font-black text-[#3AAA35]">
                                    {metaReversion} <span className="text-sm font-semibold text-[#3AAA35]/80">años</span>
                                </span>
                                <span className="text-[10px] text-[#3AAA35] mt-1 font-bold">🎯 Objetivo Ciclo 1</span>
                            </div>
                        </div>

                        {/* Copy Empático y Clínico de Reversibilidad */}
                        <div className="bg-white/80 p-4 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed space-y-2">
                            <p>
                                Estimado/a <strong>{patientName}</strong>: su edad cronológica es de <strong>{Math.round(baseAge)} años</strong>, pero el análisis integral de sus biomarcadores de reactividad vascular, viscosidad sanguínea y cristal de colesterol revela que sus células y vasos sanguíneos operan actualmente con una <strong>Edad Metabólica de {edadMetabolica} años</strong>.
                            </p>
                            <p>
                                Esta diferencia de <strong>+{deltaSobrecarga} años</strong> refleja un esfuerzo adicional que sus tejidos realizan para mantener la homeostasis. La excelente noticia es que <strong>la edad metabólica es 100% reversible</strong>.
                            </p>
                            <p className="font-semibold text-slate-900">
                                Al apegarse a su prescripción nutricional defensora de 1,994 kcal y activar la ignición celular con la fórmula <strong>33Plus®</strong> (mañana) y la reparación tisular con <strong>34Plus®</strong> (noche), nuestro objetivo en estos primeros 28 días es hacer retroceder su reloj biológico hacia los <strong>{metaReversion} años</strong>, restaurando la ligereza endotelial y su vitalidad.
                            </p>
                        </div>
                    </div>

                    {/* ========================================================= */}
                    {/* TARJETA 2: PRÓXIMA CITA DE SEGUIMIENTO (COMPROMISO)       */}
                    {/* ========================================================= */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#1C75BC]/10 border border-[#1C75BC]/20 flex items-center justify-center text-[#1C75BC]">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                                        Próxima Cita de Seguimiento
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Control Clínico y Evaluación de Evolución (Ciclo 2 • 28 Días)
                                    </p>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                                ⏳ En Proceso de Confirmación
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                    Fecha Solicitada
                                </span>
                                <span className="text-sm font-extrabold text-slate-900">
                                    {apptDate}
                                </span>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                    Horario Preferente
                                </span>
                                <span className="text-sm font-extrabold text-slate-900">
                                    {apptTime}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Ventana: 9:00 AM - 6:00 PM</span>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                    Folio de Solicitud
                                </span>
                                <span className="text-sm font-mono font-black text-[#1C75BC]">
                                    {apptFolio}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Recepción T.I.L.O.</span>
                            </div>
                        </div>

                        <div className="mt-4 p-3 rounded-xl bg-blue-50/50 border border-blue-100 flex items-start gap-2.5 text-xs text-slate-600">
                            <Shield className="w-4 h-4 text-[#1C75BC] shrink-0 mt-0.5" />
                            <p>
                                <strong>Garantía de Continuidad:</strong> La cita queda sujeta a la confirmación de recepción. El paciente recibirá la notificación oficial de fecha y enlace a través de WhatsApp y en la App móvil VitalLoop®.
                            </p>
                        </div>
                    </div>

                    {/* ========================================================= */}
                    {/* TARJETA 3: SINCRONIZACIÓN DIGITAL (APP VITALLOOP & BANDA H7) */}
                    {/* ========================================================= */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-[#1C75BC]/90 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 max-w-xl">
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                                        Ecosistema Digital
                                    </span>
                                    <span className="text-xs text-white/80 font-medium">Banda Biométrica Inteligente H7 BLE</span>
                                </div>
                                <h3 className="text-base font-black tracking-wide text-white">
                                    Lleve su Plan Clínico en la App VitalLoop®
                                </h3>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Descargue la aplicación para consultar su menú diario de 1,994 kcal, registrar sus pasos activos (NEAT 6,000–8,000), confirmar la toma de sus fórmulas 33Plus® y 34Plus®, y sincronizar su banda inteligente para el monitoreo de variabilidad cardíaca y calidad del sueño.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                                <a
                                    href="#download-vitalloop"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        alert("Iniciando enlace con la App VitalLoop® y emparejamiento de Banda H7.");
                                    }}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#1C75BC] hover:bg-[#165f9a] text-white text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-[#1C75BC]/30 active:scale-95"
                                >
                                    <Smartphone className="w-4 h-4" />
                                    Descargar App VitalLoop®
                                </a>
                            </div>
                        </div>
                    </div>

                </div>
            </Accordion>
        </div>
    );
};

export default TabCalendar;
