// Helper to render the genetic map
const MemberRow = ({ label, items }) => {
    const getPathologyBadgeStyle = (patologia) => {
        const pat = (patologia || "").toLowerCase();
        if (pat.includes("diab")) {
            return "bg-tilo-primary/10 text-tilo-primary border border-tilo-primary/20";
        }
        if (pat.includes("hiper") || pat.includes("presi") || pat.includes("tensi")) {
            return "bg-tilo-danger/10 text-tilo-danger border border-tilo-danger/20";
        }
        if (pat.includes("canc") || pat.includes("cánc") || pat.includes("tumo") || pat.includes("onco")) {
            return "bg-tilo-danger/10 text-tilo-danger border border-tilo-danger/20 font-bold";
        }
        if (pat.includes("obes") || pat.includes("sobrep")) {
            return "bg-tilo-warning/10 text-tilo-warning border border-tilo-warning/20";
        }
        if (pat.includes("renal") || pat.includes("dial")) {
            return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
        }
        return "bg-tilo-bg-base/60 text-tilo-text-main border border-tilo-border/60";
    };

    const getLocalizedPathValue = (pat, det) => {
        if (pat === "Otras" || pat === "OTHER") {
            return det || "Otras";
        }
        if (pat === "Cancer") {
            return det ? `Cáncer (${det})` : "Cáncer";
        }
        if (pat === "Hipertension") return "Hipertensión";
        if (pat === "Cardiopatia") return "Cardiopatía";
        if (pat === "Psiquiatrico") return "Psiquiátrico";
        return pat || "Condición";
    };

    const getIcon = () => {
        const lower = (label || "").toLowerCase();
        if (lower.includes("abuelo")) return <Dna size={18} />;
        return <Users size={18} />;
    };

    return (
        <div className="bg-tilo-bg-base/40 border border-tilo-border p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-tilo-primary/30 transition-all">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-tilo-primary/10 text-tilo-primary flex items-center justify-center shrink-0 border border-tilo-primary/20">
                    {getIcon()}
                </div>
                <span className="text-[11px] font-bold text-tilo-text-main uppercase tracking-tight">{label}</span>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
                {items && items.length > 0 ? (
                    items.map((item, idx) => {
                        const patVal = getLocalizedPathValue(item.patologia || item.condition, item.detalle || item.detail);
                        const relName = item.familiar || item.relative || "Familiar";
                        return (
                            <div 
                                key={idx} 
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-all max-w-[200px] sm:max-w-[250px] ${getPathologyBadgeStyle(item.patologia || item.condition)}`}
                                title={`${relName}: ${patVal}`}
                            >
                                <span className="opacity-80 shrink-0">{relName}:</span>
                                <span className="truncate">{patVal}</span>
                            </div>
                        );
                    })
                ) : (
                    <span className="text-[9px] text-tilo-text-muted/40 font-bold uppercase italic tracking-widest font-sansation">Sin reporte</span>
                )}
            </div>
        </div>
    );
};
import React from 'react';
import { Dna, Activity, Utensils, AlertTriangle, FlaskConical, Salad, Cigarette, Wine, Pill, Moon, Users } from 'lucide-react';
import EspejoClinicoActivo from '../interview/EspejoClinicoActivo';
import ReactMarkdown from 'react-markdown';

// eslint-disable-next-line no-unused-vars
const severityMap = {
    'HIGH': 'Alto',
    'MEDIUM': 'Moderado',
    'LOW': 'Bajo',
    'PENDING': 'Pendiente'
};

const phenotypeMap = {
    'CONSTIPATION': 'Estreñimiento',
    'BLOATING': 'Distensión / Inflamación',
    'DIARRHEA': 'Diarrea',
    'MIXED': 'Mixto',
    'NONE': 'Ninguno',
    'EUBIOSIS': 'Eubiosis'
};

const smokingMap = {
    'CIGARETTE': 'Cigarrillo',
    'VAPE': 'Vapeador / Electrónico',
    'BOTH': 'Ambos (Cigarrillo y Vapeador)',
    'NONE': 'Ninguno'
};

const alcoholMap = {
    'BEER_355': 'Cerveza (Lata 355ml)',
    'BEER_940': 'Cerveza Caguama (940ml)',
    'WINE': 'Vino (Copa 150ml)',
    'SPIRITS': 'Destilados / Licores',
    'COCKTAILS': 'Coctelería / Mezclas',
    'NONE': 'Ninguno'
};

const sleepQualityMap = {
    'GOOD': 'Buena',
    'FAIR': 'Regular',
    'POOR': 'Mala'
};

const sleepIssueMap = {
    'INSOMNIA': 'Insomnio',
    'FRAGMENTED': 'Sueño fragmentado',
    'APNEA': 'Posible Apnea',
    'SHIFT_WORK': 'Turno nocturno'
};

const stressLevelMap = {
    'LOW': 'Bajo',
    'MODERATE': 'Moderado',
    'HIGH': 'Alto'
};

const stressOriginMap = {
    'EMOTIONAL': 'Emocional/Ansiedad',
    'PHYSICAL': 'Carga laboral/Físico',
    'BOTH': 'Mixto'
};

// eslint-disable-next-line no-unused-vars
const detailsKeyMap = {
    'frequency': 'Frecuencia',
    'digestive_frequency': 'Frecuencia',
    'duration': 'Duración',
    'symptoms': 'Síntomas',
    'details': 'Detalles'
};

const getMenstrualPhaseInfo = (days) => {
    if (days === undefined || days === null || isNaN(days)) return null;
    const d = Number(days);
    if (d >= 1 && d <= 10) {
        return {
            phase: 'FASE DE PODER',
            description: 'Cuerpo optimizado para ayunos largos y dieta cetobiótica.',
            color: 'bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20'
        };
    }
    if (d >= 11 && d <= 15) {
        return {
            phase: 'FASE DE MANIFESTACIÓN',
            description: 'Soporte para metabolizar el estrógeno.',
            color: 'bg-tilo-success/10 text-tilo-success border-tilo-success/20'
        };
    }
    if (d >= 16 && d <= 19) {
        return {
            phase: 'FASE DE PODER',
            description: 'Cuerpo optimizado para ayunos largos y dieta cetobiótica.',
            color: 'bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20'
        };
    }
    if (d >= 20) {
        return {
            phase: 'FASE DE NUTRICIÓN',
            description: 'Prohibición de ayunos para proteger la progesterona.',
            color: 'bg-tilo-danger/10 text-tilo-danger border-tilo-danger/30'
        };
    }
    return null;
};
import { GamificationRings, StreakCard } from '../ui/GamificationRings';

export const TabClinicalHistory = ({
    patientData,
    // eslint-disable-next-line no-unused-vars
    setPatientData,
    // eslint-disable-next-line no-unused-vars
    isEditing,
    // eslint-disable-next-line no-unused-vars
    onTriggerEdit,
    renderEditableField,
    // eslint-disable-next-line no-unused-vars
    CardHeader,
    Accordion,
    openSections,
    toggleSection,
    currentStep,
    // eslint-disable-next-line no-unused-vars
    TAG_CONFIG,
    fase3State,
    fase4State,
    fase5State,
    fase6State,
    fase7State,
    fase8State,
    fase9State,
    pendingAlerts,
    // eslint-disable-next-line no-unused-vars
    metabolicAxis
}) => {
    const rawPatientData = patientData;
    // Sync physiological status fields to clinical group for dashboard rendering
    let menstruationCycleValue = 'No refiere';
    let pregnancyValue = 'No refiere';
    let lactationValue = 'No refiere';

    if (rawPatientData) {
        const clinicalCopy = {
            ...(rawPatientData.clinical || {})
        };

        // 1. Último Periodo / Menstruación
        if (rawPatientData.physio?.is_pregnant) {
            const weeks = rawPatientData.physio?.preg_weeks || rawPatientData.physio?.gestation_weeks;
            if (weeks) {
                menstruationCycleValue = `Gestación activa (${weeks} semanas)`;
            } else if (rawPatientData.clinical_context?.secondary_symptoms) {
                menstruationCycleValue = `Gestación (Retraso: ${rawPatientData.clinical_context.secondary_symptoms})`;
            } else {
                menstruationCycleValue = `Gestación activa`;
            }
        } else {
            const symptomsText = rawPatientData.clinical_context?.secondary_symptoms || "";
            if (rawPatientData.physio?.last_menstruation_period) {
                menstruationCycleValue = rawPatientData.physio.last_menstruation_period;
            } else if (symptomsText && symptomsText.toLowerCase().includes('retraso')) {
                menstruationCycleValue = `Retraso: ${symptomsText}`;
            }
        }

        // 2. Embarazo
        const physioObj = rawPatientData.physio?.physio ? rawPatientData.physio.physio : (rawPatientData.physio || {});
        const isPregnantVal = physioObj.is_pregnant;
        
        if (isPregnantVal === true || isPregnantVal === 'true' || isPregnantVal === 'Sí' || isPregnantVal === 'si') {
            const weeks = physioObj.preg_weeks || physioObj.gestation_weeks;
            pregnancyValue = weeks ? `Activo (${weeks} semanas)` : 'Activo';
        } else if (isPregnantVal === false || isPregnantVal === 'false' || isPregnantVal === 'No' || isPregnantVal === 'no' || isPregnantVal === 'Negado' || isPregnantVal === 'negado') {
            pregnancyValue = 'Niega';
        } else if (rawPatientData.clinical_context?.goal === 'GOAL_PREGNANCY' || rawPatientData.clinical_context?.primary_motive === 'Embarazo y Lactancia') {
            pregnancyValue = 'Ruta Embarazo Activa';
        } else {
            pregnancyValue = 'No refiere';
        }

        // 3. Lactancia Materna
        const isLactatingVal = physioObj.is_lactating;
        if (isLactatingVal === true || isLactatingVal === 'true' || isLactatingVal === 'Sí' || isLactatingVal === 'si') {
            let details = [];
            if (physioObj.lactation_type) {
                details.push(physioObj.lactation_type);
            }
            if (physioObj.baby_age_months !== null && physioObj.baby_age_months !== undefined) {
                details.push(`Bebé: ${physioObj.baby_age_months} meses`);
            }
            lactationValue = details.length > 0 ? `Activa (${details.join(', ')})` : 'Activa';
        } else if (isLactatingVal === false || isLactatingVal === 'false' || isLactatingVal === 'No' || isLactatingVal === 'no' || isLactatingVal === 'Negado' || isLactatingVal === 'negado') {
            lactationValue = 'Niega';
        } else if (rawPatientData.clinical_context?.goal === 'GOAL_PREGNANCY' || rawPatientData.clinical_context?.primary_motive === 'Embarazo y Lactancia') {
            lactationValue = 'Ruta Lactancia Activa';
        } else {
            lactationValue = 'No refiere';
        }

        clinicalCopy.menstruation_cycle = menstruationCycleValue;
        clinicalCopy.pregnancy_status = pregnancyValue;
        clinicalCopy.lactation_status = lactationValue;
    }

    const renderAlertsForCategory = (category) => {
        const ahfTypes = ['ALERTA ONCOLÓGICA FAMILIAR', 'RIESGO METABÓLICO HEREDITARIO', 'RIESGO CARDIOVASCULAR'];
        const appTypes = [
            'EVALUACIÓN GLUCÉMICA / DISFUNCIÓN METABÓLICA',
            'MONITOREO DE TENSIÓN ARTERIAL',
            'ADAPTACIÓN ENDÓCRINA TIROIDEA',
            'MODULACIÓN HORMONAL DE ALTO RANGO',
            'INTEGRIDAD DE MUCOSA INTESTINAL',
            'RIESGO DISLIPIDÉMICO ACTIVO'
        ];

        const isAhf = (a) => ahfTypes.includes(a.type);
        const isApp = (a) => appTypes.includes(a.type);
        
        const isDigestivo = (a) => {
            if (isAhf(a) || isApp(a)) return false;
            const t = (a.type || '').toUpperCase();
            return t.includes('SIBO') || t.includes('INTESTINAL') || t.includes('COLITIS') || t.includes('DIGESTIV') || t.includes('DISBIOSIS');
        };

        const isAlergia = (a) => {
            if (isAhf(a) || isApp(a) || isDigestivo(a)) return false;
            const t = (a.type || '').toUpperCase();
            return t.includes('ALERGIA') || t.includes('SENSIBILIDAD') || t.includes('REACTIVIDAD') || t.includes('ANAFI') || t.includes('BETA-LACTÁMICOS') || t.includes('SALICILATOS');
        };

        const isFarmaco = (a) => {
            if (isAhf(a) || isApp(a) || isDigestivo(a) || isAlergia(a)) return false;
            const t = (a.type || '').toUpperCase();
            return t.includes('FARMACO') || 
                   t.includes('DEPLETACIÓN') || 
                   t.includes('DEPLETACION') || 
                   t.includes('DEPLECION') || 
                   t.includes('INTERACCIÓN') || 
                   t.includes('INTERACCION') || 
                   t.includes('ABSORCIÓN') || 
                   t.includes('ABSORCION') || 
                   t.includes('INSULINA') || 
                   t.includes('GASTRO') || 
                   t.includes('HEPÁTICA') || 
                   t.includes('HEPATICA') || 
                   t.includes('NEFRO') || 
                   t.includes('HEMORRAGIA') || 
                   t.includes('METABÓLICA') || 
                   t.includes('METABOLICA') || 
                   t.includes('COAGULACIÓN') || 
                   t.includes('COAGULACION') || 
                   t.includes('ADYUVANTE');
        };

        let filteredAlerts = [];
        if (category === 'ahf') {
            const hasAhf = (patientData.familyTree?.antecedentes && patientData.familyTree.antecedentes.length > 0);
            filteredAlerts = hasAhf ? (pendingAlerts || []).filter(isAhf) : [];
        } else if (category === 'app') {
            const activeAppConditions = (patientData.history?.personal_structured || []).map(p => 
                String(p.specific_condition || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            );
            filteredAlerts = (pendingAlerts || []).filter(isApp).filter(alert => {
                const alertType = String(alert.type || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const alertMsg = String(alert.message || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                if (alertType.includes("GLUCEMICA") || alertType.includes("METABOLICA") || alertMsg.includes("DIABETES") || alertMsg.includes("GLUCOSA")) {
                    return activeAppConditions.some(c => c.includes("DIABETES") || c.includes("GLUCOSA") || c.includes("RESISTENCIA"));
                }
                if (alertType.includes("TENSIO") || alertType.includes("ARTERIAL") || alertMsg.includes("HIPERTENSION") || alertMsg.includes("PRESION")) {
                    return activeAppConditions.some(c => c.includes("HIPERTENS") || c.includes("PRESI"));
                }
                if (alertType.includes("TIROI") || alertMsg.includes("HIPOTIRO") || alertMsg.includes("TIROIDE")) {
                    return activeAppConditions.some(c => c.includes("TIROI") || c.includes("HIPOTIRO"));
                }
                if (alertType.includes("HORMONAL") || alertType.includes("SOP") || alertMsg.includes("SOP") || alertMsg.includes("OVARIO")) {
                    return activeAppConditions.some(c => c.includes("SOP") || c.includes("OVARIO"));
                }
                if (alertType.includes("INTESTINAL") || alertType.includes("MUCOSA") || alertMsg.includes("GASTRIT") || alertMsg.includes("COLIT") || alertMsg.includes("INTESTINO")) {
                    return activeAppConditions.some(c => c.includes("GASTRIT") || c.includes("COLIT") || c.includes("INTESTINO"));
                }
                if (alertType.includes("DISLIPIDEMICO") || alertMsg.includes("COLESTEROL") || alertMsg.includes("TRIGLICERID") || alertMsg.includes("DISLIPIDEMIA")) {
                    return activeAppConditions.some(c => c.includes("DISLIPIDEMIA") || c.includes("COLESTEROL") || c.includes("TRIGLICERID"));
                }
                return true;
            });
        } else if (category === 'digestivo') {
            filteredAlerts = (pendingAlerts || []).filter(isDigestivo);
        } else if (category === 'alergias') {
            filteredAlerts = (pendingAlerts || []).filter(isAlergia);
        } else if (category === 'farmaco') {
            const activeMedNames = (patientData.history?.medications || []).map(m => 
                String(m.name).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            );
            filteredAlerts = (pendingAlerts || []).filter(isFarmaco).filter(alert => {
                const alertText = String((alert.type || "") + " " + (alert.message || "")).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return activeMedNames.some(medName => {
                    if (medName.length < 3) return false;
                    return alertText.includes(medName);
                });
            });
        } else if (category === 'unclassified') {
            filteredAlerts = (pendingAlerts || []).filter(a => 
                !isAhf(a) && !isApp(a) && !isDigestivo(a) && !isAlergia(a) && !isFarmaco(a)
            );
        }

        const showRedAlert = category === 'ahf' && ((fase4State?.alert_detected) || (pendingAlerts || []).some(a => a.type === 'ALERTA ONCOLÓGICA FAMILIAR'));

        if (filteredAlerts.length === 0 && !showRedAlert) return null;

        return (
            <div className="mb-4 space-y-3">
                <h4 className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Monitoreo Analítico Pasivo
                </h4>
                {filteredAlerts.map(alert => (
                    <div key={alert.id} className="p-4 bg-tilo-warning/5 border border-tilo-warning/20 rounded-2xl flex items-start gap-4 shadow-sm animate-in zoom-in duration-300">
                        <div className="bg-tilo-warning/10 p-2 rounded-full text-tilo-warning border border-tilo-warning/20 shrink-0">
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                             <h4 className="text-xs font-bold text-tilo-warning uppercase tracking-wider">{alert.type || 'ALERTA TILO CORTEX'}</h4>
                            <ReactMarkdown 
                                components={{
                                    p: ({node, ...props}) => <p className="text-sm text-tilo-text-main mt-1 font-medium leading-relaxed max-w-lg" {...props} />
                                }}
                            >
                                {alert.message}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
                {showRedAlert && (
                    <div className="p-4 bg-tilo-danger/5 border border-tilo-danger/20 rounded-2xl flex items-start gap-4 shadow-sm animate-in zoom-in duration-300">
                        <div className="bg-tilo-danger/10 p-2 rounded-full text-tilo-danger border border-tilo-danger/20 shrink-0">
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-tilo-danger uppercase tracking-wider">Carga Genética de Riesgo</h4>
                            <p className="text-sm text-tilo-text-main mt-1 font-medium leading-relaxed max-w-lg font-sansation">
                                Antecedentes oncológicos detectados. El plan priorizará compuestos <strong className="font-bold text-tilo-danger">anti-inflamatorios y quimiopreventivos</strong> para blindar su salud metabólica.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6" >
            {/* --- ACORDEÓN PADRE 2: HISTORIA CLÍNICA --- */}
            < Accordion
                title="Historia Clínica"
                id="accordion-clinical-parent"
                isOpen={openSections.parentClinical}
                onToggle={() => toggleSection('parentClinical')}
                variant="parent"
            >
                <div className="space-y-6">

                    {/* --- ALERTAS SIN CLASIFICAR (FALLBACK DE SEGURIDAD) --- */}
                    {renderAlertsForCategory('unclassified')}

                    {/* --- HIJO 0: Motivo de Consulta --- */}
                    <Accordion
                        title="Motivo de Consulta"
                        id="accordion-motivo"
                        isOpen={openSections.childMotive}
                        onToggle={() => toggleSection('childMotive')}
                    >
                        <EspejoClinicoActivo fase3State={fase3State} finalizeGoal={fase3State?.finalizeGoal} patientData={patientData} />
                        



                    </Accordion>

                    {/* --- HIJO 1: AHF (Heredofamiliares) --- */}
                    <Accordion
                        title="Antecedentes Heredofamiliares"
                        id="accordion-ahf"
                        isOpen={openSections.childAhf}
                        onToggle={() => toggleSection('childAhf')}
                    >
                        <div id="card-ahf" className="space-y-6">
                            {renderAlertsForCategory('ahf')}
                            { (fase4State || patientData.familyTree?.antecedentes?.length > 0 || patientData.history?.family_structured?.length > 0) ? (
                                <div className="space-y-6">
                                    <div className="flex justify-center">
                                        <div className="px-10 py-3.5 rounded-full shadow-sm text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-4 transition-all border bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20">
                                            MAPA GENÉTICO PROFESIONAL
                                        </div>
                                    </div>

                                    {(() => {
                                        const antecedentsList = fase4State?.antecedentes 
                                            || patientData.familyTree?.antecedentes 
                                            || (patientData.history?.family_structured || []).map(item => ({
                                                familiar: item.relative,
                                                patologia: item.condition === 'OTHER' ? item.detail : item.condition,
                                                detalle: item.detail
                                            }))
                                            || [];

                                        const filterByRelatives = (list, relatives) => {
                                            return list.filter(a => {
                                                const rel = (a.familiar || a.relative || "").trim().toLowerCase();
                                                return relatives.some(r => rel === r.toLowerCase());
                                            });
                                        };

                                        const parentsItems = filterByRelatives(antecedentsList, ['Madre', 'Padre', 'Padres']);
                                        const maternalItems = filterByRelatives(antecedentsList, ['Abuela Materna', 'Abuelo Materno', 'Abuela Mat', 'Abuelo Mat', 'Abuelos Mat', 'Tio/a Materno/a', 'Tío Materno', 'Tía Materna']);
                                        const paternalItems = filterByRelatives(antecedentsList, ['Abuela Paterna', 'Abuelo Paterno', 'Abuela Pat', 'Abuelo Pat', 'Abuelos Pat', 'Tio/a Paterno/a', 'Tío Paterno', 'Tía Paterna']);
                                        const siblingsItems = filterByRelatives(antecedentsList, ['Hermano/a', 'Hermano', 'Hermana', 'Hermanos']);

                                        return (
                                            <div className="space-y-3">
                                                <MemberRow label="Padres" items={parentsItems} />
                                                <MemberRow label="Abuelos Maternos" items={maternalItems} />
                                                <MemberRow label="Abuelos Paternos" items={paternalItems} />
                                                <MemberRow label="Hermanos" items={siblingsItems} />
                                            </div>
                                        );
                                    })()}

                                </div>
                            ) : (
                                patientData.history?.family_raw_text ? (
                                    <div className="p-3 bg-tilo-bg-base/40 rounded-xl text-tilo-text-main font-medium border border-tilo-border text-sm italic">
                                        "{patientData.history.family_raw_text}"
                                    </div>
                                ) : (
                                    renderEditableField('Antecedentes', 'ahf_lista', 'Niega', 'clinica')
                                )
                            )}
                        </div>
                    </Accordion>

                    {/* --- HIJO 2: APP (Patológicos Personales) --- */}
                    <Accordion
                        title="Antecedentes Patológicos"
                        id="accordion-app"
                        isOpen={openSections.childApp}
                        onToggle={() => toggleSection('childApp')}
                    >
                        <div id="card-app" className="space-y-3">
                            {renderAlertsForCategory('app')}
                            <div className="space-y-3 relative z-10">
                                {patientData.history?.personal_structured && patientData.history.personal_structured.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {patientData.history.personal_structured.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-tilo-bg-base/40 rounded-xl text-sm border border-tilo-border w-full">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-tilo-text-main uppercase p-0 m-0 leading-tight">
                                                        {item.specific_condition === 'PENDING' ? item.condition_category : item.specific_condition}
                                                    </span>
                                                    <span className="text-[10px] text-tilo-text-muted font-semibold tracking-wide">
                                                        {item.source === 'CHECKLIST' ? 'NORMATIVA NOM-004' : 'REPORTE LIBRE'}
                                                    </span>
                                                </div>
                                                <div className="h-2 w-2 rounded-full bg-tilo-warning/80"></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    patientData.history?.personal_raw_text ? (
                                        <div className="p-3 bg-tilo-bg-base/40 rounded-xl text-tilo-text-main font-medium border border-tilo-border text-sm italic">
                                            "{patientData.history.personal_raw_text}"
                                            <div className="mt-2 flex justify-end">
                                                <span className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-wider bg-tilo-bg-panel px-2 py-0.5 rounded border border-tilo-border">
                                                    REPORTE LIBRE
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        renderEditableField('Patologías', 'app_lista', (patientData?.history?.personal_checklist_verified || fase5State) ? 'Niega' : 'Pendiente de evaluar', 'clinica')
                                    )
                                )}
                            </div>
                        </div>
                    </Accordion>

                    {/* --- HIJO 2.5: CIRUGÍAS PREVIAS --- */}
                    <Accordion
                        title="Cirugías Previas"
                        id="accordion-surgical"
                        isOpen={openSections.childSurgical}
                        onToggle={() => toggleSection('childSurgical')}
                    >
                        <div id="card-surgical" className="space-y-3">
                            <div className="space-y-3 relative z-10">
                                {(() => {
                                    const surgical = patientData.history?.surgical;
                                    if (Array.isArray(surgical) && surgical.length > 0) {
                                        return (
                                            <div className="flex flex-wrap gap-2">
                                                {surgical.map((item, idx) => (
                                                    <span key={idx} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-tilo-primary/10 text-tilo-primary border border-tilo-primary/20">
                                                        🩺 CIRUGÍA: {item.label}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    } else if (surgical === 'Niega') {
                                        return (
                                            <div className="p-3 bg-tilo-bg-base/40 rounded-xl text-slate-500 font-medium border border-tilo-border text-sm italic">
                                                Niega antecedentes quirúrgicos
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="p-3 bg-tilo-bg-base/20 rounded-xl text-slate-400 border border-tilo-border/50 text-sm italic select-none">
                                                Pendiente de evaluar
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    </Accordion>

                    {/* --- HIJO 3: FARMACOLOGÍA Y SUPLEMENTACIÓN --- */}
                    <Accordion
                        title="Farmacología y Suplementación"
                        id="accordion-farma"
                        isOpen={openSections.childFarma}
                        onToggle={() => toggleSection('childFarma')}
                    >
                        <div id="card-meds" className="space-y-6">
                            {renderAlertsForCategory('farmaco')}
                            <div className="space-y-6">
                                {/* SECTION: MEDICATIONS */}
                                <div>
                                    <h4 className="text-xs font-bold text-tilo-text-muted uppercase tracking-wider mb-2">Medicamentos Prescritos</h4>
                                    {patientData.history?.medications && patientData.history.medications.length > 0 ? (
                                        <div className="space-y-2">
                                            {patientData.history.medications.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start p-3 bg-tilo-bg-base/40 rounded-xl text-sm border border-tilo-border">
                                                    <div>
                                                        <div className="font-bold text-tilo-text-main">{item.name}</div>
                                                        <div className="text-xs text-tilo-text-muted mt-0.5">{item.dose_frequency}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="inline-block px-2 py-0.5 bg-tilo-bg-panel rounded border border-tilo-border text-[10px] font-bold text-tilo-text-muted">
                                                            {item.duration || 'Sin dato'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        renderEditableField(null, 'farma_lista', (patientData?.pharmacology || fase6State) ? 'Ninguno' : 'Pendiente de evaluar', 'clinica')
                                    )}
                                </div>

                                {/* SECTION: SUPPLEMENTS */}
                                <div>
                                    <h4 className="text-xs font-bold text-tilo-text-muted uppercase tracking-wider mb-2">Suplementación</h4>
                                    {patientData.history?.supplements && patientData.history.supplements.length > 0 ? (
                                        <div className="space-y-2">
                                            {patientData.history.supplements.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start p-3 bg-tilo-bg-base/40 rounded-xl text-sm border border-tilo-border">
                                                    <div>
                                                        <div className="font-bold text-tilo-text-main">{item.name}</div>
                                                        <div className="text-xs text-tilo-text-muted mt-0.5">{item.frequency}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="inline-block px-2 py-0.5 bg-tilo-bg-panel rounded border border-tilo-border text-[10px] font-bold text-tilo-text-muted">
                                                            {item.duration || 'Sin dato'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        renderEditableField(null, 'suple_lista', (patientData?.pharmacology || fase6State) ? 'Ninguno' : 'Pendiente de evaluar', 'clinica')
                                    )}
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- HIJO 4: ALERGIAS Y SEGURIDAD --- */}
                    <Accordion
                        title="Alergias y Seguridad"
                        id="accordion-allergies"
                        isOpen={openSections.childAllergies}
                        onToggle={() => toggleSection('childAllergies')}
                    >
                        <div id="card-allergy" className="space-y-6">
                            {renderAlertsForCategory('alergias')}
                            <div className="space-y-6">
                                {/* SECTION: FOOD ALLERGIES */}
                                <div>
                                    <h4 className="text-xs font-bold text-tilo-danger uppercase tracking-wider mb-2">Alimentos (Filtro Seguridad)</h4>
                                    {patientData.history?.allergies?.food && patientData.history.allergies.food.length > 0 ? (
                                        <div className="space-y-2">
                                            {patientData.history.allergies.food.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-3 bg-tilo-danger/5 rounded-xl text-sm border border-tilo-danger/10">
                                                    <div>
                                                        <div className="font-bold text-tilo-danger">{item.agent}</div>
                                                        <div className="text-xs text-tilo-text-muted mt-0.5">{item.reaction}</div>
                                                    </div>
                                                    <div>
                                                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${
                                                            (item.severity === 'HIGH' || !item.severity || item.severity === 'PENDING')
                                                                ? 'bg-tilo-danger/10 text-tilo-danger border-tilo-danger/20'
                                                                : 'bg-tilo-warning/10 text-tilo-warning border-tilo-warning/20'
                                                        }`}>
                                                            {item.severity === 'HIGH'
                                                                ? 'CRÍTICO'
                                                                : (item.severity === 'MEDIUM'
                                                                    ? 'ACTIVO'
                                                                    : 'ALERTA IGE')}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-tilo-bg-base/20 rounded-xl text-sm text-tilo-text-muted border border-dashed border-tilo-border text-center italic">
                                            {(patientData?.history?.allergies_verified || fase7State) ? "Niega alergias alimentarias" : "Pendiente de evaluar"}
                                        </div>
                                    )}
                                </div>

                                {/* SECTION: DRUG ALLERGIES */}
                                <div>
                                    <h4 className="text-xs font-bold text-tilo-danger uppercase tracking-wider mb-2">Medicamentos (Alerta Clínica)</h4>
                                    {patientData.history?.allergies?.drug && patientData.history.allergies.drug.length > 0 ? (
                                        <div className="space-y-2">
                                            {patientData.history.allergies.drug.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-3 bg-tilo-danger/5 rounded-xl text-sm border border-tilo-danger/10">
                                                    <div>
                                                        <div className="font-bold text-tilo-danger">{item.agent}</div>
                                                        <div className="text-xs text-tilo-text-muted mt-0.5">{item.reaction}</div>
                                                    </div>
                                                    <div>
                                                        <span className="inline-block px-2 py-0.5 bg-tilo-danger text-white rounded border border-tilo-danger/20 text-[10px] font-bold shadow-sm">
                                                            CRÍTICO
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-tilo-bg-base/20 rounded-xl text-sm text-tilo-text-muted border border-dashed border-tilo-border text-center italic">
                                            {(patientData?.history?.allergies_verified || fase7State) ? "Niega alergias medicamentosas" : "Pendiente de evaluar"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* --- HIJO 5: DIGESTIVO --- */}
                    <Accordion
                        title="Digestivo"
                        id="accordion-digestive"
                        isOpen={openSections.childDigestive}
                        onToggle={() => toggleSection('childDigestive')}
                    >
                        <div id="card-digestive" className="space-y-4">
                            {renderAlertsForCategory('digestivo')}
                            {patientData.digestive_profile?.has_issues ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-tilo-text-main">Fenotipo:</span>
                                        <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${patientData.digestive_profile.phenotype === 'CONSTIPATION' ? 'bg-tilo-warning/10 text-tilo-warning border-tilo-warning/20' :
                                            patientData.digestive_profile.phenotype === 'BLOATING' ? 'bg-tilo-warning/10 text-tilo-warning border-tilo-warning/20' :
                                                patientData.digestive_profile.phenotype === 'DIARRHEA' ? 'bg-tilo-danger/10 text-tilo-danger border-tilo-danger/20' :
                                                    'bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20'
                                            }`}>
                                            {phenotypeMap[patientData.digestive_profile.phenotype] || patientData.digestive_profile.phenotype}
                                        </span>
                                    </div>
                                    {patientData.digestive_profile.details && Object.keys(patientData.digestive_profile.details).length > 0 && (
                                        <div className="p-3 bg-tilo-bg-base/40 rounded-xl text-xs text-tilo-text-main border border-tilo-border">
                                            <strong>Detalle Clínico:</strong><br />
                                            {Object.entries(patientData.digestive_profile.details).map(([k, v]) => (
                                                <div key={k} className="mt-1 flex justify-between">
                                                    <span className="capitalize text-tilo-text-muted">{detailsKeyMap[k] || detailsKeyMap[k.toLowerCase()] || k.replace('digestive_', '').replace('_', ' ')}:</span>
                                                    <span className="font-medium text-tilo-text-main">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {patientData.digestive_profile.alarm_symptoms && patientData.digestive_profile.alarm_symptoms.length > 0 && (
                                        <div className="p-3 bg-tilo-danger/5 rounded-xl border border-tilo-danger/20 animate-pulse">
                                            <div className="flex items-center gap-2 mb-1">
                                                <AlertTriangle className="w-4 h-4 text-tilo-danger" />
                                                <span className="text-xs font-bold text-tilo-danger uppercase">Signos de Alarma</span>
                                            </div>
                                            <ul className="list-disc list-inside text-[10px] text-tilo-danger font-medium">
                                                {patientData.digestive_profile.alarm_symptoms.map(s => (
                                                    <li key={s}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {patientData.digestive_profile.ai_analysis?.raw_text && (
                                        <div className="text-xs text-tilo-text-muted italic border-t border-tilo-border/60 pt-2">
                                            " {patientData.digestive_profile.ai_analysis.raw_text} "
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${(fase8State || patientData.history?.digestive_verified || patientData.digestive_profile) ? 'bg-tilo-success/10 text-tilo-success border-tilo-success/20' : 'bg-tilo-warning/10 text-tilo-warning border-tilo-warning/20 animate-pulse'}`}>
                                        {(fase8State || patientData.history?.digestive_verified || patientData.digestive_profile) ? "EUBIOSIS (Sin hallazgos)" : "PENDIENTE DE EVALUAR"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Accordion>

                    {/* --- HIJO 6: ESTADO FISIOLÓGICO (Condicional) --- */}
                    {patientData?.profile?.sex === 'Femenino' && (() => {
                        const phaseInfo = getMenstrualPhaseInfo(patientData.physio?.menstrual_days);
                        return (
                            <Accordion
                                title="Estado Fisiológico"
                                id="accordion-physio"
                                isOpen={openSections.childPhysio}
                                onToggle={() => toggleSection('childPhysio')}
                            >
                                <div id="card-physio" className={`w-full transition-all duration-300 p-1 ${currentStep?.includes('physio_') ? 'ring-2 ring-tilo-primary/50 ring-offset-2 rounded-xl' : ''}`}>
                                    <div className="space-y-4">
                                        
                                        {/* Fila 1: Último Periodo / Menstruación */}
                                        <div className="p-3 bg-tilo-bg-base/30 rounded-xl border border-tilo-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-wider">Último Periodo / Menstruación</span>
                                                <span className="text-sm font-bold text-tilo-text-main mt-0.5">{menstruationCycleValue}</span>
                                            </div>
                                            
                                            {/* Badge clínico interpretativo (Mindy Pelz Protocol) */}
                                            {phaseInfo && (
                                                <div className="flex flex-col items-start md:items-end">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider border uppercase ${phaseInfo.color}`}>
                                                        {phaseInfo.phase}
                                                    </span>
                                                    <span className="text-[10px] text-tilo-text-muted font-semibold mt-1 text-left md:text-right max-w-[280px] leading-tight">
                                                        {phaseInfo.description}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Fila 2: Embarazo */}
                                        <div className="p-3 bg-tilo-bg-base/30 rounded-xl border border-tilo-border flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-wider">Embarazo</span>
                                                <span className="text-sm font-bold text-tilo-text-main mt-0.5">{pregnancyValue}</span>
                                            </div>
                                            <div className={`h-2.5 w-2.5 rounded-full ${patientData.physio?.is_pregnant ? 'bg-tilo-success animate-pulse' : 'bg-tilo-text-muted/30'}`}></div>
                                        </div>

                                        {/* Fila 3: Lactancia Materna */}
                                        <div className="p-3 bg-tilo-bg-base/30 rounded-xl border border-tilo-border flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-tilo-text-muted uppercase tracking-wider">Lactancia Materna</span>
                                                <span className="text-sm font-bold text-tilo-text-main mt-0.5">{lactationValue}</span>
                                            </div>
                                            <div className={`h-2.5 w-2.5 rounded-full ${patientData.physio?.is_lactating ? 'bg-tilo-success animate-pulse' : 'bg-tilo-text-muted/30'}`}></div>
                                        </div>

                                    </div>
                                </div>
                            </Accordion>
                        );
                    })()}

                    {/* --- HIJO 7: HÁBITOS Y TOXICOLOGÍA --- */}
                    <Accordion
                        title="Hábitos y Toxicología"
                        id="accordion-habits"
                        isOpen={openSections.childHabits}
                        onToggle={() => toggleSection('childHabits')}
                    >
                        <div id="card-habit" className="space-y-4">
                            <div className="space-y-4">
                                {patientData.safety?.interaction_flags?.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        {patientData.safety.interaction_flags.map((flag, idx) => (
                                            <div key={idx} className={`p-3 rounded-lg border flex items-start gap-3 ${flag.severity === 'CRITICAL' ? 'bg-tilo-danger/5 border-tilo-danger/10' : 'bg-tilo-warning/5 border-tilo-warning/10'}`}>
                                                <AlertTriangle className={`w-5 h-5 mt-0.5 ${flag.severity === 'CRITICAL' ? 'text-tilo-danger' : 'text-tilo-warning'}`} />
                                                <div>
                                                    <div className={`text-xs font-bold uppercase ${flag.severity === 'CRITICAL' ? 'text-tilo-danger' : 'text-tilo-warning'}`}>
                                                        {flag.risk_code}
                                                    </div>
                                                    <div className={`text-sm ${flag.severity === 'CRITICAL' ? 'text-tilo-text-main' : 'text-tilo-text-main'}`}>
                                                        {flag.user_message}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 2. TABACISMO */}
                                <div className="flex justify-between items-start border-b border-tilo-border/60 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Cigarette className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main">Tabaco / Vape</div>
                                            <div className="text-xs text-tilo-text-muted">
                                                {patientData.habits?.smoking?.is_smoker ? (
                                                    `${smokingMap[patientData.habits.smoking.type?.toUpperCase()] || patientData.habits.smoking.type || 'Activo'} - ${patientData.habits.smoking.quantity_text || 'Detalle pendiente'}`
                                                ) : (
                                                    patientData.habits?.smoking?.is_smoker === false ? (
                                                        <span className="text-tilo-text-main font-medium">Niega consumo</span>
                                                    ) : (
                                                        <span className="text-tilo-text-muted/80">Pendiente de evaluación</span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {patientData.habits?.smoking?.is_smoker && (
                                        <span className="bg-tilo-warning/10 text-tilo-warning border border-tilo-warning/20 text-[10px] px-2.5 py-0.5 rounded font-bold">ACTIVO</span>
                                    )}
                                </div>

                                {/* 3. ALCOHOL */}
                                <div className="flex justify-between items-start border-b border-tilo-border/60 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Wine className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main">Alcohol</div>
                                            <div className="text-xs text-tilo-text-muted">
                                                {patientData.habits?.alcohol?.is_drinker ? (
                                                    <>
                                                        {patientData.habits.alcohol.drinks && patientData.habits.alcohol.drinks.length > 0 ? (
                                                            <div className="space-y-2 mt-1">
                                                                {patientData.habits.alcohol.drinks.map((drink, idx) => (
                                                                    <div key={idx} className="border-l-2 border-tilo-primary/30 pl-2 py-0.5">
                                                                        <div className="font-semibold text-tilo-text-main">
                                                                            {alcoholMap[drink.preferred_drink?.toUpperCase()] || drink.preferred_drink}
                                                                        </div>
                                                                        <div className="text-[11px] text-tilo-text-muted">
                                                                            <strong>Frecuencia:</strong> {drink.frequency_days} días/semana | <strong>Cantidad:</strong> {drink.units_per_session} unidades/sesión
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                Activo ({alcoholMap[patientData.habits.alcohol.preferred_drink?.toUpperCase()] || patientData.habits.alcohol.preferred_drink || 'Detalle pendiente'})
                                                                {patientData.habits.alcohol.frequency_days !== null && (
                                                                    <div className="mt-1">
                                                                        <strong>Frecuencia:</strong> {patientData.habits.alcohol.frequency_days} días/semana
                                                                    </div>
                                                                )}
                                                                {patientData.habits.alcohol.units_per_session !== null && (
                                                                    <div className="mt-0.5">
                                                                        <strong>Cantidad:</strong> {patientData.habits.alcohol.units_per_session} unidades/sesión
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {patientData.habits.alcohol.calculated_weekly_calories > 0 && (
                                                            <div className="text-tilo-text-muted/70 mt-2 pt-1 border-t border-tilo-border/30">
                                                                <strong>Total Estimado:</strong> ~{patientData.habits.alcohol.calculated_weekly_calories} kcal/semana
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    patientData.habits?.alcohol?.is_drinker === false ? (
                                                        <span className="text-tilo-text-main font-medium">Niega consumo</span>
                                                    ) : (
                                                        <span className="text-tilo-text-muted/80">Pendiente de evaluación</span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {patientData.habits?.alcohol?.is_drinker && patientData.habits.alcohol.calculated_weekly_calories > 1000 && (
                                        <span className="bg-tilo-warning/10 text-tilo-warning border border-tilo-warning/20 text-[10px] px-2.5 py-0.5 rounded font-bold">ALTO CALÓRICO</span>
                                    )}
                                </div>

                                {/* 4. DROGAS (CRITICAL) */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <Pill className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main">Recreativo / Tóxicos</div>
                                            <div className="text-xs text-tilo-text-muted">
                                                {patientData.habits?.drugs?.has_usage ? (
                                                    `${patientData.habits.drugs.substance_name || 'Activo'} (${patientData.habits.drugs.frequency || 'Frecuencia pendiente'})`
                                                ) : (
                                                    patientData.habits?.drugs?.has_usage === false ? (
                                                        <span className="text-tilo-text-main font-medium">Niega consumo</span>
                                                    ) : (
                                                        <span className="text-tilo-text-muted/80">Pendiente de evaluación</span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {patientData.habits?.drugs?.has_usage && (
                                        <span className="bg-tilo-danger/10 text-tilo-danger border border-tilo-danger/20 text-[10px] px-2.5 py-0.5 rounded font-bold">
                                            ALERTA
                                        </span>
                                    )}
                                </div>



                            </div>
                        </div>
                    </Accordion>
                </div>
            </Accordion>
        </div>
    );
};

export default TabClinicalHistory;
