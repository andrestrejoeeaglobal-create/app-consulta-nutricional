export const generateSecurityConstraints = (religion, bmiValue) => {
    // Estructura base
    const constraints = {
        forbidden_ingredients: [],
        clinical_alerts: [],
        mix_restrictions: [],
        waiver_log: null
    };

    if (!religion) return constraints;

    const normalizedReligion = religion.toUpperCase().trim();
    const bmi = parseFloat(bmiValue) || 0;

    switch (normalizedReligion) {
        case 'ADVENTISTA':
            constraints.forbidden_ingredients = ['CERDO', 'MARISCO', 'CAFE', 'ALCOHOL'];
            constraints.clinical_alerts = ['CHECK_B12_LEVELS'];
            break;

        case 'MORMON':
        case 'MORMÓN':
        case 'SUD':
        case 'LDS':
            constraints.forbidden_ingredients = ['CAFE', 'TE', 'ALCOHOL', 'TABACO'];
            // Regla Condicional: Trampa del Almacenamiento
            if (bmi > 30) {
                constraints.forbidden_ingredients.push('HARINAS_REFINADAS');
            }
            break;

        case 'ISLAM':
        case 'HALAL':
        case 'MUSULMAN':
        case 'MUSULMÁN':
            constraints.forbidden_ingredients = ['CERDO', 'ALCOHOL', 'SANGRE'];
            constraints.clinical_alerts = ['RAMADAN_FASTING_CHECK'];
            break;

        case 'JUDIO':
        case 'JUDÍO':
        case 'KOSHER':
            constraints.forbidden_ingredients = ['CERDO', 'MARISCO', 'SANGRE'];
            constraints.mix_restrictions = ['NO_MEAT_AND_DAIRY'];
            break;

        case 'HINDUISMO':
        case 'HINDU':
        case 'HINDÚ':
            constraints.forbidden_ingredients = ['RES', 'VACA'];
            constraints.clinical_alerts = ['PROTEIN_DEFICIT_RISK'];
            break;

        default:
            // Si no hay match (católico, ateo, etc), se queda vacío
            break;
    }

    return constraints;
};

// Protocolo de cumplimiento (NOM-004 / Blindaje Legal)
export const logDietaryConflict = (requestedFood, forbiddenList) => {
    // Lógica de validación futura
    // Si requestedFood está en forbiddenList, disparar advertencia
    if (forbiddenList.includes(requestedFood.toUpperCase())) {
        console.warn(`CONFLICTO DETECTADO: ${requestedFood} prohibido por restricción religiosa.`);
        return `Paciente asume responsabilidad de dieta fuera de su ética declarada. Fecha: ${new Date().toISOString()}.`;
    }
    return null;
};

// --- EVALUACIÓN DE INCONGRUENCIA OBJETIVO VS BIOMETRÍA TRIANGULADA (FASE 16) ---
export const evaluateBiometricGoalConsistency = ({ objective, weight, height, waist, hip, gender, age }) => {
    // Exención pediátrica: Lactantes y niños (< 13 años) se evalúan con curvas OMS, no con reglas de adultos
    if (age !== undefined && age !== null && age < 13) {
        return { hasConflict: false, reason: 'PEDIATRIC_PATIENT' };
    }

    const w = parseFloat(weight);
    const hCm = parseFloat(height);
    if (!w || !hCm) return { hasConflict: false, reason: 'MISSING_DATA' };

    const hM = hCm < 3 ? hCm : hCm / 100;
    const bmi = parseFloat((w / (hM * hM)).toFixed(1));

    const objUpper = (objective || '').toUpperCase();
    const isWeightLossGoal = objUpper.includes('BAJAR') || 
                             objUpper.includes('PERDIDA') || 
                             objUpper.includes('PÉRDIDA') || 
                             objUpper.includes('SOBREPESO') || 
                             objUpper.includes('ADELGAZAR') ||
                             objUpper.includes('DISMINUIR PESO');

    if (!isWeightLossGoal) {
        return { hasConflict: false, bmi, isWeightLossGoal: false };
    }

    // 1. HARD STOP: Infrapeso / Bajo Peso (IMC < 18.5)
    if (bmi < 18.5) {
        return {
            hasConflict: true,
            status: 'HARD_STOP_UNDERWEIGHT',
            bmi,
            message: `⚠️ ALERTA CLÍNICA ABSOLUTA: Su IMC actual es de ${bmi} kg/m² (Infrapeso). Por normatividad de seguridad médica (COFEPRIS / NOM-004), no es clínicamente posible prescribir un plan de reducción de peso a un paciente en infrapeso.`,
            suggestedObjective: 'Recuperación Nutracéutica / Ganancia Magra'
        };
    }

    // 2. Normopeso (18.5 <= IMC < 25.0)
    if (bmi >= 18.5 && bmi < 25.0) {
        const waistVal = parseFloat(waist);
        const normGender = (gender || '').toUpperCase().startsWith('F') ? 'F' : 'M';
        const isVisceralRisk = (normGender === 'F' && waistVal >= 80) || (normGender === 'M' && waistVal >= 90);

        if (isVisceralRisk) {
            // Obesidad Sarcopénica / Adiposidad Visceral Validada -> NO hay conflicto
            return {
                hasConflict: false,
                status: 'VALID_SARCOPENIC_OBESITY',
                bmi,
                waist: waistVal,
                message: `IMC de ${bmi} kg/m² en rango normal, pero circunferencia de cintura (${waistVal} cm) refleja adipo-riesgo visceral. Objetivo de pérdida de grasa validado.`
            };
        } else {
            // Normopeso sin adiposidad visceral -> Incongruencia detectada, sugerir reorientación
            return {
                hasConflict: true,
                status: 'REORIENTATION_SUGGESTED',
                bmi,
                waist: waistVal || null,
                message: `⚠️ OBSERVACIÓN BIOMÉTRICA: Su IMC actual es de ${bmi} kg/m² (Normopeso) y sus medidas no indican adiposidad visceral severa. Reducir peso corporal adicional podría comprometer su masa magra y metabolismo.`,
                suggestedObjectives: [
                    { label: "🔄 Recomposición Corporal (Grasa a Músculo)", value: "Recomposición Corporal" },
                    { label: "⚖️ Mantenimiento y Salud Metabólica", value: "Mantenimiento Metabólico" },
                    { label: "⚠️ Mantener Pérdida de Peso (Requiere Justificación)", value: "Pérdida de Peso Justificada" }
                ]
            };
        }
    }

    return { hasConflict: false, bmi };
};

