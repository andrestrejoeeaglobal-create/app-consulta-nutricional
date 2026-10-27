import React, { useState } from 'react';
import { Activity, ShieldAlert, AlertTriangle, Zap, HeartPulse, Lock, FileText, Calendar, Clock } from 'lucide-react';
import { DiagnosticoRenderizado } from '../interview/Fase19_DiagnosticoIntegral';
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
    const [activeTimelinePhase, setActiveTimelinePhase] = useState(1);

    const dossier = patientData?.clinical_dossier || {};
    const ifmNodes = Array.isArray(dossier.ifm_nodes_matrix) ? dossier.ifm_nodes_matrix : [];
    const ortho = dossier.orthomolecular_prescription || {};
    const bioenergetics = dossier.bioenergetics || ortho.bioenergetics_summary || null;
    const node3 = ifmNodes.find(n => n.nodeId === 'NODO_3_ENERGIA');
    const node5 = ifmNodes.find(n => n.nodeId === 'NODO_5_TRANSPORTE');

    // Derivación Reactiva de Alertas de Medicina Funcional (Cero Hardcoding)
    const activeAlertNodes = React.useMemo(() => {
        return ifmNodes.filter(n => n.status !== 'HOMEOSTASIS' || (Array.isArray(n.key_biomarkers) && n.key_biomarkers.length > 0));
    }, [ifmNodes]);

    const hasActiveAlerts = activeAlertNodes.length > 0;
    const alertNodesCount = activeAlertNodes.length;

    // Síntesis Fisiopatológica Multimodal CORTEX (Lectura Defensiva)
    const correlacionMultimodal = React.useMemo(() => {
        const rawCorr = patientData?.scan_data?.correlacion_multimodal || 
                        patientData?.scan_data?.ocular_metrics?.correlacion_multimodal || 
                        patientData?.scan_data?.lingual_metrics?.correlacion_multimodal;
        if (rawCorr && typeof rawCorr === 'object' && rawCorr.sintesis_fisiopatologica) {
            return {
                sintesis_fisiopatologica: rawCorr.sintesis_fisiopatologica,
                indice_prioridad_clinica: rawCorr.indice_prioridad_clinica || "Moderado"
            };
        }
        const patientName = patientData?.profile?.name || patientData?.identificacion?.nombre || "el paciente";
        return {
            sintesis_fisiopatologica: `Pendiente de integración multimodal. Complete la toma de bioseñales, auditoría ocular y topografía lingual en la Fase 18 para generar la síntesis fisiopatológica CORTEX de ${patientName}.`,
            indice_prioridad_clinica: "Pendiente"
        };
    }, [patientData?.scan_data]);

    // === SAFETY ENGINE (Medical Override) ===
    const [overrideActive, setOverrideActive] = useState(
        patientData?.nutrition?.preferences?.safety_lock?.override_applied || false
    );

    React.useEffect(() => {
        setOverrideActive(patientData?.nutrition?.preferences?.safety_lock?.override_applied || false);
    }, [patientData?.nutrition?.preferences?.safety_lock?.override_applied, citationId]);

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

    const ageCandidate = parseFloat(
        patientData?.identificacion?.edad ?? 
        patientData?.identityLock?.patientInfo?.age ?? 
        patientData?.edad ?? 
        30
    ) || 30;

    const isLactante = ageCandidate < 2;
    const isJuvenilAdolescente = !isLactante && ageCandidate < 18;
    const isGeriatric = ageCandidate >= 65;
    const isAdult = !isLactante && !isJuvenilAdolescente && !isGeriatric;

    const assignedRoute = String(
        patientData?.clinical_dossier?.routing?.target_route || 
        patientData?.routing?.target_route || 
        patientData?.clinical_dossier?.doctrina_aplicada || 
        ""
    );

    const isRouteMismatch = (ageCandidate >= 18) && (
        assignedRoute.includes('RUTA_A') || 
        assignedRoute.includes('Pediátr') || 
        assignedRoute.includes('L-OMS')
    );

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

        // Descartar diagnósticos pediátricos en adultos >= 18 años
        if (ageCandidate >= 18) {
            const lower = nameStr.toLowerCase();
            if (lower.includes('pediátr') || lower.includes('l-oms') || lower.includes('psicomotor') || lower.includes('lactante')) {
                return null;
            }
        }

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

    // Si no hay diagnósticos válidos en dossier, construir dinámicamente desde el motivo/evaluación clínica según edad
    const defaultAdultDiagnoses = [
        {
            nodo: '1. Asimilación y Salud Digestiva',
            nombre: '1. Asimilación: Eubiosis e Integridad Intestinal (K90.9 - Prioridad Primaria)',
            cie10: 'K90.9',
            prioridad: 'Alta / Primaria (Nodo Raíz)',
            nodeKey: 'asimilacion',
            isRootNode: true
        },
        {
            nodo: '2. Biotransformación y Salud Renal',
            nombre: '2. Biotransformación: Salud Hepática y Renal Fisiológica (Z71.3 - Preventivo)',
            cie10: 'Z71.3',
            prioridad: 'Elevada',
            nodeKey: 'biotransformacion',
            isRootNode: false
        },
        {
            nodo: '3. Defensa y Reparación',
            nombre: '3. Defensa e Integridad: Perfil Inmunológico e Inflamatorio (Z88.8)',
            cie10: 'Z88.8',
            prioridad: 'Secundaria',
            nodeKey: 'defensa',
            isRootNode: false
        },
        {
            nodo: '4. Comunicación y Endocrino',
            nombre: '4. Comunicación: Equilibrio Neuroendocrino (E07.9)',
            cie10: 'E07.9',
            prioridad: 'Secundaria',
            nodeKey: 'comunicacion',
            isRootNode: false
        },
        {
            nodo: '5. Energía y Mitoquímica',
            nombre: '5. Energía: Perfil Metabólico e Inmunonutricional (E78.5)',
            cie10: 'E78.5',
            prioridad: 'Secundaria',
            nodeKey: 'energia',
            isRootNode: false
        },
        {
            nodo: '6. Transporte y Microcirculación',
            nombre: '6. Transporte: Perfusión Cardiorrespiratoria y Microcirculación (G93.1)',
            cie10: 'G93.1',
            prioridad: 'Secundaria',
            nodeKey: 'transporte',
            isRootNode: false
        },
        {
            nodo: '7. Integridad Estructural y Fascial',
            nombre: '7. Integridad Estructural: Biotensegridad y Salud Fascial (M35.9)',
            cie10: 'M35.9',
            prioridad: 'Secundaria',
            nodeKey: 'estructural',
            isRootNode: false
        }
    ];

    const cleanDiagnoses = parsedDiagnoses.length > 0 ? parsedDiagnoses : defaultAdultDiagnoses;

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

    const rawMgmt = patientData?.clinical_dossier?.human_approved_management || 
                    patientData?.clinical_dossier?.expediente_medico_nom004?.suggested_management || [];

    const hasPediatricContentInAdult = (ageCandidate >= 18) && rawMgmt.some(m => {
        const str = String(typeof m === 'string' ? m : (m?.accion || m?.action || '')).toLowerCase();
        return str.includes('lactancia') || str.includes('tummy time') || str.includes('pediatra') || str.includes('l-oms');
    });

    const cleanManagement = (rawMgmt.length > 0 && !isRouteMismatch && !hasPediatricContentInAdult)
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
            dosage: '1 toma al día (disuelto strictly en mínimo 500 ml de agua 💧)',
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
    const [localPlanViewMode, setLocalPlanViewMode] = useState('medical');
    const activeViewMode = propPlanViewMode || localPlanViewMode;
    const setActiveViewMode = propSetPlanViewMode || setLocalPlanViewMode;

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

    const isGuiaInvalidForAdult = (ageCandidate >= 18) && String(guia?.pilar_salud_crecimiento || '').toLowerCase().includes('pals');
    const pilarTitle = (!isGuiaInvalidForAdult && guia?.titulo_resumen) ? guia.titulo_resumen : defaultTitle;

    // Pilar 1: Estado de Salud / Crecimiento
    const defaultPilar1 = isLactante
        ? `${pName} se encuentra en una etapa de desarrollo acelerado con constantes vitales normales para sus Primeros 1,000 Días de vida.`
        : isJuvenilAdolescente
        ? `${pName} evoluciona favorablemente en su etapa de crecimiento óseo e infantil con parámetros fisiológicos adecuados.`
        : isGeriatric
        ? `El estado de salud de ${pName} está enfocado en proteger su vitalidad, reserva cognitiva y capacidad funcional autónoma.`
        : hasActiveAlerts
        ? `Hemos identificado ${alertNodesCount} ejes metabólicos prioritarios en tu evaluación que atenderemos de raíz con este protocolo personalizado para optimizar tu salud integral.`
        : `Tu cuerpo se encuentra en un estado metabólico estable con parámetros adaptados a tus objetivos de salud y rendimiento.`;

    const pilar1Text = (!isGuiaInvalidForAdult && guia?.pilar_salud_crecimiento) ? guia.pilar_salud_crecimiento : defaultPilar1;

    // Pilar 2: Nutrición y Alimentación
    const defaultPilar2 = isLactante
        ? `Mantener la lactancia materna o fórmula de continuación como base alimentaria principal, complementando con ablactación guiada (papillas caseras monocomponente o sólidos BLW).`
        : isJuvenilAdolescente
        ? `Alimentación rica en proteínas completas, calcio y micronutrientes para el crecimiento óseo, con snacks escolares nutritivos y sin restricción calórica punitiva.`
        : isGeriatric
        ? `Proteína fraccionada de alta calidad biológica para prevenir la sarcopenia, ajustada a su función renal (TFG) con adecuada hidratación diaria.`
        : `Mantener alimentación equilibrada sin conteo calórico estricto, priorizando alimentos naturales e hidratación óptima.`;

    const isPilar2Invalid = (ageCandidate >= 18) && String(guia?.pilar_alimentacion_diaria || '').toLowerCase().includes('lactancia');
    const pilar2Text = (!isPilar2Invalid && guia?.pilar_alimentacion_diaria) ? guia.pilar_alimentacion_diaria : defaultPilar2;

    // Pilar 3: Actividad y Movimiento
    const defaultPilar3 = isLactante
        ? `Estimulación psicomotriz diaria con tiempo boca abajo (Tummy Time), gateo libre sobre superficies seguras y rodamientos para desarrollar su postura y tono muscular.`
        : isJuvenilAdolescente
        ? `Deporte formativo, juego activo, natación y calistenia con peso corporal (evitando cargas máximas o entrenamiento extenuante de adultos).`
        : isGeriatric
        ? `Movilidad aeróbica adaptada de bajo impacto, ejercicios de propiocepción, equilibrio (Sit-to-Stand) y prevención activa de caídas.`
        : `Actividad física constante con caminata diaria (NEAT), entrenamiento de fuerza estructurado y ejercicio aeróbico adaptado.`;

    const isPilar3Invalid = (ageCandidate >= 18) && String(guia?.pilar_juegos_movimiento || '').toLowerCase().includes('tummy time');
    const pilar3Text = (!isPilar3Invalid && guia?.pilar_juegos_movimiento) ? guia.pilar_juegos_movimiento : defaultPilar3;

    // Pilar 4: Cuidados y Seguimiento
    const defaultPilar4 = isLactante
        ? `Monitoreo continuo de hitos de desarrollo con su pediatra tratante (NOM-043/OMS). Las recomendaciones nutricionales son de acompañamiento bioseguro.`
        : isJuvenilAdolescente
        ? `Higiene del sueño (8-10 horas para óptima liberación de hormona de crecimiento) y control del tiempo frente a pantallas antes de dormir.`
        : isGeriatric
        ? `Monitoreo cuidadoso de tomas, hidratación constante sin sobrecarga y acompañamiento familiar respetuoso para preservar su bienestar.`
        : `Seguir los horarios de tomas y suplementación estratégica para optimizar tu energía diurna y descanso nocturno.`;

    const isPilar4Invalid = (ageCandidate >= 18) && String(guia?.pilar_cuidados_suplementacion || '').toLowerCase().includes('pediatra');
    const pilar4Text = (!isPilar4Invalid && guia?.pilar_cuidados_suplementacion) ? guia.pilar_cuidados_suplementacion : defaultPilar4;

    // Diagnóstico General Integrado en Lenguaje Comprensible para el Paciente
    const diagnosticoGeneralPaciente = React.useMemo(() => {
        const patientName = pName || patientData?.profile?.name || patientData?.identificacion?.nombre || "Paciente";
        const systemCards = [];

        // 1. Transporte Cardiovascular (Nodo 5)
        const cardioNode = ifmNodes.find(n => n.nodeId === 'NODO_5_TRANSPORTE' || String(n.nodeName || '').toLowerCase().includes('transporte'));
        if (cardioNode && (cardioNode.status !== 'HOMEOSTASIS' || (Array.isArray(cardioNode.key_biomarkers) && cardioNode.key_biomarkers.length > 0))) {
            systemCards.push({
                id: 'cardio',
                icon: '🫀',
                title: 'Circulación y Presión Arterial',
                badge: 'Atención Prioritaria',
                badgeColor: 'bg-red-50 text-[#E30613] border-red-200',
                description: 'Tus vasos sanguíneos presentan sobrecarga de resistencia y reactividad. Para cuidar tu corazón, tu plan restringe el ejercicio de alta exigencia (Zona 5 HIIT) y prioriza caminata ligera y movilidad diaria (NEAT).'
            });
        }

        // 2. Metabolismo y Energía (Nodo 3)
        const energyNode = ifmNodes.find(n => n.nodeId === 'NODO_3_ENERGIA' || String(n.nodeName || '').toLowerCase().includes('bioenerg'));
        if (energyNode && (energyNode.status !== 'HOMEOSTASIS' || (Array.isArray(energyNode.key_biomarkers) && energyNode.key_biomarkers.length > 0))) {
            systemCards.push({
                id: 'metabolismo',
                icon: '⚡',
                title: 'Metabolismo de Grasas y Colesterol',
                badge: 'Modulación Activa',
                badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
                description: 'Tus células requieren apoyo para procesar eficazmente el colesterol y las grasas circulantes. La alimentación calculada y la fórmula 33Plus® diurna trabajan para restaurar la sensibilidad metabólica.'
            });
        }

        // 3. Piel e Inmunidad (Nodo 6)
        const defenseNode = ifmNodes.find(n => n.nodeId === 'NODO_6_DEFENSA' || String(n.nodeName || '').toLowerCase().includes('defensa'));
        if (defenseNode && (defenseNode.status !== 'HOMEOSTASIS' || (Array.isArray(defenseNode.key_biomarkers) && defenseNode.key_biomarkers.length > 0))) {
            systemCards.push({
                id: 'piel_inmune',
                icon: '🛡️',
                title: 'Barrera Cutánea e Inflamación',
                badge: 'Inflamación Superficial',
                badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
                description: 'El eritema o reactividad cutánea detectada refleja un proceso inflamatorio tisular. La fórmula 34Plus® nocturna (con colágeno y vitamina C) está formulada para reparar la matriz tisular durante el descanso.'
            });
        }

        // 4. Neuroendocrino / Sueño (Nodo 4)
        const neuroNode = ifmNodes.find(n => n.nodeId === 'NODO_4_COMUNICACION' || String(n.nodeName || '').toLowerCase().includes('comunicación'));
        if (neuroNode && (neuroNode.status !== 'HOMEOSTASIS' || (Array.isArray(neuroNode.key_biomarkers) && neuroNode.key_biomarkers.length > 0))) {
            systemCards.push({
                id: 'neuro_circadiano',
                icon: '🧠',
                title: 'Equilibrio Neurovascular y Descanso',
                badge: 'Vigilancia Funcional',
                badgeColor: 'bg-blue-50 text-[#1C75BC] border-blue-200',
                description: 'Es necesario vigilar la elasticidad microvascular cerebral y sincronizar los ritmos circadianos de actividad y sueño para una óptima recuperación cognitiva.'
            });
        }

        // 5. Otros nodos alterados que no cayeron en los anteriores
        activeAlertNodes.forEach(node => {
            const alreadyHandled = ['NODO_5_TRANSPORTE', 'NODO_3_ENERGIA', 'NODO_6_DEFENSA', 'NODO_4_COMUNICACION'].includes(node.nodeId);
            if (!alreadyHandled) {
                const cleanNodeName = String(node.nodeName || node.name || 'Sistema Funcional').replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '');
                systemCards.push({
                    id: node.nodeId || Math.random().toString(),
                    icon: '🔬',
                    title: cleanNodeName,
                    badge: 'Enfoque Terapéutico',
                    badgeColor: 'bg-blue-50 text-[#1C75BC] border-blue-200',
                    description: node.summary || node.therapeutic_focus || 'Atención de medicina funcional orientada a restablecer la homeostasis de este sistema.'
                });
            }
        });

        const isFullyOptimal = systemCards.length === 0;

        const overviewText = isFullyOptimal
            ? `Tu evaluación clínica refleja un equilibrio fisiológico óptimo en tus 7 sistemas funcionales. Este plan está diseñado para potenciar tu longevidad, vitalidad celular y rendimiento diario continuo.`
            : `Hemos integrado tus estudios de laboratorio, bioimpedancia y exploración clínica para identificar las causas de fondo que requieren atención. Tu plan médico-nutricional no es restrictivo; es una intervención estratégica para aliviar la sobrecarga vascular, regular tu metabolismo y desinflamar tu organismo.`;

        return {
            patientName,
            overviewText,
            systemCards,
            isFullyOptimal
        };
    }, [patientData, ifmNodes, activeAlertNodes, pName]);

    return (
        <div className="space-y-6 font-sans">
            {/* Tarjeta Principal del Reporte Consolidado (Doctrina CORTEX v2.1 CDSS) */}
            <div className="w-full bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col mb-6">
                {/* CONMUTADOR DUAL DE VISTAS (❖ MODO DE VISUALIZACIÓN:) */}
                <div className="p-3 bg-white border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-2 select-none no-print">
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-2 shrink-0 select-none">
                            ❖ MODO DE VISUALIZACIÓN:
                        </span>

                        <button
                            type="button"
                            onClick={() => setActiveViewMode('patient')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                                activeViewMode === 'patient' 
                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-sm' 
                                    : 'bg-slate-100/80 text-slate-700 border-slate-200/80 hover:bg-slate-200/70'
                            }`}
                        >
                            <span>👤 Vista Paciente y Familia</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                activeViewMode === 'patient'
                                    ? 'bg-white text-[#1C75BC]'
                                    : 'bg-slate-200 text-slate-700'
                            }`}>
                                4 Pilares
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveViewMode('medical')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                                activeViewMode === 'medical' 
                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-sm' 
                                    : 'bg-slate-100/80 text-slate-700 border-slate-200/80 hover:bg-slate-200/70'
                            }`}
                        >
                            <span>🩺 Vista Expediente Clínico</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                activeViewMode === 'medical'
                                    ? 'bg-white text-[#1C75BC]'
                                    : 'bg-slate-200 text-slate-700'
                            }`}>
                                NOM-004
                            </span>
                        </button>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                        Doctrina T.I.L.O. 2030
                    </span>
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

                {/* VISTA 1: PACIENTE Y FAMILIA (4 PILARES EMPÁTICOS TERMODINÁMICOS) */}
                {activeViewMode === 'patient' ? (
                    <div className="p-6 space-y-4">
                        {/* Pilar 1: Crecimiento y Salud */}
                        <div className={`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs border-l-4 ${
                            hasActiveAlerts ? 'border-l-amber-500' : 'border-l-[#3AAA35]'
                        } hover:shadow-md transition-all`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                            hasActiveAlerts
                                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                : 'bg-emerald-50 text-[#3AAA35] border-emerald-200/70'
                                        }`}>
                                            PILAR 01 • SALUD METABÓLICA
                                        </span>
                                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                                            <span>🌱</span>
                                            <span>{pilarTitle}</span>
                                        </h3>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide border shrink-0 self-start sm:self-center ${
                                    hasActiveAlerts
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                                }`}>
                                    {hasActiveAlerts ? `⚠️ ENFOQUE DE REVERSIÓN METABÓLICA (${alertNodesCount} Nodos)` : '✓ HOMEOSTASIS METABÓLICA'}
                                </span>
                            </div>

                            <p className="text-slate-700 text-xs leading-relaxed font-medium mt-3">
                                {pilar1Text}
                            </p>

                            <div className="my-3 bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex items-center justify-between text-[10.5px]">
                                <span className="font-bold text-slate-500">Estado Biológico General:</span>
                                {hasActiveAlerts ? (
                                    <span className="font-extrabold text-amber-800 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                        Atención Prioritaria Focalizada ({ageCandidate} años)
                                    </span>
                                ) : (
                                    <span className="font-extrabold text-[#3AAA35] flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-[#3AAA35] animate-pulse"></span>
                                        Calibración Óptima para Edad ({ageCandidate} años)
                                    </span>
                                )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-medium">ⓘ Monitoreo Funcional Preventivo Continuo</span>
                            </div>
                        </div>

                        {/* Pilar 2: Guía de Alimentación Diaria */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs border-l-4 border-l-[#1C75BC] hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-[#1C75BC] border border-blue-200/70">
                                            PILAR 02 • NUTRICIÓN DEFENSORA
                                        </span>
                                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                                            <span>🥗</span>
                                            <span>Guía de Alimentación Diaria</span>
                                        </h3>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide bg-blue-50 text-[#1C75BC] border border-blue-200 shrink-0 self-start sm:self-center">
                                    🥗 MODULACIÓN METABÓLICA
                                </span>
                            </div>

                            <p className="text-slate-700 text-xs leading-relaxed font-medium mt-3">
                                {pilar2Text}
                            </p>

                            <div className="my-3 bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex items-center justify-between text-[10.5px]">
                                <span className="font-bold text-slate-500">Estrategia Dietética:</span>
                                <span className="font-extrabold text-[#1C75BC]">
                                    Densidad Nutricional sin Restricción Punitiva
                                </span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-medium">ⓘ Protocolo de Eubiosis y Carga Glucémica</span>
                            </div>
                        </div>

                        {/* Pilar 3: Actividades y Desarrollo Motor */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs border-l-4 border-l-amber-500 hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/70">
                                            PILAR 03 • BIOMECÁNICA Y NEAT
                                        </span>
                                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                                            <span>🧸</span>
                                            <span>Actividades y Movimiento Funcional</span>
                                        </h3>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide bg-amber-50 text-amber-800 border border-amber-200 shrink-0 self-start sm:self-center">
                                    🧸 MOVILIDAD ADAPTADA
                                </span>
                            </div>

                            <p className="text-slate-700 text-xs leading-relaxed font-medium mt-3">
                                {pilar3Text}
                            </p>

                            <div className="my-3 bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex items-center justify-between text-[10.5px]">
                                <span className="font-bold text-slate-500">Prescripción Biomecánica:</span>
                                <span className="font-extrabold text-amber-700">
                                    Fuerza Muscular (Exoesqueleto) + Estiramiento Miofascial
                                </span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-medium">ⓘ Modelo Lyon & Attia de Longevidad Muscular</span>
                            </div>
                        </div>

                        {/* Pilar 4: Cuidados y Seguimiento */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs border-l-4 border-l-indigo-600 hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                                            PILAR 04 • CRONOBIOLOGÍA Y CUIDADOS
                                        </span>
                                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                                            <span>💧</span>
                                            <span>Cuidados, Suplementación y Seguimiento</span>
                                        </h3>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 self-start sm:self-center">
                                    💧 CRONONUTRICIÓN ACTIVA
                                </span>
                            </div>

                            <p className="text-slate-700 text-xs leading-relaxed font-medium mt-3">
                                {pilar4Text}
                            </p>

                            <div className="my-3 bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 flex items-center justify-between text-[10.5px]">
                                <span className="font-bold text-slate-500">Ventana Crononutricional:</span>
                                <span className="font-extrabold text-indigo-700">
                                    Sincronización Diurna (33Plus) / Nocturna (34Plus)
                                </span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-medium">ⓘ Sinergia de Ignición Mitocondrial y Reparación Tisular</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* VISTA 2: EXPEDIENTE CLÍNICO OFICIAL (NOM-004 / MATRIZ IFM) */
                    <div className="p-6 space-y-6">
                        
                        {/* Síntesis CORTEX v2.4 (Matriz de 7 Nodos IFM + Árbol Bioenergético) */}
                        {Array.isArray(patientData?.clinical_dossier?.ifm_nodes_matrix) && patientData.clinical_dossier.ifm_nodes_matrix.length > 0 ? (
                            <DiagnosticoRenderizado cortexSynthesis={patientData.clinical_dossier} />
                        ) : (
                            /* Sección 1: Diagnósticos (Fallback previo a síntesis v2.4) */
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
                        )}

                        {/* Algoritmo de Secuenciación Terapéutica Cronológica (Línea de Tiempo 60-30-10) */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-[#1C75BC] p-5 shadow-xs space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C75BC]/10 text-[#1C75BC] border border-[#1C75BC]/20">
                                        CRONOBIOLOGÍA METABÓLICA
                                    </span>
                                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 select-none">
                                        <Clock className="w-4 h-4 text-[#1C75BC]" />
                                        <span>Algoritmo de Secuenciación Terapéutica Cronológica</span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 3].map(phase => (
                                        <button
                                            key={phase}
                                            type="button"
                                            onClick={() => setActiveTimelinePhase(phase)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all border ${
                                                activeTimelinePhase === phase
                                                    ? 'bg-[#1C75BC] text-white border-[#1C75BC] shadow-xs'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            Fase {phase}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                <div className={`rounded-xl p-4 border transition-all space-y-2.5 flex flex-col justify-between ${
                                    activeTimelinePhase === 1
                                        ? 'bg-blue-50/70 border-[#1C75BC] ring-2 ring-[#1C75BC]/20 shadow-xs'
                                        : 'bg-slate-50/60 border-slate-200/80 opacity-90'
                                }`}>
                                    <div>
                                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                                            <span className="text-[10px] font-black text-[#1C75BC] uppercase tracking-wider">Días 1 a 21</span>
                                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-900">FASE 1</span>
                                        </div>
                                        <h5 className="font-extrabold text-slate-900 text-xs uppercase mb-1.5">Estabilización Endotelial y Barrera Mucosa</h5>
                                        <p className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
                                            Sellado epitelial intestinal, hidratación bioestructurada e inicio de cronobiología 33Plus® (09:00 AM) y 34Plus® (08:30 PM en 500 ml de agua).
                                        </p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[9.5px] text-slate-500 font-bold">
                                        <span>Permeabilidad y Microcirculación</span>
                                        <span className="text-[#1C75BC]">Semana 1-3</span>
                                    </div>
                                </div>

                                <div className={`rounded-xl p-4 border transition-all space-y-2.5 flex flex-col justify-between ${
                                    activeTimelinePhase === 2
                                        ? 'bg-emerald-50/70 border-[#3AAA35] ring-2 ring-[#3AAA35]/20 shadow-xs'
                                        : 'bg-slate-50/60 border-slate-200/80 opacity-90'
                                }`}>
                                    <div>
                                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                                            <span className="text-[10px] font-black text-[#3AAA35] uppercase tracking-wider">Días 22 a 45</span>
                                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">FASE 2</span>
                                        </div>
                                        <h5 className="font-extrabold text-slate-900 text-xs uppercase mb-1.5">Modulación Lipídica y Reológica Profunda</h5>
                                        <p className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
                                            Optimización del transporte lipídico, reducción de viscosidad hemática y síntesis activa de óxido nítrico para reactividad microvascular.
                                        </p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[9.5px] text-slate-500 font-bold">
                                        <span>Sensibilidad Insulínica y Vasos</span>
                                        <span className="text-[#3AAA35]">Semana 4-6</span>
                                    </div>
                                </div>

                                <div className={`rounded-xl p-4 border transition-all space-y-2.5 flex flex-col justify-between ${
                                    activeTimelinePhase === 3
                                        ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                        : 'bg-slate-50/60 border-slate-200/80 opacity-90'
                                }`}>
                                    <div>
                                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Días 46+</span>
                                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">FASE 3</span>
                                        </div>
                                        <h5 className="font-extrabold text-slate-900 text-xs uppercase mb-1.5">Consolidación Metabólica y Re-Evaluación</h5>
                                        <p className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
                                            Auditoría de control de biomarcadores fuera de rango y consolidación de composición corporal ({bioenergetics?.targetKcal ? `${bioenergetics.targetKcal} kcal/día` : 'mantenimiento normocalórico'}).
                                        </p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[9.5px] text-slate-500 font-bold">
                                        <span>Biometría de Control</span>
                                        <span className="text-indigo-600">Semana 7+</span>
                                    </div>
                                </div>
                            </div>
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

                    {/* --- DIAGNÓSTICO GENERAL Y ESTADO DE SALUD (LENGUAJE COMPRENSIBLE PARA EL PACIENTE) --- */}
                    <div id="card-diagnostico-general" className={`bg-white rounded-2xl border border-slate-200/90 border-l-4 ${
                        hasActiveAlerts ? 'border-l-amber-500' : 'border-l-[#3AAA35]'
                    } p-5 shadow-xs transition-all duration-300`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                        hasActiveAlerts
                                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                                            : 'bg-emerald-50 text-[#3AAA35] border-emerald-200/70'
                                    }`}>
                                        EVALUACIÓN INTEGRAL DEL PACIENTE
                                    </span>
                                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                                        <span>🧬</span>
                                        <span>Diagnóstico General y Estado de Salud</span>
                                    </h4>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Síntesis fisiológica en lenguaje claro basada en tus estudios y exploración clínica
                                </p>
                            </div>
                            <span className={`text-[10px] px-2.5 py-1 rounded-xl font-black uppercase tracking-wider border shrink-0 self-start sm:self-center ${
                                hasActiveAlerts
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-emerald-50 text-[#3AAA35] border-emerald-200'
                            }`}>
                                {hasActiveAlerts ? `⚠️ ${alertNodesCount} Áreas en Atención Prioritaria` : '✓ Equilibrio Fisiológico'}
                            </span>
                        </div>

                        {/* Visión General Comprensible */}
                        <p className="text-xs text-slate-700 leading-relaxed font-medium mt-3.5 text-justify">
                            {diagnosticoGeneralPaciente.overviewText}
                        </p>

                        {/* Ejes Clínicos Clave en Lenguaje Humano */}
                        {diagnosticoGeneralPaciente.systemCards.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {diagnosticoGeneralPaciente.systemCards.map((sys) => (
                                    <div
                                        key={sys.id}
                                        className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 text-xs leading-relaxed flex flex-col justify-between hover:bg-slate-100/70 transition-colors"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <span className="font-extrabold text-[11px] text-slate-900 flex items-center gap-1.5">
                                                    <span>{sys.icon}</span>
                                                    <span>{sys.title}</span>
                                                </span>
                                                <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded border shrink-0 ${sys.badgeColor}`}>
                                                    {sys.badge}
                                                </span>
                                            </div>
                                            <p className="text-[11.5px] text-slate-700 font-medium leading-relaxed">
                                                {sys.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Detalle Técnico de Bioseñales y Topografía Lingual (Fase 18) - Reubicado como detalle secundario colapsable */}
                        {correlacionMultimodal?.sintesis_fisiopatologica && (
                            <div className="mt-4 pt-3 border-t border-slate-100">
                                <details className="group">
                                    <summary className="cursor-pointer text-[10.5px] font-bold text-slate-500 hover:text-[#1C75BC] flex items-center justify-between select-none">
                                        <span className="flex items-center gap-1.5">
                                            <span>🔬</span>
                                            <span>Detalle Técnico de Bioseñales y Topografía Lingual (Fase 18)</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="mt-2.5 p-3 bg-slate-50/90 rounded-xl border border-slate-200/70 text-[11px] text-slate-600 leading-relaxed space-y-1.5">
                                        <p>{correlacionMultimodal.sintesis_fisiopatologica}</p>
                                        <p className="text-[9.5px] text-slate-400 font-medium border-t border-slate-200/60 pt-1.5">
                                            Bioseñales de apoyo: Auditoría Ocular Binocular + Topografía Lingual CYTOS + Biorresonancia Electret
                                        </p>
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>

                    {/* --- CHILD ACCORDION 2: ARQUITECTURA DE ORO RECOMENDADA (BENTO CARDS ORTOMOLECULARES) --- */}
                    <Accordion
                        title="Arquitectura de Oro Recomendada"
                        id="accordion-gold-architecture"
                        isOpen={openSections.childGoldArchitecture}
                        onToggle={() => toggleSection('childGoldArchitecture')}
                    >
                        <div id="card-gold-architecture" className="relative p-1">
                            {/* Overlay Bloqueo (Solo visual) */}
                            {isRiskDetected && !overrideActive && (
                                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
                                    <Lock className="w-12 h-12 text-white opacity-70 animate-pulse" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                {/* 33 Plus (Ignición Mitocondrial - Rojo #E30613) */}
                                <div className="flex flex-col bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-[#E30613] p-5 shadow-xs hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-red-50 text-[#E30613] border border-red-200/70">
                                                FÓRMULA 33PLUS® • DÍA
                                            </span>
                                            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                                33 PLUS
                                            </h4>
                                        </div>
                                        <span className="text-[10px] font-extrabold text-[#E30613] uppercase tracking-wider bg-red-50/70 px-2 py-0.5 rounded-md">
                                            Ignición Mitocondrial
                                        </span>
                                    </div>

                                    <p className="text-slate-700 text-xs leading-relaxed font-medium mb-3.5 flex-1">
                                        Optimización de la cadena respiratoria celular, reducción de fatiga crónica y mejora en la sensibilidad a la insulina mediante cofactores vasculares y antioxidantes diurnos.
                                    </p>

                                    <div className="mb-4 bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 text-[10.5px] space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-bold">Dosificación:</span>
                                            <span className="font-extrabold text-slate-800">1 toma al día</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-bold">Momento de ingesta:</span>
                                            <span className="font-extrabold text-[#E30613]">☀️ Con el desayuno (09:00 AM)</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleToggle33}
                                        className={`mt-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all w-full cursor-pointer shadow-sm flex items-center justify-center gap-2 ${
                                            is33Added
                                                ? 'bg-[#E30613] text-white hover:bg-[#E30613]/90 shadow-red-500/20'
                                                : 'bg-[#1C75BC] text-white hover:bg-[#1C75BC]/90 shadow-blue-500/20'
                                        }`}
                                    >
                                        <HeartPulse className="w-4 h-4 shrink-0" />
                                        <span>{is33Added ? '✓ Agregado al Plan Nutracéutico' : 'Agregar 33Plus® al Plan'}</span>
                                    </button>
                                </div>

                                {/* 34 Plus (Ingeniería Tisular - Verde #3AAA35) */}
                                <div className="flex flex-col bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-[#3AAA35] p-5 shadow-xs hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-[#3AAA35] border border-emerald-200/70">
                                                FÓRMULA 34PLUS® • NOCHE
                                            </span>
                                            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                                34 PLUS
                                            </h4>
                                        </div>
                                        <span className="text-[10px] font-extrabold text-[#3AAA35] uppercase tracking-wider bg-emerald-50/70 px-2 py-0.5 rounded-md">
                                            Ingeniería Tisular
                                        </span>
                                    </div>

                                    <p className="text-slate-700 text-xs leading-relaxed font-medium mb-3.5 flex-1">
                                        Regeneración de matriz extracelular, fortalecimiento articular y optimización de síntesis proteica post-ejercicio durante el sueño profundo.
                                    </p>

                                    <div className="mb-4 bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 text-[10.5px] space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-bold">Dosificación:</span>
                                            <span className="font-extrabold text-slate-800">1 toma al día (mínimo 500 ml de agua 💧)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-bold">Momento de ingesta:</span>
                                            <span className="font-extrabold text-[#3AAA35]">🌙 Con la cena (08:30 PM)</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleToggle34}
                                        className={`mt-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all w-full cursor-pointer shadow-sm flex items-center justify-center gap-2 ${
                                            is34Added
                                                ? 'bg-[#3AAA35] text-white hover:bg-[#3AAA35]/90 shadow-emerald-500/20'
                                                : 'bg-[#1C75BC] text-white hover:bg-[#1C75BC]/90 shadow-blue-500/20'
                                        }`}
                                    >
                                        <Activity className="w-4 h-4 shrink-0" />
                                        <span>{is34Added ? '✓ Agregado al Plan Nutracéutico' : 'Agregar 34Plus® al Plan'}</span>
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

export default TabDiagnosis;
