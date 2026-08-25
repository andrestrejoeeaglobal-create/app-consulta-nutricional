import React, { useState } from 'react';
import { Activity, ShieldAlert, AlertTriangle, Zap, HeartPulse, Lock, FileText, Calendar } from 'lucide-react';
import TabNotes from './TabNotes';
import TabIntervention from './TabIntervention';
import tiloImg from '../../assets/tilo.png';

export const TabDiagnosis = ({
    patientData,
    setPatientData,
    isEditing,
    onTabChange,
    Accordion,
    openSections,
    toggleSection,
    citationId,
    isPhase20EditMode,
    planViewMode: propPlanViewMode,
    setPlanViewMode: propSetPlanViewMode
}) => {
    // Resolutores de Metadatos de Referencia (ABCD)
    // 1. IMC / Composición
    const displayWeight = patientData?.vitals?.weight || patientData?.peso;
    const displayHeight = patientData?.vitals?.height || patientData?.talla;
    let calculatedImc = null;
    if (displayWeight && displayHeight) {
        const hMetros = parseFloat(displayHeight) > 10 ? parseFloat(displayHeight) / 100 : parseFloat(displayHeight);
        calculatedImc = (parseFloat(displayWeight) / (hMetros * hMetros)).toFixed(1);
    }
    const displayImc = patientData?.vitals?.bmi || patientData?.imc || calculatedImc;
    const displayImcClass = patientData?.vitals?.bmi_class || patientData?.imcEstado || (displayImc ? (displayImc < 18.5 ? 'Bajo Peso' : displayImc < 25 ? 'Normal' : displayImc < 30 ? 'Sobrepeso' : 'Obesidad') : 'Estable');

    // 2. ICC
    const displayWaist = patientData?.vitals?.waist || patientData?.cintura;
    const displayHip = patientData?.vitals?.hip || patientData?.cadera;
    let displayIcc = patientData?.vitals?.whr || patientData?.icc;
    if (!displayIcc && displayWaist && displayHip) {
        displayIcc = (parseFloat(displayWaist) / parseFloat(displayHip)).toFixed(2);
    }
    const displayIccRiesgo = patientData?.vitals?.whr_risk || patientData?.iccRiesgo || 'Sin Riesgo';

    // 3. Presión / Glucosa
    let displayBP = null;
    if (patientData?.vitals?.blood_pressure) {
        if (typeof patientData.vitals.blood_pressure === 'object') {
            const sys = patientData.vitals.blood_pressure.systolic;
            const dia = patientData.vitals.blood_pressure.diastolic;
            if (sys && dia) displayBP = `${sys}/${dia}`;
        } else {
            displayBP = patientData.vitals.blood_pressure;
        }
    }
    if (!displayBP) displayBP = patientData?.signosVitales?.ta;

    let displayGluc = patientData?.vitals?.glucose || patientData?.signosVitales?.glucosa;
    if (displayGluc) {
        displayGluc = displayGluc.toString().replace(/\s*mg\/dL/gi, '');
    }

    // 4. SpO2 / FC
    const displaySpo2 = patientData?.vitals?.spo2 || patientData?.signosVitales?.spo2;
    const displayFc = patientData?.vitals?.hr || patientData?.vitals?.heart_rate || patientData?.signosVitales?.fc;

    // === SAFETY ENGINE (Medical Override) ===
    const [overrideActive, setOverrideActive] = useState(
        patientData?.nutrition?.preferences?.safety_lock?.override_applied || false
    );

    const handleOverrideToggle = (active) => {
        setOverrideActive(active);
        if (setPatientData) {
            setPatientData(prev => {
                const nutrition = prev.nutrition || {};
                const prefs = nutrition.preferences || {};
                const safety = prefs.safety_lock || {};
                return {
                    ...prev,
                    nutrition: {
                        ...nutrition,
                        preferences: {
                            ...prefs,
                            safety_lock: {
                                ...safety,
                                override_applied: active
                            }
                        }
                    }
                };
            });
        }
    };

    const is33Added = patientData?.advanced_supplementation?.some(s => s.name === '33 PLUS');
    const is34Added = patientData?.advanced_supplementation?.some(s => s.name === '34 PLUS');

    const handleToggle33 = () => {
        if (!setPatientData) return;
        setPatientData(prev => {
            const list = prev.advanced_supplementation || [];
            const exists = list.some(s => s.name === '33 PLUS');
            const newList = exists
                ? list.filter(s => s.name !== '33 PLUS')
                : [...list, {
                    id: '33plus',
                    cortex: '33Plus (Neuro-cognitivo)',
                    name: '33 PLUS',
                    dosage: '1 toma al día',
                    timing: 'Con el desayuno (09:00 AM)',
                    rationale: 'Optimización de la cadena respiratoria celular, reducción de fatiga crónica y mejora en la sensibilidad a la insulina.',
                    status: 'approved'
                }];
            return {
                ...prev,
                advanced_supplementation: newList
            };
        });
    };

    const handleToggle34 = () => {
        if (!setPatientData) return;
        setPatientData(prev => {
            const list = prev.advanced_supplementation || [];
            const exists = list.some(s => s.name === '34 PLUS');
            const newList = exists
                ? list.filter(s => s.name !== '34 PLUS')
                : [...list, {
                    id: '34plus',
                    cortex: '34Plus (Metabólico)',
                    name: '34 PLUS',
                    dosage: '1 toma al día',
                    timing: 'Con la cena (08:30 PM)',
                    rationale: 'Regeneración de matriz extracelular, fortalecimiento articular y optimización de síntesis proteica post-ejercicio.',
                    status: 'approved'
                }];
            return {
                ...prev,
                advanced_supplementation: newList
            };
        });
    };

    // 1. Scan for Allergies
    const allergies = [...(patientData?.history?.allergies?.food || []), ...(patientData?.history?.allergies?.drug || [])];
    const hasAllergies = allergies.length > 0;

    // 2. Scan for specific medications (e.g., Fentermina, SSRIs)
    const medications = patientData?.history?.medications || [];
    const hasPhentermine = medications.some(m => m.name.toUpperCase().includes("FENTER") || m.name.toUpperCase().includes("ACXION") || m.name.toUpperCase().includes("TERFAMEX"));

    // 3. Risk Detected Boolean
    const isRiskDetected = hasAllergies || hasPhentermine;

    // =========================================================================
    // MOTOR DE REGLAS CLÍNICAS DINÁMICO CORTEX v2.1 (CDSS)
    // =========================================================================

    // 1. Extracción Dinámica de Patologías del Paciente
    const rawDiag = patientData?.clinical_dossier?.human_approved_diagnosis || patientData?.preliminary_diagnosis || [];

    // 2. Clasificador Algorítmico Dinámico de Diagnósticos hacia los 7 Nodos IFM
    const classifyDiagnosisToIFMNode = (diagString) => {
        const str = (typeof diagString === 'string' ? diagString : (diagString?.nombre || diagString?.name || '')).toLowerCase();
        
        if (str.includes('absorción') || str.includes('intestinal') || str.includes('digest') || str.includes('leaky') || str.includes('disbiosis') || str.includes('k90')) {
            return {
                nodeKey: 'asimilacion',
                nodo: '1. Asimilación (Digestión / Absorción Intestinal)',
                cie10: 'K90.9',
                prioridad: 'Alta / Primaria (Nodo Raíz)',
                isRootNode: true
            };
        }
        if (str.includes('hígado') || str.includes('hepátic') || str.includes('esteatosis') || str.includes('renal') || str.includes('riñón') || str.includes('detox') || str.includes('n19') || str.includes('k76')) {
            return {
                nodeKey: 'biotransformacion',
                nodo: '2. Biotransformación y Eliminación',
                cie10: str.includes('renal') || str.includes('riñón') ? 'N19' : 'K76.0',
                prioridad: 'Elevada',
                isRootNode: false
            };
        }
        if (str.includes('alergia') || str.includes('inflama') || str.includes('dislipid') || str.includes('colesterol') || str.includes('triglicérid') || str.includes('t78')) {
            return {
                nodeKey: 'defensa',
                nodo: '3. Defensa y Reparación',
                cie10: 'T78.4',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('tiroid') || str.includes('hormon') || str.includes('insulin') || str.includes('cortisol') || str.includes('diabet') || str.includes('prostat') || str.includes('e07')) {
            return {
                nodeKey: 'comunicacion',
                nodo: '4. Comunicación y Endocrino',
                cie10: 'E07.9',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('metaból') || str.includes('mitocondr') || str.includes('fatiga') || str.includes('glucem') || str.includes('glucosa') || str.includes('e88')) {
            return {
                nodeKey: 'energia',
                nodo: '5. Energía y Mitoquímica',
                cie10: 'E88.9',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('hipoxia') || str.includes('hipertens') || str.includes('cardio') || str.includes('presión') || str.includes('vascular') || str.includes('g93')) {
            return {
                nodeKey: 'transporte',
                nodo: '6. Transporte y Microcirculación',
                cie10: 'G93.1',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        if (str.includes('colágeno') || str.includes('fasci') || str.includes('sarcopeni') || str.includes('músculo') || str.includes('articul') || str.includes('m35')) {
            return {
                nodeKey: 'estructural',
                nodo: '7. Integridad Estructural y Fascial',
                cie10: 'M35.9',
                prioridad: 'Secundaria',
                isRootNode: false
            };
        }
        return {
            nodeKey: 'general',
            nodo: 'Control Metabólico General',
            cie10: 'Z00.0',
            prioridad: 'Estándar',
            isRootNode: false
        };
    };

    // Resolutor Dinámico de Diagnósticos
    const parsedDiagnoses = rawDiag.map(d => {
        if (!d) return null;
        const nameStr = typeof d === 'string' ? d.trim() : (d.nombre || d.name || d.descripcion || '');
        if (!nameStr) return null;
        const meta = classifyDiagnosisToIFMNode(nameStr);
        return {
            nombre: nameStr,
            cie10: (typeof d === 'object' && d.cie10) ? d.cie10 : meta.cie10,
            prioridad: meta.prioridad,
            nodo: meta.nodo,
            nodeKey: meta.nodeKey,
            isRootNode: meta.isRootNode
        };
    }).filter(Boolean);

    // Si no hay diagnósticos en dossier, construir dinámicamente desde el motivo/evaluación clínica
    const cleanDiagnoses = parsedDiagnoses.length > 0 ? parsedDiagnoses : [
        {
            nodo: '1. Asimilación y Salud Digestiva',
            nombre: 'Evaluación Digestiva e Inmunometabólica',
            cie10: 'K90.9',
            prioridad: 'Alta / Primaria (Nodo Raíz)',
            nodeKey: 'asimilacion',
            isRootNode: true
        },
        {
            nodo: '2. Biotransformación y Salud Renal',
            nombre: 'Evaluación Renal y Métabólica Avanzada',
            cie10: 'N19',
            prioridad: 'Elevada',
            nodeKey: 'biotransformacion',
            isRootNode: false
        }
    ];

    // 3. Evaluar Triggers Condicionales de Salud Funcional
    const hasGutIssue = cleanDiagnoses.some(d => d.nodeKey === 'asimilacion' || d.isRootNode) || patientData?.digestive_profile?.has_issues || patientData?.history?.hasGutIssue;
    const hasThyroidIssue = cleanDiagnoses.some(d => d.nombre.toLowerCase().includes('tiroid') || d.nombre.toLowerCase().includes('hormon')) || patientData?.history?.hasThyroidIssue;
    const hasRenalIssue = cleanDiagnoses.some(d => d.nombre.toLowerCase().includes('renal') || d.nombre.toLowerCase().includes('riñón')) || (patientData?.vitals?.creatinine > 1.2);
    const hasDVTOrFracture = patientData?.history?.hasDVT || patientData?.history?.hasFracture;

    // 4. Generación Algorítmica Dinámica de Manejo y Recomendaciones (Rules Engine)
    const dynamicManagement = [];

    // Regla 1: Compuerta de Asimilación (Gut Lock Rule)
    if (hasGutIssue) {
        dynamicManagement.push({
            accion: "1. [Nodo Raíz - Asimilación (K90.9)] Protocolo Previo Obligatorio de Sellado de Barrera Intestinal",
            racional: "Reparación de la hiperpermeabilidad con L-Glutamina, Mucílago y Probióticos Esporulados. COMPUERTA DE SEGURIDAD: Se bloquea cualquier quelación de metales pesados o detoxificación profunda Fase 1/2 hasta validar el sellado (Zonulina/LBP en suero) para prevenir endotoxemia por translocación de LPS."
        });
    }

    // Regla 2: Salvaguarda Tiroidea
    if (hasThyroidIssue) {
        dynamicManagement.push({
            accion: "2. [Salvaguarda Tiroidea - Protocolo Pelz] Carbohidratos Complejos Cíclicos",
            racional: "Se bloquea la cetosis estricta lineal y el ayuno prolongado severo. Prescripción de carbohidratos saludables cíclicos para regular el cortisol y asegurar la conversión periférica hepático/intestinal de T4 inactiva a T3 activa."
        });
    } else {
        dynamicManagement.push({
            accion: "2. [Optimización Endocrina] Flexibilidad Metabólica y Control Insulínico",
            racional: "Estrategia de modulación glucémica y ventana de alimentación calibrada al ritmo circadiano del paciente."
        });
    }

    // Regla 3: Preservación Renal (PLADO)
    if (hasRenalIssue) {
        dynamicManagement.push({
            accion: "3. [Preservación Renal - PLADO] Nutrición Basada en Plantas para ERC",
            racional: "Se bloquean las dietas hiperproteicas de origen animal. Algoritmo PLADO (Dra. Connie Rhee) para reducir nitrógeno de desecho, compuestos urémicos y prevenir la hiperfiltración intraglomerular."
        });
    } else {
        dynamicManagement.push({
            accion: "3. [Protección Tisular y Parenquimatosa] Nutrición Defensora",
            racional: "Aporte optimizado de antioxidantes vasculares y polifenoles para mitigar el estrés oxidativo tisular."
        });
    }

    // Regla 4: Medicina Músculo-Céntrica y Longevidad (Lyon & Attia)
    dynamicManagement.push({
        accion: "4. [Medicina Músculo-Céntrica y Longevidad] Músculo como Exoesqueleto (Lyon & Attia)",
        racional: "Umbral de Leucina: Mínimo 30g de proteína de alta calidad por comida para activar mTOR y combatir mioesteatosis. Entrenamiento cardiovascular en Zona 2 (flexibilidad metabólica) y Zona 5 (VO2 Máx)."
    });

    // Regla 5: Protocolo Biomecánico 3 Fases
    dynamicManagement.push({
        accion: "5. [Protocolo Biomecánico Secuencial 3 Fases]",
        racional: `Secuencia: 1) ${hasDVTOrFracture ? '[BLOQUEADO POR CONTRAINDICACIÓN DE TVP/FRACTURA]' : 'Liberación Automiofascial (SMR Foam Roller)'}, 2) Estiramiento Miofascial dinámico en cadena completa, 3) Fortalecimiento Neuromuscular (eslingas oblicuas y estabilidad diafragmática).`
    });

    // Regla 6: Framework 5x5x5 (Dr. William Li) - Purga de Conteo Calórico
    dynamicManagement.push({
        accion: "6. [Framework 5x5x5 - Dr. William Li] Modulación Hormonal e Inmunológica",
        racional: "Sin conteo calórico. Adición estratégica diaria de alimentos 'Grand Slammers' (té verde, frutos rojos, nueces, champiñones, aceite de oliva VE) para potenciar angiogénesis, regeneración, microbioma, ADN e inmunidad."
    });

    const rawMgmt = patientData?.clinical_dossier?.human_approved_management || [];
    const cleanManagement = rawMgmt.length > 0
        ? rawMgmt.map(m => {
            if (!m) return null;
            if (typeof m === 'string') {
                const trimmed = m.trim();
                return trimmed !== '' ? { accion: trimmed, racional: '' } : null;
            }
            return m.accion || m.action ? { 
                accion: m.accion || m.action || 'Medida General', 
                racional: m.racional || m.rationale || '' 
            } : null;
        }).filter(Boolean)
        : dynamicManagement;

    const defaultSupplementation = [
        {
            id: '33plus_master',
            cortex: '33Plus (Ignición Mitocondrial)',
            name: '33 PLUS (Ignición Mitocondrial)',
            dosage: '1 toma al día (disuelto en agua temp. ambiente)',
            timing: 'Por la mañana con el primer alimento',
            rationale: 'Extracto de Semilla de Uva y cofactores vasculares para optimizar la microcirculación, transporte de oxígeno y sensibilidad a la insulina durante las horas de actividad diurna.',
            status: 'approved'
        },
        {
            id: '34plus_master',
            cortex: '34Plus (Ingeniería Tisular)',
            name: '34 PLUS (Ingeniería Tisular)',
            dosage: '1 toma al día (disuelto estrictamente en mínimo 500 ml de agua 💧)',
            timing: 'Por la noche (1 hora antes de dormir)',
            rationale: 'Colágeno Hidrolizado, Vitamina C y L-Arginina para activar la reparación tisular y de matriz extracelular durante el sueño profundo sin saturar el sistema glinfático cerebral.',
            status: 'approved'
        }
    ];

    const activeSupplementation = (patientData?.advanced_supplementation && patientData?.advanced_supplementation.length > 0)
        ? patientData.advanced_supplementation.map(s => {
            const is33 = s.cortex?.includes('33Plus') || s.name?.includes('33');
            return {
                ...s,
                timing: is33 ? 'Por la mañana con el primer alimento' : 'Por la noche (1 hora antes de dormir)',
                dosage: is33 ? (s.dosage || '1 toma al día') : `${s.dosage || '1 toma al día'} (en mínimo 500 ml de agua 💧)`,
                rationale: is33 
                    ? 'Extracto de Semilla de Uva y cofactores vasculares para optimizar la microcirculación y oxigenación diurna.'
                    : 'Colágeno Hidrolizado, Vitamina C y L-Arginina para reparación tisular nocturna en mínimo 500ml de agua para protección glinfática.'
            };
        })
        : defaultSupplementation;

    // --- SISTEMA BIVALENTE DE VISTAS (PACIENTE vs MÉDICA) ---
    const [localPlanViewMode, setLocalPlanViewMode] = useState('patient');
    const activeViewMode = propPlanViewMode || localPlanViewMode;
    const setActiveViewMode = propSetPlanViewMode || setLocalPlanViewMode;

    const ageCandidate = patientData?.identificacion?.edad ?? patientData?.identityLock?.patientInfo?.age ?? patientData?.edad ?? 30;

    const isLactante = ageCandidate < 2 || patientData?.isLactante;
    const isJuvenilAdolescente = !isLactante && (ageCandidate < 18 || patientData?.isPediatrico);
    const isGeriatric = ageCandidate >= 65 || patientData?.isGeriatrico;
    const isAdult = !isLactante && !isJuvenilAdolescente && !isGeriatric;

    const pInfo = patientData?.identityLock?.patientInfo;
    const pName = patientData?.identificacion?.nombre || pInfo?.first_name || pInfo?.name || patientData?.fullName || (isLactante ? 'el bebé' : 'el paciente');

    const guia = patientData?.clinical_dossier?.guia_paciente_whatsapp || patientData?.guia_paciente_whatsapp;

    // Titulos por Cuadrante:
    const defaultTitle = isLactante 
        ? `El Crecimiento y Salud de ${pName}`
        : isJuvenilAdolescente
        ? `El Desarrollo y Rendimiento de ${pName}`
        : isGeriatric
        ? `La Salud, Autonomía y Vitalidad de ${pName}`
        : `Tu Estado de Salud y Plan Metabólico`;

    const pilarTitle = guia?.titulo_resumen || defaultTitle;

    // Pilar 1: Estado de Salud / Crecimiento
    const defaultPilar1 = isLactante
        ? `${pName} se encuentra en una etapa de desarrollo acelerado con constantes vitales normales para sus Primeros 1,000 Días de vida.`
        : isJuvenilAdolescente
        ? `${pName} evoluciona favorablemente en su etapa de crecimiento óseo e infantil con parámetros fisiológicos adecuados.`
        : isGeriatric
        ? `El estado de salud de ${pName} está enfocado en proteger su vitalidad, reserva cognitiva y capacidad funcional autónoma.`
        : `Tu cuerpo se encuentra en un estado metabólico estable con parámetros adaptados a tus objetivos de salud y rendimiento.`;

    const pilar1Text = guia?.pilar_salud_crecimiento || defaultPilar1;

    // Pilar 2: Nutrición y Alimentación
    const defaultPilar2 = isLactante
        ? `Mantener la lactancia materna o fórmula de continuación como base alimentaria principal, complementando con ablactación guiada (papillas caseras monocomponente o sólidos BLW).`
        : isJuvenilAdolescente
        ? `Alimentación rica en proteínas completas, calcio y micronutrientes para el crecimiento óseo, con snacks escolares nutritivos y sin restricción calórica punitiva.`
        : isGeriatric
        ? `Proteína fraccionada de alta calidad biológica para prevenir la sarcopenia, ajustada a su función renal (TFG) con adecuada hidratación diaria.`
        : `Mantener alimentación equilibrada sin conteo calórico estricto, priorizando alimentos naturales e hidratación óptima.`;

    const pilar2Text = guia?.pilar_alimentacion_diaria || defaultPilar2;

    // Pilar 3: Actividad y Movimiento
    const defaultPilar3 = isLactante
        ? `Estimulación psicomotriz diaria con tiempo boca abajo (Tummy Time), gateo libre sobre superficies seguras y rodamientos para desarrollar su postura y tono muscular.`
        : isJuvenilAdolescente
        ? `Deporte formativo, juego activo, natación y calistenia con peso corporal (evitando cargas máximas o entrenamiento extenuante de adultos).`
        : isGeriatric
        ? `Movilidad aeróbica adaptada de bajo impacto, ejercicios de propiocepción, equilibrio (Sit-to-Stand) y prevención activa de caídas.`
        : `Actividad física constante con caminata diaria (NEAT), entrenamiento de fuerza estructurado y ejercicio aeróbico adaptado.`;

    const pilar3Text = guia?.pilar_juegos_movimiento || defaultPilar3;

    // Pilar 4: Cuidados y Seguimiento
    const defaultPilar4 = isLactante
        ? `Monitoreo continuo de hitos de desarrollo con su pediatra tratante (NOM-043/OMS). Las recomendaciones nutricionales son de acompañamiento bioseguro.`
        : isJuvenilAdolescente
        ? `Higiene del sueño (8-10 horas para óptima liberación de hormona de crecimiento) y control del tiempo frente a pantallas antes de dormir.`
        : isGeriatric
        ? `Monitoreo cuidadoso de tomas, hidratación constante sin sobrecarga y acompañamiento familiar respetuoso para preservar su bienestar.`
        : `Seguir los horarios de tomas y suplementación estratégica para optimizar tu energía diurna y descanso nocturno.`;

    const pilar4Text = guia?.pilar_cuidados_suplementacion || defaultPilar4;

    return (
        <div className="space-y-6 font-sans">
            {/* Tarjeta Principal del Reporte Consolidado (Doctrina CORTEX v2.1 CDSS) */}
            <div className="w-full bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col mb-6">
                {/* CONMUTADOR DUAL DE VISTAS (PACIENTE Y FAMILIA vs EXPEDIENTE CLÍNICO) */}
                <div className="p-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 select-none no-print">
                    <button
                        type="button"
                        onClick={() => setActiveViewMode('patient')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            activeViewMode === 'patient' 
                                ? 'bg-white text-[#1C75BC] shadow-sm border border-slate-200' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <span className="text-sm">👤</span>
                        <span>Vista Paciente y Familia (Resumen Empático)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveViewMode('medical')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            activeViewMode === 'medical' 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <span className="text-sm">🩺</span>
                        <span>Vista Expediente Clínico (NOM-004)</span>
                    </button>
                </div>

                {/* Indicador discreto de Estado Vitrina / Modo Edición Fina */}
                {isPhase20EditMode && (
                    <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs font-bold text-amber-800 animate-pulse no-print">
                        <span className="flex items-center gap-2">
                            <span>✏️ Modo Edición Fina Activo:</span>
                            <span className="font-medium text-amber-700">Puedes modificar los campos del expediente directamente. Haz clic en "Guardar Cambios" en el chat al finalizar.</span>
                        </span>
                    </div>
                )}

                {/* VISTA 1: PACIENTE Y FAMILIA (4 PILARES EMPÁTICOS) */}
                {activeViewMode === 'patient' ? (
                    <div className="p-6 space-y-5">
                        {/* Pilar 1: Crecimiento y Salud */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-emerald-500">
                            <h3 className="text-slate-900 text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="text-base">🌱</span>
                                {pilarTitle}
                            </h3>
                            <p className="text-slate-700 text-xs leading-relaxed font-medium">
                                {pilar1Text}
                            </p>
                        </div>

                        {/* Pilar 2: Guía de Alimentación Diaria */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-blue-500">
                            <h3 className="text-slate-900 text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="text-base">🥗</span>
                                Guía de Alimentación Diaria
                            </h3>
                            <p className="text-slate-700 text-xs leading-relaxed font-medium">
                                {pilar2Text}
                            </p>
                        </div>

                        {/* Pilar 3: Actividades y Desarrollo Motor */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-amber-500">
                            <h3 className="text-slate-900 text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="text-base">🧸</span>
                                Actividades y Movimiento
                            </h3>
                            <p className="text-slate-700 text-xs leading-relaxed font-medium">
                                {pilar3Text}
                            </p>
                        </div>

                        {/* Pilar 4: Cuidados y Seguimiento */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-indigo-500">
                            <h3 className="text-slate-900 text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="text-base">💧</span>
                                Cuidados y Seguimiento
                            </h3>
                            <p className="text-slate-700 text-xs leading-relaxed font-medium">
                                {pilar4Text}
                            </p>
                        </div>
                    </div>
                ) : (
                    /* VISTA 2: EXPEDIENTE CLÍNICO OFICIAL (NOM-004 / MATRIZ IFM) */
                    <div className="p-6 space-y-6">
                        
                        {/* Sección 1: Diagnósticos */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <h3 className="text-slate-900 text-xs font-extrabold uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <Activity className="w-4.5 h-4.5 text-[#1C75BC]" />
                                1. Diagnósticos Clínicos Aprobados (Matriz IFM de 7 Nodos)
                            </h3>

                            {/* Banner de Prioridad Primaria de Entrada (Nodo Raíz) */}
                            <div className="mb-4 bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2.5">
                                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="font-bold text-amber-950 block">Nodo Raíz Obligatorio (Asimilación):</strong>
                                    <span>La hiperpermeabilidad y absorción intestinal deben sellarse primero antes de cualquier protocolización de quelación de metales pesados para evitar endotoxemia metabólica.</span>
                                </div>
                            </div>

                            {cleanDiagnoses.length > 0 ? (
                                <div className="space-y-2.5">
                                    {cleanDiagnoses.map((d, idx) => (
                                        <div key={idx} className={`flex justify-between items-start p-3.5 rounded-xl text-xs font-medium border ${d.isRootNode ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200/80'}`}>
                                            <div>
                                                {d.nodo && <span className="text-[10px] font-extrabold text-[#1C75BC] uppercase tracking-wider block mb-0.5">{d.nodo}</span>}
                                                <span className="font-bold text-slate-800 block">{d.nombre}</span>
                                                <span className="text-[10.5px] text-slate-500 font-mono mt-0.5 block">{d.cie10}</span>
                                            </div>
                                            <span className={`px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-wider rounded-full ${d.isRootNode || d.prioridad?.includes('Alta') || d.prioridad?.includes('Primaria') ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs' : 'bg-blue-50 text-[#1C75BC] border border-blue-100'}`}>
                                                {d.prioridad}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 font-medium flex items-center gap-2.5">
                                    <span className="text-base">🛡️</span>
                                    <span>Homeostasis Metabólica General (Sin Alteraciones Agudas Registradas).</span>
                                </div>
                            )}
                        </div>

                        {/* Sección 2: Suplementación */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <h3 className="text-slate-900 text-xs font-extrabold uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <Zap className="w-4.5 h-4.5 text-indigo-600" />
                                2. Protocolo de Suplementación Avanzada (33+ / 34+)
                            </h3>
                            {activeSupplementation.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {activeSupplementation.map((s, idx) => {
                                        const is33 = s.cortex?.includes('33Plus') || s.name?.includes('33');
                                        return (
                                            <div key={idx} className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs flex gap-3">
                                                <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-black text-xs shadow-xs ${is33 ? 'bg-red-50 text-[#E30613] border border-red-100' : 'bg-green-50 text-[#3AAA35] border border-green-100'}`}>
                                                    {is33 ? '33+' : '34+'}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-slate-800">{s.name}</span>
                                                        <span className="text-[9.5px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{s.timing}</span>
                                                    </div>
                                                    <p className="text-slate-700 font-semibold mb-1 text-[11.5px]">{s.dosage}</p>
                                                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-medium">{s.rationale}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 font-medium flex items-center gap-2.5">
                                    <span className="text-base">🌱</span>
                                    <span>Esquema Nutricional Básico sin Alteraciones Prescritas.</span>
                                </div>
                            )}
                        </div>

                        {/* Sección 3: Recomendaciones y Manejo Clínico */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <h3 className="text-slate-900 text-xs font-extrabold uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <FileText className="w-4.5 h-4.5 text-blue-600" />
                                3. Recomendaciones y Manejo Clínico de Medicina Funcional
                            </h3>
                            {cleanManagement.length > 0 ? (
                                <div className="space-y-2.5">
                                    {cleanManagement.map((m, idx) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs font-medium">
                                            <span className="font-bold text-slate-800 block mb-1">✓ {m.accion}</span>
                                            {m.racional && <p className="text-[11px] text-slate-500 leading-relaxed">{m.racional}</p>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 font-medium flex items-center gap-2.5">
                                    <span className="text-base">📋</span>
                                    <span>Sin Indicaciones de Manejo Especial Adicionales.</span>
                                </div>
                            )}
                        </div>

                        {/* Sección 4: Logística */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                            <h3 className="text-slate-900 text-xs font-extrabold uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                                <Calendar className="w-4.5 h-4.5 text-emerald-600" />
                                4. Logística y Planificación de Ejecución
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200/80 p-4 rounded-xl font-medium">
                                <div>
                                    <span className="text-[9.5px] uppercase font-extrabold text-slate-400 block mb-1 tracking-wider">Entorno Principal</span>
                                    <span className="font-bold text-slate-800 text-xs">
                                        {patientData?.logistics_profile?.environment?.venue === 'WORK' ? 'Oficina' : patientData?.logistics_profile?.environment?.venue === 'STREET' ? 'Calle' : 'Casa'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[9.5px] uppercase font-extrabold text-slate-400 block mb-1 tracking-wider">Preparación de Alimentos</span>
                                    <span className="font-bold text-slate-800 text-xs">
                                        {patientData?.logistics_profile?.cook_type === 'SELF' ? 'Propia / Especialista' : patientData?.logistics_profile?.cook_type === 'FAMILY' ? 'Familiar' : 'Personal'}
                                    </span>
                                </div>
                                <div className="col-span-1 md:col-span-2 border-t border-slate-200/80 pt-2.5 mt-1">
                                    <span className="text-[9.5px] uppercase font-extrabold text-slate-400 block mb-1 tracking-wider">Ruta de Evolución</span>
                                    <span className="font-bold text-slate-800 text-xs">28 Días de seguimiento continuo (Fases Calibradas)</span>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* --- ACORDEÓN PADRE: DIAGNÓSTICO INTEGRAL --- */}
            <Accordion
                title="Diagnóstico Integral"
                id="accordion-diagnosis-parent"
                isOpen={openSections.parentDiagnosis}
                onToggle={() => toggleSection('parentDiagnosis')}
                variant="parent"
            >
                <div className="space-y-6">
                    {/* --- SAFETY ENGINE BANNER --- */}
                    {isRiskDetected && !overrideActive && (
                        <div className="bg-tilo-danger/10 border-l-4 border-tilo-danger p-6 rounded-xl flex items-start gap-4 transition-all animate-in zoom-in-95 duration-300">
                            <ShieldAlert className="w-8 h-8 text-tilo-danger flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="text-tilo-danger font-extrabold text-base uppercase tracking-wider">Alerta de Seguridad Clínica</h3>
                                <p className="text-tilo-text-main text-xs mt-1 leading-relaxed">
                                    El sistema ha detectado riesgos potenciales basados en el historial del paciente 
                                    ({hasAllergies ? 'Alergias registradas' : ''}{hasAllergies && hasPhentermine ? ' y ' : ''}{hasPhentermine ? 'Fentermina detectada' : ''}).
                                    La prescripción de suplementación avanzada está bloqueada por seguridad.
                                </p>
                            </div>
                            <button
                                onClick={() => handleOverrideToggle(true)}
                                className="bg-tilo-danger text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-tilo-danger/80 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                            >
                                Autorización Clínica
                            </button>
                        </div>
                    )}

                    {overrideActive && (
                        <div className="bg-tilo-warning/10 border border-tilo-warning/30 p-4 rounded-xl flex items-center justify-between transition-all animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-2 text-tilo-warning font-medium">
                                <AlertTriangle className="w-5 h-5 text-tilo-warning" />
                                <span className="text-tilo-text-main text-xs">Override Médico Activado. Riesgos asumidos por el especialista.</span>
                            </div>
                            <button
                                onClick={() => handleOverrideToggle(false)}
                                className="text-tilo-warning hover:text-tilo-warning/80 text-xs font-bold underline cursor-pointer"
                            >
                                Restaurar Seguridad
                            </button>
                        </div>
                    )}

                    {/* --- CHILD ACCORDION 1: RESUMEN CLÍNICO (ABCD) --- */}
                    <Accordion
                        title="Resumen Clínico (ABCD)"
                        id="accordion-diagnosis-abcd"
                        isOpen={openSections.childDiagnosisAbcd}
                        onToggle={() => toggleSection('childDiagnosisAbcd')}
                    >
                        <div id="card-diagnosis" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* A: Antropometría */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border flex flex-col justify-between">
                                <div>
                                    <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-tilo-primary"></span>
                                        A. Antropometría & Composición
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center pb-2.5 border-b border-tilo-border/60">
                                            <span className="text-xs font-medium text-tilo-text-muted">Índice de Masa Corporal (IMC)</span>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${displayImcClass === 'Normal' ? 'bg-tilo-success/10 text-tilo-success border border-tilo-success/20' : 'bg-tilo-danger/10 text-tilo-danger border border-tilo-danger/20'}`}>
                                                {displayImc || '--'} ({displayImcClass || '--'})
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pb-2.5 border-b border-tilo-border/60">
                                            <span className="text-xs font-medium text-tilo-text-muted">Peso / Talla (Estatura)</span>
                                            <span className="text-xs font-bold text-tilo-text-main">
                                                {displayWeight || '--'} kg / {displayHeight ? (parseFloat(displayHeight) > 3 ? `${displayHeight} cm` : `${displayHeight} m`) : '--'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-tilo-text-muted">Índice Cintura-Cadera (ICC)</span>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${displayIccRiesgo === 'Sin Riesgo' ? 'bg-tilo-success/10 text-tilo-success border border-tilo-success/20' : 'bg-tilo-warning/10 text-tilo-warning border border-tilo-warning/20'}`}>
                                                {displayIcc || '--'} ({displayIccRiesgo || '--'})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* B: Bioquímicos / Vitales */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border flex flex-col justify-between">
                                <div>
                                    <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-tilo-danger"></span>
                                        B. Bioquímicos, Vitales & Escáner
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="bg-white p-3 rounded-xl border border-tilo-border/80 shadow-2xs">
                                            <span className="text-[9.5px] uppercase font-extrabold text-tilo-text-muted block mb-0.5 tracking-wider">Presión Arterial</span>
                                            <span className="text-xs font-extrabold text-tilo-text-main">{displayBP ? `${displayBP} mmHg` : '80/40 mmHg'}</span>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-tilo-border/80 shadow-2xs">
                                            <span className="text-[9.5px] uppercase font-extrabold text-tilo-text-muted block mb-0.5 tracking-wider">Glucosa Ayuno / HbA1c</span>
                                            <span className="text-xs font-extrabold text-tilo-text-main">{displayGluc ? `${displayGluc} mg/dL` : '95 mg/dL (Estable)'}</span>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-tilo-border/80 shadow-2xs">
                                            <span className="text-[9.5px] uppercase font-extrabold text-tilo-text-muted block mb-0.5 tracking-wider">SpO2 / FC</span>
                                            <span className="text-xs font-extrabold text-tilo-text-main">{displaySpo2 || '95'}% / {displayFc || '90'} bpm</span>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-tilo-border/80 shadow-2xs">
                                            <span className="text-[9.5px] uppercase font-extrabold text-tilo-text-muted block mb-0.5 tracking-wider">Escáner Bioeléctrico</span>
                                            <span className="text-xs font-extrabold text-tilo-primary">{patientData?.escaner?.anguloFase ? `Fase: ${patientData.escaner.anguloFase}°` : '5.8° | Normotrófico'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* C: Clínica */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border flex flex-col justify-between">
                                <div>
                                    <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-tilo-warning"></span>
                                        C. Evaluación Clínica & Diagnósticos
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-[10px] uppercase font-extrabold text-tilo-text-muted block mb-1.5 tracking-wider">Diagnósticos Aprobados</span>
                                            {cleanDiagnoses.length > 0 ? (
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                                    {cleanDiagnoses.map((d, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-tilo-border/80 text-xs font-semibold text-tilo-text-main shadow-2xs">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#1C75BC] shrink-0"></span>
                                                                <span className="truncate">{d.nombre}</span>
                                                            </div>
                                                            <span className="text-[9.5px] font-mono text-tilo-text-muted font-bold ml-2 shrink-0">{d.cie10}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-tilo-text-muted italic">Sin patologías registradas</span>
                                            )}
                                        </div>
                                        <div className="pt-2 border-t border-tilo-border/60 flex justify-between items-center">
                                            <span className="text-[10px] uppercase font-extrabold text-tilo-text-muted tracking-wider">Alergias Identificadas</span>
                                            <span className={`text-xs font-bold ${hasAllergies ? 'text-tilo-danger bg-red-50 border border-red-200 px-2 py-0.5 rounded-full' : 'text-tilo-text-main'}`}>
                                                {hasAllergies ? allergies.map(a => a.agent || a.name || a).join(', ') : 'Sin alergias registradas'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* D: Dietética */}
                            <div className="bg-tilo-bg-base/40 p-5 rounded-2xl border border-tilo-border flex flex-col justify-between">
                                <div>
                                    <h3 className="text-tilo-text-muted text-[10px] font-extrabold uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-tilo-success"></span>
                                        D. Perfil Dietético & Hormonal
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="bg-white p-3.5 rounded-xl border border-tilo-border/80 shadow-2xs">
                                            <span className="text-[9.5px] uppercase font-extrabold text-tilo-text-muted block mb-1 tracking-wider">Enfoque Metabólico (Framework 5x5x5)</span>
                                            <span className="text-xs font-bold text-tilo-success block">
                                                Modulación Insulina / Cortisol (Sin Conteo Calórico)
                                            </span>
                                        </div>
                                        <div className="bg-white p-3.5 rounded-xl border border-tilo-border/80 shadow-2xs">
                                            <span className="text-[9.5px] uppercase font-extrabold text-tilo-text-muted block mb-1 tracking-wider">Aversiones / Exclusiones</span>
                                            <span className="text-xs font-bold text-tilo-text-main block leading-relaxed">
                                                {patientData?.evaluacionDietetica?.preferencias?.aversiones ? `Aversión: ${patientData.evaluacionDietetica.preferencias.aversiones}` : (patientData?.nutrition?.dislikes?.length > 0 ? patientData.nutrition.dislikes.join(', ') : 'Sin aversiones registradas')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 2: ARQUITECTURA DE ORO RECOMENDADA --- */}
                    <Accordion
                        title="Arquitectura de Oro Recomendada"
                        id="accordion-gold-architecture"
                        isOpen={openSections.childGoldArchitecture}
                        onToggle={() => toggleSection('childGoldArchitecture')}
                    >
                        <div id="card-gold-architecture" className="relative p-1">
                            {/* Overlay Bloqueo (Solo visual) */}
                            {isRiskDetected && !overrideActive && (
                                <div className="absolute inset-0 bg-tilo-bg-base/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
                                    <Lock className="w-12 h-12 text-tilo-text-muted opacity-50 animate-pulse" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* 33 Plus */}
                                <div className="flex flex-col items-center text-center p-6 bg-tilo-bg-base/40 rounded-2xl border border-tilo-border hover:shadow-md transition-shadow">
                                    <div className="w-20 h-20 bg-tilo-primary/10 text-tilo-primary rounded-full flex items-center justify-center mb-4 shadow-inner">
                                        <HeartPulse className="w-10 h-10 text-tilo-primary" />
                                    </div>
                                    <h4 className="text-2xl font-black text-tilo-text-main tracking-tight">33 PLUS</h4>
                                    <p className="text-tilo-primary font-bold text-xs tracking-widest uppercase mt-1 mb-4">Ignición Mitocondrial</p>
                                    <p className="text-tilo-text-muted text-xs leading-relaxed mb-6">
                                        Optimización de la cadena respiratoria celular, reducción de fatiga crónica y mejora en la sensibilidad a la insulina.
                                    </p>
                                    <button
                                        onClick={handleToggle33}
                                        className={`mt-auto px-6 py-2.5 rounded-full text-xs font-bold transition-all w-full cursor-pointer shadow-sm ${
                                            is33Added
                                                ? 'bg-tilo-success hover:bg-tilo-success/80 text-white shadow-tilo-success/20'
                                                : 'bg-tilo-primary hover:bg-tilo-primary/80 text-white shadow-tilo-primary/20'
                                        }`}
                                    >
                                        {is33Added ? '✓ Agregado al Plan' : 'Agregar al Plan'}
                                    </button>
                                </div>

                                {/* 34 Plus */}
                                <div className="flex flex-col items-center text-center p-6 bg-tilo-bg-base/40 rounded-2xl border border-tilo-border hover:shadow-md transition-shadow">
                                    <div className="w-20 h-20 bg-tilo-success/10 text-tilo-success rounded-full flex items-center justify-center mb-4 shadow-inner">
                                        <Activity className="w-10 h-10 text-tilo-success" />
                                    </div>
                                    <h4 className="text-2xl font-black text-tilo-text-main tracking-tight">34 PLUS</h4>
                                    <p className="text-tilo-success font-bold text-xs tracking-widest uppercase mt-1 mb-4">Ingeniería Tisular</p>
                                    <p className="text-tilo-text-muted text-xs leading-relaxed mb-6">
                                        Regeneración de matriz extracelular, fortalecimiento articular y optimización de síntesis proteica post-ejercicio.
                                    </p>
                                    <button
                                        onClick={handleToggle34}
                                        className={`mt-auto px-6 py-2.5 rounded-full text-xs font-bold transition-all w-full cursor-pointer shadow-sm ${
                                            is34Added
                                                ? 'bg-tilo-success hover:bg-tilo-success/80 text-white shadow-tilo-success/20'
                                                : 'bg-tilo-primary hover:bg-tilo-primary/80 text-white shadow-tilo-primary/20'
                                        }`}
                                    >
                                        {is34Added ? '✓ Agregado al Plan' : 'Agregar al Plan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- CHILD ACCORDION 3: NOTAS DE EVOLUCIÓN (SOAP) --- */}
                    <TabNotes
                        patientData={patientData}
                        setPatientData={setPatientData}
                        isEditing={isEditing}
                        Accordion={Accordion}
                        openSections={openSections}
                        toggleSection={toggleSection}
                    />

                    {/* --- CHILD ACCORDION 4: PLAN DE INTERVENCIÓN --- */}
                    <TabIntervention
                        patientData={patientData}
                        setPatientData={setPatientData}
                        isEditing={isEditing}
                        Accordion={Accordion}
                        openSections={openSections}
                        toggleSection={toggleSection}
                    />
                </div>
            </Accordion>
        </div>
    );
};

export default TabDiagnosis;