// --- EVALUACIÓN DE SEGURIDAD EN SIGNOS VITALES Y CRONOTROPÍA (FASE 17) ---
export const evaluateVitalSignsSafety = ({ heartRate, activityLevel, pharmacology = [] }) => {
    const hr = parseInt(heartRate, 10);
    if (!hr || isNaN(hr)) return { alerts: [], isCrisis: false };

    const alerts = [];
    const pharmacListStr = (Array.isArray(pharmacology) ? pharmacology.join(' ') : JSON.stringify(pharmacology || '')).toUpperCase();

    // Detección de fármacos con efecto cronotrópico negativo (Betabloqueadores / Antihipertensivos)
    const hasNegativeChronotrope = pharmacListStr.includes('METOPROLOL') ||
                                  pharmacListStr.includes('ATENOLOL') ||
                                  pharmacListStr.includes('BISOPROLOL') ||
                                  pharmacListStr.includes('PROPRANOLOL') ||
                                  pharmacListStr.includes('CARVEDILOL') ||
                                  pharmacListStr.includes('NEBIVOLOL') ||
                                  pharmacListStr.includes('VERAPAMILO') ||
                                  pharmacListStr.includes('DILTIAZEM') ||
                                  pharmacListStr.includes('ANTIHIPERTENSIVO') ||
                                  pharmacListStr.includes('BETABLOQUEADOR');

    const actUpper = (activityLevel || '').toUpperCase();
    const isAthlete = actUpper.includes('ATLETA') || actUpper.includes('ALTO RENDIMIENTO') || actUpper.includes('INTENSO') || actUpper.includes('VIGOROSO');

    if (hr < 50) {
        // Bradicardia Severa (< 50 LPM)
        if (hasNegativeChronotrope) {
            alerts.push({
                type: 'FARMACOLOGICA',
                flag: 'BRADICARDIA_SEVERA_FARMACOLOGICA',
                level: 'ORANGE',
                dashboardTitle: '🟠 BRADICARDIA SEVERA FARMACOLÓGICA (<50 LPM)',
                dashboardMessage: `Frecuencia de ${hr} LPM en paciente con fármaco de efecto cronotrópico negativo (Betabloqueador/Antihipertensivo). Monitorear presión y tolerancia.`
            });
        } else if (isAthlete) {
            alerts.push({
                type: 'FISIOLOGICA',
                flag: 'BRADICARDIA_ATLETA',
                level: 'GREEN',
                dashboardTitle: '🟢 BRADICARDIA FISIOLÓGICA DE ATLETA (<50 LPM)',
                dashboardMessage: `Frecuencia de ${hr} LPM consistente con acondicionamiento cardiovascular de alta intensidad.`
            });
        } else {
            alerts.push({
                type: 'PATOLOGICA',
                flag: 'BRADICARDIA_SEVERA_NO_ATLETA',
                level: 'RED',
                dashboardTitle: '🔴 ALERTA ROJA: BRADICARDIA SEVERA NO ATLETA (<50 LPM)',
                dashboardMessage: `Frecuencia de ${hr} LPM en reposo en paciente no atleta sin betabloqueadores. Requiere evaluación de nodo sinusal, perfil tiroideo o EKG.`
            });
        }
    } else if (hr >= 50 && hr <= 59) {
        // Bradicardia Leve (50-59 LPM)
        if (!isAthlete && !hasNegativeChronotrope) {
            alerts.push({
                type: 'SILENT_WARNING',
                flag: 'BRADICARDIA_LEVE_SILENCIOSA',
                level: 'YELLOW',
                dashboardTitle: '🟡 BRADICARDIA LEVE EN REPOSO (50-59 LPM)',
                dashboardMessage: `Frecuencia de ${hr} LPM registrada en reposo. Observación preventiva para dosificación energética.`
            });
        }
    } else if (hr > 100) {
        // Taquicardia en Reposo (> 100 LPM)
        alerts.push({
            type: 'TAQUICARDIA',
            flag: 'TAQUICARDIA_REPOSO',
            level: 'ORANGE',
            dashboardTitle: '🟠 TAQUICARDIA EN REPOSO (>100 LPM)',
            dashboardMessage: `Frecuencia de ${hr} LPM registrada en reposo. Confirmada tras protocolo de reposo de 3 minutos.`
        });
    }

    return {
        hr,
        hasNegativeChronotrope,
        isAthlete,
        alerts
    };
};

