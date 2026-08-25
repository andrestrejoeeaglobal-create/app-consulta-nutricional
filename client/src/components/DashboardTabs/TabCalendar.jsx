import React, { useState } from 'react';
import axios from 'axios';
import {
    CheckCircle, Clock, Coffee, Moon, Sun, Utensils,
    Navigation, Activity, MapPin, Briefcase, User, Smartphone, Send, Shield, AlertTriangle,
    Layers, Dumbbell, Zap, RefreshCw, Lock
} from 'lucide-react';
import { formatCalendarForClipboard } from '../../utils/formatCalendarForClipboard';

export const TabCalendar = ({
    patientData,
    setPatientData,
    apiContext,
    Accordion,
    openSections,
    toggleSection,
    isPhase20EditMode
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [errorSync, setErrorSync] = useState(null);

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
    const ageCandidate = pInfo?.age !== undefined ? pInfo.age : (patientData?.identificacion?.edad !== undefined ? patientData.identificacion.edad : 30);
    const isLactante = ageCandidate < 2 || patientData?.isLactante || (pInfo?.dob_year && (new Date().getFullYear() - pInfo.dob_year < 2));
    const isJuvenilAdolescente = (!isLactante && (ageCandidate < 18 || patientData?.isPediatrico || (pInfo?.dob_year && (new Date().getFullYear() - pInfo.dob_year < 18))));
    const isGeriatric = ageCandidate >= 65 || patientData?.isGeriatrico;
    const isLactanteOrPediatric = isLactante; // Alias retrocompatible para visores genéricos

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

    const handleExport = async () => {
        setIsExporting(true);
        setErrorSync(null);

        const citationId = apiContext?.citaId || apiContext?.idCita || patientData?.citaId || '15000';
        const userId = apiContext?.userId || patientData?.userId || '165';

        const rawAllergiesList = [...(patientData?.history?.allergies?.food || []), ...(patientData?.history?.allergies?.drug || [])];
        const formattedAllergies = rawAllergiesList.map(a => typeof a === 'string' ? a : (a.agent || a.name || 'Alimento'));

        // Construir DTO compatible 100% con Pydantic CDSSv2EngineDTO (Clase Clinica expects key 'alergias')
        const dto = {
            metadata: {
                citation_id: citationId,
                user_id: userId,
                timestamp: new Date().toISOString()
            },
            perfil_abcd: {
                antropometria: {
                    peso_kg: patientData?.vitals?.weight || 70,
                    talla_m: patientData?.vitals?.height || 1.70,
                    imc: patientData?.vitals?.imc || 24.2,
                    icc: patientData?.vitals?.icc || 0.85,
                    clasificacion_imc: patientData?.vitals?.imc_class || 'Normopeso'
                },
                bioquimicos_y_vitales: {
                    presion_arterial: patientData?.vitals?.bp || '110/70',
                    spo2_porcentaje: patientData?.vitals?.spo2 || 98,
                    fc_reposo_lpm: patientData?.vitals?.fc || 65,
                    angulo_fase_grados: patientData?.escaner?.anguloFase || 5.8,
                    estado_muscular: 'Normotrófico'
                },
                clinica: {
                    patologias: normalizeRedFlags(rawDiag),
                    alergias: formattedAllergies // CLAVE EXACTA EXIGIDA POR PYDANTIC: alergias
                },
                dietetica: {
                    enfoque: "Modulación de Insulina / Cortisol (Sin Conteo Calórico)",
                    aversiones: patientData?.nutrition?.dislikes || [],
                    preferencias_5x5x5: ["Té verde", "Frutos rojos", "Aceite de oliva VE"]
                }
            },
            cronobiologia: {
                formula_33_plus: {
                    nombre: "33 PLUS (Ignición Mitocondrial)",
                    horario: "Mañana con primer alimento",
                    dosis: "1 sobre",
                    preparacion: "Disolver en agua temp. ambiente",
                    proposito_clinico: "Optimizar microcirculación diurna y sensibilidad a la insulina"
                },
                formula_34_plus: {
                    nombre: "34 PLUS (Ingeniería Tisular)",
                    horario: "Noche 60 min pre-sueño",
                    dosis: "1 sobre",
                    preparacion: "Disolver estrictamente en un MÍNIMO de 500 ml de agua natural 💧",
                    advertencia_hidratacion: "Disolver en menos de 500 ml retrasa el vaciado gástrico y bloquea el drenaje glinfático cerebral nocturno.",
                    proposito_clinico: "Reparación tisular nocturna y matriz extracelular"
                }
            },
            calendario_28_dias: periodizationPhases
        };

        try {
            const response = await axios.patch(`http://localhost:5000/api/citations/${citationId}/progress`, {
                phase: 21,
                block: 'finished',
                patientData: dto,
                is_completed: true
            });

            if (response.data?.success) {
                setExportSuccess(true);
                if (setPatientData) {
                    setPatientData(prev => ({
                        ...prev,
                        is_completed: true
                    }));
                }
            } else {
                throw new Error("Respuesta del servidor sin éxito");
            }
        } catch (err) {
            console.error("❌ Error al sincronizar con Terminal B:", err.message);
            setErrorSync("Error de conexión: No se pudo transmitir el plan a la Terminal B.");
        } finally {
            setIsExporting(false);
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

    return (
        <div className="space-y-6 font-sans">
            {/* --- ACORDEÓN PADRE: CALENDARIO Y RUTA DE EJECUCIÓN --- */}
            <Accordion
                title="Calendario y Ruta de Ejecución"
                id="accordion-calendar-parent"
                isOpen={openSections.parentCalendar}
                onToggle={() => toggleSection('parentCalendar')}
                variant="parent"
            >
                <div className="space-y-6">

                    {/* --- CHILD ACCORDION 1: RELOJ METABÓLICO --- */}
                    <Accordion
                        title="Reloj Metabólico"
                        id="accordion-metabolic-clock"
                        isOpen={openSections.childMetabolicClock}
                        onToggle={() => toggleSection('childMetabolicClock')}
                    >
                        <div id="card-metabolic-clock" className="bg-tilo-bg-base/40 rounded-2xl p-6 border border-tilo-border">
                            <div className="relative border-l-2 border-tilo-border ml-4 space-y-8 py-2">
                                {/* 09:00 AM */}
                                <div className="relative pl-6">
                                    <span className="absolute -left-[11px] top-1 px-1 bg-tilo-bg-panel">
                                        <div className="w-4 h-4 rounded-full bg-tilo-warning/10 border-2 border-tilo-warning flex items-center justify-center">
                                            <Sun className="w-2.5 h-2.5 text-tilo-warning" />
                                        </div>
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-tilo-text-main">09:00 AM</span>
                                        <span className="text-tilo-warning text-[10px] font-bold uppercase tracking-wider mb-1">Ventana de Desayuno</span>
                                        {has33Plus ? (
                                            <div className="bg-tilo-primary/10 p-3 rounded-xl border border-tilo-primary/20 mt-1 shadow-sm max-w-md">
                                                <div className="flex items-start gap-2">
                                                    <Activity className="w-4 h-4 text-tilo-primary shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-bold text-tilo-text-main">Ignición Mitocondrial</p>
                                                        <p className="text-[10px] text-tilo-text-muted leading-tight">Tomar Suplemento 33+ (1 toma con alimentos en agua a temp. ambiente)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-tilo-bg-base/20 p-3 rounded-xl border border-tilo-border mt-1 border-dashed max-w-md">
                                                <p className="text-[10px] text-tilo-text-muted/60 italic">Sin suplemento de ignición asignado</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 02:00 PM */}
                                <div className="relative pl-6">
                                    <span className="absolute -left-[11px] top-1 px-1 bg-tilo-bg-panel">
                                        <div className="w-4 h-4 rounded-full bg-tilo-primary/10 border-2 border-tilo-primary flex items-center justify-center">
                                            <Utensils className="w-2.5 h-2.5 text-tilo-primary" />
                                        </div>
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-tilo-text-main">02:00 PM</span>
                                        <span className="text-tilo-primary text-[10px] font-bold uppercase tracking-wider mb-1">Comida Principal</span>
                                        <p className="text-xs text-tilo-text-muted leading-relaxed">Pico insulínico mayor. Umbral Proteico de Leucina (&gt;30g de proteína).</p>
                                    </div>
                                </div>

                                {/* 08:30 PM */}
                                <div className="relative pl-6">
                                    <span className="absolute -left-[11px] top-1 px-1 bg-tilo-bg-panel">
                                        <div className="w-4 h-4 rounded-full bg-tilo-success/10 border-2 border-tilo-success flex items-center justify-center">
                                            <Moon className="w-2.5 h-2.5 text-tilo-success" />
                                        </div>
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-tilo-text-main">08:30 PM</span>
                                        <span className="text-tilo-success text-[10px] font-bold uppercase tracking-wider mb-1">Cena y Cierre Metabólico</span>
                                        {has34Plus ? (
                                            <div className="bg-tilo-success/10 p-3 rounded-xl border border-tilo-success/20 mt-1 shadow-sm max-w-md">
                                                <div className="flex items-start gap-2">
                                                    <Shield className="w-4 h-4 text-tilo-success shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-bold text-tilo-text-main">Reparación Tisular Nocturna</p>
                                                        <p className="text-[10px] text-tilo-text-muted leading-tight">Tomar Suplemento 34+ (Disuelto estrictamente en MÍNIMO 500 ml de agua 💧)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-tilo-bg-base/20 p-3 rounded-xl border border-tilo-border mt-1 border-dashed max-w-md">
                                                <p className="text-[10px] text-tilo-text-muted/60 italic">Sin suplemento de reparación asignado</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 2: PROGRAMACIÓN DE PERIODIZACIÓN CELULAR (28 DÍAS) --- */}
                    <Accordion
                        title="Periodización Celular Parametrizada (28 Días)"
                        id="accordion-cell-periodization"
                        isOpen={openSections.childCellPeriodization || true}
                        onToggle={() => toggleSection('childCellPeriodization')}
                    >
                        <div id="card-periodization-28d" className="space-y-4">
                            
                            {/* Fase 1 */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-blue-600" />
                                        {periodizationPhases.fase1.nombre_completo}
                                    </span>
                                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                        Días 1-7
                                    </span>
                                </div>
                                <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    {periodizationPhases.fase1.gut_lock_status}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                                    <div className="bg-slate-50 p-2.5 rounded-xl">
                                        <strong className="text-slate-900 block text-[10px] uppercase tracking-wider mb-0.5">Nutrición:</strong>
                                        {isPhase20EditMode ? (
                                            <input 
                                                type="text" 
                                                className="w-full p-1 bg-white border border-amber-300 rounded text-xs"
                                                defaultValue={periodizationPhases.fase1.nutrition}
                                            />
                                        ) : (
                                            <span>{periodizationPhases.fase1.nutrition}</span>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-xl">
                                        <strong className="text-slate-900 block text-[10px] uppercase tracking-wider mb-0.5">Movimiento:</strong>
                                        {periodizationPhases.fase1.movement}
                                    </div>
                                </div>
                            </div>

                            {/* Fase 2 */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <RefreshCw className="w-4 h-4 text-emerald-600" />
                                        {periodizationPhases.fase2.nombre_completo}
                                    </span>
                                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Días 8-14
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                                    <strong className="text-slate-900 block text-[10px] uppercase tracking-wider mb-0.5">{isLactanteOrPediatric ? 'Nutrición Pediátrica:' : 'Nutrición (Framework 5x5x5):'}</strong>
                                    <span>{periodizationPhases.fase2.nutrition}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                                    <div className="bg-slate-50 p-2.5 rounded-xl">
                                        <strong className="text-slate-900 block text-[10px] uppercase tracking-wider mb-0.5">{isLactanteOrPediatric ? 'Estimulación Pediátrica:' : `Cardio Zona 2 (${isThresholdMetric ? 'LTHR' : 'FCM'}):`}</strong>
                                        <span className="font-bold text-emerald-700">{periodizationPhases.fase2.zona2_range}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-xl">
                                        <strong className="text-slate-900 block text-[10px] uppercase tracking-wider mb-0.5">{isLactanteOrPediatric ? 'Desarrollo Motor:' : 'Protocolo Biomecánico:'}</strong>
                                        <span>{periodizationPhases.fase2.smr_status}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fase 3 */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Dumbbell className="w-4 h-4 text-purple-600" />
                                        {periodizationPhases.fase3.nombre_completo}
                                    </span>
                                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                        Días 15-21
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                                    <div className="bg-slate-50 p-2.5 rounded-xl">
                                        <strong className="text-slate-900 block text-[10px] uppercase tracking-wider mb-0.5">{isLactanteOrPediatric ? 'Proteína y Crecimiento Pediátrico:' : 'Nutrición Músculo-Céntrica:'}</strong>
                                        <span>{periodizationPhases.fase3.nutrition}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-xl">
                                        <strong className="text-slate-900 block text-[10px] uppercase tracking-wider mb-0.5">{isLactanteOrPediatric ? 'Coordinación Motora:' : 'HIIT Zona 5 (VO2 Máx):'}</strong>
                                        <span className="font-bold text-purple-700">{periodizationPhases.fase3.zona5_target}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fase 4 */}
                            <div className={`p-4 rounded-2xl border shadow-sm space-y-2 ${hasGutIssue ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${hasGutIssue ? 'text-amber-800' : 'text-slate-800'}`}>
                                        <Zap className="w-4 h-4 text-amber-600" />
                                        {periodizationPhases.fase4.nombre_completo}
                                    </span>
                                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${hasGutIssue ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                        {periodizationPhases.fase4.estado}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-white border border-slate-100 text-xs text-slate-700 leading-relaxed">
                                    <strong className="block text-[10px] uppercase tracking-wider text-slate-900 mb-1">{isLactanteOrPediatric ? 'Monitoreo de Crecimiento L-OMS:' : 'Estado de Detoxificación Hepática / Quelación:'}</strong>
                                    <span>{periodizationPhases.fase4.detox_status}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 text-xs text-slate-600">
                                    <strong className="block text-[10px] uppercase tracking-wider text-slate-900 mb-0.5">{isLactanteOrPediatric ? 'Seguimiento Ponderal y Citas:' : 'Semana de Descarga (Tapering):'}</strong>
                                    <span>{periodizationPhases.fase4.activity}</span>
                                </div>
                            </div>

                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 3: LOGÍSTICA DE EJECUCIÓN --- */}
                    <Accordion
                        title="Logística de Ejecución"
                        id="accordion-execution-logistics"
                        isOpen={openSections.childExecutionLogistics}
                        onToggle={() => toggleSection('childExecutionLogistics')}
                    >
                        <div id="card-logistics" className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-wider">Planificación de Ejecución</span>
                                <span className="bg-tilo-success/10 text-tilo-success border border-tilo-success/20 text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase">
                                    Nivel 1: Al Paso
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-tilo-bg-base/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-tilo-border">
                                    <MapPin className="w-5 h-5 text-tilo-text-muted/50 mb-2" />
                                    <span className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider mb-1">Entorno Principal</span>
                                    <span className="text-sm font-bold text-tilo-text-main">{translateVenue(environmentVenue)}</span>
                                </div>
                                <div className="bg-tilo-bg-base/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-tilo-border">
                                    <User className="w-5 h-5 text-tilo-text-muted/50 mb-2" />
                                    <span className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider mb-1">Preparación</span>
                                    <span className="text-sm font-bold text-tilo-text-main">{translateCook(cookType)}</span>
                                </div>
                                <div className="bg-tilo-bg-base/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-tilo-border">
                                    <Coffee className="w-5 h-5 text-tilo-text-muted/50 mb-2" />
                                    <span className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider mb-1">Factibilidad</span>
                                    <span className="text-sm font-bold text-tilo-text-main">Alta - Menú Adaptativo</span>
                                </div>
                            </div>
                        </div>
                    </Accordion>
                </div>
            </Accordion>

            {/* ERROR SYNC BANNER */}
            {errorSync && (
                <div className="bg-tilo-danger/10 border border-tilo-danger/20 text-tilo-danger px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold mt-4 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-tilo-danger shrink-0" />
                    <span>{errorSync}</span>
                </div>
            )}

            {/* BOTÓN DE CIERRE (Sincronización) */}
            <div className="flex justify-end pt-4 border-t border-tilo-border mt-8">
                <button
                    onClick={handleExport}
                    disabled={isExporting || exportSuccess}
                    className={`
                        relative overflow-hidden flex justify-center items-center gap-2 px-8 py-4 rounded-2xl font-black tracking-wide text-xs transition-all duration-300 w-full sm:w-auto shadow-lg cursor-pointer
                        ${exportSuccess
                            ? 'bg-tilo-success text-white cursor-default shadow-tilo-success/20'
                            : 'bg-tilo-primary text-white hover:bg-tilo-primary/80 shadow-tilo-primary/20 hover:shadow-tilo-primary/30 hover:-translate-y-0.5'
                        }
                    `}
                >
                    {isExporting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Enviando Datos...</span>
                        </>
                    ) : exportSuccess ? (
                        <>
                            <CheckCircle className="w-5 h-5 text-white" />
                            <span>Plan Exportado con Éxito</span>
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            <span>Sincronizar con Terminal B (Enviar al Paciente)</span>
                        </>
                    )}

                    {/* Ripple/Glimmer effect */}
                    {!exportSuccess && !isExporting && (
                        <div className="absolute inset-0 -translate-x-full hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    )}
                </button>
            </div>
        </div>
    );
};

export default TabCalendar;
