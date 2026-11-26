const crypto = require('crypto');
const { db } = require('../db');
const cryptoVault = require('../utils/cryptoVault');
const { FORMULA_33PLUS, FORMULA_34PLUS, formatScaledActives } = require('../utils/pharmacopeiaCatalogSSoT');
const {
    ENGINE_VERSION_SSOT,
    sanitizeBioelectricScreeningLabel,
    sanitizeArt215NonTherapeuticLexicon,
    extractUnifiedAnamnesisSignals,
    buildSafeDietaryExamplesSSoT,
    calculateUniversalMetabolicAgeSSoT
} = require('../utils/metabolicAgeEngineSSoT');

function getCatalogActiveDynamic(formulaObj, nameRegex) {
    const list = Array.isArray(formulaObj?.heroActives) ? formulaObj.heroActives : [];
    return list.find((a) => nameRegex.test(String(a?.name || ''))) || null;
}

const SPANISH_LOWER_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
const COMMON_SPANISH_NAME_ACCENTS = {
    andres: 'Andrés',
    jesus: 'Jesús',
    jose: 'José',
    maria: 'María',
    angel: 'Ángel',
    oscar: 'Óscar',
    hector: 'Héctor',
    victor: 'Víctor',
    cesar: 'César',
    raul: 'Raúl',
    ruben: 'Rubén',
    ivan: 'Iván',
    adrian: 'Adrián',
    fabiola: 'Fabiola',
    monica: 'Mónica',
    veronica: 'Verónica',
    sofia: 'Sofía',
    lucia: 'Lucía',
    martinez: 'Martínez',
    gonzalez: 'González',
    rodriguez: 'Rodríguez',
    fernandez: 'Fernández',
    lopez: 'López',
    perez: 'Pérez',
    gomez: 'Gómez',
    sanchez: 'Sánchez',
    ramirez: 'Ramírez',
    hernandez: 'Hernández',
    jimenez: 'Jiménez',
    gutierrez: 'Gutiérrez',
    vazquez: 'Vázquez',
    garcia: 'García',
    diaz: 'Díaz'
};

function toSpanishTitleCaseFullName(rawStr) {
    const clean = String(rawStr || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean
        .split(' ')
        .map((word, idx) => {
            const lower = word.toLowerCase();
            if (idx > 0 && SPANISH_LOWER_PARTICLES.has(lower)) return lower;
            const plainAscii = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (COMMON_SPANISH_NAME_ACCENTS[plainAscii]) {
                return COMMON_SPANISH_NAME_ACCENTS[plainAscii];
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function composeDeduplicatedFullName(givenRaw, patRaw, matRaw) {
    const given = String(givenRaw || '').replace(/\s+/g, ' ').trim();
    const pat = String(patRaw || '').replace(/\s+/g, ' ').trim();
    const mat = String(matRaw || '').replace(/\s+/g, ' ').trim();
    const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const parts = [];
    if (given) parts.push(given);
    if (pat && !norm(parts.join(' ')).includes(norm(pat))) parts.push(pat);
    if (mat && !norm(parts.join(' ')).includes(norm(mat))) parts.push(mat);
    return parts.join(' ').trim();
}

function formatInstitutionalFullName(patientData) {
    if (!patientData || typeof patientData !== 'object') return 'Paciente';
    try {
        const composedIdent = composeDeduplicatedFullName(
            patientData.identificacion?.nombres || patientData.identificacion?.nombre_pila || patientData.identificacion?.nombre,
            patientData.identificacion?.apellidoPaterno,
            patientData.identificacion?.apellidoMaterno
        );

        const composedProfile = composeDeduplicatedFullName(
            patientData.profile?.first_name || patientData.profile?.firstName || patientData.profile?.nombre,
            patientData.profile?.last_name || patientData.profile?.lastName || patientData.profile?.apellidos,
            patientData.profile?.second_last_name
        );

        const validCandidates = [
            composedIdent,
            composedProfile,
            patientData.identificacion?.nombreCompleto,
            patientData.profile?.fullName,
            patientData.profile?.name,
            patientData.identificacion?.nombre,
            patientData.identityLock?.patientInfo?.full_name,
            patientData.identityLock?.patientInfo?.name,
            patientData.fullName,
            patientData.name
        ]
            .map((c) => String(c || '').replace(/\s+/g, ' ').trim())
            .filter((trimmed) => trimmed && !/^(paciente|usuario|invitado|su\s+beb[ée]|tu\s+beb[ée]|el\s+menor|la\s+menor|lactante|null|undefined|s\/n|---)$/i.test(trimmed));

        if (validCandidates.length > 0) {
            validCandidates.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);
            return toSpanishTitleCaseFullName(validCandidates[0]);
        }
    } catch (_) {
        // Fallback seguro
    }
    return 'Paciente';
}

const ASSIGNED_CITATION_USER_MAP = {
    '21161': '32071'
};

function normalizeControllerCitationId(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s || s === '0' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    return s;
}

function normalizeControllerUserId(raw, citationIdHint = null) {
    if (raw !== null && raw !== undefined) {
        const s = String(raw).trim();
        if (s && s !== '0' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') {
            return s;
        }
    }
    if (citationIdHint !== null && citationIdHint !== undefined) {
        const cKey = String(citationIdHint).trim();
        if (ASSIGNED_CITATION_USER_MAP[cKey]) {
            return ASSIGNED_CITATION_USER_MAP[cKey];
        }
    }
    return null;
}
const {
    sanitizeClinicalSpanish,
    normalizeMetricDecimals,
    joinSpanishList,
    isPhysiologicallyNormal,
    normalizeForMatch,
    sanitizeSnapshotStringsRecursively,
    enforcePatientGenderConcordance,
    filterOrphanTelemetryAnnexes
} = require('../utils/clinicalTextSanitizer');

function resolveBackendPatientIsFemale(patientData) {
    const raw =
        patientData?.identityLock?.patientInfo?.gender ??
        patientData?.identityLock?.patientInfo?.sex ??
        patientData?.identificacion?.sexo ??
        patientData?.identificacion?.genero ??
        patientData?.profile?.sex ??
        patientData?.profile?.gender ??
        patientData?.sex ??
        patientData?.genero ??
        '';
    const norm = String(raw ?? '').trim().toUpperCase();
    return norm === '2' || norm === 'F' || norm === 'FEMENINO' || norm === 'FEMALE' || norm === 'MUJER' || norm.startsWith('FEM');
}

// ============================================================================
// UTILITARIOS UNIVERSALES SSoTT (EGM-50 + EGM-51 v2 + EGM-56): CANDADO TEMPORAL 18-DIC-2026, FICHA NOM-004, R24H+FFQ, LOGÍSTICA, ALTITUD Y UNIDADES SI
// ============================================================================
const SINERGIX_PUBLIC_RELEASE_MS = new Date('2026-12-18T00:00:00-06:00').getTime();

function isPostSinergixEmbargoDate(referenceDate = new Date()) {
    try {
        const dt = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
        const ts = dt.getTime();
        if (!Number.isFinite(ts)) return false;
        return ts >= SINERGIX_PUBLIC_RELEASE_MS;
    } catch (_) {
        return false;
    }
}

function resolveBiometricMonitorLabel(referenceDate = new Date()) {
    return isPostSinergixEmbargoDate(referenceDate)
        ? 'EcoSinergix'
        : 'monitoreo biométrico de Ritmo Vital';
}

function formatBiometricMonitorPrepClause(referenceDate = new Date()) {
    return isPostSinergixEmbargoDate(referenceDate)
        ? 'con EcoSinergix'
        : 'mediante monitoreo biométrico de Ritmo Vital';
}

function enforceTemporalEmbargoOnText(rawText = '', referenceDate = new Date()) {
    const str = String(rawText || '');
    if (!str || isPostSinergixEmbargoDate(referenceDate)) return str;
    return str
        .replace(/monitoreo\s+(?:cronotr[óo]pico\s+|de\s+FC\s+)?con\s+EcoSinergix/giu, 'monitoreo biométrico de Ritmo Vital')
        .replace(/monitoread[oa]\s+con\s+EcoSinergix/giu, 'bajo monitoreo biométrico de Ritmo Vital')
        .replace(/\bcon\s+EcoSinergix\b/giu, 'mediante monitoreo biométrico de Ritmo Vital')
        .replace(/\bEcoSinergix\b/giu, 'monitoreo biométrico de Ritmo Vital');
}

function translateLogisticsProfile(patientData = {}) {
    try {
        const lp = patientData?.logistics_profile || patientData?.logistics || {};
        const savedSummary = patientData?.clinical_dossier?.logistics_summary || {};
        const anamnesis = extractUnifiedAnamnesisSignals(patientData);
        const rawVenue = String(
            lp?.environment?.venue ||
            savedSummary?.venueCode ||
            'HOME'
        ).trim().toUpperCase();
        const rawCook = String(
            lp?.cook_type ||
            savedSummary?.cookCode ||
            'SELF'
        ).trim().toUpperCase();

        const venueMap = {
            HOME: 'Casa',
            WORK: 'Oficina',
            STREET: 'Calle / Restaurante'
        };
        const cookMap = {
            STAFF: 'Personal de apoyo en casa',
            FAMILY: 'Familiar',
            SELF: 'Preparación propia',
            BUYING: 'Alimentos preparados externos'
        };

        const venueLabel = venueMap[rawVenue] || sanitizeClinicalSpanish(rawVenue || 'Casa');
        const cookLabel = cookMap[rawCook] || sanitizeClinicalSpanish(rawCook || 'Preparación propia');
        const cookingTimeMinutes = Number(lp?.cooking_time_minutes || savedSummary?.cookingTimeMinutes || 0) || null;
        const dinersCount = Number(lp?.sharing_diners_count || savedSummary?.dinersCount || 0) || null;
        const sharingDynamicsCode = String(lp?.sharing_dynamics || savedSummary?.sharingDynamicsCode || '').trim().toUpperCase();
        const sharingDemographicsCode = String(lp?.sharing_demographics || savedSummary?.sharingDemographicsCode || '').trim().toUpperCase();
        const noRefrigeration = Boolean(anamnesis.noRefrigeration || savedSummary?.noRefrigeration);
        const noReheating = Boolean(anamnesis.noReheating || savedSummary?.noReheating);
        const buyingTypeUpper = String(anamnesis.buyingTypeUpper || savedSummary?.buyingTypeCode || '');
        const isNightOrRotatingShift = Boolean(anamnesis.isNightOrRotatingShift || savedSummary?.isNightOrRotatingShift);

        const sharingDynamicsLabel = sharingDynamicsCode === 'SHARED_MENU'
            ? 'Menú familiar compartido'
            : sharingDynamicsCode === 'INDIVIDUAL'
                ? 'Menú individual'
                : '';

        let intergenerationalNote = '';
        if (/ELDERLY|ADULTO_MAYOR|SENIOR/.test(sharingDemographicsCode)) {
            intergenerationalNote = 'adaptación intergeneracional de textura suave y sazón cardioprotectora apta para adultos mayores en mesa';
        } else if (/CHILD|KIDS|PEDIATR|MINOR/.test(sharingDemographicsCode)) {
            intergenerationalNote = 'adaptación familiar apta para menores en casa';
        } else if (/FAMILY|MIXED|ALL/.test(sharingDemographicsCode)) {
            intergenerationalNote = 'adaptación intergeneracional para toda la familia';
        }

        const opSegments = [
            `Entorno: ${venueLabel}`,
            `Preparación: ${cookLabel}${cookingTimeMinutes ? ` (<= ${cookingTimeMinutes} min por tiempo)` : ''}`
        ];
        if (noRefrigeration || noReheating) {
            opSegments.push(
                noRefrigeration && noReheating
                    ? 'Lonchera térmica no perecedera a temperatura ambiente (sin refrigeración ni recalentamiento)'
                    : noRefrigeration
                        ? 'Conservación segura sin red de frío (bolsa térmica / insumos estables)'
                        : 'Platillos listos para consumo a temperatura ambiente (sin microondas/recalentamiento)'
            );
        }
        if (/FONDA|RESTAURANTE|COMEDOR|CALLE|DELIVERY/.test(buyingTypeUpper)) {
            opSegments.push('Selección inteligente en fonda/comedor (asados, a la plancha o al vapor, sin capeados ni frituras)');
        }
        if (isNightOrRotatingShift) {
            opSegments.push('Sincronización circadiana adaptada a turno nocturno / rotativo');
        }
        if (dinersCount && dinersCount > 1) {
            opSegments.push(
                `${sharingDynamicsLabel || 'Mesa compartida'}: ${dinersCount} comensales${intergenerationalNote ? ` (${intergenerationalNote})` : ''}`
            );
        } else if (intergenerationalNote) {
            opSegments.push(capitalizeLeadingSpanishLetter(intergenerationalNote));
        }

        return {
            venueCode: rawVenue,
            venueLabel,
            cookCode: rawCook,
            cookLabel,
            cookingTimeMinutes,
            dinersCount,
            sharingDynamicsCode,
            sharingDynamicsLabel,
            sharingDemographicsCode,
            intergenerationalNote,
            noRefrigeration,
            noReheating,
            buyingTypeCode: buyingTypeUpper,
            isNightOrRotatingShift,
            operationalSummary: opSegments.join(' | ')
        };
    } catch (_) {
        return {
            venueCode: 'HOME',
            venueLabel: 'Casa',
            cookCode: 'SELF',
            cookLabel: 'Preparación propia',
            cookingTimeMinutes: null,
            dinersCount: null,
            sharingDynamicsCode: '',
            sharingDynamicsLabel: '',
            sharingDemographicsCode: '',
            intergenerationalNote: '',
            noRefrigeration: false,
            noReheating: false,
            buyingTypeCode: '',
            isNightOrRotatingShift: false,
            operationalSummary: 'Entorno: Casa | Preparación: Preparación propia'
        };
    }
}

function resolveScheduledAppointmentSummary(patientData = {}, semaphoreOverride = null) {
    try {
        const raw = patientData?.scheduledAppointment || patientData?.clinical_dossier?.scheduled_appointment_summary || {};
        const semLevel = String(
            semaphoreOverride?.level ||
            patientData?.clinical_dossier?.biosecurity_semaphore?.level ||
            patientData?.clinical_dossier?.canonical_clinical_plan?.semaphoreLevel ||
            ''
        ).trim().toUpperCase();
        const isRedAlert = semLevel === 'ROJO';
        const earlyPriorityClause = 'Revisión médica prioritaria temprana en 72 horas a 7 días con estudios solicitados';

        const rawDate = sanitizeClinicalSpanish(String(raw?.chosenDate || raw?.dateLabel || '').trim());
        const rawTime = sanitizeClinicalSpanish(String(raw?.chosenTime || raw?.timeLabel || '').trim());
        const rawFolio = String(raw?.folio || '').replace(/^#/, '').trim();
        if (!rawDate) {
            return {
                hasScheduled: false,
                isPriorityEarlyFollowup: isRedAlert,
                recommendedWindowLabel: isRedAlert ? '72 horas a 7 días' : 'Día 28 (Ciclo 1)',
                dateLabel: null,
                timeLabel: null,
                folio: null,
                formattedLine: isRedAlert
                    ? `${earlyPriorityClause} (previo al corte comparativo del Día 28)`
                    : 'Revaloración clínica comparativa al cierre del Ciclo 1 (Día 28)'
            };
        }
        const normalizedDate = rawDate.replace(
            /^(Lunes|Martes|Mi[ée]rcoles|Jueves|Viernes|S[áa]bado|Domingo),?\s+/iu,
            (_, wd) => `${wd.toLowerCase()} `
        );
        const parts = [normalizedDate];
        if (rawTime) parts.push(rawTime);
        if (rawFolio) parts.push(`Folio #${rawFolio}`);
        const baseFormatted = parts.join(' • ');
        return {
            hasScheduled: true,
            isPriorityEarlyFollowup: isRedAlert,
            recommendedWindowLabel: isRedAlert ? '72 horas a 7 días' : 'Día 28 (Ciclo 1)',
            dateLabel: normalizedDate,
            rawDateLabel: rawDate,
            timeLabel: rawTime || null,
            folio: rawFolio || null,
            formattedLine: isRedAlert
                ? `${baseFormatted} • Nota clínica prioritaria: acreditar control médico temprano en 72 horas a 7 días`
                : baseFormatted
        };
    } catch (_) {
        return {
            hasScheduled: false,
            isPriorityEarlyFollowup: false,
            recommendedWindowLabel: 'Día 28 (Ciclo 1)',
            dateLabel: null,
            timeLabel: null,
            folio: null,
            formattedLine: 'Revaloración clínica comparativa al cierre del Ciclo 1 (Día 28)'
        };
    }
}

function extractNom004IdentificationSheet(patientData = {}, serum = null, bioenergetics = null) {
    try {
        const verifiedAge = resolveVerifiedPatientAge(patientData, 35);
        const isFemale = resolveBackendPatientIsFemale(patientData);
        const altitudeInfo = serum?.altitudeInfo || resolvePatientAltitudeMsnm(patientData);
        const curp = String(
            patientData?.profile?.curp ||
            patientData?.demographics?.curp ||
            patientData?.identificacion?.curp ||
            ''
        ).trim().toUpperCase();
        const birthDate = String(
            patientData?.profile?.birthdate ||
            patientData?.identificacion?.fechanac ||
            patientData?.demographics?.birthdate ||
            ''
        ).trim();

        const emg = patientData?.emergencia || patientData?.profile?.emergencyContact || {};
        const emgName = sanitizeClinicalSpanish(String(emg?.nombre || emg?.name || '').trim());
        const emgKin = sanitizeClinicalSpanish(String(emg?.parentesco || emg?.kin || '').trim());
        const emgPhone = String(emg?.telefono || emg?.phone || '').trim();
        const emergencyContactText = emgName
            ? `${emgName}${emgKin || emgPhone ? ` (${[emgKin, emgPhone ? `Tel. ${emgPhone}` : ''].filter(Boolean).join(' • ')})` : ''}`
            : 'No registrado';

        const primaryMotive = sanitizeClinicalSpanish(
            String(
                patientData?.clinical_context?.primary_motive ||
                patientData?.motivo_consulta ||
                patientData?.motivo ||
                patientData?.reason_for_consultation ||
                patientData?.clinical_context?.ai_analysis?.gem_reasoning ||
                'Evaluación nutricional preventiva integral'
            ).trim()
        );

        const rawFamily = Array.isArray(patientData?.history?.family_structured) && patientData.history.family_structured.length > 0
            ? patientData.history.family_structured
            : (Array.isArray(patientData?.familyTree?.antecedentes) ? patientData.familyTree.antecedentes : []);
        const ahfMap = new Map();
        rawFamily.forEach((it) => {
            const cond = sanitizeClinicalSpanish(String(it?.condition || it?.patologia || it?.disease || '').trim());
            const kin = sanitizeClinicalSpanish(String(it?.relative || it?.familiar || it?.relationship || '').trim());
            if (!cond || /^(ningun[oa]?|niega|negad[oa]s?|no|n\/a)$/i.test(cond)) return;
            const k = normalizeForMatch(cond);
            if (!ahfMap.has(k)) ahfMap.set(k, { cond, kins: new Set() });
            if (kin) ahfMap.get(k).kins.add(kin);
        });
        const ahfList = Array.from(ahfMap.values()).map((x) =>
            x.kins.size > 0 ? `${x.cond} (${Array.from(x.kins).join(', ')})` : x.cond
        );
        const ahfText = ahfList.length > 0 ? ahfList.join('; ') : 'Negados';

        const anamnesis = extractUnifiedAnamnesisSignals(patientData);
        const appItems = anamnesis.unifiedPathologies.map((s) => sanitizeClinicalSpanish(s)).filter(Boolean);
        const appText = appItems.length > 0 ? appItems.join(', ') : 'Niega patológicos crónicos';

        const surgItems = anamnesis.unifiedSurgical.map((s) => sanitizeClinicalSpanish(s)).filter(Boolean);
        const surgicalText = surgItems.length > 0 ? surgItems.join(', ') : 'Negados';

        const foodAllergies = (patientData?.history?.allergies?.food || [])
            .map((a) => sanitizeClinicalSpanish(String(typeof a === 'object' ? (a?.agent || a?.name || '') : a || '').trim()))
            .filter(Boolean);
        const drugAllergies = (patientData?.history?.allergies?.drug || [])
            .map((a) => sanitizeClinicalSpanish(String(typeof a === 'object' ? (a?.agent || a?.name || '') : a || '').trim()))
            .filter(Boolean);
        const hasClinicalAllergies = foodAllergies.length > 0 || drugAllergies.length > 0;
        const allergiesText = hasClinicalAllergies
            ? [
                foodAllergies.length > 0 ? `Alimentarias: ${foodAllergies.join(', ')}` : null,
                drugAllergies.length > 0 ? `Farmacológicas: ${drugAllergies.join(', ')}` : null
            ].filter(Boolean).join(' | ')
            : 'Negadas (0 alergias clínicas)';

        const rawMeds = Array.isArray(patientData?.history?.medications) ? patientData.history.medications : [];
        const medItems = rawMeds
            .map((m) => sanitizeClinicalSpanish(String(typeof m === 'object' ? (m?.name || m?.drug || '') : m || '').trim()))
            .filter((s) => s && !/^(ningun[oa]?|niega|no)$/i.test(s));
        const medicationsText = medItems.length > 0 ? medItems.join(', ') : 'Ninguno (0 fármacos activos)';

        const priorAdh = serum?.priorAdherence || detectPriorInstitutionalAdherence(patientData);
        const priorSupplementsText = priorAdh?.hasPriorAdherence
            ? `${priorAdh.publicSafeLabel || '33Plus® y 34Plus®'}${priorAdh.durationText ? ` (adherencia previa de ${priorAdh.durationText})` : ''}`
            : 'Ninguna declarada';

        const digProfile = patientData?.digestive_profile || {};
        const digSymptoms = [
            ...(Array.isArray(digProfile?.symptoms) ? digProfile.symptoms : []),
            ...(Array.isArray(patientData?.history?.digestive_symptoms) ? patientData.history.digestive_symptoms : [])
        ]
            .map((s) => sanitizeClinicalSpanish(String(s || '').trim()))
            .filter((s) => s && !/^(ningun[oa]?|niega|no)$/i.test(s));
        const isClinicalEubiosis = !digProfile?.has_issues && digSymptoms.length === 0;
        const digestivePhenotypeText = isClinicalEubiosis
            ? 'Eubiosis clínica (0 síntomas digestivos)'
            : `Sintomatología reportada: ${digSymptoms.join(', ') || sanitizeClinicalSpanish(digProfile?.phenotype || 'Sensibilidad digestiva')}`;

        const v = patientData?.vitals || {};
        const bp = v?.blood_pressure || v?.bloodPressure || {};
        const sysBp = Number(bp?.systolic || 0) || null;
        const diaBp = Number(bp?.diastolic || 0) || null;
        const fcVal = Number(v?.heart_rate ?? v?.hr ?? 0) || null;
        const frVal = Number(v?.respiratory_rate ?? v?.rr ?? 0) || null;
        const spo2Val = Number(v?.spo2 ?? 0) || null;
        const tempVal = Number(v?.temperature ?? 0) || null;
        const gluVal = Number(v?.glucose ?? serum?.labValues?.glucose ?? 0) || null;

        const vitalsParts = [
            sysBp && diaBp ? `PA ${sysBp}/${diaBp} mmHg` : null,
            fcVal ? `FC ${fcVal} lpm` : null,
            frVal ? `FR ${frVal} rpm` : null,
            spo2Val ? `SpO2 ${spo2Val} %${altitudeInfo?.msnm >= 1500 ? ` (${altitudeInfo.msnm} msnm)` : ''}` : null,
            tempVal ? `Temp ${tempVal} °C` : null,
            gluVal ? `Glucosa basal ${gluVal} mg/dL` : null
        ].filter(Boolean);

        const weightKg = Number(v?.weight || bioenergetics?.weightKg || patientData?.peso || 0) || null;
        const rawHeight = Number(v?.height || bioenergetics?.heightCm || patientData?.talla || 0) || null;
        const heightCm = rawHeight ? (rawHeight < 3 ? Number((rawHeight * 100).toFixed(1)) : rawHeight) : null;
        const bmi = (weightKg && heightCm)
            ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
            : (Number(v?.bmi || bioenergetics?.bmi || 0) || null);
        const bmiClass = sanitizeClinicalSpanish(String(v?.bmi_class || (bmi >= 30 ? 'Obesidad' : bmi >= 25 ? 'Sobrepeso' : bmi ? 'Normopeso' : '')).trim());
        const bodyFatPct = Number(v?.body_fat || bioenergetics?.bodyFatPct || 0) || null;
        const leanMassKg = (weightKg && bodyFatPct)
            ? Number((weightKg * (1 - bodyFatPct / 100)).toFixed(1))
            : (Number(bioenergetics?.leanBodyMassKg || 0) ? Number(Number(bioenergetics.leanBodyMassKg).toFixed(1)) : null);
        const waistCm = Number(v?.waist || patientData?.cintura || 0) || null;
        const hipCm = Number(v?.hip || patientData?.cadera || 0) || null;
        const icc = (waistCm && hipCm) ? Number((waistCm / hipCm).toFixed(2)) : (Number(v?.whr || patientData?.icc || 0) || null);
        const ica = (waistCm && heightCm) ? Number((waistCm / heightCm).toFixed(2)) : null;

        const somaParts = [
            weightKg ? `Peso ${weightKg} kg` : null,
            heightCm ? `Talla ${heightCm} cm` : null,
            bmi ? `IMC ${bmi} kg/m²${bmiClass ? ` (${bmiClass})` : ''}` : null,
            bodyFatPct ? `Grasa ${bodyFatPct} %` : null,
            leanMassKg ? `MLG ${leanMassKg} kg` : null,
            waistCm ? `Cintura ${waistCm} cm` : null,
            hipCm ? `Cadera ${hipCm} cm` : null,
            icc ? `ICC físico ${icc}` : null,
            ica ? `ICA ${ica}` : null
        ].filter(Boolean);

        const scheduledAppointment = resolveScheduledAppointmentSummary(patientData);

        return {
            ageYears: verifiedAge.ageYears,
            sexLabel: isFemale ? 'Femenino' : 'Masculino',
            birthDate: birthDate || null,
            curp: curp || null,
            altitudeMsnm: altitudeInfo?.msnm || 0,
            altitudeLabel: altitudeInfo?.label || 'Nivel basal',
            emergencyContactText,
            primaryMotive,
            ahfList,
            ahfText,
            appText,
            surgicalText,
            allergiesText,
            hasClinicalAllergies,
            medicationsText,
            priorSupplementsText,
            digestivePhenotypeText,
            isClinicalEubiosis,
            vitals: {
                pa: sysBp && diaBp ? `${sysBp}/${diaBp} mmHg` : null,
                fc: fcVal ? `${fcVal} lpm` : null,
                fr: frVal ? `${frVal} rpm` : null,
                spo2: spo2Val ? `${spo2Val} %` : null,
                temp: tempVal ? `${tempVal} °C` : null,
                glucose: gluVal ? `${gluVal} mg/dL` : null,
                summaryLine: vitalsParts.join(' | ') || 'En registro clínico'
            },
            somatometry: {
                weightKg,
                heightCm,
                bmi,
                bmiClass: bmiClass || null,
                bodyFatPct,
                leanMassKg,
                waistCm,
                hipCm,
                icc,
                ica,
                summaryLine: somaParts.join(' | ') || 'En registro antropométrico'
            },
            scheduledAppointment
        };
    } catch (_) {
        return null;
    }
}

function extractDietaryAndEpigeneticSynthesis(patientData = {}, serum = null, bioenergetics = null) {
    try {
        const evalDiet = patientData?.evaluacionDietetica || {};
        const r24hList = Array.isArray(evalDiet?.r24h)
            ? evalDiet.r24h
            : (Array.isArray(patientData?.r24h) ? patientData.r24h : []);
        const ffq = evalDiet?.ffq || patientData?.nutrition?.ffq || patientData?.frecuenciaConsumo || {};
        const labs = serum?.labValues || {};
        const subAxes = serum?.subAxisFlags || {};
        const vitalsSnap = serum?.vitalsSnapshot || {};
        const logistics = translateLogisticsProfile(patientData);

        const protectiveHabits = [];
        const vegDays = Number(ffq?.verduras ?? 0);
        const fruitDays = Number(ffq?.frutas ?? 0);
        const healthyFatsDays = Number(ffq?.grasas ?? 0);
        const leanMeatDays = Number(ffq?.carne_magra ?? 0);
        const poultryDays = Number(ffq?.pollo ?? 0);
        const legumeDays = Number(ffq?.leguminosas ?? 0);
        const dairyDays = Number(ffq?.leche ?? 0);
        const waterGlasses = Number(ffq?.agua ?? 0);
        const sugarsDays = Number(ffq?.azucares ?? -1);
        const junkDays = Number(ffq?.chatarra ?? -1);
        const procMeatDays = Number(ffq?.carne_procesada ?? -1);

        if (vegDays >= 5) protectiveHabits.push(`verduras (${vegDays}/7 días)`);
        if (fruitDays >= 5) protectiveHabits.push(`frutas naturales (${fruitDays}/7 días)`);
        if (healthyFatsDays >= 5) protectiveHabits.push(`grasas saludables (${healthyFatsDays}/7 días)`);
        if (waterGlasses >= 6) protectiveHabits.push(`hidratación base de ${waterGlasses} vasos/día de agua simple`);
        if (sugarsDays >= 0 && sugarsDays <= 1 && junkDays >= 0 && junkDays <= 1 && procMeatDays >= 0 && procMeatDays <= 1) {
            protectiveHabits.push('baja exposición a ultraprocesados, embutidos y azúcares simples (<= 1/7 días)');
        } else if (legumeDays >= 3 || leanMeatDays >= 3 || poultryDays >= 3) {
            protectiveHabits.push('aporte regular de proteínas magras y leguminosas');
        }

        const r24Text = r24hList.map((m) => String(m?.alimento || m?.descripcion || m?.meal || '')).join(' | ');
        const r24Hours = r24hList.map((m) => String(m?.hora || m?.time || '').trim()).filter(Boolean);
        const mealWindowText = r24Hours.length >= 2 ? `${r24Hours[0]} a ${r24Hours[r24Hours.length - 1]}` : '';
        const r24DishExemplars = r24hList
            .slice(0, 4)
            .map((m) => {
                const hr = String(m?.hora || m?.time || '').trim();
                const rawDish = sanitizeClinicalSpanish(String(m?.alimento || m?.descripcion || m?.meal || '').trim());
                if (!rawDish) return null;
                const words = rawDish.split(/\s+/);
                const conciseDish = words.length > 9 ? `${words.slice(0, 9).join(' ')}…` : rawDish;
                return hr ? `${hr}: ${conciseDish}` : conciseDish;
            })
            .filter(Boolean);
        const r24Highlights = [];
        if (/salm[óo]n|mojarra|pescado|at[úu]n|huachinango|trucha/i.test(r24Text)) r24Highlights.push('pescado rico en ácidos grasos cardioprotectores');
        if (/nopal|calabacit|espinaca|br[óo]coli|ensalada|verdura|pimiento/i.test(r24Text)) r24Highlights.push('fibra vegetal fresca (nopal/hortalizas)');
        if (/huevo/i.test(r24Text)) r24Highlights.push('proteína de alto valor biológico');
        const hasDairySatFatInDiet = dairyDays >= 5 || /queso\s+manchego|mantequilla|crema|gratinad|queso\s+maduro/i.test(r24Text);

        const hasAtheroLipids = Boolean(
            subAxes?.hasAtherogenicCholesterol ||
            Number(labs.ldl) >= 130 ||
            Number(labs.sdLdl) > 1.35 ||
            Number(labs.totalCholesterol) >= 200
        );

        const exclDietStr = (Array.isArray(serum?.combinedExclusions) ? serum.combinedExclusions : []).join(' ').toLowerCase();
        const seedsExcludedInBridge = /semilla|chia|ch[íi]a|ajonjol|linaza|disfagia|diverticulit/i.test(exclDietStr) || Boolean(serum?.anamnesisUnified?.hasDysphagia);
        const seedsPhrase = seedsExcludedInBridge ? '' : ', semillas';
        const solubleFiberPhrase = seedsExcludedInBridge ? '(nopal cocido suave, avena hidratada y leguminosas bien cocidas)' : '(nopal, avena, chía y leguminosas)';
        let lipidCulinaryBridge = '';
        if (hasAtheroLipids && hasDairySatFatInDiet) {
            lipidCulinaryBridge = `moderar grasas saturadas lácteas identificadas en su registro (${dairyDays >= 5 ? `lácteos ${dairyDays}/7 días` : 'lácteos frecuentes'}${/manchego|mantequilla/i.test(r24Text) ? ', queso manchego y mantequilla en cocción' : ''}), sustituyéndolas por aceite de oliva extra virgen en crudo, aguacate${seedsPhrase} y mayor fibra soluble ${solubleFiberPhrase} para favorecer el descenso de colesterol LDL y partículas sdLDL`;
        } else if (hasAtheroLipids) {
            lipidCulinaryBridge = 'priorizar grasas monoinsaturadas (aceite de oliva extra virgen, aguacate) y fibra soluble viscosa en cada comida principal para optimizar el transporte de colesterol LDL y sdLDL';
        }

        const ahfList = Array.isArray(serum?.anamnesis360Context?.epigeneticSurveillance)
            ? serum.anamnesis360Context.epigeneticSurveillance
            : [];
        const hasMetabolicAhf = ahfList.some((x) => /diabet|obesidad|sobrepeso|colesterol|cardio/i.test(String(x)));
        const effGlu = Number(labs.glucose || vitalsSnap?.glu || patientData?.vitals?.glucose || 0);
        const effTg = Number(labs.triglycerides || 0);
        const icaVal = vitalsSnap?.ica || (Number(patientData?.vitals?.waist) && Number(patientData?.vitals?.height) ? Number((Number(patientData.vitals.waist) / Number(patientData.vitals.height)).toFixed(2)) : null);
        const iccVal = vitalsSnap?.icc || Number(patientData?.vitals?.whr || 0) || null;

        let epigeneticClinicalNote = '';
        let epigeneticPatientNote = '';
        if (hasMetabolicAhf) {
            const ahfClean = ahfList.join('; ');
            if (effGlu > 0 && effGlu < 100 && (effTg === 0 || effTg < 150)) {
                epigeneticClinicalNote = `Contexto Epigenético AHF (${ahfClean}): Glucosa basal (${effGlu} mg/dL)${effTg > 0 ? ` y Triglicéridos (${effTg} mg/dL)` : ''} conservados en rango óptimo protector frente a carga heredofamiliar; se vincula el ajuste energético con la reducción preventiva de adiposidad central${icaVal ? ` (ICA ${icaVal}` : ''}${iccVal ? `${icaVal ? ' / ' : ' ('}ICC ${iccVal})` : (icaVal ? ')' : '')}.`;
                epigeneticPatientNote = `Frente a sus antecedentes familiares (${ahfClean}), hoy sus niveles de glucosa (${effGlu} mg/dL)${effTg > 0 ? ` y triglicéridos (${effTg} mg/dL)` : ''} se mantienen en rango óptimo saludable, protegiendo su metabolismo mientras reducimos gradualmente el perímetro abdominal${iccVal ? ` (ICC ${iccVal})` : ''}.`;
            } else {
                epigeneticClinicalNote = `Contexto Epigenético AHF (${ahfClean}): Vigilancia metabólica prioritaria integrada a la distribución macronutrimental y control de adiposidad central.`;
                epigeneticPatientNote = `Acompañamos de forma preventiva sus antecedentes familiares (${ahfClean}) cuidando la calidad de sus carbohidratos, grasas nobles y cintura abdominal.`;
            }
        }

        const r24SummaryClause = r24hList.length > 0
            ? `${r24hList.length} tiempos registrados${mealWindowText ? ` (ventana ${mealWindowText})` : ''}${r24DishExemplars.length > 0 ? ` [${r24DishExemplars.join(' | ')}]` : ''}${r24Highlights.length > 0 ? ` con presencia de ${joinSpanishList(r24Highlights)}` : ''}`
            : '';

        const clinicalParts = [];
        if (protectiveHabits.length > 0 || r24SummaryClause) {
            clinicalParts.push(
                `Evaluación Dietética Integrada (R24h + FFQ): Se reconocen hábitos protectores actuales (${[r24SummaryClause, ...protectiveHabits].filter(Boolean).join('; ')})`
            );
        }
        if (lipidCulinaryBridge) {
            clinicalParts.push(`Ajuste alimentario cardioprotector: ${lipidCulinaryBridge}`);
        }
        if (epigeneticClinicalNote) {
            clinicalParts.push(epigeneticClinicalNote);
        }

        const patientParts = [];
        if (protectiveHabits.length > 0 || r24Highlights.length > 0) {
            const strengths = [
                r24Highlights.length > 0 ? `preparaciones caseras con ${joinSpanishList(r24Highlights)}${mealWindowText ? ` en horarios ordenados (${mealWindowText})` : ''}` : null,
                protectiveHabits.length > 0 ? `consumo constante de ${joinSpanishList(protectiveHabits.slice(0, 3))}` : null
            ].filter(Boolean);
            if (strengths.length > 0) {
                patientParts.push(`Reconocemos sus fortalezas alimentarias actuales (${strengths.join(' y ')}).`);
            }
        }
        if (lipidCulinaryBridge) {
            patientParts.push(`Como ajuste clave de precisión: vamos a ${lipidCulinaryBridge}.`);
        }
        if (epigeneticPatientNote) {
            patientParts.push(epigeneticPatientNote);
        }

        const normalizedClinicalParts = clinicalParts.map((p) => String(p || '').trim().replace(/\.+$/g, '')).filter(Boolean);

        return {
            hasDietaryData: Boolean(r24hList.length > 0 || Object.keys(ffq).length > 0),
            r24MealsCount: r24hList.length,
            mealWindowText,
            r24DishExemplars,
            protectiveHabits,
            r24Highlights,
            hasDairySatFatInDiet,
            lipidCulinaryBridge,
            epigeneticClinicalNote,
            epigeneticPatientNote,
            logistics,
            clinicalSummaryText: normalizedClinicalParts.length > 0 ? `${normalizedClinicalParts.join('. ')}.` : '',
            patientSummaryText: patientParts.join(' ')
        };
    } catch (_) {
        return {
            hasDietaryData: false,
            r24MealsCount: 0,
            mealWindowText: '',
            protectiveHabits: [],
            r24Highlights: [],
            hasDairySatFatInDiet: false,
            lipidCulinaryBridge: '',
            epigeneticClinicalNote: '',
            epigeneticPatientNote: '',
            logistics: translateLogisticsProfile(patientData),
            clinicalSummaryText: '',
            patientSummaryText: ''
        };
    }
}

function parseAdherenceDurationMonths(rawDuration = '') {
    const s = String(rawDuration || '').trim().toLowerCase();
    if (!s) return 0;
    const yrMatch = s.match(/(\d+(?:[.,]\d+)?)\s*a[ñn]os?/i);
    if (yrMatch) return Math.round(parseFloat(yrMatch[1].replace(',', '.')) * 12);
    const moMatch = s.match(/(\d+(?:[.,]\d+)?)\s*mes(?:es)?/i);
    if (moMatch) return Math.round(parseFloat(moMatch[1].replace(',', '.')));
    const wkMatch = s.match(/(\d+(?:[.,]\d+)?)\s*semanas?/i);
    if (wkMatch) return Number((parseFloat(wkMatch[1].replace(',', '.')) / 4.33).toFixed(1));
    const dayMatch = s.match(/(\d+)\s*d[íi]as?/i);
    if (dayMatch) return Number((parseInt(dayMatch[1], 10) / 30).toFixed(1));
    if (/cr[óo]nic|habitual|constante|siempre|hace\s+tiempo|varios\s+a[ñn]os|largo\s+plazo/i.test(s)) return 6;
    return 0;
}

function detectPriorInstitutionalAdherence(patientData = {}) {
    try {
        if (patientData?.history?.supplements_negated === true && !Array.isArray(patientData?.history?.supplements)) {
            return { hasPriorAdherence: false, hasEstablishedAdherence3mPlus: false, estimatedMonths: 0, matchedFormulas: [], publicSafeLabel: '', durationText: '' };
        }
        const rawList = [
            ...(Array.isArray(patientData?.history?.supplements) ? patientData.history.supplements : []),
            ...(Array.isArray(patientData?.advanced_supplementation) ? patientData.advanced_supplementation : [])
        ];
        if (rawList.length === 0) {
            return { hasPriorAdherence: false, hasEstablishedAdherence3mPlus: false, estimatedMonths: 0, matchedFormulas: [], publicSafeLabel: '', durationText: '' };
        }

        const matchedCodes = new Set();
        const safePublicBrands = new Set();
        let bestDuration = '';
        let maxEstimatedMonths = 0;
        const priorPosologyNotes = [];

        rawList.forEach((entry) => {
            const rawName = typeof entry === 'object' ? (entry?.name || entry?.supplement || entry?.title || '') : String(entry || '');
            const normName = String(rawName).toUpperCase();
            if (!normName || /^(NINGUN[OA]?|NIEGA|NO|N\/A|NULL|UNDEFINED)$/i.test(normName.trim())) return;

            let isInstitutional = false;
            if (/33\s*PLUS/i.test(normName)) {
                matchedCodes.add('33PLUS');
                safePublicBrands.add('33Plus®');
                isInstitutional = true;
            }
            if (/34\s*PLUS/i.test(normName)) {
                matchedCodes.add('34PLUS');
                safePublicBrands.add('34Plus®');
                isInstitutional = true;
            }
            if (/MULTISINERGIX/i.test(normName)) {
                matchedCodes.add('MULTISINERGIX');
                isInstitutional = true;
            }
            if (/AMINOSINERGIX/i.test(normName)) {
                matchedCodes.add('AMINOSINERGIX');
                isInstitutional = true;
            }

            if (isInstitutional && typeof entry === 'object') {
                const dur = sanitizeClinicalSpanish(String(entry.duration || entry.tiempo || '').trim());
                const parsedMo = parseAdherenceDurationMonths(dur);
                if (parsedMo > maxEstimatedMonths) {
                    maxEstimatedMonths = parsedMo;
                    bestDuration = dur;
                } else if (dur && !bestDuration) {
                    bestDuration = dur;
                }
                const freq = sanitizeClinicalSpanish(String(entry.frequency || entry.dosis || '').trim());
                if (freq) priorPosologyNotes.push(`${ /33/i.test(normName) ? '33Plus®' : /34/i.test(normName) ? '34Plus®' : 'fórmula institucional' }: ${freq}`);
            }
        });

        if (matchedCodes.size === 0) {
            return { hasPriorAdherence: false, hasEstablishedAdherence3mPlus: false, estimatedMonths: 0, matchedFormulas: [], publicSafeLabel: '', durationText: '' };
        }

        const estimatedMonths = maxEstimatedMonths || parseAdherenceDurationMonths(bestDuration);
        const hasEstablishedAdherence3mPlus = estimatedMonths >= 3;

        // Candado Temporal 18-dic-2026: Jamás exponer marcas embargadas en copy visible/exportable
        const safeBrandsArr = Array.from(safePublicBrands);
        const publicSafeLabel = safeBrandsArr.length > 0
            ? joinSpanishList(safeBrandsArr)
            : 'sus fórmulas nutricionales institucionales';

        return {
            hasPriorAdherence: true,
            hasPriorInstitutionalSupplements: true,
            hasEstablishedAdherence3mPlus,
            estimatedMonths,
            matchedFormulas: Array.from(matchedCodes),
            publicSafeLabel,
            durationText: bestDuration,
            priorPosologyNotes
        };
    } catch (_) {
        return { hasPriorAdherence: false, hasPriorInstitutionalSupplements: false, hasEstablishedAdherence3mPlus: false, estimatedMonths: 0, matchedFormulas: [], publicSafeLabel: '', durationText: '' };
    }
}

function resolvePatientAltitudeMsnm(patientData = {}) {
    try {
        const dom = patientData?.domicilio || patientData?.address || {};
        const ident = patientData?.identificacion || patientData?.profile || {};
        const explicitCandidates = [
            dom.altitud_msnm,
            dom.altitude_msnm,
            dom.altitud,
            dom.altitude,
            dom.elevation_m,
            dom.msnm,
            ident.altitud_msnm,
            ident.altitude_msnm,
            patientData?.vitals?.altitude_msnm,
            patientData?.vitals?.altitud_msnm,
            patientData?.profile?.altitude_msnm,
            patientData?.profile?.altitud_msnm,
            patientData?.altitude_msnm,
            patientData?.msnm
        ];
        for (const cand of explicitCandidates) {
            if (cand !== null && cand !== undefined && String(cand).trim() !== '') {
                const n = parseFloat(String(cand).replace(/[^0-9.-]/g, ''));
                if (Number.isFinite(n) && n >= -100 && n <= 5500) {
                    const msnm = Math.round(n);
                    return buildAltitudeDescriptor(msnm, dom.municipio || dom.ciudad || ident.municipio || 'Altitud declarada');
                }
            }
        }

        const lat = parseFloat(dom?.coordinates?.lat ?? dom?.lat ?? ident?.lat ?? NaN);
        const lng = parseFloat(dom?.coordinates?.lng ?? dom?.lng ?? ident?.lng ?? NaN);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            if (lat >= 19.12 && lat <= 19.46 && lng >= -99.85 && lng <= -99.42) {
                return buildAltitudeDescriptor(2660, 'Valle de Toluca');
            }
            if (lat >= 19.20 && lat <= 19.65 && lng >= -99.36 && lng <= -98.88) {
                return buildAltitudeDescriptor(2240, 'Valle de México');
            }
            if (lat >= 20.02 && lat <= 20.22 && lng >= -98.85 && lng <= -98.60) {
                return buildAltitudeDescriptor(2420, 'Pachuca / Comarca Minera');
            }
            if (lat >= 18.95 && lat <= 19.15 && lng >= -98.35 && lng <= -98.10) {
                return buildAltitudeDescriptor(2135, 'Valle de Puebla');
            }
            if (lat >= 20.50 && lat <= 20.70 && lng >= -100.52 && lng <= -100.28) {
                return buildAltitudeDescriptor(1820, 'Querétaro');
            }
            if (lat >= 20.55 && lat <= 20.80 && lng >= -103.50 && lng <= -103.20) {
                return buildAltitudeDescriptor(1566, 'Guadalajara');
            }
        }

        const cp = String(dom.cp || dom.codigoPostal || dom.postal_code || ident.cp || ident.codigoPostal || ident.postal_code || '').trim();
        if (/^(50\d{3}|520\d{2}|521\d{2})$/.test(cp)) return buildAltitudeDescriptor(2660, 'Valle de Toluca');
        if (/^(0[1-9]\d{3}|1[0-6]\d{3})$/.test(cp)) return buildAltitudeDescriptor(2240, 'Ciudad de México');
        if (/^42[01]\d{2}$/.test(cp)) return buildAltitudeDescriptor(2420, 'Pachuca');
        if (/^423\d{2}$/.test(cp)) return buildAltitudeDescriptor(1640, 'Tasquillo, Hidalgo');
        if (/^980\d{2}$/.test(cp)) return buildAltitudeDescriptor(2490, 'Zacatecas');
        if (/^72\d{3}$/.test(cp)) return buildAltitudeDescriptor(2135, 'Puebla');
        if (/^76[0-2]\d{2}$/.test(cp)) return buildAltitudeDescriptor(1820, 'Querétaro');

        const geoText = normalizeForMatch(
            `${dom.municipio || ''} ${dom.ciudad || ''} ${dom.estado || ''} ${dom.direccion_capturada_usuario || ''} ${dom.direccion_googlemaps || ''} ${ident.municipio || ''} ${ident.ciudad || ''} ${ident.estado || ''}`
        );
        if (/\b(?:toluca|metepec|zinacantepec|lerma|calimaya|almoloya)\b/.test(geoText)) return buildAltitudeDescriptor(2660, 'Valle de Toluca');
        if (/\b(?:el_alto|la_paz_bolivia)\b/.test(geoText)) return buildAltitudeDescriptor(3640, 'Altiplano Andino');
        if (/\b(?:cusco|cuzco)\b/.test(geoText)) return buildAltitudeDescriptor(3399, 'Cusco');
        if (/\b(?:quito)\b/.test(geoText)) return buildAltitudeDescriptor(2850, 'Quito');
        if (/\b(?:bogota)\b/.test(geoText)) return buildAltitudeDescriptor(2640, 'Sabana de Bogotá');
        if (/\b(?:zacatecas)\b/.test(geoText)) return buildAltitudeDescriptor(2490, 'Zacatecas');
        if (/\b(?:pachuca|mineral_de_la_reforma|real_del_monte|tlaxcala|apizaco)\b/.test(geoText)) return buildAltitudeDescriptor(2420, 'Altiplano Central');
        if (/\b(?:ciudad_de_mexico|cdmx|naucalpan|tlalnepantla|huixquilucan|ecatepec|nezahualcoyotl|texcoco)\b/.test(geoText)) return buildAltitudeDescriptor(2240, 'Valle de México');
        if (/\b(?:puebla|cholula|atlixco)\b/.test(geoText)) return buildAltitudeDescriptor(2135, 'Valle de Puebla');
        if (/\b(?:morelia|patzcuaro|aguascalientes|san_luis_potosi|durango|leon|guanajuato|queretaro|tasquillo|ixmiquilpan|saltillo|guadalajara|zapopan|oaxaca)\b/.test(geoText)) {
            return buildAltitudeDescriptor(1820, 'Altiplano Medio');
        }
    } catch (_) {
        // Fallback seguro a nivel bajo
    }
    return buildAltitudeDescriptor(0, 'Nivel basal (< 1,500 msnm)');
}

function buildAltitudeDescriptor(msnm, regionHint = '') {
    const safeMsnm = Number.isFinite(msnm) ? Math.max(0, Math.round(msnm)) : 0;
    if (safeMsnm >= 2400) {
        return {
            msnm: safeMsnm,
            tier: 'ALTA_MONTANA_2400',
            spo2NormalFloor: 92,
            hbAltitudeOffset: 1.3,
            label: `${regionHint ? `${regionHint} • ` : ''}${safeMsnm} msnm (ajuste de altitud >= 2,400 msnm)`
        };
    }
    if (safeMsnm >= 1500) {
        return {
            msnm: safeMsnm,
            tier: 'ALTITUD_MEDIA_1500',
            spo2NormalFloor: 94,
            hbAltitudeOffset: 0.5,
            label: `${regionHint ? `${regionHint} • ` : ''}${safeMsnm} msnm (ajuste de altitud >= 1,500 msnm)`
        };
    }
    return {
        msnm: safeMsnm,
        tier: 'NIVEL_MAR_BAJO',
        spo2NormalFloor: 95,
        hbAltitudeOffset: 0.0,
        label: safeMsnm > 0 ? `${regionHint ? `${regionHint} • ` : ''}${safeMsnm} msnm` : 'Nivel basal (< 1,500 msnm)'
    };
}

function calculateCkdEpi2021Egfr(creatinineMgDl, ageYears, isFemale) {
    const scr = Number(creatinineMgDl);
    const age = Number(ageYears);
    if (!Number.isFinite(scr) || scr <= 0 || !Number.isFinite(age) || age < 18) return null;
    const kappa = isFemale ? 0.7 : 0.9;
    const alpha = isFemale ? -0.241 : -0.302;
    const sexFactor = isFemale ? 1.012 : 1.0;
    const minRatio = Math.min(scr / kappa, 1);
    const maxRatio = Math.max(scr / kappa, 1);
    const egfr = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.200) * Math.pow(0.9938, age) * sexFactor;
    return Number(egfr.toFixed(1));
}

function normalizeInternationalLabUnit(rawNormKey, rawNum, rawUnit = '', itemObj = null) {
    if (!Number.isFinite(rawNum)) return { value: rawNum, canonicalUnit: rawUnit, converted: false, conversionNote: null };
    const normKey = normalizeForMatch(rawNormKey || '');
    const u = String(rawUnit || itemObj?.unit || '')
        .trim()
        .toLowerCase()
        .replace(/μ/g, 'µ')
        .replace(/\s+/g, '');

    // 1. Glucosa: mmol/L -> mg/dL (* 18.0156), g/L -> mg/dL (* 100)
    if ((normKey.includes('glucosa') || normKey.includes('glucose')) && !normKey.includes('orina') && !normKey.includes('urine')) {
        if (u.includes('mmol/l') || u === 'mmol') {
            const conv = Number((rawNum * 18.0156).toFixed(1));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Glucosa ${rawNum} mmol/L -> ${conv} mg/dL` };
        }
        if (u === 'g/l') {
            const conv = Number((rawNum * 100).toFixed(1));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Glucosa ${rawNum} g/L -> ${conv} mg/dL` };
        }
    }

    // 2. Triglicéridos: mmol/L -> mg/dL (* 88.57)
    if (normKey.includes('triglic') || normKey.includes('triglycer')) {
        if (u.includes('mmol/l') || u === 'mmol') {
            const conv = Number((rawNum * 88.57).toFixed(1));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Triglicéridos ${rawNum} mmol/L -> ${conv} mg/dL` };
        }
        if (u === 'g/l') {
            const conv = Number((rawNum * 100).toFixed(1));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Triglicéridos ${rawNum} g/L -> ${conv} mg/dL` };
        }
    }

    // 3. Colesterol Total / LDL / HDL / no-HDL: mmol/L -> mg/dL (* 38.67)
    if (
        !normKey.includes('relacion') &&
        !normKey.includes('indice') &&
        !normKey.includes('ratio') &&
        (normKey.includes('colesterol') || normKey.includes('cholesterol') || normKey.includes('ldl') || normKey.includes('hdl'))
    ) {
        if (u.includes('mmol/l') || u === 'mmol') {
            const conv = Number((rawNum * 38.67).toFixed(1));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Lípido (${normKey}) ${rawNum} mmol/L -> ${conv} mg/dL` };
        }
        if (u === 'g/l') {
            const conv = Number((rawNum * 100).toFixed(1));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Lípido (${normKey}) ${rawNum} g/L -> ${conv} mg/dL` };
        }
    }

    // 4. Creatinina: µmol/L -> mg/dL (/ 88.42)
    if ((normKey.includes('creatinina') || normKey.includes('creatinine')) && !normKey.includes('relacion') && !normKey.includes('depuracion') && !normKey.includes('clearance')) {
        if (u.includes('µmol/l') || u.includes('umol/l') || u.includes('mcmol/l') || u === 'µmol' || u === 'umol') {
            const conv = Number((rawNum / 88.42).toFixed(2));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Creatinina ${rawNum} µmol/L -> ${conv} mg/dL` };
        }
        if (u.includes('mmol/l')) {
            const conv = Number(((rawNum * 1000) / 88.42).toFixed(2));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Creatinina ${rawNum} mmol/L -> ${conv} mg/dL` };
        }
    }

    // 5. Ácido úrico: µmol/L -> mg/dL (/ 59.48)
    if (normKey.includes('urico') || normKey.includes('uric')) {
        if (u.includes('µmol/l') || u.includes('umol/l') || u.includes('mcmol/l') || u === 'µmol' || u === 'umol') {
            const conv = Number((rawNum / 59.48).toFixed(2));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Ácido úrico ${rawNum} µmol/L -> ${conv} mg/dL` };
        }
        if (u.includes('mmol/l')) {
            const conv = Number(((rawNum * 1000) / 59.48).toFixed(2));
            return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Ácido úrico ${rawNum} mmol/L -> ${conv} mg/dL` };
        }
    }

    // 6. Urea / BUN: mmol/L -> mg/dL
    if (normKey === 'urea' && (u.includes('mmol/l') || u === 'mmol')) {
        const conv = Number((rawNum * 6.006).toFixed(1));
        return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Urea ${rawNum} mmol/L -> ${conv} mg/dL` };
    }
    if (normKey.includes('bun') && !normKey.includes('relacion') && (u.includes('mmol/l') || u === 'mmol')) {
        const conv = Number((rawNum * 2.801).toFixed(1));
        return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `BUN ${rawNum} mmol/L -> ${conv} mg/dL` };
    }

    // 7. Bilirrubina: µmol/L -> mg/dL (/ 17.104)
    if ((normKey.includes('bilirrubina') || normKey.includes('bilirubin')) && (u.includes('µmol/l') || u.includes('umol/l') || u === 'µmol' || u === 'umol')) {
        const conv = Number((rawNum / 17.104).toFixed(2));
        return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Bilirrubina ${rawNum} µmol/L -> ${conv} mg/dL` };
    }

    // 8. Calcio y Magnesio: mmol/L -> mg/dL
    if ((normKey.includes('calcio') || normKey.includes('calcium')) && (u.includes('mmol/l') || u === 'mmol')) {
        const conv = Number((rawNum * 4.008).toFixed(2));
        return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Calcio ${rawNum} mmol/L -> ${conv} mg/dL` };
    }
    if ((normKey.includes('magnesio') || normKey.includes('magnesium')) && (u.includes('mmol/l') || u === 'mmol')) {
        const conv = Number((rawNum * 2.431).toFixed(2));
        return { value: conv, canonicalUnit: 'mg/dL', converted: true, conversionNote: `Magnesio ${rawNum} mmol/L -> ${conv} mg/dL` };
    }

    // 9. Hemoglobina: g/L -> g/dL (/ 10), mmol/L -> g/dL (* 1.611)
    if ((normKey.includes('hemoglobina') || normKey.includes('hemoglobin')) && !normKey.includes('corp') && !normKey.includes('a1c')) {
        if (u === 'g/l') {
            const conv = Number((rawNum / 10).toFixed(2));
            return { value: conv, canonicalUnit: 'g/dL', converted: true, conversionNote: `Hemoglobina ${rawNum} g/L -> ${conv} g/dL` };
        }
        if (u.includes('mmol/l')) {
            const conv = Number((rawNum * 1.611).toFixed(2));
            return { value: conv, canonicalUnit: 'g/dL', converted: true, conversionNote: `Hemoglobina ${rawNum} mmol/L -> ${conv} g/dL` };
        }
    }

    // 10. Vitamina D (25-OH): nmol/L -> ng/mL (/ 2.496)
    if ((normKey.includes('vitamina_d') || normKey.includes('vitamin_d') || normKey.includes('25_oh') || normKey.includes('calcidiol')) && u.includes('nmol/l')) {
        const conv = Number((rawNum / 2.496).toFixed(1));
        return { value: conv, canonicalUnit: 'ng/mL', converted: true, conversionNote: `Vitamina D ${rawNum} nmol/L -> ${conv} ng/mL` };
    }

    // 11. PCR-us: mg/dL -> mg/L (* 10)
    if (normKey.includes('pcr') || normKey.includes('proteina_c_reactiva') || normKey.includes('crp')) {
        if (u === 'mg/dl') {
            const conv = Number((rawNum * 10).toFixed(2));
            return { value: conv, canonicalUnit: 'mg/L', converted: true, conversionNote: `PCR ${rawNum} mg/dL -> ${conv} mg/L` };
        }
        return { value: rawNum, canonicalUnit: 'mg/L', converted: false, conversionNote: null };
    }

    return { value: rawNum, canonicalUnit: rawUnit, converted: false, conversionNote: null };
}

function resolveActiveClinicalRoutes(patientData = {}, ageYears = 35, isLactanteExplicit = false, isPediatricExplicit = false) {
    const anamnesisRoutes = extractUnifiedAnamnesisSignals(patientData);
    const rawTokens = [
        patientData?.clinical_context?.primary_route,
        patientData?.clinical_context?.goal,
        ...(Array.isArray(patientData?.clinical_context?.routes) ? patientData.clinical_context.routes : []),
        ...(Array.isArray(patientData?.activeRoutes) ? patientData.activeRoutes : [patientData?.activeRoutes]),
        ...(Array.isArray(patientData?.clinical_routes) ? patientData.clinical_routes : [patientData?.clinical_routes]),
        patientData?.history?.primaryRoute,
        patientData?.route,
        patientData?.profile?.goal,
        patientData?.motivo_consulta,
        patientData?.motivo,
        patientData?.reason_for_consultation,
        patientData?.clinical_context?.patient_quote,
        patientData?.clinical_context?.specific_ailment,
        anamnesisRoutes.pathUpper,
        JSON.stringify(patientData?.history?.special_context || '')
    ]
        .filter(Boolean)
        .map((x) => String(x).toUpperCase())
        .join(' | ');

    const routes = new Set();
    if (ageYears < 18 || isLactanteExplicit || isPediatricExplicit || /GOAL_PEDIATRICS|PEDIATR|CRECIMIENTO\s+Y\s+DESARROLLO/.test(rawTokens)) {
        routes.add('GOAL_PEDIATRICS'); // Ruta 5
    }
    if (
        Boolean(anamnesisRoutes.isPregnant || anamnesisRoutes.isLactating || patientData?.physio?.is_pregnant || patientData?.physio?.is_lactating || patientData?.clinical_context?.isPregnant) ||
        /GOAL_PREGNANCY|EMBARAZ|GESTACI[ÓO]N|LACTANCIA\s+MATERNA|PUERPERIO/.test(rawTokens)
    ) {
        routes.add('GOAL_PREGNANCY'); // Ruta 6
    }
    if (/GOAL_MENTAL_HEALTH|\bTCA\b|ANOREXIA|BULIMIA|ATRAC[ÓO]N|ORTOREXIA|VIGOREXIA|DISMORFIA|TRASTORNO\s+(?:DE\s+LA\s+)?CONDUCTA\s+ALIMENTARIA|SEGURIDAD\s+CONDUCTUAL/.test(rawTokens)) {
        routes.add('GOAL_MENTAL_HEALTH'); // Ruta 9
    }
    if (/GOAL_PALLIATIVE|CUIDADOS?\s+PALIATIV|SOPORTE\s+PALIATIV|TERMINAL/.test(rawTokens)) {
        routes.add('GOAL_PALLIATIVE'); // Ruta 14
    }
    if (/GOAL_MUSCLE|GANAR\s+M[ÚU]SCULO|HIPERTROFIA|ATLETA|ALTO\s+RENDIMIENTO|DEPORTE\s+DE\s+FUERZA|FISICOCULTUR|HALTEROFILIA|CROSSFIT/.test(rawTokens)) {
        routes.add('GOAL_MUSCLE'); // Ruta 3
    }
    if (ageYears >= 65 || /GOAL_GERIATRICS|GERIATR/.test(rawTokens)) routes.add('GOAL_GERIATRICS');
    if (/GOAL_WEIGHT_LOSS|BAJAR\s+DE\s+PESO|SOBREPESO/.test(rawTokens)) routes.add('GOAL_WEIGHT_LOSS');
    if (/GOAL_LONGEVITY|LONGEVIDAD|BIOHACKING/.test(rawTokens)) routes.add('GOAL_LONGEVITY');
    if (anamnesisRoutes.hasMenopause || /GOAL_MENOPAUSE|CLIMATERIO|MENOPAUSIA/.test(rawTokens)) routes.add('GOAL_MENOPAUSE');
    if (anamnesisRoutes.hasBariatricSurgery || /GOAL_BARIATRIC|BARI[ÁA]TRIC/.test(rawTokens)) routes.add('GOAL_BARIATRIC');
    if (anamnesisRoutes.hasSevereRenalHistory || /GOAL_RENAL|NEFROPAT|SALUD\s+RENAL/.test(rawTokens)) routes.add('GOAL_RENAL');
    if (/GOAL_ONCOLOGY|ONCOLOG/.test(rawTokens)) routes.add('GOAL_ONCOLOGY');
    if (/GOAL_IMMUNE|INMUNODEFICIENCIA|\bVIH\b/.test(rawTokens)) routes.add('GOAL_IMMUNE');
    if (/GOAL_ALLERGIES|ANAFILAXIA|ALERGIAS\s+GRAVES/.test(rawTokens)) routes.add('GOAL_ALLERGIES');
    if (/GOAL_ADDICTIONS|ADICCIONES/.test(rawTokens)) routes.add('GOAL_ADDICTIONS');
    if (/GOAL_DISABILITY|DISCAPACIDAD|REHABILITACI[ÓO]N/.test(rawTokens)) routes.add('GOAL_DISABILITY');
    if (routes.size === 0) routes.add('GOAL_CLINICAL');

    let safetyGateReasonCode = null;
    if (routes.has('GOAL_MENTAL_HEALTH') && !isLactanteExplicit) safetyGateReasonCode = 'TCA_BEHAVIORAL_SAFETY';
    else if (routes.has('GOAL_PREGNANCY')) safetyGateReasonCode = 'PREGNANCY_LACTATION_PROTECTION';
    else if (routes.has('GOAL_PALLIATIVE')) safetyGateReasonCode = 'PALLIATIVE_COMFORT_CARE';
    else if (routes.has('GOAL_PEDIATRICS')) safetyGateReasonCode = 'PEDIATRICS_GROWTH_PERCENTILES';

    return {
        activeRoutes: Array.from(routes),
        isSensitiveSafetyRoute: Boolean(safetyGateReasonCode),
        safetyGateReasonCode,
        isTcaBehavioralSafety: routes.has('GOAL_MENTAL_HEALTH'),
        isMuscleOrSportRoute: routes.has('GOAL_MUSCLE')
    };
}

function sanitizeLegacyTelemetryInPatientData(rawPatientData) {
    if (!rawPatientData || typeof rawPatientData !== 'object') return rawPatientData;
    const data = { ...rawPatientData };
    const lp = data.lifestyle_profile ? { ...data.lifestyle_profile } : null;
    const legacyLs = data.lifestyle ? { ...data.lifestyle } : null;
    const cc = data.clinical_context ? { ...data.clinical_context } : null;

    const canonicalSourceType =
        lp?.activity?.source_type ||
        cc?.activity?.exercise?.source_type ||
        legacyLs?.activity?.source_type ||
        'MANUAL';

    const isConfirmedTelemetry = canonicalSourceType === 'TELEMETRY_TCX';

    if (!isConfirmedTelemetry) {
        if (lp && lp.activity) {
            lp.activity = {
                ...lp.activity,
                source_type: 'MANUAL',
                telemetry_metadata: null
            };
        }
        if (legacyLs && legacyLs.activity) {
            legacyLs.activity = {
                ...legacyLs.activity,
                ...(lp?.activity ? {
                    has_scheduled_exercise: lp.activity.has_scheduled_exercise,
                    neat_level: lp.activity.neat_level,
                    log: lp.activity.log
                } : {}),
                source_type: 'MANUAL',
                telemetry_metadata: null
            };
        }
        if (cc) {
            if (cc.activity?.exercise) {
                cc.activity = {
                    ...cc.activity,
                    exercise: {
                        ...cc.activity.exercise,
                        source_type: 'MANUAL',
                        telemetry_metadata: null
                    }
                };
            }
            if (Array.isArray(cc.annexes)) {
                cc.annexes = filterOrphanTelemetryAnnexes(cc.annexes, true);
            }
        }
    }

    if (lp) data.lifestyle_profile = lp;
    if (legacyLs) data.lifestyle = legacyLs;
    if (cc) data.clinical_context = cc;
    return data;
}

function capitalizeLeadingSpanishLetter(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    // Si inicia con "(1)líquido...", respetar el prefijo numérico y capitalizar la primera letra
    return trimmed.replace(/^(\(\d+\)\s*)?([\p{Ll}])/u, (_, prefix = '', ch) => `${prefix}${ch.toUpperCase()}`);
}

function cleanClinicalLabel(rawLabel) {
    return capitalizeLeadingSpanishLetter(sanitizeClinicalSpanish(rawLabel || ''));
}

function evaluateRangeDirection(rawVal, rawRef) {
    if (rawVal === null || rawVal === undefined || rawRef === null || rawRef === undefined) {
        return 'OUT_OF_RANGE';
    }
    const vNum = parseFloat(String(rawVal).replace(',', '.').replace(/[^0-9.-]/g, ''));
    if (isNaN(vNum)) return 'OUT_OF_RANGE';
    const refNorm = String(rawRef).replace(/,/g, '.');
    const m = refNorm.match(/(-?\d+(?:\.\d+)?)\s*[-–~]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return 'OUT_OF_RANGE';
    const min = parseFloat(m[1]);
    const max = parseFloat(m[2]);
    if (isNaN(min) || isNaN(max)) return 'OUT_OF_RANGE';
    const lowBound = Math.min(min, max);
    const highBound = Math.max(min, max);
    if (vNum < lowBound) return 'LOW';
    if (vNum > highBound) return 'HIGH';
    return 'IN_RANGE';
}

/**
 * Clasificador Ontológico Exhaustivo de las 37 Categorías Electret + Categorías Femeninas
 * y Enrutamiento Fino de Micronutrientes (Cero pérdida silenciosa y cero cajón de sastre en Nodo 7).
 */
function classifyElectretParameterToNode(catKey, itemKey, cleanName) {
    const cKey = normalizeForMatch(catKey);
    const pKey = normalizeForMatch(itemKey || cleanName);

    // 0. Exclusión limpia de meridianos de acupuntura hacia telemetría bioenergética auxiliar
    if (cKey === 'meridians' || cKey.includes('meridiano')) {
        return { nodeId: 'AUXILIARY_MERIDIANS' };
    }

    // 1. Enrutamiento fino de Vitaminas (vitamins)
    if (cKey === 'vitamins' || cKey.startsWith('vitamina')) {
        if (pKey.includes('vitamina_d') || pKey.includes('d3') || pKey.includes('vitamina_k')) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        if (pKey.includes('vitamina_c') || pKey.includes('vitamina_e') || pKey.includes('vitamina_a')) {
            return { nodeId: 'NODO_6_DEFENSA' };
        }
        // Complejo B (B1, B2, B3, B6, B9, B12) -> Cofactores mitocondriales y ciclo de Krebs
        return { nodeId: 'NODO_3_ENERGIA' };
    }

    // 2. Enrutamiento fino de Oligoelementos / Minerales (trace_elements)
    if (cKey === 'trace_elements' || cKey.includes('oligoelemento') || cKey.includes('mineral')) {
        if (['calcio', 'fosforo', 'silicio', 'boro', 'estroncio', 'fluor', 'manganeso'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        if (['hierro', 'cobre', 'cobalto'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_5_TRANSPORTE' };
        }
        if (['zinc', 'selenio', 'niquel'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_6_DEFENSA' };
        }
        if (['potasio', 'magnesio', 'vanadio', 'cromo'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_3_ENERGIA' };
        }
        if (pKey.includes('yodo')) {
            return { nodeId: 'NODO_4_COMUNICACION' };
        }
        if (['molibdeno', 'estano'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_2_BIOTRANSFORMACION' };
        }
        return { nodeId: 'NODO_3_ENERGIA' };
    }

    // 3. Enrutamiento fino de Aminoácidos (amino_acids)
    if (cKey === 'amino_acids' || cKey.includes('aminoacido')) {
        if (['leucina', 'isoleucina', 'valina'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        if (['triptofano', 'fenilalanina', 'tirosina'].some(k => pKey.includes(k))) {
            return { nodeId: 'NODO_4_COMUNICACION' };
        }
        if (pKey.includes('arginina')) {
            return { nodeId: 'NODO_5_TRANSPORTE' };
        }
        if (pKey.includes('metionina')) {
            return { nodeId: 'NODO_2_BIOTRANSFORMACION' };
        }
        if (pKey.includes('treonina') || pKey.includes('glutamina')) {
            return { nodeId: 'NODO_1_ASIMILACION' };
        }
        // Lisina, Histidina -> inmunidad, reparación epitelial y modulación histamínica
        return { nodeId: 'NODO_6_DEFENSA' };
    }

    // 4. Enrutamiento fino de Ojo / Microcirculación Periocular (eye)
    if (cKey === 'eye' || cKey === 'ojo' || cKey === 'ojos') {
        if (pKey.includes('fatiga_visual')) {
            return { nodeId: 'NODO_4_COMUNICACION' };
        }
        if (pKey.includes('arrugas') || pKey.includes('colageno') || pKey.includes('flacidez')) {
            return { nodeId: 'NODO_7_ESTRUCTURAL' };
        }
        return { nodeId: 'NODO_5_TRANSPORTE' };
    }

    // 5. Enrutamiento fino de Condición Física Básica (basic_physical)
    if (cKey === 'basic_physical' || cKey.includes('fisica_basica')) {
        if (pKey.includes('hipoxia')) return { nodeId: 'NODO_5_TRANSPORTE' };
        if (pKey.includes('mental') || pKey.includes('respuesta')) return { nodeId: 'NODO_4_COMUNICACION' };
        return { nodeId: 'NODO_3_ENERGIA' };
    }

    // 6. Enrutamiento fino de Composición Corporal (body_composition)
    if (cKey === 'body_composition' || cKey.includes('composicion_corporal')) {
        if (pKey.includes('grasa_corporal')) return { nodeId: 'NODO_3_ENERGIA' };
        return { nodeId: 'NODO_7_ESTRUCTURAL' };
    }

    // 7. Categorías Sistémicas Directas (Cobertura 100% de las 37 categorías canónicas + variantes femeninas)
    const DIRECT_CATEGORY_MAP = {
        // Nodo 1: Asimilación y Barrera Digestiva
        gastrointestinal: 'NODO_1_ASIMILACION',
        stomach: 'NODO_1_ASIMILACION',
        intestinal: 'NODO_1_ASIMILACION',
        colon: 'NODO_1_ASIMILACION',
        large_intestine: 'NODO_1_ASIMILACION',
        pancreas: 'NODO_1_ASIMILACION',
        digestivo: 'NODO_1_ASIMILACION',

        // Nodo 2: Biotransformación Hepatorrenal y Detoxificación
        liver: 'NODO_2_BIOTRANSFORMACION',
        higado: 'NODO_2_BIOTRANSFORMACION',
        gallbladder: 'NODO_2_BIOTRANSFORMACION',
        vesicula: 'NODO_2_BIOTRANSFORMACION',
        renal: 'NODO_2_BIOTRANSFORMACION',
        kidney: 'NODO_2_BIOTRANSFORMACION',
        rinon: 'NODO_2_BIOTRANSFORMACION',
        toxins: 'NODO_2_BIOTRANSFORMACION',
        human_toxin: 'NODO_2_BIOTRANSFORMACION',
        heavy_metals: 'NODO_2_BIOTRANSFORMACION',
        metales_pesados: 'NODO_2_BIOTRANSFORMACION',

        // Nodo 3: Bioenergética Mitocondrial y Metabolismo Lipídico-Glucémico
        blood_sugar: 'NODO_3_ENERGIA',
        azucar_en_la_sangre: 'NODO_3_ENERGIA',
        blood_lipids: 'NODO_3_ENERGIA',
        lipidos_sanguineos: 'NODO_3_ENERGIA',
        obesity: 'NODO_3_ENERGIA',
        obesidad: 'NODO_3_ENERGIA',
        coenzymes: 'NODO_3_ENERGIA',
        coenzimas: 'NODO_3_ENERGIA',
        fatty_acids: 'NODO_3_ENERGIA',
        acidos_grasos: 'NODO_3_ENERGIA',

        // Nodo 4: Comunicación Neuroendocrina, Cerebral y Reproductiva
        endocrine: 'NODO_4_COMUNICACION',
        tiroides: 'NODO_4_COMUNICACION',
        thyroid: 'NODO_4_COMUNICACION',
        brain: 'NODO_4_COMUNICACION',
        brain_nerve: 'NODO_4_COMUNICACION',
        cerebro: 'NODO_4_COMUNICACION',
        prostate: 'NODO_4_COMUNICACION',
        prostata: 'NODO_4_COMUNICACION',
        male_sexual: 'NODO_4_COMUNICACION',
        sperm_semen: 'NODO_4_COMUNICACION',
        gynecology: 'NODO_4_COMUNICACION',
        ginecologia: 'NODO_4_COMUNICACION',
        breasts: 'NODO_4_COMUNICACION',
        mammary: 'NODO_4_COMUNICACION',
        mama: 'NODO_4_COMUNICACION',
        menstrual_cycle: 'NODO_4_COMUNICACION',
        ciclo_menstrual: 'NODO_4_COMUNICACION',
        female_sexual: 'NODO_4_COMUNICACION',
        uterus: 'NODO_4_COMUNICACION',

        // Nodo 5: Transporte Cardiovascular, Cerebrovascular y Respiratorio
        cardiovascular: 'NODO_5_TRANSPORTE',
        cerebrovascular: 'NODO_5_TRANSPORTE',
        pulso_cerebro_y_corazon: 'NODO_5_TRANSPORTE',
        heart_brain_pulse: 'NODO_5_TRANSPORTE',
        pulmonary: 'NODO_5_TRANSPORTE',
        lung: 'NODO_5_TRANSPORTE',
        pulmonar: 'NODO_5_TRANSPORTE',

        // Nodo 6: Defensa Inmunológica, Alergias y Piel
        immune: 'NODO_6_DEFENSA',
        inmunologico: 'NODO_6_DEFENSA',
        allergies: 'NODO_6_DEFENSA',
        alergias: 'NODO_6_DEFENSA',
        skin: 'NODO_6_DEFENSA',
        piel: 'NODO_6_DEFENSA',

        // Nodo 7: Integridad Estructural, Matriz Ósea, Reumatoide y Colágeno
        bone_disease: 'NODO_7_ESTRUCTURAL',
        bone_density: 'NODO_7_ESTRUCTURAL',
        bone_mineral_density: 'NODO_7_ESTRUCTURAL',
        rheumatoid: 'NODO_7_ESTRUCTURAL',
        rheumatoid_bone: 'NODO_7_ESTRUCTURAL',
        bone_growth: 'NODO_7_ESTRUCTURAL',
        collagen: 'NODO_7_ESTRUCTURAL',
        colageno: 'NODO_7_ESTRUCTURAL'
    };

    if (DIRECT_CATEGORY_MAP[cKey]) {
        return { nodeId: DIRECT_CATEGORY_MAP[cKey] };
    }

    // Respaldo semántico por palabras clave antes de levantar alerta de auditoría ontológica
    const combined = `${cKey}_${pKey}`;
    if (/(gastro|estomag|intestin|colon|pepsin|pancrea|absorcion)/.test(combined)) return { nodeId: 'NODO_1_ASIMILACION' };
    if (/(higado|hepat|vesicul|biliar|renal|rinon|urobilin|proteinuri|toxin|pesticid|metal|plomo|mercuri|arsenic|cadmi)/.test(combined)) return { nodeId: 'NODO_2_BIOTRANSFORMACION' };
    if (/(glucos|insulina|colesterol|triglic|lipoprotein|hdl|ldl|coenzim|obesid|adip|acido_graso)/.test(combined)) return { nodeId: 'NODO_3_ENERGIA' };
    if (/(endocrin|tiroid|cerebr|craneal|memoria|pineal|hipotal|prostat|esperma|semen|testosteron|gonad|ginecol|menstru|estrogen|progesteron)/.test(combined)) return { nodeId: 'NODO_4_COMUNICACION' };
    if (/(cardio|vascular|coronari|miocard|pulmon|respirat|capacidad_vital|paco2|sao2|viscosidad|bombeo|latido)/.test(combined)) return { nodeId: 'NODO_5_TRANSPORTE' };
    if (/(inmun|linf|amigdal|alerg|histamin|cutane|melanin|dermat)/.test(combined)) return { nodeId: 'NODO_6_DEFENSA' };
    if (/(hueso|osea|osteocalcin|osteopor|reumat|colagen|calcificac|lumbar|cervical|muscul)/.test(combined)) return { nodeId: 'NODO_7_ESTRUCTURAL' };

    console.warn(`[CORTEX ONTOLOGY AUDIT] Parámetro Electret sin categoría canónica reconocida: cat="${catKey}", key="${itemKey}", name="${cleanName}". Enrutando a revisión clínica.`);
    return { nodeId: 'NODO_2_BIOTRANSFORMACION', requiresOntologyReview: true };
}

// ============================================================================
// 1. DICCIONARIO DETERMINISTA LOCAL DE CÓDIGOS CIE-10 Y REGLA DE FALLBACK
// ============================================================================
const CIE10_CLINICAL_DICTIONARY = {
    Z00_0: { code: 'Z00.0', label: 'Examen médico general (Homeostasis conservada)' },
    Z00_1: { code: 'Z00.1', label: 'Control de salud de rutina del niño (L-OMS)' },
    Z71_3: { code: 'Z71.3', label: 'Consulta para instrucción y vigilancia dietética' },
    K90_9: { code: 'K90.9', label: 'Malabsorción intestinal / Disbiosis funcional' },
    K30:   { code: 'K30',   label: 'Dispepsia funcional / Hipoclorhidria' },
    K59_0: { code: 'K59.0', label: 'Estreñimiento funcional' },
    K76_0: { code: 'K76.0', label: 'Hígado graso / Sobrecarga de biotransformación hepática' },
    E78_0: { code: 'E78.0', label: 'Hipercolesterolemia pura (LDL / Colesterol elevado)' },
    E78_2: { code: 'E78.2', label: 'Hiperlipidemia mixta (Colesterol y Triglicéridos)' },
    E78_5: { code: 'E78.5', label: 'Hiperlipidemia / Dislipidemia aterogénica (sdLDL / Índice Aterogénico)' },
    E11_9: { code: 'E11.9', label: 'Disglucemia / Resistencia a la insulina metabólica' },
    R73_0: { code: 'R73.0', label: 'Anormalidad en la prueba de tolerancia a la glucosa / Prediabetes' },
    E03_9: { code: 'E03.9', label: 'Hipotiroidismo subclínico / Baja conversión periférica T4->T3' },
    E07_9: { code: 'E07.9', label: 'Desregulación del eje neuroendocrino (Cortisol / DHEA)' },
    G47_0: { code: 'G47.0', label: 'Trastorno del inicio y mantenimiento del sueño / Cronodisrupción' },
    I10:   { code: 'I10',   label: 'Hipertensión arterial / Reactividad vascular elevada' },
    R70_1: { code: 'R70.1', label: 'Viscosidad sanguínea anormal / Hiperviscosidad reológica' },
    D50_9: { code: 'D50.9', label: 'Déficit de hierro / Hipoperfusión microcirculatoria' },
    D72_8: { code: 'D72.8', label: 'Reactividad leucocitaria / Basofilia reactiva' },
    L53_9: { code: 'L53.9', label: 'Afección eritematosa / Erupción micropapular cutánea' },
    T78_4: { code: 'T78.4', label: 'Hipersensibilidad alérgica / Reactividad histamínica' },
    M81_8: { code: 'M81.8', label: 'Desmineralización ósea / Desbalance de osteocalcina' },
    M79_1: { code: 'M79.1', label: 'Mialgia / Tensión miofascial y biotensegridad alterada' },
    E66_9: { code: 'E66.9', label: 'Adiposidad visceral / Desbalance de composición corporal' },
    // Fallbacks deterministas para casos borde no mapeados
    R79_9: { code: 'R79.9', label: 'Hallazgo anormal de la química sanguínea, sin otra especificación' },
    R89_9: { code: 'R89.9', label: 'Hallazgo anormal no especificado en muestras de otros órganos, sistemas y tejidos' }
};

const IFM_FUNCTIONAL_AXIS_DESCRIPTORS = Object.freeze({
    NODO_1_ASIMILACION: { code: 'IFM-01', label: 'Eje Funcional de Asimilación, Digestión y Barrera Mucosa' },
    NODO_2_BIOTRANSFORMACION: { code: 'IFM-02', label: 'Eje Funcional de Biotransformación y Depuración Hepatorrenal' },
    NODO_3_ENERGIA: { code: 'IFM-03', label: 'Eje Funcional Bioenergético Mitocondrial y Transporte Lipídico-Glucémico' },
    NODO_4_COMUNICACION: { code: 'IFM-04', label: 'Eje Funcional de Comunicación Neuroendocrina y Ritmo Circadiano' },
    NODO_5_TRANSPORTE: { code: 'IFM-05', label: 'Eje Funcional de Transporte Cardiovascular y Reología Microvascular' },
    NODO_6_DEFENSA: { code: 'IFM-06', label: 'Eje Funcional de Defensa Inmunológica y Reparación Celular' },
    NODO_7_ESTRUCTURAL: { code: 'IFM-07', label: 'Eje Funcional de Integridad Estructural, Colágeno y Soporte Osteomuscular' }
});

/**
 * Extrae exclusivamente códigos CIE-10 formalmente acreditados por diagnóstico médico previo en la anamnesis.
 * PROHIBIDO estampar códigos CIE-10 patológicos automáticos (NOM-004 / COFEPRIS).
 */
function extractAccreditedMedicalCie10(patientData, nodeId) {
    try {
        const rawPathologies = patientData?.history?.pathologies || patientData?.antecedentesPersonales || [];
        if (!Array.isArray(rawPathologies) || rawPathologies.length === 0) return null;
        for (const p of rawPathologies) {
            if (!p || typeof p !== 'object') continue;
            const explicitCie = String(p.accredited_cie10 || p.cie10_acreditado || '').trim().toUpperCase();
            if (/^[A-Z]\d{2}(?:\.\d{1,2})?$/.test(explicitCie) && p.nodeId === nodeId) {
                return explicitCie;
            }
        }
    } catch (_) {
        // Sin CIE-10 acreditado
    }
    return null;
}

function resolveFunctionalAxisForNode(nodeId, anomalies, patientData = null, isLactanteExplicit = false) {
    const baseAxis = IFM_FUNCTIONAL_AXIS_DESCRIPTORS[nodeId] || {
        code: 'IFM-00',
        label: 'Eje Funcional Sistémico Integrado'
    };
    const accreditedCie10 = extractAccreditedMedicalCie10(patientData, nodeId);

    if (!Array.isArray(anomalies) || anomalies.length === 0) {
        return {
            cie10: accreditedCie10,
            accredited_cie10: accreditedCie10,
            functionalCode: baseAxis.code,
            label: isLactanteExplicit && nodeId === 'NODO_1_ASIMILACION'
                ? 'Seguimiento Funcional de Crecimiento y Maduración Digestiva Pediátrica'
                : 'Equilibrio Funcional Conservado (Homeostasis)',
            validation_status: 'VALIDADO',
            requires_clinical_review: false
        };
    }

    const hasUnmappedSource = anomalies.some((a) => Boolean(a.requiresOntologyReview));
    return {
        cie10: accreditedCie10,
        accredited_cie10: accreditedCie10,
        functionalCode: baseAxis.code,
        label: baseAxis.label,
        validation_status: 'VALIDADO',
        requires_clinical_review: hasUnmappedSource
    };
}

// ============================================================================
// 2. FÓRMULA DE DEVINE BIDIRECCIONAL (< 152.4 cm) + ÁRBOL BIOENERGÉTICO
// ============================================================================
/**
 * Calcula el Peso Ideal (Fórmula de Devine Bidireccional + Referencia Lemmens)
 * y el Peso Ajustado para pacientes con obesidad (IMC >= 35).
 * @param {number} weightKg - Peso real del paciente en kilogramos.
 * @param {number} heightCm - Estatura del paciente en centímetros.
 * @param {string} gender - 'Masculino' o 'Femenino'.
 * @returns {Object} { idealWeight, lemmensIdealWeight, adjustedWeight }
 */
function calculatePrecisionWeights(weightKg, heightCm, gender) {
    const validWeight = Number(weightKg) > 0 ? Number(weightKg) : 70;
    const validHeight = Number(heightCm) > 0 ? Number(heightCm) : 165;
    const baseHeightCm = 152.4; // Base de 5 pies (60 pulgadas)
    const gStr = String(gender || '').toLowerCase();
    const isMale = gStr.startsWith('masc') || gStr === 'hombre' || gStr === 'm';
    const baseWeightKg = isMale ? 50.0 : 45.5;

    let idealWeight = baseWeightKg;
    if (validHeight >= baseHeightCm) {
        const inchesOverBase = (validHeight - baseHeightCm) / 2.54;
        idealWeight = baseWeightKg + (2.3 * inchesOverBase);
    } else {
        // Corrección bidireccional para estaturas bajas (< 152.4 cm):
        // Resta 1.5 kg por cada pulgada por debajo de los 5 pies
        const inchesUnderBase = (baseHeightCm - validHeight) / 2.54;
        idealWeight = Math.max(30.0, baseWeightKg - (1.5 * inchesUnderBase));
    }

    // Referencia cruzada de Lemmens (IMC óptimo 22 kg/m² válido en todo el espectro de tallas)
    const heightM = validHeight / 100;
    const lemmensIdealWeight = 22.0 * (heightM * heightM);

    // Peso Ajustado: PI + 25% del exceso de peso metabólicamente inactivo
    const adjustedWeight = idealWeight > 0 && validWeight > idealWeight
        ? idealWeight + 0.25 * (validWeight - idealWeight)
        : validWeight;

    return {
        idealWeight: Number(idealWeight.toFixed(2)),
        lemmensIdealWeight: Number(lemmensIdealWeight.toFixed(2)),
        adjustedWeight: Number(adjustedWeight.toFixed(2))
    };
}

/**
 * Árbol de Decisiones Matemáticas para Cálculo Bioenergético:
 * 1. Lactantes/Pediátricos (< 18 años) -> OMS / Schofield
 * 2. Adultos con % Grasa / Masa Muscular -> Katch-McArdle (MLG)
 * 3. Adultos con IMC >= 35 sin bioimpedancia -> Mifflin-St Jeor con Peso Ajustado (Devine Bidireccional)
 * 4. Adultos estándar sin bioimpedancia -> Mifflin-St Jeor Estándar
 */
function calculatePrecisionBioenergetics(rawPatientData, ageYears, ageMonths, isLactanteExplicit, isPediatricExplicit) {
    const patientData = sanitizeLegacyTelemetryInPatientData(rawPatientData || {});
    const rawWeight = parseFloat(patientData?.vitals?.weight || patientData?.peso || patientData?.biometria?.peso || patientData?.profile?.weight) || (isLactanteExplicit ? 9.5 : 72);
    const rawHeight = parseFloat(patientData?.vitals?.height || patientData?.talla || patientData?.biometria?.talla || patientData?.profile?.height) || (isLactanteExplicit ? 74 : 168);
    const heightCm = rawHeight < 3 ? rawHeight * 100 : rawHeight;
    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? Number((rawWeight / (heightM * heightM)).toFixed(1)) : 24.0;

    const isFemale = resolveBackendPatientIsFemale(patientData);
    const isMale = !isFemale;
    const gender = isFemale ? 'Femenino' : 'Masculino';

    const weights = calculatePrecisionWeights(rawWeight, heightCm, gender);

    // Detectar % de Grasa Corporal (Fase 16 o Electret)
    const bodyFatRaw = parseFloat(
        patientData?.vitals?.body_fat ||
        patientData?.vitals?.body_fat_pct ||
        patientData?.biometria?.grasa_corporal ||
        patientData?.biometria?.porcentaje_grasa ||
        patientData?.metrics?.body_fat ||
        0
    );
    const hasBioimpedanceFat = !isNaN(bodyFatRaw) && bodyFatRaw >= 4 && bodyFatRaw <= 65;

    let bmr = 1500;
    let equationUsed = 'Mifflin-St Jeor Estándar';
    let formulaExplanation = '';
    let leanBodyMassKg = null;

    if (isLactanteExplicit || isPediatricExplicit || ageYears < 18) {
        equationUsed = 'OMS / Schofield Pediátrica';
        if (ageYears < 3) {
            bmr = isMale ? (59.512 * rawWeight) - 30.4 : (58.317 * rawWeight) - 31.1;
            bmr += isLactanteExplicit ? 180 : 120; // Reserva energética de crecimiento L-OMS
        } else if (ageYears < 10) {
            bmr = isMale ? (22.706 * rawWeight) + 504.3 : (20.315 * rawWeight) + 485.9;
        } else {
            bmr = isMale ? (17.686 * rawWeight) + 658.2 : (13.384 * rawWeight) + 692.6;
        }
        formulaExplanation = `Cálculo pediátrico OMS/Schofield para ${ageYears < 2 ? `${ageMonths || 12} meses` : `${ageYears} años`} con peso ${rawWeight} kg.`;
    } else if (hasBioimpedanceFat) {
        equationUsed = 'Katch-McArdle (Masa Libre de Grasa)';
        leanBodyMassKg = Number((rawWeight * (1 - (bodyFatRaw / 100))).toFixed(2));
        bmr = 370 + (21.6 * leanBodyMassKg);
        formulaExplanation = `Basada en Masa Libre de Grasa (MLG: ${leanBodyMassKg} kg | Grasa: ${bodyFatRaw}%): TMB = 370 + (21.6 × ${leanBodyMassKg}).`;
    } else if (bmi >= 35) {
        equationUsed = 'Mifflin-St Jeor con Peso Ajustado (Devine Bidireccional)';
        const s = isMale ? 5 : -161;
        bmr = (10 * weights.adjustedWeight) + (6.25 * heightCm) - (5 * ageYears) + s;
        formulaExplanation = `IMC ${bmi} kg/m² (≥ 35): Se utilizó Peso Ajustado (${weights.adjustedWeight} kg) derivado de Peso Ideal Devine (${weights.idealWeight} kg).`;
    } else {
        equationUsed = 'Mifflin-St Jeor Estándar';
        const s = isMale ? 5 : -161;
        bmr = (10 * rawWeight) + (6.25 * heightCm) - (5 * ageYears) + s;
        formulaExplanation = `Basada en Peso Actual (${rawWeight} kg), Estatura (${heightCm} cm), Edad (${ageYears} años) y Sexo (${isMale ? '+5' : '-161'}).`;
    }

    bmr = Math.max(isLactanteExplicit ? 450 : 950, Math.round(bmr));

    // Factor de Actividad Física (PAL) y Gasto por Ejercicio (EAT) cruzando Fase 11 SSoTT (.TCX + NEAT) y Fase 1
    const lpAct = patientData?.lifestyle_profile?.activity || patientData?.clinical_context?.activity?.exercise || {};
    const tcxMeta = lpAct?.source_type === 'TELEMETRY_TCX' ? (lpAct?.telemetry_metadata || null) : null;
    const neatUpper = String(lpAct?.neat_level || '').toUpperCase();

    const actStr = String(
        patientData?.activity_level ||
        patientData?.physical_activity ||
        patientData?.habits?.activity_level ||
        patientData?.profile?.activity_level ||
        (neatUpper === 'HEAVY' ? 'INTENSO' : neatUpper === 'MODERATE' ? 'MODERADO' : neatUpper === 'SEDENTARY' ? 'SEDENTARIO' : 'LIGERO')
    ).toUpperCase();

    let pal = 1.375;
    if (isLactanteExplicit) {
        pal = 1.25;
    } else if (neatUpper) {
        if (neatUpper === 'SEDENTARY') pal = 1.2;
        else if (neatUpper === 'LIGHT') pal = 1.375;
        else if (neatUpper === 'MODERATE') pal = 1.55;
        else if (neatUpper === 'HEAVY') pal = 1.725;
    } else {
        if (actStr.includes('SEDENTARIO') || actStr.includes('NULA')) pal = 1.2;
        else if (actStr.includes('MODERAD') || actStr.includes('ACTIVO')) pal = 1.55;
        else if (actStr.includes('INTENS') || actStr.includes('ATLETA') || actStr.includes('ALTO')) pal = 1.725;
    }

    let dailyTelemetryEatKcal = 0;
    let weeklyExerciseMinutes = Number(lpAct?.weekly_minutes || 0);
    if (!isLactanteExplicit && tcxMeta && !tcxMeta.preview_pending_confirm) {
        const wkDays = Number(tcxMeta.weekly_days) > 0 ? Number(tcxMeta.weekly_days) : (Number(tcxMeta.unique_days_count) >= 3 ? Math.min(7, Number(tcxMeta.unique_days_count)) : 0);
        const wkCal = Number(tcxMeta.weekly_calories) > 0
            ? Number(tcxMeta.weekly_calories)
            : (wkDays > 0 ? Number(tcxMeta.daily_calories || tcxMeta.total_calories || 0) * wkDays : 0);
        if (wkCal > 0) {
            dailyTelemetryEatKcal = Math.round(wkCal / 7);
        }
        if (weeklyExerciseMinutes === 0 && wkDays > 0) {
            weeklyExerciseMinutes = Math.round(Number(tcxMeta.daily_minutes || tcxMeta.total_minutes || 0) * wkDays);
        }
    } else if (!isLactanteExplicit && weeklyExerciseMinutes === 0 && Array.isArray(lpAct?.log)) {
        lpAct.log.forEach(item => {
            if (item && typeof item === 'object') {
                const dur = Number(item.duration || item.durationMinutes || 0);
                const freq = Number(item.weekly_days || item.frequency || 0);
                if (Number(item.weekly_minutes) > 0) weeklyExerciseMinutes += Number(item.weekly_minutes);
                else if (dur > 0 && freq > 0) weeklyExerciseMinutes += Math.round(dur * freq);
            }
        });
    }

    if (!isLactanteExplicit && dailyTelemetryEatKcal === 0 && weeklyExerciseMinutes > 0) {
        if (weeklyExerciseMinutes >= 300) pal = Math.max(pal, 1.725);
        else if (weeklyExerciseMinutes >= 150) pal = Math.max(pal, 1.55);
        else if (weeklyExerciseMinutes >= 60) pal = Math.max(pal, 1.375);
    }

    const tdee = Math.round((bmr * pal) + dailyTelemetryEatKcal);
    if (dailyTelemetryEatKcal > 0 && bmr > 0) {
        pal = Number((tdee / bmr).toFixed(3));
    }

    // Determinación del Objetivo Calórico (Target) con Protección Materno-Infantil, Atlética y TCA (EGM-59)
    const anamnesisBio = extractUnifiedAnamnesisSignals(patientData);
    const routeCtxBio = resolveActiveClinicalRoutes(patientData, ageYears, isLactanteExplicit, isPediatricExplicit);
    const waistBio = parseFloat(patientData?.vitals?.waist || patientData?.anthropometry?.waist_cm || patientData?.biometria?.cintura || patientData?.cintura || 0) || null;
    const hipBio = parseFloat(patientData?.vitals?.hip || patientData?.anthropometry?.hip_cm || patientData?.biometria?.cadera || patientData?.cadera || 0) || null;
    const icaBio = (waistBio && heightCm > 0) ? Number((waistBio / heightCm).toFixed(2)) : null;
    const iccBio = (waistBio && hipBio > 0) ? Number((waistBio / hipBio).toFixed(2)) : null;
    const hasActiveSportBio = Boolean(weeklyExerciseMinutes >= 120 || dailyTelemetryEatKcal > 0 || /MODERAD|INTENS|ATLETA|ACTIVO/.test(actStr));
    const isAthleticHighLeanMass = Boolean(
        !isLactanteExplicit &&
        !isPediatricExplicit &&
        bmi >= 20.5 &&
        (
            routeCtxBio.isMuscleOrSportRoute ||
            (hasBioimpedanceFat && bodyFatRaw <= (isFemale ? 25.0 : 18.0) && (icaBio === null || icaBio < 0.52) && (iccBio === null || iccBio < (isFemale ? 0.85 : 0.90)) && hasActiveSportBio)
        )
    );

    let targetKcal = tdee;
    let caloricDeltaType = 'MANTENIMIENTO_RECOMPOSICION';
    if (anamnesisBio.isPregnant) {
        const wk = anamnesisBio.pregWeeks;
        const pregSurplus = (wk && wk <= 13) ? 0 : (wk && wk >= 28 ? 452 : 340);
        targetKcal = tdee + pregSurplus;
        caloricDeltaType = pregSurplus === 0
            ? 'BALANCE_GESTACIONAL_TRIMESTRE_1 (+0 kcal • 0 déficit)'
            : (pregSurplus === 452
                ? 'SOPORTE_GESTACIONAL_TRIMESTRE_3 (+452 kcal • IOM/NOM-043)'
                : 'SOPORTE_GESTACIONAL_TRIMESTRE_2 (+340 kcal • IOM/NOM-043)');
    } else if (anamnesisBio.isLactating) {
        const lacSurplus = bmi >= 25.0 ? 330 : 450;
        targetKcal = tdee + lacSurplus;
        caloricDeltaType = `SOPORTE_LACTANCIA_MATERNA (+${lacSurplus} kcal • IOM/NOM-043)`;
    } else if (!isLactanteExplicit && !isPediatricExplicit) {
        if (routeCtxBio.isTcaBehavioralSafety) {
            targetKcal = bmi < 18.5 ? (tdee + 300) : tdee;
            caloricDeltaType = bmi < 18.5
                ? 'RESTAURACION_NUTRICIONAL_TCA (+300 kcal)'
                : 'ESTABILIZACION_CONDUCTUAL_SIN_DEFICIT';
        } else if (isAthleticHighLeanMass) {
            targetKcal = routeCtxBio.isMuscleOrSportRoute ? (tdee + 250) : tdee;
            caloricDeltaType = routeCtxBio.isMuscleOrSportRoute
                ? 'SUPERAVIT_HIPERTROFIA_ATLETICA (+250 kcal)'
                : 'MANTENIMIENTO_RENDIMIENTO_ATLETICO (0 déficit)';
        } else if (bmi >= 30) {
            targetKcal = Math.max(1250, tdee - 450);
            caloricDeltaType = 'AJUSTE_ENERGETICO_MODERADO (-450 kcal)';
        } else if (bmi >= 25.5) {
            targetKcal = Math.max(1300, tdee - 300);
            caloricDeltaType = 'DEFICIT_RECOMPOSICION_SUAVE (-300 kcal)';
        } else if (bmi < 18.5) {
            targetKcal = tdee + 300;
            caloricDeltaType = 'SUPERAVIT_ANABOLICO (+300 kcal)';
        }
    }

    // Distribución de Macronutrientes personalizada
    let macros = { carbs: 40, protein: 30, fat: 30 };
    if (isLactanteExplicit) {
        macros = { carbs: 50, protein: 15, fat: 35 };
    } else if (isPediatricExplicit) {
        macros = { carbs: 50, protein: 20, fat: 30 };
    } else if (anamnesisBio.isPregnant || anamnesisBio.isLactating) {
        macros = { carbs: 48, protein: 22, fat: 30 };
    } else if (anamnesisBio.hasSevereRenalHistory && !anamnesisBio.isDialysisActive) {
        macros = { carbs: 53, protein: 12, fat: 35 };
    } else if (anamnesisBio.isDialysisActive) {
        macros = { carbs: 45, protein: 22, fat: 33 };
    } else if (isAthleticHighLeanMass) {
        macros = { carbs: 50, protein: 25, fat: 25 };
    } else if (ageYears >= 65) {
        macros = { carbs: 45, protein: 25, fat: 30 };
    } else if (bmi >= 27) {
        macros = { carbs: 35, protein: 35, fat: 30 };
    }

    return {
        age: ageYears,
        bmr,
        tdee,
        targetKcal,
        pal,
        bmi,
        weightKg: rawWeight,
        heightCm,
        leanBodyMassKg,
        bodyFatPct: hasBioimpedanceFat ? bodyFatRaw : null,
        isAthleticHighLeanMass,
        isPregnant: anamnesisBio.isPregnant,
        isLactating: anamnesisBio.isLactating,
        pregWeeks: anamnesisBio.pregWeeks,
        isTcaBehavioralSafety: routeCtxBio.isTcaBehavioralSafety,
        weights,
        equationUsed,
        formulaExplanation,
        caloricDeltaType,
        macros
    };
}

// ============================================================================
// 3. DESTILADOR DE "SUERO CLÍNICO" (REDUCCIÓN DE RUIDO HOMEOSTÁTICO)
// ============================================================================
/**
 * Extrae únicamente las anomalías reales de las Fases 1-18 (ignorando los valores
 * en rango NORMAL de Electret y OCR) y las organiza en las 7 Micro-Cápsulas IFM.
 */
function distillClinicalSerum(rawPatientData, isLactanteExplicit = false) {
    const patientData = sanitizeLegacyTelemetryInPatientData(rawPatientData || {});
    const nodesMap = {
        NODO_1_ASIMILACION: {
            id: 'NODO_1_ASIMILACION',
            number: 1,
            name: '1. Asimilación y Barrera Intestinal',
            anomalies: []
        },
        NODO_2_BIOTRANSFORMACION: {
            id: 'NODO_2_BIOTRANSFORMACION',
            number: 2,
            name: '2. Biotransformación y Eliminación Hepatorrenal',
            anomalies: []
        },
        NODO_3_ENERGIA: {
            id: 'NODO_3_ENERGIA',
            number: 3,
            name: '3. Bioenergética Mitocondrial y Metabolismo Lipídico-Glucémico',
            anomalies: []
        },
        NODO_4_COMUNICACION: {
            id: 'NODO_4_COMUNICACION',
            number: 4,
            name: '4. Comunicación Neuroendocrina y Ritmo Circadiano',
            anomalies: []
        },
        NODO_5_TRANSPORTE: {
            id: 'NODO_5_TRANSPORTE',
            number: 5,
            name: '5. Transporte Cardiovascular y Reología Microcirculatoria',
            anomalies: []
        },
        NODO_6_DEFENSA: {
            id: 'NODO_6_DEFENSA',
            number: 6,
            name: '6. Defensa Inmunológica, Piel y Respuesta Inflamatoria',
            anomalies: []
        },
        NODO_7_ESTRUCTURAL: {
            id: 'NODO_7_ESTRUCTURAL',
            number: 7,
            name: '7. Integridad Estructural, Matriz Ósea y Biotensegridad',
            anomalies: []
        }
    };

    const pushAnomaly = (nodeKey, source, label, detail, severity = 'MODERADA', extraMeta = {}) => {
        if (!label && !detail) return;
        if (!nodesMap[nodeKey]) return;
        nodesMap[nodeKey].anomalies.push({
            source,
            label: cleanClinicalLabel(label),
            detail: sanitizeClinicalSpanish(String(detail || '').trim()),
            severity,
            ...extraMeta
        });
    };

    // Declaración e inicialización estricta de variables de control clínico y bioseguridad
    let hasHighSerumCalciumOrCalcification = false;
    const auxiliaryBioenergetics = [];
    const unmappedOntologyWarnings = [];
    const electretSignals = {
        hasRenalBurden: false,
        hasSevereRenalAlert: false,
        hasHepaticBurden: false,
        hasBiliaryBurden: false,
        hasDigestiveSensitivity: false,
        hasCalcificationAlert: false,
        hasThyroidAlert: false,
        renalMarkers: [],
        hepaticMarkers: []
    };

    // A. INGESTA DE FASE 3: MOTIVO PRINCIPAL & SUFRIMIENTO CLÍNICO
    const clinicalContext = patientData?.clinical_context || {};
    const patientQuote = clinicalContext.patient_quote || patientData?.motivo || "";
    const specificAilment = clinicalContext.specific_ailment || "";
    const emotionalAnchor = clinicalContext.emotional_anchor || "";
    if (patientQuote || specificAilment) {
        pushAnomaly('NODO_4_COMUNICACION', 'CHIEF_COMPLAINT', 'Motivo de Consulta y Carga Alostática', 
            `Voz del Paciente: "${patientQuote}". Afección específica: ${specificAilment}. Ancla emocional: ${emotionalAnchor}`, 'MODERADA');
    }

    // B. INGESTA DE FASE 4: ANTECEDENTES HEREDOFAMILIARES (AHF - Vigilancia Epigenética Deduplicada)
    const rawFamily = patientData?.history?.family_structured || patientData?.history?.family_history || [];
    const familyHistory = Array.isArray(rawFamily) ? rawFamily : [];
    const familyByCondition = new Map();
    familyHistory.forEach((item) => {
        const disease = sanitizeClinicalSpanish(
            (typeof item === 'object' ? (item?.condition || item?.disease || item?.condicion || item?.detail) : item) || ''
        ).trim();
        const kin = sanitizeClinicalSpanish(
            (typeof item === 'object' ? (item?.relative || item?.relationship || item?.parentesco) : 'Familiar') || 'Familiar'
        ).trim();
        if (!disease || /^(ningun[oa]?|niega|negad[oa]s?|no|n\/a|null|undefined)$/i.test(disease)) return;
        const normDiseaseKey = normalizeForMatch(disease);
        if (!familyByCondition.has(normDiseaseKey)) {
            familyByCondition.set(normDiseaseKey, { label: disease, relatives: new Set() });
        }
        if (kin) familyByCondition.get(normDiseaseKey).relatives.add(kin);
    });

    const epigeneticSurveillance = [];
    familyByCondition.forEach(({ label: disease, relatives }) => {
        const kinList = Array.from(relatives).join(', ') || 'Familiar';
        const upper = disease.toUpperCase();
        const entrySummary = `${disease} (${kinList})`;
        epigeneticSurveillance.push(entrySummary);
        if (upper.includes('DIABET') || upper.includes('GLUCOSA') || upper.includes('METABOL') || upper.includes('OBESIDAD') || upper.includes('SOBREPESO') || upper.includes('DISLIPIDEMIA') || upper.includes('COLESTEROL')) {
            pushAnomaly('NODO_3_ENERGIA', 'AHF_EPIGENETIC', `Vigilancia Epigenética Heredo-Familiar: ${disease} (${kinList})`, 'Antecedente familiar preventivo sin equivalencia a patología activa; guía prevención nutricional', 'LEVE');
        } else if (upper.includes('HIPERTENSI') || upper.includes('INFARTO') || upper.includes('CARDIO') || upper.includes('EMBOLIA') || upper.includes('VASCULAR')) {
            pushAnomaly('NODO_5_TRANSPORTE', 'AHF_EPIGENETIC', `Vigilancia Epigenética Heredo-Familiar: ${disease} (${kinList})`, 'Antecedente familiar cardiovascular en seguimiento preventivo endotelial', 'LEVE');
        } else if (upper.includes('RENAL') || upper.includes('RIÑÓN') || upper.includes('RINON') || upper.includes('HEPÁT') || upper.includes('HEPAT')) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'AHF_EPIGENETIC', `Vigilancia Epigenética Heredo-Familiar: ${disease} (${kinList})`, 'Antecedente familiar hepatorrenal en vigilancia preventiva de hidratación', 'LEVE');
        } else if (upper.includes('CANCER') || upper.includes('CÁNCER') || upper.includes('AUTOINMUNE') || upper.includes('TIROID')) {
            pushAnomaly('NODO_6_DEFENSA', 'AHF_EPIGENETIC', `Vigilancia Epigenética Heredo-Familiar: ${disease} (${kinList})`, 'Antecedente familiar inmunológico/endocrino en vigilancia preventiva antioxidante', 'LEVE');
        }
    });

    // C. INGESTA UNIFICADA DE FASES 5 Y 6: ANTECEDENTES PATOLÓGICOS PERSONALES (APP) Y CIRUGÍAS (EGM-57)
    const anamnesis = extractUnifiedAnamnesisSignals(patientData);
    anamnesis.unifiedPathologies.forEach((name) => {
        const upper = String(name).toUpperCase();
        if (upper.includes('COLECIST') || upper.includes('VESÍCULA') || upper.includes('VESICULA')) {
            pushAnomaly('NODO_1_ASIMILACION', 'SURGICAL', 'Colecistectomía Declarada', 'Pérdida de reservorio biliar; requiere emulsión enzimática y modulación lipídica estricta.', 'ALTA');
        } else if (upper.includes('GASTRITIS') || upper.includes('REFLUJO') || upper.includes('COLITIS') || upper.includes('DISBIOSIS') || upper.includes('CELIAQ') || upper.includes('CELÍAC') || upper.includes('DISFAGIA')) {
            pushAnomaly('NODO_1_ASIMILACION', 'APP_DIGESTIVE', `Patología Digestiva: ${name}`, 'Compromiso mucoso, motilidad o barrera epitelial digestiva', 'ALTA');
        } else if (upper.includes('HÍGADO GRASO') || upper.includes('HIGADO GRASO') || upper.includes('HEPAT') || upper.includes('CIRROSIS')) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'APP_HEPATIC', `Antecedente Hepatobiliar: ${name}`, 'Vigilancia prioritaria de biotransformación hepática Fase I/II', 'ALTA');
        } else if (upper.includes('RENAL') || upper.includes('ERC') || upper.includes('LITIASIS') || upper.includes('CÁLCULO') || upper.includes('DIÁLISIS') || upper.includes('DIALISIS')) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'APP_RENAL', `Antecedente Nefrourológico: ${name}`, 'Protección estricta de filtración glomerular, solutos y equilibrio electrolítico', 'ALTA');
        } else if (upper.includes('DIABET') || upper.includes('PREDIABET') || upper.includes('INSULIN') || upper.includes('OVARIO POLIQU') || /\bSOP\b/.test(upper)) {
            pushAnomaly('NODO_3_ENERGIA', 'APP_METABOLIC', `Condición Metabólica Declarada: ${name}`, 'Modulación glucémica, sensibilidad insulínica y carga glucídica controlada', 'ALTA');
        } else if (upper.includes('HIPERTENSI') || /\bHTA\b/.test(upper) || upper.includes('FIBRILACI') || upper.includes('ARRITMIA') || upper.includes('CARDÍAC') || upper.includes('CARDIAC') || upper.includes('INFARTO') || upper.includes('TROMBOSIS')) {
            pushAnomaly('NODO_5_TRANSPORTE', 'APP_CARDIOVASCULAR', `Condición Cardiovascular Declarada: ${name}`, 'Estabilidad hemodinámica, protección endotelial y vigilancia farmacológica', 'ALTA');
        } else if (upper.includes('TIROID') || upper.includes('HIPOTIROID') || upper.includes('HIPERTIROID') || upper.includes('HASHIMOTO')) {
            pushAnomaly('NODO_4_COMUNICACION', 'APP_ENDOCRINE', `Condición Tiroidea / Endocrina: ${name}`, 'Sincronización metabólica neuroendocrina y respeto de ventana de absorción en ayunas', 'ALTA');
        } else if (upper.includes('ARTRITIS') || upper.includes('LUPUS') || upper.includes('AUTOINMUNE') || upper.includes('CÁNCER') || upper.includes('CANCER') || upper.includes('ONCOLOG')) {
            pushAnomaly('NODO_6_DEFENSA', 'APP_IMMUNE', `Condición Inmunológica / Sistémica: ${name}`, 'Modulación antiinflamatoria e inmunonutrición clínica supervisada', 'ALTA');
        } else if (upper.includes('ARTROSIS') || upper.includes('GONARTROSIS') || upper.includes('OSTEOPOROSIS') || upper.includes('OSTEOPENIA') || upper.includes('SARCOPENIA')) {
            pushAnomaly('NODO_7_ESTRUCTURAL', 'APP_STRUCTURAL', `Condición Osteomuscular: ${name}`, 'Preservación de matriz colágena, densidad mineral y descarga biomecánica articular', 'ALTA');
        }
    });

    if (anamnesis.hasBariatricSurgery) {
        pushAnomaly('NODO_1_ASIMILACION', 'SURGICAL', 'Antecedente de Cirugía Bariátrica (Bypass / Manga)', 'Capacidad gástrica reducida y riesgo de malabsorción de micronutrientes; requiere fraccionamiento proteico y líquidos separados de sólidos.', 'ALTA');
    } else if (anamnesis.hasCholecystectomy && !nodesMap.NODO_1_ASIMILACION.anomalies.some((a) => /Colecistectom/i.test(a.label))) {
        pushAnomaly('NODO_1_ASIMILACION', 'SURGICAL', 'Colecistectomía Declarada', 'Pérdida de reservorio biliar; requiere emulsión suave y fraccionamiento de lípidos.', 'ALTA');
    }

    // D. INGESTA DE FASE 9: ESTADO FISIOLÓGICO Y REPRODUCTIVO (preg_weeks + menstrual_status)
    const isPregnant = anamnesis.isPregnant;
    const isLactating = anamnesis.isLactating;
    const gestationWeeks = anamnesis.pregWeeks || 0;
    if (isPregnant) {
        pushAnomaly('NODO_3_ENERGIA', 'PHYSIO_STATE', 'Estado Gestacional Activo',
            `Semana de gestación: ${gestationWeeks || 'En curso (confirmar trimestre)'}. Prioridad fetoplacentaria sin restricción calórica (IOM / NOM-043).`, 'CRÍTICA');
        pushAnomaly('NODO_4_COMUNICACION', 'PHYSIO_STATE', 'Modulación Neuroendocrina Gestacional',
            'Adaptación fisiológica materna; suplementación sujeta a validación gineco-obstétrica.', 'ALTA');
    } else if (isLactating) {
        pushAnomaly('NODO_3_ENERGIA', 'PHYSIO_STATE', 'Lactancia Materna Activa',
            'Incremento fisiológico en demanda energética e hídrica; protocolo libre de estimulantes.', 'ALTA');
    }
    if (anamnesis.hasAmenorrhea) {
        pushAnomaly('NODO_4_COMUNICACION', 'PHYSIO_MENSTRUAL', 'Amenorrea / Supresión del Eje Hipotálamo-Hipófisis-Gonadal',
            `Estado menstrual declarado: ${anamnesis.menstrualStatus}. Descartar baja disponibilidad energética relativa (RED-S), estrés hipotalámico o disfunción endocrina.`, 'ALTA');
    } else if (anamnesis.hasIrregularCycle) {
        pushAnomaly('NODO_4_COMUNICACION', 'PHYSIO_MENSTRUAL', 'Irregularidad del Ciclo Menstrual',
            `Ciclo reportado: ${anamnesis.menstrualStatus}. Correlacionar con sensibilidad insulínica, reserva férrica y perfil tiroideo.`, 'MODERADA');
    } else if (anamnesis.hasMenopause) {
        pushAnomaly('NODO_4_COMUNICACION', 'PHYSIO_MENSTRUAL', 'Transición Climatérica / Postmenopausia',
            'Vigilancia cardioprotectora lipídica, preservación mineral ósea y masa muscular magra.', 'LEVE');
    }

    // E. INGESTA DE FASES 10 Y 11: CRONOBIOLOGÍA, SUEÑO, ESTRÉS (NUMÉRICO 1..10) Y TOXICOLOGÍA REAL
    if (anamnesis.hasPoorSleep) {
        pushAnomaly('NODO_4_COMUNICACION', 'LIFESTYLE_SLEEP', 'Disrupción Circadiana / Deuda de Sueño',
            `Horas reportadas: ${anamnesis.sleepHours ?? 'No precisadas'} h/noche${anamnesis.sleepQualityNum !== null ? ` • Calidad: ${anamnesis.sleepQualityNum}/10` : ''}${anamnesis.hasInsomniaFlag ? ' • Insomnio activo' : ''}`, 'ALTA');
    }
    if (anamnesis.hasHighStress) {
        pushAnomaly('NODO_4_COMUNICACION', 'LIFESTYLE_STRESS', 'Carga Alostática Elevada (Eje HPA)',
            `Nivel de estrés percibido: ${anamnesis.stressScoreNum !== null ? `${anamnesis.stressScoreNum}/10` : 'Alto'}. Riesgo de disregulación autonómica y glucémica`, 'ALTA');
    }
    if (anamnesis.isSmoker || anamnesis.isHeavyAlcohol || anamnesis.isFrequentAlcohol || anamnesis.hasDrugUsage) {
        const toxParts = [
            anamnesis.isSmoker ? `Tabaco activo${anamnesis.cigPerDay ? ` (${anamnesis.cigPerDay} cig/día)` : ''}` : null,
            (anamnesis.isHeavyAlcohol || anamnesis.isFrequentAlcohol) ? `Alcohol recurrente${anamnesis.alcWeeklyKcal ? ` (${anamnesis.alcWeeklyKcal} kcal/sem)` : ''}` : null,
            anamnesis.hasDrugUsage ? `Sustancias psicoactivas (${anamnesis.substanceName || 'declaradas'})` : null
        ].filter(Boolean).join(' • ');
        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'TOXIC_BURDEN', 'Carga Xenobiótica y Estrés Oxidativo Declarado (Fase 10)',
            toxParts, anamnesis.isHeavySmoker || anamnesis.isHeavyAlcohol || anamnesis.hasDrugUsage ? 'ALTA' : 'MODERADA');
    }

    // F. INGESTA DE FASES 7, 8, 12, 13 Y 14: ALERGIAS, INTOLERANCIAS, AVERSIÓN Y PREFERENCIAS ALIMENTARIAS
    const nutritionPrefs = patientData?.nutrition?.preferences || {};
    const altDietaryPrefs = patientData?.dietary_preferences || patientData?.preferencias_alimentarias || patientData?.clinical_context?.nutrition?.preferences || {};
    const dietEval = patientData?.evaluacionDietetica?.preferencias || patientData?.evaluacionDietetica || {};
    const digIntol = patientData?.digestive_profile?.intolerances || patientData?.history?.intolerances || [];
    const digTriggers = patientData?.digestive_profile?.trigger_foods || [];
    const foodAllergyItems = (patientData?.history?.allergies?.food || []).map((a) =>
        typeof a === 'object' ? (a.agent || a.name || '') : String(a || '')
    );
    const splitCsvList = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map((x) => String(typeof x === 'object' ? (x.name || x.label || '') : x || '').trim());
        return String(raw).split(/[,;|•\n]/).map((s) => s.trim());
    };
    const combinedExclusions = Array.from(new Set([
        ...foodAllergyItems,
        ...(Array.isArray(anamnesis.allergyItems) ? anamnesis.allergyItems : []),
        ...splitCsvList(digIntol),
        ...splitCsvList(digTriggers),
        ...splitCsvList(nutritionPrefs.excluded_ingredients),
        ...splitCsvList(nutritionPrefs.dislikes),
        ...splitCsvList(nutritionPrefs.aversions),
        ...splitCsvList(altDietaryPrefs.excluded_ingredients),
        ...splitCsvList(altDietaryPrefs.dislikes),
        ...splitCsvList(altDietaryPrefs.aversions),
        ...splitCsvList(dietEval.aversiones),
        ...splitCsvList(dietEval.intolerancias),
        ...splitCsvList(patientData?.r24h?.aversions)
    ]))
        .map((s) => cleanClinicalLabel(s))
        .filter((clean) => clean && !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean));

    // G. INGESTA DE FASE 14: CRONONUTRICIÓN R24H (Ventanas de Ayuno y Horarios Derivados Automáticamente — EGM-67)
    const crono = patientData?.nutrition?.crononutricion || patientData?.crononutricion || patientData?.r24h || {};
    const cenaTime = crono.hora_cena || crono.cena_horario || crono.dinner_time || anamnesis.derivedLastMealDisplay || '';
    const hasLateEating = Boolean(
        anamnesis.hasLateDinnerR24h ||
        (cenaTime && !anamnesis.isNightOrRotatingShift && (cenaTime.includes('22:') || cenaTime.includes('23:') || cenaTime.includes('00:') || cenaTime.includes('01:') || cenaTime.includes('10 PM') || cenaTime.includes('11 PM')))
    );
    const fastingHours = parseFloat(crono.horas_ayuno || crono.fasting_hours || anamnesis.derivedOvernightFastingHours || 0);
    if (hasLateEating || (crono.ingesta_nocturna && crono.ingesta_nocturna !== 'NO')) {
        pushAnomaly('NODO_4_COMUNICACION', 'R24H_CHRONO', 'Ingesta Tardía / Desalineación Cronobiológica', 
            `Horario de última ingesta (${cenaTime || 'Nocturno tardío'}) interfiere con la secreción de melatonina y reparación nocturna`, 'ALTA');
    }
    if (fastingHours > 0 && fastingHours < 10) {
        pushAnomaly('NODO_4_COMUNICACION', 'R24H_FASTING', 'Ventana de Reposo Metabólico Reducida', 
            `Ayuno nocturno estimado de ${fastingHours} h. Se recomienda extender gradualmente a 12 h de reposo digestivo`, 'MODERADA');
    }

    // H. INGESTA DE FASE 15: FRECUENCIA DE ALIMENTOS FFQ (Ultraprocesados y Azúcares)
    const ffq = patientData?.nutrition?.ffq || patientData?.frecuenciaConsumo || {};
    const ultraprocessedFreq = String(ffq.ultraprocesados || ffq.comida_chatarra || ffq.fast_food || '').toUpperCase();
    const sugaryBeveragesFreq = String(ffq.bebidas_azucaradas || ffq.refrescos || ffq.sodas || '').toUpperCase();
    if (ultraprocessedFreq.includes('DIARIO') || ultraprocessedFreq.includes('FRECUENTE') || ultraprocessedFreq.includes('3-4')) {
        pushAnomaly('NODO_1_ASIMILACION', 'FFQ_ULTRAPROCESSED', 'Consumo Recurrente de Ultraprocesados', 
            'Ingesta elevada de emulsificantes y grasas hidrogenadas; riesgo de disrupción en la barrera mucosa enterocitaria', 'ALTA');
    }
    if (sugaryBeveragesFreq.includes('DIARIO') || sugaryBeveragesFreq.includes('FRECUENTE') || sugaryBeveragesFreq.includes('3-4')) {
        pushAnomaly('NODO_3_ENERGIA', 'FFQ_SUGARS', 'Sobrecarga de Fructosa / Azúcares Líquidos', 
            'Frecuencia elevada de azúcares simples; riesgo de esteatosis hepática y resistencia periférica a la insulina', 'ALTA');
    }

    // I. INGESTA DE FASES 16 Y 17: ANTROPOMETRÍA FÍSICA PREFERENTE, ALTITUD (MSNM), PRESIÓN ARTERIAL Y GLUCOSA CAPILAR
    const isFemaleSerum = resolveBackendPatientIsFemale(patientData);
    const verifiedSerumAge = resolveVerifiedPatientAge(patientData, 35);
    const altitudeInfo = resolvePatientAltitudeMsnm(patientData);
    const routeContext = resolveActiveClinicalRoutes(patientData, verifiedSerumAge.ageYears, isLactanteExplicit, verifiedSerumAge.isPediatricVerified);
    const vitals = patientData?.vitals || patientData?.signosVitales || {};
    const biometria = patientData?.biometria || {};
    const bp = vitals.blood_pressure || vitals.bloodPressure || {};
    const sys = parseInt(bp.systolic || vitals.systolic || vitals.ta_sistolica || vitals.ta?.split('/')[0] || 0, 10);
    const dia = parseInt(bp.diastolic || vitals.diastolic || vitals.ta_diastolica || vitals.ta?.split('/')[1] || 0, 10);
    const gluRaw = parseFloat(vitals.glucose || vitals.glucosa || 0);
    const gluUnit = String(vitals.glucose_unit || vitals.unidad_glucosa || '').toLowerCase();
    const glu = gluRaw > 0 && gluUnit.includes('mmol') ? Number((gluRaw * 18.0156).toFixed(1)) : gluRaw;
    const spo2 = parseFloat(vitals.spo2 || vitals.saturacion || 0);
    const waist = parseFloat(vitals.waist || biometria.cintura || patientData?.cintura || 0);
    const hip = parseFloat(vitals.hip || biometria.cadera || patientData?.cadera || 0);
    const weightPhys = parseFloat(vitals.weight || biometria.peso || patientData?.peso || patientData?.profile?.weight || 0);
    const heightRawPhys = parseFloat(vitals.height || biometria.talla || patientData?.talla || patientData?.profile?.height || 0);
    const heightCmPhys = heightRawPhys > 0 && heightRawPhys < 3 ? heightRawPhys * 100 : heightRawPhys;
    const bodyFatPhys = parseFloat(vitals.body_fat || vitals.body_fat_pct || biometria.grasa_corporal || biometria.porcentaje_grasa || 0);
    const icc = (waist > 0 && hip > 0)
        ? parseFloat((waist / hip).toFixed(2))
        : (parseFloat(vitals.whr || patientData?.icc || 0) > 0 ? parseFloat(Number(vitals.whr || patientData?.icc).toFixed(2)) : null);
    const ica = (waist > 0 && heightCmPhys > 0) ? parseFloat((waist / heightCmPhys).toFixed(2)) : null;
    const bmiPhys = (weightPhys > 0 && heightCmPhys > 0)
        ? parseFloat((weightPhys / Math.pow(heightCmPhys / 100, 2)).toFixed(1))
        : (parseFloat(vitals.bmi || patientData?.imc || 0) > 0 ? parseFloat(Number(vitals.bmi || patientData?.imc).toFixed(1)) : null);
    const hasPhysicalTapeIcc = Boolean(waist > 0 && hip > 0 && icc);
    const hasPhysicalScaleBmi = Boolean(weightPhys > 0 && heightCmPhys > 0 && bmiPhys);
    const isAthleticHighLeanMass = Boolean(
        !isLactanteExplicit &&
        !verifiedSerumAge.isPediatricVerified &&
        (!bmiPhys || bmiPhys >= 20.5) &&
        (
            routeContext.isMuscleOrSportRoute ||
            (bodyFatPhys > 0 && (isFemaleSerum ? bodyFatPhys <= 25.0 : bodyFatPhys <= 18.0) && (!ica || ica < 0.52) && (!icc || (isFemaleSerum ? icc < 0.85 : icc < 0.90)))
        )
    );

    if (sys >= 130 || dia >= 85) {
        pushAnomaly('NODO_5_TRANSPORTE', 'VITALS_BP', `Tensión Arterial Elevada (${sys}/${dia} mmHg)`, 
            'Riesgo de sobrecarga vascular y disfunción endotelial', sys >= 140 || dia >= 90 ? 'CRÍTICA' : 'ALTA');
    }
    if (spo2 > 0 && spo2 < altitudeInfo.spo2NormalFloor) {
        pushAnomaly('NODO_5_TRANSPORTE', 'VITALS_SPO2', `Saturación Periférica de Oxígeno Disminuida (${spo2} %)`,
            `Inferior al umbral fisiológico ajustado por altitud (${altitudeInfo.spo2NormalFloor} % en ${altitudeInfo.label})`, spo2 < 89 ? 'CRÍTICA' : 'ALTA');
    }
    const capGluCtx = String(vitals.glucose_context || 'FASTING').toUpperCase();
    const isPostprandialVitalsGlu = /POST|CASUAL|DESPU[ÉE]S/.test(capGluCtx);
    if ((!isPostprandialVitalsGlu && glu >= 100) || (isPostprandialVitalsGlu && glu >= 140)) {
        pushAnomaly('NODO_3_ENERGIA', 'VITALS_GLUCOSE', `Glucosa Capilar Alterada (${glu} mg/dL${isPostprandialVitalsGlu ? ' postprandial' : ''})`, 
            (!isPostprandialVitalsGlu && glu >= 126) || (isPostprandialVitalsGlu && glu >= 200) ? 'Glucemia en rango compatible con descontrol glucémico' : 'Disglucemia capilar detectada', 'CRÍTICA');
    }
    const iccCutoff = isFemaleSerum ? 0.85 : 0.90;
    if (icc && icc > iccCutoff && !isLactanteExplicit && verifiedSerumAge.ageYears >= 18) {
        pushAnomaly('NODO_7_ESTRUCTURAL', 'ANTHRO_ICC', `Relación Cintura-Cadera Física (ICC: ${icc})`,
            `Medición física con cinta (Fase 16): Cintura ${waist} cm / Cadera ${hip} cm (Ref ${isFemaleSerum ? '< 0.85' : '< 0.90'})${ica ? ` • ICA: ${ica}` : ''}`, 'ALTA');
    }

    // J. Anomalías de Entrevista Clínica (Fases 7 y 8 — Unificado con history.digestive_symptoms)
    const digestiveProfile = patientData?.digestive_profile || {};
    if (anamnesis.hasDigestiveIssues) {
        const symp = anamnesis.unifiedDigestiveSymptoms.length > 0
            ? anamnesis.unifiedDigestiveSymptoms.join(', ')
            : (digestiveProfile.phenotype || 'Sintomatología digestiva reportada');
        pushAnomaly('NODO_1_ASIMILACION', 'INTERVIEW', 'Disfunción Digestiva Declarada', symp, 'ALTA');
    }

    const foodAllergies = patientData?.history?.allergies?.food || [];
    foodAllergies.forEach(a => {
        const agent = typeof a === 'object' ? a.agent : a;
        if (agent) pushAnomaly('NODO_6_DEFENSA', 'INTERVIEW', `Alergia Alimentaria: ${agent}`, 'Hipersensibilidad declarada en Fase 7', 'CRÍTICA');
    });

    const drugAllergies = patientData?.history?.allergies?.drug || [];
    drugAllergies.forEach(a => {
        const agent = typeof a === 'object' ? a.agent : a;
        if (agent) pushAnomaly('NODO_6_DEFENSA', 'INTERVIEW', `Alergia Farmacológica: ${agent}`, 'Hipersensibilidad medicamentosa declarada en Fase 7', 'CRÍTICA');
    });

    // B. Anomalías de Laboratorio Clínico OCR, Índices Funcionales y Gabinete Multimodal (Paso 4 de Fase 18)
    const extMetrics = patientData?.scan_data?.external_metrics || {};
    const rawLabSections = extMetrics.sections || extMetrics.lab_sections || {};
    const labSectionEntries = Array.isArray(rawLabSections)
        ? rawLabSections.map((s, idx) => [s?.id || s?.title || `sec_${idx}`, s])
        : Object.entries(rawLabSections);
    const flatLabs = extMetrics.biomarkers || extMetrics.labs || patientData?.lab_results || patientData?.ocr_labs || {};
    const seenLabKeys = new Set();
    const labVigencia = extMetrics.vigencia || null;

    // Diccionario de valores numéricos extraídos con normalización estricta de unidades internacionales (SI -> Clínica)
    const labValues = {};
    const unitConversionsApplied = [];

    function registerLabNumeric(name, rawVal, rawUnit = '', itemObj = null) {
        if (rawVal === undefined || rawVal === null) return;
        const rawNum = parseFloat(String(rawVal).replace(',', '.').replace(/[^0-9.-]/g, ''));
        if (isNaN(rawNum)) return;
        const normKey = String(name).toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, '_');
        const unitNorm = String(rawUnit || itemObj?.unit || '').toLowerCase().trim();
        const convInfo = normalizeInternationalLabUnit(normKey, rawNum, unitNorm, itemObj);
        const num = convInfo.value;
        if (convInfo.converted && convInfo.conversionNote && !unitConversionsApplied.includes(convInfo.conversionNote)) {
            unitConversionsApplied.push(convInfo.conversionNote);
        }

        if (normKey.includes('triglic')) labValues.triglycerides = num;
        else if (normKey.includes('no_hdl')) labValues.nonHdl = num;
        else if (normKey.includes('sd_ldl') || normKey.includes('sdldl')) labValues.sdLdl = num;
        else if (normKey.includes('apo_b') || normKey === 'apob' || normKey.includes('apolipoproteina_b')) labValues.apoB = num;
        else if (normKey.includes('indice_aterogenico')) labValues.atherogenicIndex = num;
        else if (normKey.includes('relacion_ldl_hdl')) labValues.ldlHdlRatio = num;
        else if (normKey.includes('hdl') && !normKey.includes('no_hdl') && !normKey.includes('relacion')) labValues.hdl = num;
        else if (normKey.includes('ldl') && !normKey.includes('vldl') && !normKey.includes('relacion')) labValues.ldl = num;
        else if (normKey.includes('colesterol') && !normKey.includes('ldl') && !normKey.includes('hdl') && !normKey.includes('vldl')) labValues.totalCholesterol = num;
        else if ((normKey.includes('glucosa') || normKey.includes('glucose')) && !normKey.includes('orina')) labValues.glucose = num;
        else if (normKey.includes('insulina') || normKey.includes('insulin')) labValues.insulin = num;
        else if (normKey.includes('hba1c') || normKey.includes('glicosilada') || normKey.includes('hemoglobina_a1c')) labValues.hba1c = num;
        else if (normKey.includes('calcio') || normKey.includes('calcium')) labValues.serumCalcium = num;
        else if (normKey.includes('magnesio')) labValues.magnesium = num;
        else if (normKey.includes('vitamina_d') || normKey.includes('25_oh') || normKey.includes('calcidiol')) labValues.vitaminD = num;
        else if (normKey.includes('creatinina') && !normKey.includes('relacion') && !normKey.includes('depuracion')) labValues.creatinine = num;
        else if (normKey.includes('filtrado') || normKey.includes('tfg') || normKey.includes('egfr')) labValues.gfr = num;
        else if (normKey.includes('bun') && !normKey.includes('relacion')) labValues.bun = num;
        else if (normKey === 'urea') {
            labValues.urea = num;
            if (!labValues.bun && num > 0) labValues.bun = Number((num / 2.14).toFixed(1));
        }
        else if (normKey.includes('urico') || normKey.includes('uric')) labValues.uricAcid = num;
        else if ((normKey.includes('alt') || normKey.includes('tgp')) && !normKey.includes('relacion')) labValues.alt = num;
        else if ((normKey.includes('ast') || normKey.includes('tgo')) && !normKey.includes('relacion')) labValues.ast = num;
        else if (normKey.includes('ggt') || normKey.includes('glutamil')) labValues.ggt = num;
        else if (normKey.includes('bilirrubina_total') || (normKey.includes('bilirrubina') && !normKey.includes('directa') && !normKey.includes('indirecta'))) labValues.bilirubin = num;
        else if (normKey.includes('pcr') || normKey.includes('proteina_c_reactiva')) {
            labValues.hscrpRaw = rawNum;
            if (itemObj?.value_mg_l !== undefined) {
                labValues.hscrpMgL = Number(itemObj.value_mg_l);
            } else {
                labValues.hscrpMgL = num;
            }
        }
        else if (normKey.includes('homocisteina')) labValues.homocysteine = num;
        else if ((normKey.includes('leucocito') || normKey.includes('white_blood')) && !normKey.includes('orina')) {
            if (itemObj?.value_cells_per_ul !== undefined) {
                labValues.leukocytes = Number(itemObj.value_cells_per_ul);
            } else if (/miles|10\^3|x10\^9/i.test(unitNorm) || (rawNum > 0 && rawNum < 50)) {
                labValues.leukocytes = Math.round(rawNum * 1000);
            } else {
                labValues.leukocytes = rawNum;
            }
        }
        else if (normKey.includes('basofilos') && (unitNorm === '%' || normKey.includes('pct'))) labValues.basophilsPct = rawNum;
        else if (normKey.includes('basofilos') && /miles|10\^3/i.test(unitNorm)) labValues.basophilsAbs = rawNum;
        else if (normKey.includes('hemoglobina') && !normKey.includes('corp') && !normKey.includes('a1c')) labValues.hemoglobin = num;
        else if (normKey.includes('vsg') || normKey.includes('sedimentacion')) labValues.vsg = num;
        else if (normKey.includes('ferritina')) labValues.ferritin = num;
        else if (normKey.includes('tsh')) labValues.tsh = num;
        else if (normKey.includes('t3_libre') || normKey.includes('t3')) labValues.freeT3 = num;
        else if (normKey.includes('t4_libre') || normKey.includes('t4')) labValues.freeT4 = num;
        else if (normKey.includes('cortisol')) labValues.cortisol = num;
        else if (normKey.includes('potasio') || normKey === 'k' || normKey.startsWith('k_')) labValues.potassium = num;
        else if (normKey === 'sodio' || normKey.startsWith('sodio_')) labValues.sodium = num;
        else if (normKey.includes('albumina') && !normKey.includes('microalbumin') && !normKey.includes('relacion') && !normKey.includes('orina')) labValues.albumin = num;
        else if (normKey.includes('rdw_cv') || (normKey.includes('distribucion_eritrocitaria') && !normKey.includes('rdw_sd') && (unitNorm === '%' || rawNum < 30))) labValues.rdw = rawNum;
    }

    labSectionEntries.forEach(([secKey, secObj]) => {
        const items = Array.isArray(secObj?.items) ? secObj.items : (Array.isArray(secObj) ? secObj : []);
        items.forEach(item => {
            const name = cleanClinicalLabel(item.name || item.label || item.parameter || 'Biomarcador');
            const unitStr = item.unit || '';
            registerLabNumeric(name, item.val ?? item.value, unitStr, item);

            const st = String(item.status || '').toUpperCase().trim();
            if (st && !isPhysiologicallyNormal(st)) {
                const dedupeKey = item.analyte_uid || `${name.toUpperCase()}::${unitStr.toUpperCase()}`;
                seenLabKeys.add(dedupeKey);
                const normLabVal = normalizeMetricDecimals(item.val ?? item.value ?? '');
                const normLabRef = normalizeMetricDecimals(item.ref || item.reference || 'N/A');
                const vigTag = labVigencia?.study_date_display ? ` • Toma ${labVigencia.study_date_display}` : '';
                const cleanUnitStr = String(unitStr || '').trim();
                const nonRedundantUnit = /^[íi]ndice$/i.test(cleanUnitStr) ? '' : cleanUnitStr;
                const detail = `${normLabVal}${nonRedundantUnit ? ` ${nonRedundantUnit}` : ''} (Ref: ${normLabRef} | Estado: ${st}${vigTag})`.trim();
                const upperName = `${secKey} ${name}`.toUpperCase();

                if (upperName.includes('COLESTEROL') || upperName.includes('LDL') || upperName.includes('HDL') || upperName.includes('TRIGLIC') || upperName.includes('ATEROG') || upperName.includes('GLUCOSA') || upperName.includes('INSULINA') || upperName.includes('HBA1C')) {
                    pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', name, detail, 'ALTA');
                } else if (upperName.includes('BASÓFIL') || upperName.includes('BASOFIL') || upperName.includes('LEUCOCIT') || upperName.includes('EOSIN') || upperName.includes('LINFOCIT') || upperName.includes('NEUTRÓFIL') || upperName.includes('PCR') || upperName.includes('VSG') || upperName.includes('FERRITINA')) {
                    pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('HEMOGLOBINA') || upperName.includes('HEMATOCRITO') || upperName.includes('ERITROCIT') || upperName.includes('PLAQUETA') || upperName.includes('HIERRO') || upperName.includes('HOMOCISTEINA') || upperName.includes('HOMOCISTEÍNA')) {
                    pushAnomaly('NODO_5_TRANSPORTE', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('CREATININA') || upperName.includes('UREA') || upperName.includes('BUN') || upperName.includes('ÁCIDO ÚRICO') || upperName.includes('ACIDO URICO') || upperName.includes('AST') || upperName.includes('ALT') || upperName.includes('GGT') || upperName.includes('BILIRRUBINA') || upperName.includes('ORINA') || upperName.includes('POTASIO')) {
                    pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('TSH') || upperName.includes('T3') || upperName.includes('T4') || upperName.includes('CORTISOL')) {
                    pushAnomaly('NODO_4_COMUNICACION', 'OCR_LAB', name, detail, 'MODERADA');
                } else if (upperName.includes('CALCIO') || upperName.includes('VITAMINA D') || upperName.includes('MAGNESIO') || upperName.includes('FÓSFORO')) {
                    pushAnomaly('NODO_7_ESTRUCTURAL', 'OCR_LAB', name, detail, 'MODERADA');
                } else {
                    pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', name, detail, 'MODERADA');
                }
            }
        });
    });

    Object.entries(flatLabs).forEach(([k, v]) => {
        if (!v) return;
        const name = cleanClinicalLabel(typeof v === 'object' ? (v.name || v.label || k) : k);
        const rawVal = typeof v === 'object' ? (v.value ?? v.val) : v;
        const unitStr = typeof v === 'object' ? (v.unit || '') : '';
        registerLabNumeric(name, rawVal, unitStr, typeof v === 'object' ? v : null);

        const st = typeof v === 'object' ? String(v.status || '').toUpperCase().trim() : '';
        const dedupeKey = (typeof v === 'object' && v.analyte_uid) ? v.analyte_uid : `${name.toUpperCase()}::${unitStr.toUpperCase()}`;
        if (st && !isPhysiologicallyNormal(st) && !seenLabKeys.has(dedupeKey)) {
            const cleanUnitStr = String(unitStr || '').trim();
            const nonRedundantUnit = /^[íi]ndice$/i.test(cleanUnitStr) ? '' : cleanUnitStr;
            const detail = `${normalizeMetricDecimals(rawVal ?? '')}${nonRedundantUnit ? ` ${nonRedundantUnit}` : ''} (${st})`.trim();
            const upperName = name.toUpperCase();
            if (upperName.includes('COLESTEROL') || upperName.includes('LDL') || upperName.includes('ATEROG') || upperName.includes('GLUCOSA') || upperName.includes('TRIGLIC')) {
                pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', name, detail, 'ALTA');
            } else if (upperName.includes('BASÓFIL') || upperName.includes('BASOFIL') || upperName.includes('LEUCOCIT') || upperName.includes('PCR')) {
                pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', name, detail, 'MODERADA');
            } else {
                pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', name, detail, 'MODERADA');
            }
        }
    });

    // EVALUACIÓN DE ÍNDICES FUNCIONALES, CKD-EPI 2021 Y CORTES POR SEXO/ALTITUD (CON NORMALIZACIÓN ESTRICTA SI)
    if (labValues.creatinine > 0 && !(labValues.gfr > 0)) {
        const computedEgfr = calculateCkdEpi2021Egfr(labValues.creatinine, verifiedSerumAge.ageYears, isFemaleSerum);
        if (computedEgfr !== null) {
            labValues.gfr = computedEgfr;
            labValues.gfrCalculatedCkdEpi = true;
        }
    }
    labValues.unitConversionsApplied = unitConversionsApplied;

    // 1. Ratio Triglicéridos / HDL (> 2.0) o HDL bajo ajustado por sexo (< 40 H / < 50 M)
    const hdlFloorBySex = isFemaleSerum ? 50 : 40;
    if (labValues.triglycerides > 0 && labValues.hdl > 0) {
        const tgHdl = labValues.triglycerides / labValues.hdl;
        if (tgHdl > 2.0) {
            pushAnomaly('NODO_3_ENERGIA', 'FUNCTIONAL_INDEX', 'Ratio Triglicéridos/HDL Elevado',
                `TG: ${labValues.triglycerides} mg/dL, HDL: ${labValues.hdl} mg/dL | Ratio = ${tgHdl.toFixed(2)} (> 2.0). Marcador subrogado de resistencia a la insulina`, 'ALTA');
        }
    }
    if (labValues.hdl > 0 && labValues.hdl < hdlFloorBySex) {
        pushAnomaly('NODO_5_TRANSPORTE', 'OCR_LAB', `Colesterol HDL Disminuido (${labValues.hdl} mg/dL)`,
            `Inferior al corte cardioprotector ajustado por sexo (${isFemaleSerum ? '>= 50 mg/dL' : '>= 40 mg/dL'})`, 'MODERADA');
    }

    // 2. Índice HOMA-IR (> 2.5) o Glucosa Venosa / HbA1c
    let homaIrCalc = null;
    if (labValues.glucose > 0 && labValues.insulin > 0) {
        homaIrCalc = (labValues.glucose * labValues.insulin) / 405;
        labValues.homaIr = Number(homaIrCalc.toFixed(2));
        if (homaIrCalc > 2.5) {
            pushAnomaly('NODO_3_ENERGIA', 'FUNCTIONAL_INDEX', 'Índice HOMA-IR Elevado',
                `Glucosa: ${labValues.glucose} mg/dL, Insulina: ${labValues.insulin} µUI/mL | HOMA-IR = ${homaIrCalc.toFixed(2)} (> 2.5). Resistencia periférica a la insulina`, 'ALTA');
        }
    }
    if (labValues.glucose >= 100) {
        pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', `Glucosa Sérica en Ayuno Alterada (${labValues.glucose} mg/dL)`,
            labValues.glucose >= 126 ? 'Glucemia venosa en rango compatible con diabetes' : 'Disglucemia venosa basal en ayuno', labValues.glucose >= 126 ? 'CRÍTICA' : 'ALTA');
    }
    if (labValues.hba1c >= 5.7) {
        pushAnomaly('NODO_3_ENERGIA', 'OCR_LAB', `Hemoglobina Glucosilada Alterada (${labValues.hba1c}%)`,
            `HbA1c = ${labValues.hba1c}%. Glicación proteica tisular fuera de rango óptimo`, labValues.hba1c >= 6.5 ? 'CRÍTICA' : 'ALTA');
    }

    // 2B. Hemoglobina ajustada por Sexo y Altitud (msnm)
    if (labValues.hemoglobin > 0) {
        const hbFloor = Number(((isFemaleSerum ? 12.0 : 13.5) + altitudeInfo.hbAltitudeOffset).toFixed(1));
        const hbCeil = Number(((isFemaleSerum ? 16.0 : 17.5) + altitudeInfo.hbAltitudeOffset).toFixed(1));
        if (labValues.hemoglobin < hbFloor) {
            pushAnomaly('NODO_5_TRANSPORTE', 'OCR_LAB', `Hemoglobina Disminuida para Altitud (${labValues.hemoglobin} g/dL)`,
                `Inferior al corte ajustado por sexo y altitud (${hbFloor} – ${hbCeil} g/dL en ${altitudeInfo.label})`, 'ALTA');
        }
    }

    // 3. Calcio Sérico (> 10.2 mg/dL) y Vitamina D
    if (labValues.serumCalcium > 10.2) {
        hasHighSerumCalciumOrCalcification = true;
        pushAnomaly('NODO_7_ESTRUCTURAL', 'OCR_LAB', 'Calcio Sérico Elevado (Hipercalcemia Funcional)',
            `Calcio sérico: ${labValues.serumCalcium} mg/dL (> 10.2 mg/dL). Alerta de desregulación mineral`, 'ALTA');
    }
    if (labValues.vitaminD > 0 && labValues.vitaminD < 30) {
        pushAnomaly('NODO_7_ESTRUCTURAL', 'OCR_LAB', 'Hipovitaminosis D (25-OH)',
            `Vitamina D (25-OH): ${labValues.vitaminD} ng/mL (< 30 ng/mL). Deficiencia de mineralización esquelética`, 'MODERADA');
    }

    // 4. Biotransformación Hepatorrenal (cortes reales de laboratorio venoso)
    if (labValues.alt > 61 || labValues.ast > 40 || labValues.ggt > 61 || labValues.bilirubin > 1.2 || labValues.uricAcid > 7.0 || labValues.creatinine > 1.2 || (labValues.gfr > 0 && labValues.gfr < 60) || labValues.potassium > 5.1) {
        pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCR_LAB', 'Sobrecarga de Biotransformación Hepatorrenal',
            `Parámetros alterados: ${[
                labValues.alt > 61 ? `ALT/TGP: ${labValues.alt} U/L` : null,
                labValues.ast > 40 ? `AST/TGO: ${labValues.ast} U/L` : null,
                labValues.ggt > 61 ? `GGT: ${labValues.ggt} U/L` : null,
                labValues.bilirubin > 1.2 ? `Bilirrubina: ${labValues.bilirubin} mg/dL` : null,
                labValues.uricAcid > 7.0 ? `Ácido Úrico: ${labValues.uricAcid} mg/dL` : null,
                labValues.creatinine > 1.2 ? `Creatinina: ${labValues.creatinine} mg/dL` : null,
                (labValues.gfr > 0 && labValues.gfr < 60) ? `TFG: ${labValues.gfr} mL/min` : null,
                labValues.potassium > 5.1 ? `Potasio: ${labValues.potassium} mEq/L` : null
            ].filter(Boolean).join(' • ')}`, 'ALTA');
    }

    // 5. Transporte Vascular (Colesterol Total, LDL, sdLDL, PCR-us normalizada en mg/L > 3.0 mg/L, Homocisteína)
    const isHscrpAcuteElevated = Number(labValues.hscrpMgL) > 3.0;
    if (labValues.totalCholesterol > 200 || labValues.ldl > 130 || labValues.sdLdl > 1.35 || isHscrpAcuteElevated || labValues.homocysteine > 12) {
        pushAnomaly('NODO_5_TRANSPORTE', 'OCR_LAB', 'Dislipidemia Aterogénica y Transporte Lipoproteico',
            `Marcadores vasculares: ${[
                labValues.totalCholesterol > 200 ? `Colesterol Total: ${labValues.totalCholesterol} mg/dL` : null,
                labValues.ldl > 130 ? `Colesterol LDL directo: ${labValues.ldl} mg/dL` : null,
                labValues.nonHdl > 130 ? `Colesterol no-HDL: ${labValues.nonHdl} mg/dL` : null,
                labValues.sdLdl > 1.35 ? `sdLDL: ${labValues.sdLdl}` : null,
                isHscrpAcuteElevated ? `PCR-us: ${labValues.hscrpMgL} mg/L (> 3.0 mg/L)` : null,
                labValues.homocysteine > 12 ? `Homocisteína: ${labValues.homocysteine} µmol/L` : null
            ].filter(Boolean).join(' • ')}`, 'ALTA');
    }

    // 6. Defensa e Inmunología (Leucocitos escalados a células/µL: < 3800 o > 11600; Reactantes de Fase Aguda reales)
    const hasLeukopeniaOrLeukocytosis = labValues.leukocytes > 11600 || (labValues.leukocytes > 0 && labValues.leukocytes < 3800);
    const hasTrueAcutePhaseReactants = isHscrpAcuteElevated || labValues.vsg > 20 || labValues.ferritin > 300;
    if (hasLeukopeniaOrLeukocytosis || hasTrueAcutePhaseReactants) {
        pushAnomaly('NODO_6_DEFENSA', 'OCR_LAB', hasTrueAcutePhaseReactants ? 'Reactantes de Fase Aguda Elevados' : 'Alteración Cuantitativa de Serie Blanca',
            `Analitos: ${[
                hasLeukopeniaOrLeukocytosis ? `Leucocitos: ${labValues.leukocytes} /µL` : null,
                isHscrpAcuteElevated ? `PCR-us: ${labValues.hscrpMgL} mg/L` : null,
                labValues.vsg > 20 ? `VSG: ${labValues.vsg} mm/h` : null,
                labValues.ferritin > 300 ? `Ferritina: ${labValues.ferritin} ng/mL` : null
            ].filter(Boolean).join(' • ')}`, 'MODERADA');
    }

    // 7. Comunicación Neuroendocrina (TSH, T3 libre, T4 libre, Cortisol)
    if (labValues.tsh > 4.5 || (labValues.tsh > 0 && labValues.tsh < 0.4) || labValues.cortisol > 20) {
        if (labValues.tsh > 4.5 || (labValues.tsh > 0 && labValues.tsh < 0.4)) {
            electretSignals.hasThyroidAlert = true;
        }
        pushAnomaly('NODO_4_COMUNICACION', 'OCR_LAB', 'Eje Neuroendocrino / Tiroideo-Adrenal Alterado',
            `Hormonas: ${[
                labValues.tsh ? `TSH: ${labValues.tsh} µUI/mL` : null,
                labValues.cortisol ? `Cortisol: ${labValues.cortisol} µg/dL` : null
            ].filter(Boolean).join(' • ')}`, 'MODERADA');
    }

    // B2. Puente Universal de Gabinete e Imagenología (ECG_CARDIOLOGY y RADIOLOGY_ULTRASOUND_IMAGING -> NODO_5 y NODO_7)
    const cabinetSignals = {
        hasCabinetStudies: false,
        studiesCount: 0,
        hasCardiacConductionOrBradycardia: false,
        hasRbbbBlock: false,
        ecgHrBpm: null,
        ecgQrsMs: null,
        recommendsEchocardiogram: false,
        hasAorticOrThoracicRemodeling: false,
        hasPostsurgicalInguinalOrAbdominalWall: false,
        hasNoActiveHerniaAtValsalva: false,
        hasAxialLoadRestriction: false,
        summaries: []
    };
    try {
        const cabinetStudies =
            extMetrics?.external_studies?.clinical_imaging_and_cabinet ||
            extMetrics?.imaging?.studies ||
            [];
        if (Array.isArray(cabinetStudies) && cabinetStudies.length > 0) {
            cabinetSignals.hasCabinetStudies = true;
            cabinetSignals.studiesCount = cabinetStudies.length;
            cabinetStudies.forEach(st => {
                if (!st || typeof st !== 'object') return;
                const flags = Array.isArray(st.clinical_flags) ? st.clinical_flags : [];
                const m = st.metrics || {};
                const dateLabel = st.study_date_display ? ` (${st.study_date_display})` : '';

                if (st.domain === 'ECG_CARDIOLOGY' || st.modality === 'ECG') {
                    if (m.hr_bpm) cabinetSignals.ecgHrBpm = Number(m.hr_bpm);
                    if (m.qrs_ms) cabinetSignals.ecgQrsMs = Number(m.qrs_ms);
                    if (flags.includes('ECG_RBBB_CONDUCTION') || (m.qrs_ms && m.qrs_ms >= 120)) {
                        cabinetSignals.hasRbbbBlock = true;
                        cabinetSignals.hasCardiacConductionOrBradycardia = true;
                    }
                    if (flags.includes('ECG_SINUS_BRADYCARDIA') || (m.hr_bpm && m.hr_bpm < 60)) {
                        cabinetSignals.hasCardiacConductionOrBradycardia = true;
                    }
                    if (flags.includes('RECOMMENDS_ECHOCARDIOGRAM')) {
                        cabinetSignals.recommendsEchocardiogram = true;
                    }
                    if (flags.includes('ECG_TACHYARRHYTHMIA') || (m.hr_bpm && Number(m.hr_bpm) >= 110) || /taquiarritmia|fibrilaci[óo]n\s+auricular|taquicardia\s+(?:supraventricular|ventricular)|flutter/i.test(String(st.impression || ''))) {
                        cabinetSignals.hasActiveTachyarrhythmia = true;
                    }
                    const metricParts = [
                        m.hr_bpm !== undefined ? `FC ${m.hr_bpm} lpm` : null,
                        m.pr_ms !== undefined ? `PR ${m.pr_ms} ms` : null,
                        m.qrs_ms !== undefined ? `QRS ${m.qrs_ms} ms` : null,
                        m.qt_ms !== undefined ? `QT ${m.qt_ms} ms` : null,
                        m.qtc_ms !== undefined ? `QTc ${m.qtc_ms} ms` : null,
                        m.p_axis_deg !== undefined ? `Eje P ${m.p_axis_deg}°` : null,
                        m.qrs_axis_deg !== undefined ? `Eje QRS ${m.qrs_axis_deg}°` : null,
                        m.t_axis_deg !== undefined ? `Eje T ${m.t_axis_deg}°` : null,
                        m.rr_ms !== undefined ? `RR ${m.rr_ms} ms` : null
                    ].filter(Boolean).join(', ');
                    const detail = `${metricParts ? `${metricParts} • ` : ''}${st.impression || 'Evaluación electrocardiográfica en reposo'}`;
                    pushAnomaly('NODO_5_TRANSPORTE', 'CABINET_ECG', `Electrocardiograma en Reposo${dateLabel}`, detail, 'ALTA');
                    cabinetSignals.summaries.push(`ECG${dateLabel}: ${detail}`);
                } else if (st.modality === 'RX' && String(st.anatomical_region || '').includes('torax')) {
                    if (flags.includes('RX_PROMINENT_AORTIC_ARCH_HILA')) {
                        cabinetSignals.hasAorticOrThoracicRemodeling = true;
                    }
                    const ictStr = m.ict !== undefined ? `ICT ${m.ict} • ` : '';
                    const detail = `${ictStr}${st.impression || 'Radiografía postero-anterior de tórax'}`;
                    pushAnomaly('NODO_5_TRANSPORTE', 'CABINET_RX', `Radiografía de Tórax PA${dateLabel}`, detail, 'MODERADA');
                    cabinetSignals.summaries.push(`RX Tórax${dateLabel}: ${detail}`);
                } else {
                    if (flags.includes('US_POSTSURGICAL_INGUINAL_WALL')) {
                        cabinetSignals.hasPostsurgicalInguinalOrAbdominalWall = true;
                    }
                    if (flags.includes('US_NO_ACTIVE_HERNIA_AT_VALSALVA')) {
                        cabinetSignals.hasNoActiveHerniaAtValsalva = true;
                    }
                    if (st.modality === 'RM' || st.modality === 'TAC' || st.modality === 'DMO' || String(st.anatomical_region || '').includes('columna')) {
                        cabinetSignals.hasAxialLoadRestriction = true;
                    }
                    const extraMetrics = Object.entries(m)
                        .filter(([mk]) => !['transducer_mhz'].includes(mk))
                        .map(([mk, mv]) => `${mk}: ${mv}`)
                        .join(', ');
                    const platesTag = st.attached_plate_pages > 0 ? ` • Informe + ${st.attached_plate_pages} láminas Doppler` : '';
                    const detail = `${extraMetrics ? `${extraMetrics} • ` : ''}${st.impression || 'Estudio estructural de gabinete'}${platesTag}`;
                    const targetNodeId = /h[íi]gado|hep[áa]t|biliar|ves[íi]cula|renal|ri[ñn][óo]n/i.test(`${st.anatomical_region || ''} ${st.title || ''}`)
                        ? 'NODO_2_BIOTRANSFORMACION'
                        : 'NODO_7_ESTRUCTURAL';
                    pushAnomaly(targetNodeId, 'CABINET_IMAGING', `${st.title || st.modality}${dateLabel}`, detail, 'MODERADA');
                    cabinetSignals.summaries.push(`${st.modality}${dateLabel}: ${detail}`);
                }
            });
        }
    } catch (cabErr) {
        console.warn('⚠️ [Cabinet Bridge Safe Catch]:', cabErr.message);
    }

    // C. Tamizaje Biofísico Orientativo Electret (EGM-71: Separado en Anexo Informativo fuera de Nota Médica NOM-004)
    const electretCats = patientData?.scan_data?.electret_metrics || patientData?.electretTelemetry?.categories || {};
    const electretAnnexItems = [];
    const electretCountByNode = {};
    const electretFriendlyTopicsByNode = {};

    if (electretCats && typeof electretCats === 'object') {
        Object.entries(electretCats).forEach(([catKey, catData]) => {
            const items = Array.isArray(catData?.items) ? catData.items : (Array.isArray(catData) ? catData : []);
            items.forEach(item => {
                const st = String(item.status || item.level || '').toUpperCase().trim();
                // Filtro fisiológico estricto: descarta NORMAL, NORMAL (-), NORMAL (+), OPTIMAL, CONSERVADO
                if (!st || isPhysiologicallyNormal(st)) {
                    return;
                }

                const rawName = item.displayName || item.name || item.parameter || item.label || catKey;
                let cleanName = cleanClinicalLabel(rawName);
                const normCat = normalizeForMatch(catKey);
                if (normCat === 'collagen' && !/col[áa]geno/i.test(cleanName)) {
                    cleanName = `Colágeno (${cleanName})`;
                }

                const rawVal = normalizeMetricDecimals(item.value ?? item.val ?? item.actual ?? '');
                const refStr = normalizeMetricDecimals(item.reference || item.ref || item.range || item.standard || 'N/A');
                const direction = evaluateRangeDirection(rawVal, refStr);
                const dirHint = direction === 'LOW' ? 'Bajo' : (direction === 'HIGH' ? 'Elevado' : '');
                const valStr = `${rawVal} (Ref: ${refStr} | ${st}${dirHint ? ` • ${dirHint}` : ''})`.trim();

                let sev = 'MODERADA';
                if (st.includes('+++') || st.includes('---') || st.includes('SEVER')) sev = 'CRÍTICA';
                else if (st.includes('++') || st.includes('--') || st.includes('MODERAD')) sev = 'ALTA';

                const normItemKey = normalizeForMatch(item.key || rawName);

                // Señales de bioseguridad y sobrecarga orgánica para Semáforo Clínico
                if (normItemKey.includes('calcificacion') && direction !== 'LOW') {
                    hasHighSerumCalciumOrCalcification = true;
                    electretSignals.hasCalcificationAlert = true;
                } else if (normItemKey === 'calcio' && direction === 'HIGH') {
                    hasHighSerumCalciumOrCalcification = true;
                    electretSignals.hasCalcificationAlert = true;
                }

                if (normCat === 'renal' || normItemKey.includes('proteinuria') || normItemKey.includes('acido_urico') || normItemKey.includes('urobilinogeno') || normItemKey.includes('nitrogeno_ureico')) {
                    if (sev === 'ALTA' || sev === 'CRÍTICA' || normItemKey.includes('proteinuria')) {
                        electretSignals.hasRenalBurden = true;
                        electretSignals.renalMarkers.push(cleanName);
                    }
                    if (sev === 'CRÍTICA' && normItemKey.includes('proteinuria')) {
                        electretSignals.hasSevereRenalAlert = true;
                    }
                }

                if (normCat === 'liver' || normItemKey.includes('grasa_en_el_higado') || normItemKey.includes('desintoxicacion')) {
                    if (sev === 'ALTA' || sev === 'CRÍTICA') {
                        electretSignals.hasHepaticBurden = true;
                        electretSignals.hepaticMarkers.push(cleanName);
                    }
                }

                if (normCat === 'gallbladder') {
                    if (sev === 'ALTA' || sev === 'CRÍTICA') {
                        electretSignals.hasBiliaryBurden = true;
                    }
                }

                if ((normCat === 'gastrointestinal' || normCat === 'colon') && sev === 'CRÍTICA') {
                    electretSignals.hasDigestiveSensitivity = true;
                }

                if (normItemKey.includes('tiroid') || normItemKey.includes('tiroglobulina') || normItemKey.includes('paratiroid') || /(?:^|_)t[34](?:_|$)/.test(normItemKey)) {
                    if (sev === 'ALTA' || sev === 'CRÍTICA' || normItemKey.includes('tiroglobulina')) {
                        electretSignals.hasThyroidAlert = true;
                    }
                }

                const classification = classifyElectretParameterToNode(catKey, item.key, cleanName);
                const safeBioelectricLabel = sanitizeBioelectricScreeningLabel(cleanName);
                if (classification.nodeId === 'AUXILIARY_MERIDIANS') {
                    auxiliaryBioenergetics.push({
                        label: safeBioelectricLabel,
                        detail: valStr,
                        severity: sev
                    });
                    return;
                }

                if (classification.requiresOntologyReview) {
                    unmappedOntologyWarnings.push(`${catKey}:${cleanName}`);
                }

                // EGM-71 (NOM-004 / COFEPRIS): Cero inserción de bioseñales .HTM en nodos clínicos acreditados;
                // se resguardan en el Anexo Biofísico Orientativo con etiquetas no diagnósticas sanitizadas.
                electretCountByNode[classification.nodeId] = (electretCountByNode[classification.nodeId] || 0) + 1;
                if (!electretFriendlyTopicsByNode[classification.nodeId]) {
                    electretFriendlyTopicsByNode[classification.nodeId] = [];
                }
                electretFriendlyTopicsByNode[classification.nodeId].push(safeBioelectricLabel);
                electretAnnexItems.push({
                    nodeId: classification.nodeId,
                    category: normCat,
                    label: safeBioelectricLabel,
                    detail: formatMedicalBiomarkerSummary(valStr),
                    severity: sev,
                    direction
                });
            });
        });
    }

    // D. Hallazgos de Auditoría Ocular Binocular (Paso 2 de Fase 18)
    const ocular = patientData?.scan_data?.ocular_metrics || patientData?.ocular_metrics || patientData?.oculomics;
    const flattenVisionObjectClauses = (node, prefix = '') => {
        if (node === null || node === undefined) return [];
        if (typeof node === 'string' || typeof node === 'number') {
            return [`${prefix ? `${prefix}: ` : ''}${String(node)}`];
        }
        if (Array.isArray(node)) {
            return node.flatMap((it) => flattenVisionObjectClauses(it, prefix));
        }
        if (typeof node === 'object') {
            return Object.entries(node).flatMap(([k, v]) => {
                if (/url$|disclaimer|titulo/i.test(k)) return [];
                return flattenVisionObjectClauses(v, k);
            });
        }
        return [];
    };
    const hasAffirmativeOpticalSign = (rawStr, posRe, negRe) => {
        const s = String(rawStr || '');
        if (!s || !posRe.test(s)) return false;
        const clauses = s.split(/[.;|•\n]+/);
        return clauses.some((cl) => posRe.test(cl) && !negRe.test(cl));
    };

    if (ocular && ocular.status !== 'SKIPPED') {
        const ocSeverity = String(ocular.severity || ocular.prioridad_clinica_global || 'LOW').toUpperCase();
        const ocFindings = ocular.findings || ocular.summary || ocular.sintesis_fisiopatologica || '';
        const ocFlags = Array.isArray(ocular.clinical_flags) ? ocular.clinical_flags.join(' . ') : '';
        const ocStructuredClauses = flattenVisionObjectClauses({
            pilares: ocular.pilares,
            microcirculacion_escleral: ocular.microcirculacion_escleral,
            tejido_periorbital: ocular.tejido_periorbital
        }).join(' . ');
        const fullOcText = `${ocFindings} . ${ocFlags} . ${ocStructuredClauses}`;
        const negOpticalRe = /\b(?:sin\s+|no\s+se\s+observa|no\s+evaluable|falta\s+de\s+eversi[óo]n|ausentes?|normal|transparente|conservad[oa]s?|descartad[oa]s?|libre\s+de)\b/i;

        // 1. Palidez conjuntival real (excluyendo "No evaluable" o "Sin palidez") -> Nodo 5 y Nodo 1
        const hasTruePallor = hasAffirmativeOpticalSign(fullOcText, /\b(?:palidez\s+conjuntival|conjunctival_pallor|hipocrom[íi]a\s+marcada|anemia\s+moderada)\b/i, negOpticalRe);
        if (hasTruePallor && !(Number(labValues.hemoglobin) >= 13.5)) {
            pushAnomaly('NODO_5_TRANSPORTE', 'OCULAR_VISION', 'Hipoperfusión Mucosa Conjuntival',
                'Signo de hipocromía microvascular detectable en lecho conjuntival evaluado', ocSeverity === 'HIGH' ? 'ALTA' : 'MODERADA');
            pushAnomaly('NODO_1_ASIMILACION', 'OCULAR_VISION', 'Vigilancia de Absorción de Micronutrientes Hematopoyéticos',
                'Hipocromía conjuntival sugestiva de demanda en reserva de hierro y cofactores hematopoyéticos', 'MODERADA');
        }

        // 2. Esclera ictérica real (excluyendo "Sin ictericia" o "Esclera blanca") -> Nodo 2
        const hasTrueScleralIcterus = hasAffirmativeOpticalSign(fullOcText, /\b(?:ictericia|subictericia|tinte\s+ict[ée]rico|scleral_icterus)\b/i, negOpticalRe);
        if (hasTrueScleralIcterus) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'OCULAR_VISION', 'Cromatismo Escleral Hepatobiliar',
                'Tinte subictérico escleral compatible con demanda funcional en vías de conjugación hepatobiliar', 'ALTA');
        }

        // 3. Arco corneal / Xantelasmas reales (excluyendo "Ausente") -> Nodo 3 y Nodo 5
        const explicitArcoField = String(
            ocular?.pilares?.cardiovascular_lipidos?.arco_senil_corneal ||
            ocular?.tejido_periorbital?.deposito_lipidico_corneal ||
            ''
        );
        const hasExplicitArcusField = Boolean(explicitArcoField && !/ausente|sin\s+arco|negativo/i.test(explicitArcoField) && /grado|incipiente|presente|leve|moderad|sever|arco/i.test(explicitArcoField));
        const hasTrueCornealArcus = hasExplicitArcusField || hasAffirmativeOpticalSign(fullOcText, /\b(?:arco\s+senil|arco\s+corneal|deposito_lipidico_corneal|gerontoxon|xantelasma)\b/i, negOpticalRe);
        if (hasTrueCornealArcus) {
            const arcusGradeNote = explicitArcoField ? ` (${sanitizeClinicalSpanish(explicitArcoField)})` : '';
            const lipidCorrSuffix = (Number(labValues.ldl) >= 130 || Number(labValues.sdLdl) > 1.35)
                ? ` correlacionado con perfil lipoproteico sérico (LDL ${labValues.ldl || '--'} mg/dL${labValues.sdLdl ? ` • sdLDL ${labValues.sdLdl}` : ''})`
                : ' correlacionable con transporte lipoproteico';
            pushAnomaly('NODO_3_ENERGIA', 'OCULAR_VISION', `Arco Corneal Limbar${arcusGradeNote}`,
                `Depósito lipídico periférico en limbo corneal bilateral (OD+OI)${lipidCorrSuffix}`, 'MODERADA');
            pushAnomaly('NODO_5_TRANSPORTE', 'OCULAR_VISION', `Arco Corneal Limbar${arcusGradeNote} y Microvasculatura Epiescleral`,
                `Hallazgo óptico bilateral en limbo corneal${lipidCorrSuffix}`, 'MODERADA');
        }

        const hasMicrovascularHyperemia = hasAffirmativeOpticalSign(fullOcText, /\b(?:tortuosidad|hiperemia|congesti[óo]n\s+epiescleral)\b/i, negOpticalRe);
        if (ocFindings && !isPhysiologicallyNormal(ocSeverity) && (hasMicrovascularHyperemia || (!hasTruePallor && !hasTrueScleralIcterus && !hasTrueCornealArcus && ocFlags))) {
            pushAnomaly('NODO_5_TRANSPORTE', 'OCULAR_VISION', 'Trofismo Microvascular Epiescleral y Bulbar', `${ocFindings} ${ocFlags ? `[${ocFlags}]` : ''}`.trim(), ocSeverity === 'HIGH' ? 'ALTA' : 'MODERADA');
        }
    }

    // E. Hallazgos de Glosodiagnóstico 6 Ejes (Paso 3 de Fase 18)
    const isDigestiveEubiosisInSerum = !digestiveProfile.has_issues &&
        (!Array.isArray(digestiveProfile.symptoms) || digestiveProfile.symptoms.length === 0) &&
        (!Array.isArray(patientData?.history?.digestive_symptoms) || patientData.history.digestive_symptoms.length === 0);
    const lingual = patientData?.scan_data?.lingual_metrics || patientData?.lingual_metrics || patientData?.glosodiagnostico;
    if (lingual && lingual.status !== 'SKIPPED') {
        const lgFindings = lingual.findings || lingual.summary || lingual.sintesis_fisiopatologica || '';
        const lgFlags = Array.isArray(lingual.clinical_flags) ? lingual.clinical_flags.join(' . ') : '';
        const lgStructuredClauses = flattenVisionObjectClauses({
            pilares: lingual.pilares,
            cuerpo_lingual: lingual.cuerpo_lingual,
            saburra_microbiota: lingual.saburra_microbiota
        }).join(' . ');
        const fullLgText = `${lgFindings} . ${lgFlags} . ${lgStructuredClauses}`;
        const negLingualRe = /\b(?:sin\s+|no\s+se\s+observa|ausentes?|normal|fisiol[óo]gic[oa]s?|conservad[oa]s?|adecuad[oa]s?|libre\s+de)\b/i;

        // 1. Saburra espesa / amarilla / blanca moderada-marcada y marcas dentales -> Nodo 1
        const explicitIndent = String(lingual?.cuerpo_lingual?.indentaciones_dentales || lingual?.pilares?.funcion_hepatica_renal_hidratacion?.marcas_dentales_festoneado || '');
        const explicitSaburra = String(lingual?.saburra_microbiota?.grosor || lingual?.pilares?.gastrointestinal_microbioma?.saburra_grosor || '');
        const hasExplicitLingualTopo =
            (!/ausent|sin\s+/i.test(explicitIndent) && /marcad|festonead|bilateral|edema|leve|moderad/i.test(explicitIndent)) ||
            (!/ausent|liger|delgad|normal/i.test(explicitSaburra) && /moderad|espes|abundante/i.test(explicitSaburra));
        const hasLingualCoatingOrScalloping = hasExplicitLingualTopo || hasAffirmativeOpticalSign(fullLgText, /\b(?:saburra\s+(?:espesa|moderada|amarillenta)|marcas_dentales_festoneado|indentaciones_dentales|scalloped|festonead[oa]|indentaci[óo]n)\b/i, negLingualRe);
        if (hasLingualCoatingOrScalloping) {
            pushAnomaly('NODO_1_ASIMILACION', 'LINGUAL_VISION', 'Topografía Lingual: Saburra Dorsal e Indentación Marginal',
                isDigestiveEubiosisInSerum
                    ? 'Saburra dorsal moderada e indentaciones marginales bilaterales por equilibrio hidrosalino y tránsito digestivo pausado (en paciente asintomático con eubiosis clínica)'
                    : 'Topografía lingual con capa saburral o bordes festoneados sugestivos de tránsito digestivo lento y demanda prebiótica',
                'MODERADA');
        }

        // 2. Bordes eritematosos reales -> Nodo 2
        if (hasAffirmativeOpticalSign(fullLgText, /\b(?:bordes\s+rojizos|bordes\s+eritematosos|hiperemia\s+lateral)\b/i, negLingualRe)) {
            pushAnomaly('NODO_2_BIOTRANSFORMACION', 'LINGUAL_VISION', 'Hiperemia Marginal Lingual',
                'Eritema en bordes laterales linguales compatible con demanda funcional digestivo-biliar', 'MODERADA');
        }

        // 3. Punta roja -> Nodo 4
        if (hasAffirmativeOpticalSign(fullLgText, /\b(?:punta\s+roja|red\s+tip|eritema\s+apical|hiperemia\s+apical)\b/i, negLingualRe)) {
            pushAnomaly('NODO_4_COMUNICACION', 'LINGUAL_VISION', 'Hiperemia Apical Lingual (Carga Neurovegetativa)',
                'Eritema en ápice lingual sugestivo de demanda adaptativa al estrés y vigilia prolongada', 'MODERADA');
        }

        // 4. Venas sublinguales ingurgitadas -> Nodo 5
        const explicitSublingual = String(lingual?.pilares?.cardiovascular_oxigenacion?.estasis_venosa_sublingual || '');
        const hasExplicitSublingual = Boolean(explicitSublingual && !/ausent|normal|sin\s+/i.test(explicitSublingual) && /tortuos|ingurgit|marcad|moderad|varic|várices|estasis/i.test(explicitSublingual));
        if (hasExplicitSublingual || hasAffirmativeOpticalSign(fullLgText, /\b(?:ingurgitaci[óo]n|varices\s+sublinguales|várices\s+sublinguales|estasis\s+sublingual|venas\s+raninas|viol[áa]ce[oa])\b/i, negLingualRe)) {
            pushAnomaly('NODO_5_TRANSPORTE', 'LINGUAL_VISION', 'Ingurgitación y Tortuosidad de Venas Raninas Sublinguales',
                'Dilatación microvascular en cara ventral lingual compatible con estasis venosa sublingual y demanda de retorno venoso', 'MODERADA');
        }
    }

    // F. Hallazgos de Evidencia Somática Multi-Foto y Mapa Corporal (Paso 5 de Fase 18 + VisualBodyMap)
    const visual = patientData?.scan_data?.visual_metrics;
    const somaticFindings = patientData?.somatic_findings || patientData?.body_zones || patientData?.VisualBodyMap || patientData?.mapaCorporal || [];
    const allSomaticItems = [];

    if (visual && visual.status !== 'SKIPPED') {
        const vItems = Array.isArray(visual.items) ? visual.items : [];
        if (vItems.length > 0) {
            allSomaticItems.push(...vItems);
        } else if (visual.findings) {
            allSomaticItems.push({ region: 'Superficie Corporal', finding: visual.findings, clinical_flags: visual.clinical_flags, severity: visual.severity });
        }
    }

    if (Array.isArray(somaticFindings)) {
        somaticFindings.forEach(sf => {
            if (typeof sf === 'string') {
                allSomaticItems.push({ region: 'Mapa Corporal', finding: sf, severity: 'MODERADA' });
            } else if (typeof sf === 'object') {
                allSomaticItems.push({
                    region: sf.zone || sf.region || sf.label || sf.bodyPart || 'Zona Corporal',
                    finding: sf.finding || sf.notes || sf.description || sf.symptom || 'Hallazgo somático reportado',
                    severity: sf.severity || 'MODERADA',
                    clinical_flags: sf.clinical_flags || sf.flags || []
                });
            }
        });
    }

    if (allSomaticItems.length > 0) {
        const globalVisFlags = Array.isArray(visual?.clinical_flags) ? visual.clinical_flags.join(', ') : '';
        allSomaticItems.forEach((it, idx) => {
            const region = it.region || `Zona #${idx + 1}`;
            const desc = it.finding || '';
            const flags = [
                Array.isArray(it.clinical_flags) ? it.clinical_flags.join(', ') : (it.clinical_flags || ''),
                globalVisFlags
            ].filter(Boolean).join(', ');
            const fullSomText = `${region} ${desc} ${flags}`.toUpperCase();
            const sev = String(it.severity || 'MODERADA').toUpperCase();

            // 1. Acantosis nigricans o adiposidad localizada -> Nodo 3
            if (fullSomText.includes('ACANTOSIS') || fullSomText.includes('NIGRICANS') || fullSomText.includes('ADIPOSIDAD') || fullSomText.includes('GRASA LOCALIZADA') || (fullSomText.includes('CUELLO') && fullSomText.includes('OSCURA'))) {
                pushAnomaly('NODO_3_ENERGIA', 'SOMATIC_VISION', `Acantosis Nigricans / Adiposidad (${region})`,
                    `${desc} ${flags ? `[${flags}]` : ''}. Marcador cutáneo de hiperinsulinemia y resistencia a la insulina`, sev === 'ALTA' || sev === 'CRÍTICA' ? 'ALTA' : 'MODERADA');
            }

            // 2. Edema maleolar, insuficiencia/estasis venosa, pigmentación ocre/hemosiderínica o extravasación distal -> Nodo 5
            if (/(?:EDEMA|MALEOLAR|VENOS[OA]|VARICES|VÁRICES|HEMOSIDER[IÍ]N|ESTASI|OCRE|EXTRAVASACI[ÓO]N|CIANOSIS)/i.test(fullSomText)) {
                pushAnomaly('NODO_5_TRANSPORTE', 'SOMATIC_VISION', `Estasis Venosa Cutánea y Cambios Hemosiderínicos (${region})`,
                    `${desc}. Compromiso microcirculatorio de retorno venoso periférico`, sev === 'ALTA' || sev === 'CRÍTICA' ? 'ALTA' : 'MODERADA');
            }

            // 3. Dermatitis, eccema, psoriasis o lesiones en piel -> Nodo 6 (Defensa) y Nodo 1 (solo cuando no exista eubiosis clínica estricta o sea mucocutánea generalizada)
            if (fullSomText.includes('DERMATITIS') || fullSomText.includes('ECCEMA') || fullSomText.includes('ECZEMA') || fullSomText.includes('PSORIASIS') || fullSomText.includes('ERITEMA') || fullSomText.includes('ERUPCION') || fullSomText.includes('ERUPCIÓN') || fullSomText.includes('PRURITO') || fullSomText.includes('LESION') || fullSomText.includes('LESIÓN')) {
                pushAnomaly('NODO_6_DEFENSA', 'SOMATIC_VISION', `Reactividad Cutánea Microvascular (${region})`,
                    `${desc}. Demanda de reparación epitelial y antioxidante dérmica`, 'MODERADA');
                if (!isDigestiveEubiosisInSerum) {
                    pushAnomaly('NODO_1_ASIMILACION', 'SOMATIC_VISION', `Eje Intestino-Piel (${region})`,
                        'Manifestación dérmica vinculada a sensibilidad mucosa e inmunotolerancia', 'MODERADA');
                }
            }

            // 4. Inflamación o dolor articular / musculoesquelético -> Nodo 7
            if (fullSomText.includes('ARTICULAR') || fullSomText.includes('RODILLA') || fullSomText.includes('DOLOR') || fullSomText.includes('INFLAMACION') || fullSomText.includes('INFLAMACIÓN') || fullSomText.includes('ARTROSIS') || fullSomText.includes('ARTRITIS') || fullSomText.includes('COLUMNA') || fullSomText.includes('LUMBAR') || fullSomText.includes('CERVICAL') || fullSomText.includes('HOMBRO')) {
                pushAnomaly('NODO_7_ESTRUCTURAL', 'SOMATIC_VISION', `Compromiso Estructural / Articular (${region})`,
                    `${desc} ${flags ? `[${flags}]` : ''}. Alteración de la integridad biomecánica y articular`, sev === 'ALTA' || sev === 'CRÍTICA' ? 'ALTA' : 'MODERADA');
            }
        });
    }

    const numericLabKeys = Object.keys(labValues).filter(
        (k) => typeof labValues[k] === 'number' && Number.isFinite(labValues[k])
    );
    const hasLabResultsLoaded = numericLabKeys.length > 0;

    // Regla Universal A + B + Ajuste 5 (EGM-49): Ejecutar Precedencia Biomédica (Sangre Venosa > Gabinete > Bioimpedancia)
    // ANTES de construir `nodes[]`, podando de raíz cualquier hallazgo bioeléctrico/óptico contradicho por química sanguínea normal.
    let precedence = {
        venousRenalNormal: false,
        venousHepaticNormal: false,
        hasGfrStageG2: false,
        isHistoricalLab: Boolean(labVigencia?.is_historical || (Number(labVigencia?.age_days) > 180))
    };
    let subAxisFlags = {
        hasTrueDysglycemia: false,
        hasVenousNormoglycemia: false,
        hasHypertriglyceridemia: false,
        hasVenousNormalTriglycerides: false,
        hasAtherogenicCholesterol: false,
        hasAcutePhaseInflammation: false,
        hasDistalVenousStasis: false
    };

    try {
        const hasVenousRenal = Number(labValues.creatinine) > 0;
        const venousRenalNormal =
            hasVenousRenal &&
            labValues.creatinine <= 1.2 &&
            (!labValues.uricAcid || labValues.uricAcid <= 7.0) &&
            (!labValues.bun || labValues.bun <= 23) &&
            (!labValues.gfr || labValues.gfr >= 60);

        const hasVenousHepatic = Number(labValues.ast) > 0 && Number(labValues.alt) > 0;
        const venousHepaticNormal =
            hasVenousHepatic &&
            labValues.ast <= 40 &&
            labValues.alt <= 61 &&
            (!labValues.ggt || labValues.ggt <= 61) &&
            (!labValues.bilirubin || labValues.bilirubin <= 1.2);

        if (venousRenalNormal) {
            electretSignals.hasRenalBurden = false;
            electretSignals.hasSevereRenalAlert = false;
            nodesMap.NODO_2_BIOTRANSFORMACION.anomalies = nodesMap.NODO_2_BIOTRANSFORMACION.anomalies.filter((a) => {
                if (a.source !== 'ELECTRET') return true;
                return !/(?:proteinuria|[áa]cido\s+[úu]rico|acido\s+urico|nitr[óo]geno\s+ureico|creatinina|urobilin[óo]geno|fun[cç]i[óo]n\s+renal)/i.test(a.label);
            });
        }
        if (venousHepaticNormal) {
            electretSignals.hasHepaticBurden = false;
            electretSignals.hasBiliaryBurden = false;
            nodesMap.NODO_2_BIOTRANSFORMACION.anomalies = nodesMap.NODO_2_BIOTRANSFORMACION.anomalies.filter((a) => {
                if (a.source === 'ELECTRET') {
                    return !/(?:grasa\s+en\s+el\s+h[íi]gado|higado\s+graso|bilirrubina|transaminasa|ves[íi]cula|biliar)/i.test(a.label);
                }
                if (a.source === 'OCULAR_VISION' || a.source === 'LINGUAL_VISION') {
                    return !/(?:hepatobiliar|ict[ée]ric|subict[ée]ric|fuego\s+hep[áa]tico)/i.test(`${a.label} ${a.detail}`);
                }
                return true;
            });
        }

        const hasGfrStageG2 = Number(labValues.gfr) >= 60 && Number(labValues.gfr) < 90;
        if (venousRenalNormal && hasGfrStageG2) {
            const alreadyHasGfrNote = nodesMap.NODO_2_BIOTRANSFORMACION.anomalies.some((a) => /filtrado\s+glomerular|tfge/i.test(a.label));
            if (!alreadyHasGfrNote) {
                pushAnomaly(
                    'NODO_2_BIOTRANSFORMACION',
                    'OCR_LAB',
                    'Tasa de Filtración Glomerular Estimada (TFGe — Seguimiento Preventivo)',
                    `${labValues.gfr} mL/min/1.73 m² (Estadio funcional intermedio KDIGO G2 con Creatinina ${labValues.creatinine} mg/dL y Ácido úrico ${labValues.uricAcid || 'normal'} mg/dL en rango fisiológico)`,
                    'MODERADA'
                );
            }
        }

        if (Number(labValues.serumCalcium) > 0 && labValues.serumCalcium <= 10.2) {
            hasHighSerumCalciumOrCalcification = Boolean(electretSignals.hasCalcificationAlert);
        }

        precedence = {
            venousRenalNormal,
            venousHepaticNormal,
            hasGfrStageG2,
            isHistoricalLab: Boolean(labVigencia?.is_historical || (Number(labVigencia?.age_days) > 180)),
            studyDateDisplay: labVigencia?.study_date_display || null
        };

        const hasVenousNormoglycemia =
            Number(labValues.glucose) > 0 &&
            labValues.glucose < 100 &&
            (!labValues.hba1c || labValues.hba1c < 5.7) &&
            (!labValues.homaIr || labValues.homaIr <= 2.5) &&
            (!glu || glu < 100);

        if (hasVenousNormoglycemia) {
            nodesMap.NODO_3_ENERGIA.anomalies = nodesMap.NODO_3_ENERGIA.anomalies.filter((a) => {
                if (a.source !== 'ELECTRET') return true;
                return !/(?:insulina|glucosa|az[úu]car\s+en\s+la\s+sangre|gluc[óo]geno)/i.test(a.label);
            });
        }

        const hasVenousNormalTriglycerides = Number(labValues.triglycerides) > 0 && labValues.triglycerides < 150;
        if (hasVenousNormalTriglycerides) {
            nodesMap.NODO_3_ENERGIA.anomalies = nodesMap.NODO_3_ENERGIA.anomalies.filter((a) => {
                if (a.source !== 'ELECTRET') return true;
                return !/triglic[ée]rido/i.test(a.label);
            });
        }

        const electretGlycemicAltered = nodesMap.NODO_3_ENERGIA.anomalies.some(
            (a) => a.source === 'ELECTRET' && /insulina|glucosa|az[úu]car/i.test(a.label)
        );

        const hasTrueDysglycemia = Boolean(
            glu >= 100 ||
            Number(labValues.glucose) >= 100 ||
            Number(labValues.hba1c) >= 5.7 ||
            Number(labValues.homaIr) > 2.5 ||
            (!hasVenousNormoglycemia && electretGlycemicAltered)
        );

        const hasHypertriglyceridemia = Boolean(Number(labValues.triglycerides) >= 150);
        const hasAtherogenicCholesterol = Boolean(
            Number(labValues.totalCholesterol) >= 200 ||
            Number(labValues.ldl) >= 130 ||
            Number(labValues.nonHdl) >= 130 ||
            Number(labValues.sdLdl) > 1.35 ||
            Number(labValues.atherogenicIndex) >= 4.5
        );
        const hasAcutePhaseInflammation = Boolean(
            Number(labValues.hscrpMgL) > 3.0 ||
            Number(labValues.vsg) > 20 ||
            Number(labValues.ferritin) > 300
        );
        const hasDistalVenousStasis = Boolean(
            nodesMap.NODO_5_TRANSPORTE.anomalies.some((a) =>
                a.source === 'SOMATIC_VISION' || /resistencia\s+vascular|col[áa]geno.*circulatorio|estasis|ocre|venos/i.test(`${a.label} ${a.detail}`)
            )
        );

        subAxisFlags = {
            hasTrueDysglycemia,
            hasVenousNormoglycemia,
            hasHypertriglyceridemia,
            hasVenousNormalTriglycerides,
            hasAtherogenicCholesterol,
            hasAcutePhaseInflammation,
            hasDistalVenousStasis
        };

        // Precedencia Antropométrica Física (Fase 16 Cinta/Báscula) > Bioimpedancia Electret + Ajuste de Hipoxia por Altitud (EGM-50)
        if (hasPhysicalTapeIcc) {
            ['NODO_3_ENERGIA', 'NODO_7_ESTRUCTURAL'].forEach((nKey) => {
                nodesMap[nKey].anomalies = nodesMap[nKey].anomalies.filter((a) => {
                    if (a.source !== 'ELECTRET') return true;
                    return !/(?:relaci[óo]n\s+cintura[-\s]*cadera|\brcc\b|waist[-\s]*hip)/i.test(a.label);
                });
            });
        }
        if (hasPhysicalScaleBmi && isAthleticHighLeanMass) {
            ['NODO_3_ENERGIA', 'NODO_7_ESTRUCTURAL'].forEach((nKey) => {
                nodesMap[nKey].anomalies = nodesMap[nKey].anomalies.filter((a) => {
                    if (a.source !== 'ELECTRET') return true;
                    return !/(?:[íi]ndice\s+de\s+masa\s+corporal|\bimc\b|sobrepeso|obesidad)/i.test(a.label);
                });
            });
        }
        if (spo2 > 0 && spo2 >= altitudeInfo.spo2NormalFloor) {
            nodesMap.NODO_5_TRANSPORTE.anomalies = nodesMap.NODO_5_TRANSPORTE.anomalies.filter((a) => {
                if (a.source !== 'ELECTRET') return true;
                return !/^hipoxia$/i.test(String(a.label || '').trim());
            });
        }
    } catch (precErr) {
        console.warn('⚠️ [Precedence Engine Safe Catch]:', precErr.message);
    }

    // Deduplicación estricta de hallazgos intra-nodo (EGM-50) + Fallback Regulatorio de Nodo Huérfano (EGM-71 Fallo #2)
    const nodes = Object.values(nodesMap).map((node) => {
        const seenNodeAnomalyKeys = new Set();
        const dedupedAnomalies = (node.anomalies || []).filter((a) => {
            const k = `${String(a?.source || '').toUpperCase()}::${normalizeForMatch(a?.label || '')}`;
            if (seenNodeAnomalyKeys.has(k)) return false;
            seenNodeAnomalyKeys.add(k);
            return true;
        });
        node.anomalies = dedupedAnomalies;
        const hasAnomalies = dedupedAnomalies.length > 0;
        const movedElectretCount = Number(electretCountByNode[node.id] || 0);
        const resolvedAxis = resolveFunctionalAxisForNode(node.id, dedupedAnomalies, patientData, isLactanteExplicit);
        return {
            ...node,
            hasAnomalies,
            anomaliesCount: dedupedAnomalies.length,
            hasMovedElectretSignals: movedElectretCount > 0,
            movedElectretCount,
            orientativeElectretTopics: electretFriendlyTopicsByNode[node.id] || [],
            preAssignedCie10: hasAnomalies ? resolvedAxis.accredited_cie10 : null,
            accredited_cie10: hasAnomalies ? resolvedAxis.accredited_cie10 : null,
            functionalCode: resolvedAxis.functionalCode,
            preAssignedLabel: resolvedAxis.label,
            validation_status: 'VALIDADO',
            requires_clinical_review: Boolean(hasAnomalies && resolvedAxis.requires_clinical_review)
        };
    });

    const electretInformativeAnnex = {
        title: 'ANEXO INFORMATIVO (FUERA DE NOTA MÉDICA NOM-004) — TAMIZAJE BIOFÍSICO ORIENTATIVO NO DIAGNÓSTICO',
        disclaimer: 'Los siguientes parámetros provienen de bioimpedancia bioeléctrica orientativa (.HTM) y NO constituyen diagnóstico médico, toxicológico ni prueba de laboratorio acreditada conforme a NOM-004-SSA3-2012 y COFEPRIS. Se consignan únicamente como referencia preventiva complementaria fuera de la nota médica.',
        totalItems: electretAnnexItems.length + auxiliaryBioenergetics.length,
        items: electretAnnexItems,
        meridianItems: auxiliaryBioenergetics
    };

    const priorAdherence = detectPriorInstitutionalAdherence(patientData);
    const logisticsSummary = translateLogisticsProfile(patientData);
    const hasClinicalAllergies = foodAllergies.length > 0 || drugAllergies.length > 0;
    const n5Anoms = nodesMap.NODO_5_TRANSPORTE.anomalies || [];
    const multimodalTriad = {
        hasCornealArcus: n5Anoms.some((a) => a.source === 'OCULAR_VISION' && /arco\s+corneal|limbar/i.test(a.label)),
        hasSublingualVenousStasis: n5Anoms.some((a) => a.source === 'LINGUAL_VISION' && /raninas|sublingual/i.test(a.label)),
        hasLowerLimbVenousStasis: n5Anoms.some((a) => a.source === 'SOMATIC_VISION' && /estasis|hemosider/i.test(a.label)),
        hasCirculatoryCollagenLow: (nodesMap.NODO_7_ESTRUCTURAL.anomalies || []).some((a) => /col[áa]geno.*circulatorio/i.test(a.label))
    };

    const baseSerumReturn = {
        nodes,
        anamnesisUnified: anamnesis,
        hasHighSerumCalciumOrCalcification,
        combinedExclusions,
        labValues,
        labVigencia,
        unitConversionsApplied,
        cabinetSignals,
        precedence,
        subAxisFlags,
        hasLabResultsLoaded,
        electretSignals,
        auxiliaryBioenergetics,
        electretInformativeAnnex,
        unmappedOntologyWarnings,
        altitudeInfo,
        routeContext,
        priorAdherence,
        logisticsSummary,
        isClinicalEubiosis: isDigestiveEubiosisInSerum,
        hasClinicalAllergies,
        multimodalTriad,
        vitalsSnapshot: {
            sys,
            dia,
            glu,
            spo2,
            waist,
            hip,
            icc,
            ica,
            weightKg: weightPhys || null,
            heightCm: heightCmPhys || null,
            bmi: bmiPhys,
            bodyFatPct: bodyFatPhys > 0 ? bodyFatPhys : null,
            hasPhysicalTapeIcc,
            hasPhysicalScaleBmi,
            isAthleticHighLeanMass
        },
        anamnesisUnified: anamnesis,
        anamnesis360Context: {
            chiefComplaint: sanitizeClinicalSpanish(patientQuote),
            pathologiesCount: anamnesis.unifiedPathologies.length,
            epigeneticSurveillance,
            highRiskVitals: sys >= 130 || glu >= 100,
            combinedExclusions,
            isPregnant,
            isLactating,
            gestationWeeks
        }
    };
    baseSerumReturn.nom004Sheet = extractNom004IdentificationSheet(patientData, baseSerumReturn, null);
    baseSerumReturn.dietaryEpigeneticSynthesis = extractDietaryAndEpigeneticSynthesis(patientData, baseSerumReturn, null);
    baseSerumReturn.scheduledAppointmentSummary = resolveScheduledAppointmentSummary(patientData);
    return baseSerumReturn;
}

// ============================================================================
// 4. MOTOR SSoTT (SINGLE SOURCE OF THERAPEUTIC TRUTH) + SÍNTESIS OBSERVACIONAL UNIFICADA
// ============================================================================
const IFM_BATCH_SUMMARY_SCHEMA = {
    type: 'OBJECT',
    properties: {
        nodes: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    nodeId: { type: 'STRING', description: 'Identificador exacto del Nodo IFM' },
                    status: { type: 'STRING', enum: ['HOMEOSTASIS', 'ALERTA_MODERADA', 'PRIORIDAD_ALTA', 'CRÍTICO'] },
                    summary: { type: 'STRING', description: 'Narrativa fisiopatológica observacional concisa en español (1 a 2 oraciones, cero prescripciones)' }
                },
                required: ['nodeId', 'status', 'summary']
            }
        }
    },
    required: ['nodes']
};

const SEVERITY_RANK = { CRÍTICA: 4, ALTA: 3, MODERADA: 2, LEVE: 1 };

const FORBIDDEN_SUMMARY_CLAIMS_REGEX = /(?<![\p{L}\p{N}_])(quelaci[óo]n|silimarina|glutati[óo]n|hipocal[óo]ric[ao]s?|nutriketo|cetog[ée]nic[ao]s?|fitoterapia|intoxicaci[óo]n|envenenamiento|suplementaci[óo]n\s+(?:dirigida\s+|espec[íi]fica\s+)?con)(?![\p{L}\p{N}_])/iu;
const UNCONFIRMED_NOSOLOGY_WITHOUT_LABS_REGEX = /(?<![\p{L}\p{N}_])(esteatosis\s+hep[áa]tica|acumulaci[óo]n\s+(?:significativa\s+|severa\s+)?de\s+metales\s+pesados|deficiencia\s+(?:relativa\s+|severa\s+)?de\s+yodo)(?![\p{L}\p{N}_])/iu;

/**
 * Motor Universal de Macronutrientes y Patrón Alimentario (Directiva 1.E — EGM-49).
 * Ajusta dinámicamente carbohidratos, proteínas y lípidos según fenotipo metabólico,
 * función renal, dislipidemia aterogénica, glucemia, etapa vital y preferencias de entrevista.
 */
function resolveDynamicMacronutrientsAndRegimen(opts = {}) {
    const {
        patientData = {},
        serum = null,
        bioenergetics = null,
        isLactanteExplicit = false,
        isPediatricExplicit = false
    } = opts;
    const ageYears = opts.ageYears ?? bioenergetics?.age ?? bioenergetics?.ageYears ?? 35;
    const bmi = opts.bmi ?? bioenergetics?.bmi ?? 24;
    const labValues = opts.labValues || serum?.labValues || {};
    const subAxisFlags = opts.subAxisFlags || serum?.subAxisFlags || {};
    const anamnesis = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
    const isAthletic = Boolean(bioenergetics?.isAthleticHighLeanMass || opts.isAthleticHighLeanMass);
    const suffixRules = anamnesis.isVegan
        ? `0 Picante • 100 % Basada en Plantas • 0 Azúcares refinados${anamnesis.hasCeliacOrGlutenFree ? ' • 0 Gluten' : ''}`
        : `0 Picante • 0 Cerdo • 0 Azúcares refinados${anamnesis.hasCeliacOrGlutenFree ? ' • 0 Gluten' : ''}`;
    const plantSuffixTitle = anamnesis.isVegan ? ' (100 % Basada en Plantas)' : (anamnesis.isVegetarian ? ' (Ovolactovegetariana)' : '');

    try {
        if (isLactanteExplicit) {
            return {
                macros: { carbs: 50, protein: 15, fat: 35 },
                regimen: 'Alimentación Pediátrica Guiada (L-OMS)',
                regimenBadge: 'Alimentación Pediátrica L-OMS (Supervisión Pediátrica)'
            };
        }
        if (isPediatricExplicit) {
            return {
                macros: { carbs: 48, protein: 22, fat: 30 },
                regimen: `Alimentación Integral de Crecimiento y Desarrollo${plantSuffixTitle}`,
                regimenBadge: `Nutrición Integral de Desarrollo (${suffixRules})`
            };
        }

        if (anamnesis.isPregnant || bioenergetics?.isPregnant) {
            return {
                macros: { carbs: 48, protein: 22, fat: 30 },
                regimen: `Alimentación Materno-Fetal Equilibrada sin Restricción Calórica (NOM-043)${plantSuffixTitle}`,
                regimenBadge: `Nutrición Gestacional Protectora (${suffixRules})`
            };
        }
        if (anamnesis.isLactating || bioenergetics?.isLactating) {
            return {
                macros: { carbs: 48, protein: 22, fat: 30 },
                regimen: `Alimentación de Soporte en Lactancia Materna (NOM-043)${plantSuffixTitle}`,
                regimenBadge: `Soporte Nutricional en Lactancia (${suffixRules})`
            };
        }

        if (anamnesis.isKeto && !anamnesis.hasSevereRenalHistory && !(Number(labValues.gfr) > 0 && Number(labValues.gfr) < 60)) {
            return {
                macros: { carbs: 10, protein: 30, fat: 60 },
                regimen: `Alimentación Cetogénica Clínica Antiinflamatoria${plantSuffixTitle}`,
                regimenBadge: `NutriKeto Clínico (${suffixRules})`
            };
        }

        const gfrVal = Number(labValues.gfr || 0);
        const crVal = Number(labValues.creatinine || 0);
        const hasSeverePreDialysisRenal = !anamnesis.isDialysisActive && (
            anamnesis.hasSevereRenalHistory ||
            (gfrVal > 0 && gfrVal < 45) ||
            crVal >= 1.5
        );
        const hasMildRenalStageG3a = !anamnesis.isDialysisActive && !hasSeverePreDialysisRenal && (
            (gfrVal >= 45 && gfrVal < 60) ||
            (crVal > 1.3 && crVal < 1.5)
        );
        const hasDysglycemia = Boolean(subAxisFlags?.hasTrueDysglycemia || Number(labValues.glucose) >= 100 || Number(labValues.hba1c) >= 5.7);
        const idealWt = Number(bioenergetics?.weights?.idealWeight || 65);
        const targetK = Number(bioenergetics?.targetKcal || bioenergetics?.tdee || 1950);

        // EGM-59: Cálculo nefroprotector por g/kg de peso ideal (KDOQI 0.6–0.8 g/kg pre-diálisis vs 1.15 g/kg en diálisis)
        if (anamnesis.isDialysisActive) {
            const gProtDialysis = Number((idealWt * 1.15).toFixed(1));
            const pctP = Math.max(16, Math.min(24, Math.round(((gProtDialysis * 4) / targetK) * 100)));
            const pctC = hasDysglycemia ? 38 : 46;
            const pctF = Math.max(25, 100 - pctC - pctP);
            return {
                macros: { carbs: pctC, protein: pctP, fat: pctF },
                proteinGramsPerDay: gProtDialysis,
                proteinGramsPerKgIdeal: 1.15,
                regimen: `Alimentación Nefroprotectora de Reposición en Diálisis (1.15 g prot/kg PI/día)${plantSuffixTitle}`,
                regimenBadge: `Pauta en Terapia Dialítica (${suffixRules})`
            };
        }

        if (hasSeverePreDialysisRenal) {
            const gProtPreDialysis = Number((idealWt * 0.70).toFixed(1));
            const pctP = Math.max(10, Math.min(15, Math.round(((gProtPreDialysis * 4) / targetK) * 100)));
            const pctC = hasDysglycemia ? 42 : 53;
            const pctF = Math.max(30, 100 - pctC - pctP);
            return {
                macros: { carbs: pctC, protein: pctP, fat: pctF },
                proteinGramsPerDay: gProtPreDialysis,
                proteinGramsPerKgIdeal: 0.70,
                regimen: `Alimentación Nefroprotectora Pre-Diálisis Controlada (0.7 g prot/kg PI/día • KDOQI)${hasDysglycemia ? ' y Bajo Índice Glucémico' : ''}${plantSuffixTitle}`,
                regimenBadge: `Nefroprotección Pre-Diálisis KDOQI (${suffixRules})`
            };
        }

        if (hasMildRenalStageG3a) {
            const gProtG3a = Number((idealWt * 0.80).toFixed(1));
            const pctP = Math.max(12, Math.min(18, Math.round(((gProtG3a * 4) / targetK) * 100)));
            const pctC = hasDysglycemia ? 38 : 47;
            const pctF = Math.max(30, 100 - pctC - pctP);
            return {
                macros: { carbs: pctC, protein: pctP, fat: pctF },
                proteinGramsPerDay: gProtG3a,
                proteinGramsPerKgIdeal: 0.80,
                regimen: `Alimentación Nefroprotectora Normoproteica Moderada (0.8 g prot/kg PI/día)${plantSuffixTitle}`,
                regimenBadge: `Pauta Nefroprotectora Controlada (${suffixRules})`
            };
        }

        // EGM-59: Protección energética y glucídica en Atletas con alta masa muscular magra
        if (isAthletic && !hasDysglycemia) {
            return {
                macros: { carbs: 50, protein: 25, fat: 25 },
                regimen: `Alimentación Deportiva de Rendimiento y Síntesis Miofibrilar${plantSuffixTitle}`,
                regimenBadge: `Nutrición Deportiva de Precisión (${suffixRules})`
            };
        }

        if (hasDysglycemia || (!isAthletic && Number(bmi) >= 28.5)) {
            return {
                macros: { carbs: 30, protein: 35, fat: 35 },
                regimen: `Pauta de Control Glucémico e Hiperproteica Moderada${plantSuffixTitle}`,
                regimenBadge: `Control Glucémico-Metabólico (${suffixRules})`
            };
        }

        if (subAxisFlags?.hasAtherogenicCholesterol || Number(labValues.ldl) >= 130 || Number(labValues.sdLdl) > 1.35 || Number(labValues.totalCholesterol) >= 200) {
            return {
                macros: { carbs: 35, protein: 30, fat: 35 },
                regimen: `Alimentación Mediterránea Cardioprotectora Antiinflamatoria (Rica en Ácidos Grasos Monoinsaturados y Fibra Soluble)${plantSuffixTitle}`,
                regimenBadge: `Mediterránea Cardioprotectora (${suffixRules})`
            };
        }

        if (ageYears >= 65) {
            return {
                macros: { carbs: 38, protein: 32, fat: 30 },
                regimen: `Alimentación de Preservación Osteomuscular y Vitalidad Senior${plantSuffixTitle}`,
                regimenBadge: `Preservación Osteomuscular (${suffixRules})`
            };
        }

        if (!isAthletic && Number(bmi) >= 26) {
            return {
                macros: { carbs: 35, protein: 35, fat: 30 },
                regimen: `Alimentación Funcional de Recomposición Corporal Antiinflamatoria${plantSuffixTitle}`,
                regimenBadge: `Recomposición Antiinflamatoria (${suffixRules})`
            };
        }

        return {
            macros: { carbs: 40, protein: 30, fat: 30 },
            regimen: anamnesis.isVegan
                ? 'Alimentación Basada en Plantas Antiinflamatoria Completa'
                : `Alimentación Funcional Antiinflamatoria Personalizada${plantSuffixTitle}`,
            regimenBadge: `Alimentación Antiinflamatoria (${suffixRules})`
        };
    } catch (_) {
        return {
            macros: { carbs: 40, protein: 30, fat: 30 },
            regimen: 'Alimentación Funcional Antiinflamatoria Personalizada',
            regimenBadge: `Alimentación Antiinflamatoria (${suffixRules})`
        };
    }
}

/**
 * Evalúa de forma determinista las causas universales de Pausa Selectiva de 33Plus® (EGM-49 + EGM-57):
 * Simpaticomiméticos centrales, IMAO, sustancias vasoactivas (Fase 10), crisis hipertensiva, taquiarritmia activa descontrolada o embarazo/lactancia.
 */
function detectSelective33PlusContraindication({
    patientData = {},
    serum = {},
    medications = null
} = {}) {
    try {
        const anamnesis = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
        const medsList = Array.isArray(medications) && medications.length > 0
            ? medications
            : anamnesis.unifiedMedications;
        const medsUpper = medsList.map((m) => String(m?.name || m || '').toUpperCase()).join(' | ');
        const pathUpper = anamnesis.pathUpper;

        const hasSympathomimetic = /(?:FENTERMINA|ACXION|TERFAMEX|METILFENIDATO|CONCERTA|RITALIN|ANFETAMINA|LISDEXANFETAMINA|VYVANSE|MODAFINILO|ARMODAFINILO|EFEDRINA|PSEUDOEFEDRINA|SIBUTRAMINA)/.test(medsUpper);
        const hasMaoInhibitor = /(?:FENELZINA|TRANILCIPROMINA|SELEGILINA|RASAGILINA|MOCLOBEMIDA|ISOCARBOXAZIDA|LINEZOLID|\bIMAO\b|INHIBIDOR(?:ES)?\s+DE\s+LA\s+MAO)/.test(medsUpper);
        const hasVasoactiveSubstance = Boolean(anamnesis.hasVasoactiveIllicitDrug);

        const vitalsSnap = serum?.vitalsSnapshot || {};
        const hrRest = Number(patientData?.vitals?.heart_rate || patientData?.vitals?.hr || serum?.cabinetSignals?.ecgHrBpm || 0);
        const hasHypertensiveCrisis = Number(vitalsSnap.sys) >= 160 || Number(vitalsSnap.dia) >= 100;
        const hasActiveUncontrolledTachyarrhythmia =
            Boolean(serum?.cabinetSignals?.hasActiveTachyarrhythmia) ||
            (hrRest >= 115 && !(Number(patientData?.age) < 12)) ||
            /(?:TAQUIARRITMIA\s+(?:ACTIVA|DESCONTROLADA)|FIBRILACI[ÓO]N\s+AURICULAR\s+DESCONTROLADA|TAQUICARDIA\s+(?:SUPRAVENTRICULAR|VENTRICULAR)|FLUTTER\s+AURICULAR)/.test(pathUpper);

        const isPregnant = Boolean(serum?.anamnesis360Context?.isPregnant || anamnesis.isPregnant);
        const isLactating = Boolean(serum?.anamnesis360Context?.isLactating || anamnesis.isLactating);

        const reasons = [];
        if (hasSympathomimetic) reasons.push('tratamiento activo con fármacos simpaticomiméticos centrales');
        if (hasMaoInhibitor) reasons.push('tratamiento activo con inhibidores de la monoaminooxidasa (IMAO)');
        if (hasVasoactiveSubstance) reasons.push('exposición declarada a sustancias vasoactivas/estimulantes');
        if (hasHypertensiveCrisis) reasons.push(`cifras tensionales en rango crítico (${vitalsSnap.sys}/${vitalsSnap.dia} mmHg)`);
        if (hasActiveUncontrolledTachyarrhythmia) reasons.push('taquiarritmia activa descontrolada');
        if (isPregnant) reasons.push('estado gestacional activo');
        if (isLactating) reasons.push('etapa de lactancia materna activa');

        return {
            isSelective33Paused: reasons.length > 0,
            hasSympathomimetic,
            hasMaoInhibitor,
            hasVasoactiveSubstance,
            hasHypertensiveCrisis,
            hasActiveUncontrolledTachyarrhythmia,
            isPregnant,
            isLactating,
            reasons,
            reasonText: reasons.join(', ')
        };
    } catch (_) {
        return {
            isSelective33Paused: false,
            reasons: [],
            reasonText: ''
        };
    }
}

/**
 * Evalúa Pausa Selectiva de 34Plus® ante Anticoagulantes Antagonistas de la Vitamina K (`EGM-58`):
 * Resuelve dinámicamente el activo Vitamina K2 MK-7 desde FORMULA_34PLUS.heroActives (cero claves estáticas).
 */
function detectSelective34PlusContraindication({
    patientData = {},
    serum = {},
    medications = null
} = {}) {
    try {
        const anamnesis = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
        const medsList = Array.isArray(medications) && medications.length > 0
            ? medications
            : anamnesis.unifiedMedications;
        const medsUpper = medsList.map((m) => String(m?.name || m || '').toUpperCase()).join(' | ');
        const hasCoumarin = Boolean(
            anamnesis.hasCoumarinAnticoagulant ||
            /(?:WARFARINA|COUMADIN|ACENOCUMAROL|SINTROM|ALDOCUMAR|FENPROCUM[ÓO]N)/.test(medsUpper)
        );
        const k2Active = getCatalogActiveDynamic(FORMULA_34PLUS, /VITAMINA\s+K2/i);
        const k2LabelClinical = k2Active
            ? `${k2Active.name} ${k2Active.code} (${k2Active.amountNumeric} ${k2Active.unit}/sobre)`
            : 'Vitamina K2 MK-7';
        const k2LabelPatient = k2Active ? k2Active.name : 'Vitamina K2 MK-7';

        const reasons = [];
        if (hasCoumarin) {
            reasons.push(`tratamiento anticoagulante antagonista de la Vitamina K (protección estricta de su índice INR frente a ${k2LabelPatient})`);
        }
        return {
            isSelective34Paused: reasons.length > 0,
            hasCoumarin,
            k2LabelClinical,
            k2LabelPatient,
            reasons,
            reasonText: reasons.join(', ')
        };
    } catch (_) {
        return {
            isSelective34Paused: false,
            hasCoumarin: false,
            reasons: [],
            reasonText: ''
        };
    }
}

/**
 * Motor Universal Multivariable de Estudio de Edad Metabólica (`calculateBidirectionalMetabolicAge` — EGM-51 v3 SSoTT).
 * Delega 1:1 al motor unificado `shared/metabolicAgeEngineSSoT.js` (`v3.4.0-EGM51-V3` de 6 dominios),
 * garantizando paridad matemática exacta (`0.000` divergencia) entre servidor Node y cliente React.
 */
function calculateBidirectionalMetabolicAge(rawPatientData = {}, precomputedSerum = null, precomputedBioenergetics = null) {
    const verifiedAge = resolveVerifiedPatientAge(rawPatientData, 35);
    const chronoAge = Number(verifiedAge.ageYears) || 35;
    const isFemale = resolveBackendPatientIsFemale(rawPatientData);
    const isLactante = Boolean(chronoAge < 2 && (verifiedAge.isLactanteVerified || rawPatientData?.isLactante === true));
    const isPediatric = Boolean(chronoAge < 18 && (isLactante || verifiedAge.isPediatricVerified || rawPatientData?.isPediatrico === true));

    try {
        const serum = precomputedSerum || distillClinicalSerum(rawPatientData, isLactante);
        const bio = precomputedBioenergetics || calculatePrecisionBioenergetics(rawPatientData, chronoAge, verifiedAge.ageMonths, isLactante, isPediatric);
        const altitudeInfo = serum?.altitudeInfo || resolvePatientAltitudeMsnm(rawPatientData);
        const study = calculateUniversalMetabolicAgeSSoT(rawPatientData, {
            verifiedAge,
            isFemale,
            serum,
            bioenergetics: bio,
            altitudeInfo,
            anamnesis: serum?.anamnesisUnified
        });
        return {
            ...study,
            patientSummary: sanitizeClinicalSpanish(study.patientSummary || ''),
            clinicalSummary: sanitizeClinicalSpanish(study.clinicalSummary || '')
        };
    } catch (metaErr) {
        console.warn('⚠️ [MetabolicAge EGM-51 v3 Safe Fallback]:', metaErr?.message || metaErr);
        const fallbackStudy = calculateUniversalMetabolicAgeSSoT({}, { verifiedAge, isFemale });
        return {
            ...fallbackStudy,
            patientSummary: sanitizeClinicalSpanish(fallbackStudy.patientSummary || ''),
            clinicalSummary: sanitizeClinicalSpanish(fallbackStudy.clinicalSummary || '')
        };
    }
}

/**
 * Compilador Clínico SSoTT Único (`canonicalClinicalPlan` — EGM-49 + EGM-50 + EGM-51 v2).
 * Genera un único árbol intermedio determinista para Secciones 0, 1, 2, 3 y 4 del Expediente NOM-004 y Guía del Paciente.
 */
function buildCanonicalTherapeuticContract({
    patientData = {},
    serum = {},
    bioenergetics = {},
    biosecuritySemaphore = {},
    medications = null,
    selective33Guard = null,
    physicalPrescription = null,
    metabolicAgeStudy = null,
    isLactanteExplicit = false,
    isPediatricExplicit = false
} = {}) {
    try {
        const anamnesisContract = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
        const labsContract = serum?.labValues || {};
        const fluidRestrictionActive = Boolean(
            anamnesisContract.hasMedicalFluidRestriction ||
            (Number(labsContract.gfr) > 0 && Number(labsContract.gfr) < 30) ||
            (Number(labsContract.sodium) > 0 && Number(labsContract.sodium) < 132)
        );
        const weightForWater = Number(bioenergetics?.weightKg) > 0 ? Number(bioenergetics.weightKg) : 70;
        const lacWaterBonus = anamnesisContract.isLactating ? 0.6 : 0.0;
        const hydrationTargetLiters = fluidRestrictionActive
            ? null
            : Math.min(3.4, Math.max(1.8, Number((((weightForWater * 32) / 1000) + lacWaterBonus).toFixed(1))));
        const hydrationClinicalPhrase = fluidRestrictionActive
            ? 'techo hídrico estricto indicado por su especialista (sin cargas adicionales de volumen)'
            : `${hydrationTargetLiters} L/día`;

        const resolvedDiet = resolveDynamicMacronutrientsAndRegimen({
            patientData,
            serum,
            bioenergetics,
            ageYears: Number(bioenergetics?.age) || 35,
            bmi: Number(bioenergetics?.bmi) || 24,
            isLactanteExplicit,
            isPediatricExplicit,
            labValues: serum?.labValues || {},
            subAxisFlags: serum?.subAxisFlags || {},
            precedence: serum?.precedence || {}
        });

        const macros = bioenergetics?.macrosDynamicApplied ? bioenergetics.macros : resolvedDiet.macros;
        if (bioenergetics && typeof bioenergetics === 'object' && !bioenergetics.macrosDynamicApplied) {
            bioenergetics.macros = macros;
            bioenergetics.regimen = resolvedDiet.regimen;
        }
        const regimen = resolvedDiet.regimen;
        const regimenBadge = resolvedDiet.regimenBadge;
        const targetKcal = bioenergetics?.targetKcal || bioenergetics?.tdee || 2000;
        const tdeeKcal = bioenergetics?.tdee || targetKcal;
        const caloricDeltaType = bioenergetics?.caloricDeltaType || 'MANTENIMIENTO_RECOMPOSICION';

        const selGuard = selective33Guard || detectSelective33PlusContraindication({ patientData, serum, medications });
        const sel34Guard = detectSelective34PlusContraindication({ patientData, serum, medications });
        const calciumLocked = Boolean(serum?.hasHighSerumCalciumOrCalcification || serum?.electretSignals?.hasCalcificationAlert);
        const hasThyroidAlert = Boolean(serum?.electretSignals?.hasThyroidAlert);
        const hasLabResultsLoaded = Boolean(serum?.hasLabResultsLoaded);
        const isPaused = Boolean(biosecuritySemaphore?.isPaused || biosecuritySemaphore?.level === 'ROJO');
        const isSelective33Paused = !isPaused && Boolean(selGuard.isSelective33Paused || biosecuritySemaphore?.isSelective33Paused);
        const isSelective34Paused = !isPaused && Boolean(sel34Guard.isSelective34Paused || biosecuritySemaphore?.isSelective34Paused);
        const isEstablishedContinuityFullDose = !isPaused && !isSelective33Paused && !isSelective34Paused && Boolean(
            biosecuritySemaphore?.isEstablishedContinuityFullDose ||
            biosecuritySemaphore?.modeCode === 'CONTINUIDAD_CALIBRADA_DOSIS_COMPLETA'
        );
        const isMicroDose = !isPaused && !isEstablishedContinuityFullDose && Boolean(
            biosecuritySemaphore?.isMicroDose ||
            biosecuritySemaphore?.level === 'AMARILLO' ||
            isSelective33Paused ||
            isSelective34Paused
        );

        const doseFactor33 = isPaused || isSelective33Paused ? 0 : (isMicroDose ? 0.5 : 2);
        const doseFactor34 = isPaused || isSelective34Paused ? 0 : (isMicroDose ? 0.5 : 2);

        const scaled33 = formatScaledActives('33PLUS', doseFactor33);
        const scaled34 = formatScaledActives('34PLUS', doseFactor34);

        const hasCardioConductionCaution = Boolean(serum?.cabinetSignals?.hasCardiacConductionOrBradycardia);
        const monitorPrepClause = formatBiometricMonitorPrepClause();
        const biometricMonitorLabel = resolveBiometricMonitorLabel();
        const cutoffDesc = anamnesisContract.isNightOrRotatingShift
            ? 'corte >= 8 h antes de su horario programado de sueño diurno'
            : 'corte horario antes de las 14:00 h';
        const ecoMonitorClause = hasCardioConductionCaution
            ? ` bajo vigilancia de frecuencia cardiaca ${monitorPrepClause} y ${cutoffDesc}`
            : ` (${cutoffDesc})`;

        const phrase33ForNode = isPaused
            ? 'alimentación natural e hidratación controlada (0 sobres activos de 33Plus® en pausa preventiva)'
            : isSelective33Paused
                ? `pausa selectiva de 33Plus® (0 sobres activos por ${selGuard.reasonText || 'criterio de bioseguridad'}) priorizando hidratación natural`
                : isMicroDose
                    ? `micro-dosis gradual de 33Plus® (1/2 sobre = ${FORMULA_33PLUS.halfSachetGramsDisplay} en ${FORMULA_33PLUS.minWaterMl} ml de agua natural${ecoMonitorClause}; aporte neto: ${scaled33.activesInline})`
                    : isEstablishedContinuityFullDose
                        ? `continuidad calibrada en dosis completa de 33Plus® (1 a 2 sobres completos/día = ${FORMULA_33PLUS.sachetGramsDisplay} a ${scaled33.totalGramsDisplay} conforme a su pauta habitual consolidada, en ${FORMULA_33PLUS.minWaterMl} ml de agua natural${ecoMonitorClause}; aporte por 2 sobres: ${scaled33.activesInline})`
                        : `protocolo diurno de 33Plus® (2 sobres/día = ${scaled33.totalGramsDisplay}; ${FORMULA_33PLUS.sachetGramsDisplay} c/u en ${FORMULA_33PLUS.minWaterMl} ml de agua natural${ecoMonitorClause}; aporte diario: ${scaled33.activesInline})`;

        const phrase34ForNode = isPaused
            ? 'hidratación controlada y proteína dietética suave (0 sobres activos de 34Plus® en pausa preventiva)'
            : isSelective34Paused
                ? `pausa selectiva estricta de 34Plus® (0 sobres activos por ${sel34Guard.reasonText || 'interacción con anticoagulante cumarínico'})`
                : isMicroDose
                    ? `micro-dosis de reparación de 34Plus® (1/2 sobre = ${FORMULA_34PLUS.halfSachetGramsDisplay} disuelto en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple; aporte neto: ${scaled34.activesInline})`
                    : isEstablishedContinuityFullDose
                        ? `continuidad calibrada en dosis completa de 34Plus® (1 a 2 sobres completos/día = ${FORMULA_34PLUS.sachetGramsDisplay} a ${scaled34.totalGramsDisplay} conforme a su pauta habitual consolidada, cada sobre en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple; aporte por 2 sobres: ${scaled34.activesInline})`
                        : `protocolo vespertino y pre-descanso de 34Plus® (2 sobres/día = ${scaled34.totalGramsDisplay}; ${FORMULA_34PLUS.sachetGramsDisplay} c/u en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple; aporte diario: ${scaled34.activesInline})`;

        const patientSpecificExclusions = (serum?.combinedExclusions || [])
            .map(sanitizeClinicalSpanish)
            .filter((val) => {
                const clean = String(val || '').trim();
                if (!clean) return false;
                return !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean);
            });

        const phase1Desc = isPaused
            ? `Alimentación protectora (${targetKcal} kcal/día; ${macros.carbs}% CHO / ${macros.protein}% P / ${macros.fat}% L), hidratación (${hydrationClinicalPhrase}) y acreditación de valoración médica/estudios de control (0 sobres activos).`
            : isSelective33Paused
                ? `Sellado epitelial digestivo (${targetKcal} kcal/día), hidratación (${hydrationClinicalPhrase}), pausa selectiva de 33Plus® (0 sobres activos) e inicio gradual con 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧.`
                : isSelective34Paused
                    ? `Adaptación metabólica (${targetKcal} kcal/día), hidratación (${hydrationClinicalPhrase}), inicio gradual con 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® y pausa selectiva estricta de 34Plus® (0 sobres activos por protección de INR frente a ${sel34Guard.k2LabelClinical || 'Vitamina K2 MK-7'}).`
                    : isMicroDose
                        ? `Sellado epitelial digestivo (${targetKcal} kcal/día; 0 Picante, 0 Cerdo, 0 Azúcares refinados), hidratación (${hydrationClinicalPhrase}) e inicio gradual con 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® en ${FORMULA_33PLUS.minWaterMl} ml de agua natural y 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧.`
                        : `Integración de ${regimen.toLowerCase()} (${targetKcal} kcal/día), hidratación diaria (${hydrationClinicalPhrase}) y protocolo completo sincronizado de 33Plus® (${FORMULA_33PLUS.sachetGramsDisplay}/toma) y 34Plus® (${FORMULA_34PLUS.sachetGramsDisplay}/toma en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧).`;

        const isTcaContractSafety = Boolean(serum?.routeContext?.isTcaBehavioralSafety);
        const midCyclePulseDay14 = {
            day: 14,
            title: 'Hito de Pulso Día 14 (Mitad de Ciclo)',
            clinicalInstruction: isTcaContractSafety
                ? 'Control intermedio Día 14 (sin mediciones antropométricas punitivas): registro de vitalidad matutina (1–10), confort digestivo y constancia de hidratación/complementación.'
                : 'Control intermedio Día 14: medición matutina en ayunas de circunferencia abdominal (nivel umbilical con cinta flexible), calificación de vitalidad al despertar (escala 1–10) y verificación de constancia en sus 4 momentos de hidratación y complementación.'
        };

        const evolutionTimeline = {
            totalDays: 28,
            summaryLabel: '28 Días de seguimiento continuo (Fase 1: Días 1–7 • Pulso Día 14 • Fase 2: Días 8–21 • Fase 3: Días 22–28)',
            midCyclePulseDay14,
            phases: isPaused
                ? [
                    {
                        phase: 1,
                        rangeLabel: 'Días 1 a 7',
                        weekLabel: 'Semana 1',
                        title: 'Estabilización Inicial y Pausa Preventiva de Suplementación',
                        description: phase1Desc
                    },
                    {
                        phase: 2,
                        rangeLabel: 'Días 8 a 21',
                        weekLabel: 'Semanas 2-3',
                        title: 'Valoración Médica Paraclínica, Pulso Día 14 y Desinflamación Mucosa',
                        description: 'Revisión clínica de estudios solicitados para acreditar estabilidad renal, hepática y hemodinámica previo a cualquier suplementación, con Hito de Pulso Día 14 de vitalidad e hidratación.'
                    },
                    {
                        phase: 3,
                        rangeLabel: 'Días 22 a 28',
                        weekLabel: 'Semana 4',
                        title: 'Consolidación Metabólica y Re-Evaluación Comparativa (T0 → T1)',
                        description: isTcaContractSafety
                            ? 'Auditoría comparativa de evolución clínica y bienestar integral al cierre del ciclo de 28 días.'
                            : `Auditoría comparativa de evolución clínica al cierre del ciclo de 28 días (${targetKcal} kcal/día).`
                    }
                ]
                : isMicroDose
                    ? [
                        {
                            phase: 1,
                            rangeLabel: 'Días 1 a 7',
                            weekLabel: 'Semana 1',
                            title: 'Adaptación Mucosa y Micro-Dosis Calibrada',
                            description: phase1Desc
                        },
                        {
                            phase: 2,
                            rangeLabel: 'Días 8 a 21',
                            weekLabel: 'Semanas 2-3',
                            title: 'Escalamiento Gradual según Tolerancia, Pulso Día 14 y Modulación Metabólica',
                            description: isSelective33Paused
                                ? `Continuidad de pausa selectiva en 33Plus® (0 sobres activos), Hito de Pulso Día 14 y valoración de tolerancia digestiva para escalar 34Plus® vespertino/nocturno (${FORMULA_34PLUS.halfSachetGramsDisplay} a ${FORMULA_34PLUS.sachetGramsDisplay}) en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple.`
                                : `Valoración de tolerancia digestiva y respuesta cardiovascular (${biometricMonitorLabel}) a partir del Día 8 e Hito de Pulso Día 14 para mantener micro-dosis o integrar segunda toma diurna (${FORMULA_33PLUS.halfSachetGramsDisplay} ${anamnesisContract.isNightOrRotatingShift ? 'suspendiéndolo >= 8 h antes de su sueño diurno' : 'antes de las 14:00 h'}).`
                        },
                        {
                            phase: 3,
                            rangeLabel: 'Días 22 a 28',
                            weekLabel: 'Semana 4',
                            title: 'Consolidación Funcional y Re-Evaluación Comparativa (T0 → T1)',
                            description: isTcaContractSafety
                                ? 'Auditoría comparativa de bioseñales y bienestar integral al cierre del ciclo de 28 días.'
                                : `Auditoría comparativa de bioseñales y estudios de control al cierre del ciclo de 28 días sobre meta de ${targetKcal} kcal/día.`
                        }
                    ]
                    : [
                        {
                            phase: 1,
                            rangeLabel: 'Días 1 a 7',
                            weekLabel: 'Semana 1',
                            title: isEstablishedContinuityFullDose
                                ? 'Continuidad Calibrada en Dosis Completa y Sincronización Circadiana'
                                : 'Sincronización Circadiana y Sellado de Barrera Mucosa',
                            description: phase1Desc
                        },
                        {
                            phase: 2,
                            rangeLabel: 'Días 8 a 21',
                            weekLabel: 'Semanas 2-3',
                            title: 'Modulación Metabólica, Hito de Pulso Día 14 y Reparación Tisular',
                            description: isTcaContractSafety
                                ? 'Optimización de vitalidad diurna, confort digestivo y Hito de Pulso Día 14 de energía e hidratación.'
                                : 'Optimización del transporte lipídico-glucémico, oxigenación microvascular diurna, síntesis nocturna de matriz de colágeno e Hito de Pulso Día 14 (cintura matutina en ayunas, vitalidad 1–10 y constancia de sus 4 momentos).'
                        },
                        {
                            phase: 3,
                            rangeLabel: 'Días 22 a 28',
                            weekLabel: 'Semana 4',
                            title: 'Consolidación Funcional y Re-Evaluación Comparativa (T0 → T1)',
                            description: isTcaContractSafety
                                ? 'Auditoría comparativa de bienestar integral al día 28.'
                                : `Auditoría comparativa de parámetros fuera de rango al día 28 y consolidación de composición corporal (${targetKcal} kcal/día).`
                        }
                    ]
        };

        const resolvedMetabolicAge = metabolicAgeStudy || calculateBidirectionalMetabolicAge(patientData, serum, bioenergetics);
        const priorAdherence = serum?.priorAdherence || detectPriorInstitutionalAdherence(patientData);
        const logisticsSummary = serum?.logisticsSummary || translateLogisticsProfile(patientData);
        const nom004Sheet = extractNom004IdentificationSheet(patientData, serum, bioenergetics);
        const dietaryEpigeneticSynthesis = extractDietaryAndEpigeneticSynthesis(patientData, serum, bioenergetics);
        const scheduledAppointmentSummary = resolveScheduledAppointmentSummary(patientData, biosecuritySemaphore);
        const isRecalibrationMode = Boolean(isMicroDose && !isPaused && priorAdherence?.hasPriorAdherence);

        return {
            contractVersion: '3.5.0-EGM73-SSOTT',
            biometricMonitorLabel,
            regimen,
            regimenBadge,
            caloricDeltaType,
            tdeeKcal,
            targetKcal,
            macros,
            hydrationTargetLiters,
            patientSpecificExclusions,
            calciumLocked,
            hasThyroidAlert,
            hasLabResultsLoaded,
            isPaused,
            isMicroDose,
            isEstablishedContinuityFullDose,
            isRecalibrationMode,
            isSelective33Paused,
            selective33ReasonText: selGuard.reasonText || '',
            isSelective34Paused,
            selective34ReasonText: sel34Guard.reasonText || '',
            isPediatricExplicit,
            isLactanteExplicit,
            isClinicalEubiosis: Boolean(serum?.isClinicalEubiosis ?? nom004Sheet?.isClinicalEubiosis),
            hasClinicalAllergies: Boolean(serum?.hasClinicalAllergies ?? nom004Sheet?.hasClinicalAllergies),
            multimodalTriad: serum?.multimodalTriad || {},
            semaphoreLevel: biosecuritySemaphore?.level || 'VERDE',
            priorAdherence,
            logisticsSummary,
            nom004Sheet,
            dietaryEpigeneticSynthesis,
            scheduledAppointmentSummary,
            metabolicAgeStudy: resolvedMetabolicAge,
            posology: {
                doseFactor33,
                doseFactor34,
                scaled33,
                scaled34,
                phrase33ForNode,
                phrase34ForNode,
                hasCardioConductionCaution,
                isEstablishedContinuityFullDose,
                isRecalibrationMode
            },
            movement: {
                medicalPrescriptionText: sanitizeArt215NonTherapeuticLexicon(physicalPrescription || ''),
                hasPostsurgicalInguinalWall: Boolean(serum?.cabinetSignals?.hasPostsurgicalInguinalOrAbdominalWall),
                hasCardioConductionCaution,
                recommendsEchocardiogram: Boolean(serum?.cabinetSignals?.recommendsEchocardiogram)
            },
            evolutionTimeline
        };
    } catch (planErr) {
        console.warn('⚠️ [Canonical Plan Safe Catch]:', planErr.message);
        return {
            contractVersion: '3.2.0-EGM49-FALLBACK',
            biometricMonitorLabel: resolveBiometricMonitorLabel(),
            regimen: 'Alimentación Funcional Antiinflamatoria Personalizada',
            regimenBadge: 'Alimentación Antiinflamatoria (0 Picante • 0 Cerdo • 0 Azúcares refinados)',
            caloricDeltaType: 'MANTENIMIENTO_RECOMPOSICION',
            tdeeKcal: 2000,
            targetKcal: 2000,
            macros: { carbs: 40, protein: 30, fat: 30 },
            hydrationTargetLiters: 2.2,
            patientSpecificExclusions: [],
            calciumLocked: false,
            hasThyroidAlert: false,
            hasLabResultsLoaded: false,
            isPaused: true,
            isMicroDose: false,
            isSelective33Paused: false,
            selective33ReasonText: '',
            semaphoreLevel: 'ROJO',
            posology: {
                doseFactor33: 0,
                doseFactor34: 0,
                scaled33: formatScaledActives('33PLUS', 0),
                scaled34: formatScaledActives('34PLUS', 0),
                phrase33ForNode: 'alimentación natural e hidratación medida (0 sobres activos)',
                phrase34ForNode: 'hidratación fraccionada y proteína suave (0 sobres activos)',
                hasCardioConductionCaution: false
            },
            movement: { medicalPrescriptionText: '', hasPostsurgicalInguinalWall: false, hasCardioConductionCaution: false },
            evolutionTimeline: { totalDays: 28, summaryLabel: '28 Días de seguimiento continuo', phases: [] }
        };
    }
}

/**
 * Compila `therapeutic_focus` de cada Nodo IFM (Sección 1 y Sección 3 CDSS 3.1–3.7)
 * interpolando 100% desde `canonicalClinicalPlan` (`posology`, `bioenergetics`, `movement`, `multimodalTriad`).
 */
function resolveNodeTherapeuticFocus(nodeId, contract = null) {
    const c = contract || buildCanonicalTherapeuticContract({});
    const kcal = c.targetKcal || 2000;
    const m = c.macros || { carbs: 40, protein: 30, fat: 30 };
    const liters = c.hydrationTargetLiters || 2.2;
    const dose33Phrase = c.posology?.phrase33ForNode || 'hidratación matutina supervisada';
    const dose34Phrase = c.posology?.phrase34ForNode || 'hidratación nocturna supervisada';
    const monitorPrep = formatBiometricMonitorPrepClause();

    let caloricPhrase = `pauta normocalórica personalizada (${kcal} kcal/día; ${m.carbs}% CHO / ${m.protein}% P / ${m.fat}% L)`;
    if (String(c.caloricDeltaType || '').includes('DEFICIT')) {
        caloricPhrase = `ajuste energético cardioprotector (${kcal} kcal/día; ${m.carbs}% CHO / ${m.protein}% P / ${m.fat}% L)`;
    } else if (String(c.caloricDeltaType || '').includes('SUPERAVIT')) {
        caloricPhrase = `soporte energético de recuperación (${kcal} kcal/día; ${m.carbs}% CHO / ${m.protein}% P / ${m.fat}% L)`;
    }

    const exclText = Array.isArray(c.patientSpecificExclusions) && c.patientSpecificExclusions.length > 0
        ? `, además de exclusión personalizada de ${c.patientSpecificExclusions.join(', ')}`
        : '';

    const cardioMoveClause = c.movement?.hasCardioConductionCaution
        ? `actividad aeróbica sin impacto en Zona 1–2 ${monitorPrep} (FC <= 130 lpm)`
        : 'caminata aeróbica conversacional sin impactos bruscos';

    const structuralMoveClause = c.movement?.hasPostsurgicalInguinalWall
        ? 'movilidad articular controlada con prohibición estricta de maniobras de Valsalva pesadas (protección de pared inguinal postquirúrgica)'
        : 'movilidad articular progresiva sin impacto';

    const triad = c.multimodalTriad || {};
    const triadSigns = [
        triad.hasCornealArcus ? 'arco corneal limbar asociado a transporte lipoproteico' : null,
        triad.hasSublingualVenousStasis ? 'ingurgitación venosa sublingual (venas raninas)' : null,
        triad.hasLowerLimbVenousStasis ? 'estasis venosa y cambios hemosiderínicos distales en extremidades inferiores' : null
    ].filter(Boolean);
    const triadClause = triadSigns.length > 0
        ? ` —integrando la correlación morfológica de ${joinSpanishList(triadSigns)} mediante proantocianidinas de Semilla de Uva 95 % (MP040), Coenzima Q10 (MP104) y Vitamina C (MP048) de 33Plus® junto con Colágeno Hidrolizado (MP009) de 34Plus®—`
        : '';

    const dietSynth = c.dietaryEpigeneticSynthesis || {};
    const dietBridgeClause = dietSynth.lipidCulinaryBridge
        ? `, aplicando el ajuste alimentario personalizado (${dietSynth.lipidCulinaryBridge})`
        : ', ácidos grasos monoinsaturados y fibra soluble';

    switch (nodeId) {
        case 'NODO_1_ASIMILACION':
            return sanitizeClinicalSpanish(
                c.isClinicalEubiosis
                    ? `Optimización preventiva de absorción mucosa y equilibrio hidrosalino lingual —preservando su estado actual de eubiosis clínica (0 síntomas digestivos)— mediante exclusión preventiva de irritantes (0 picante, 0 cerdo, 0 azúcares refinados${exclText}), masticación pausada, hidratación fraccionada (${liters} L/día) y soporte prebiótico con ${dose34Phrase}.`
                    : `Restauración de barrera mucosa digestiva mediante exclusión estricta de irritantes (0 picante, 0 cerdo, 0 azúcares refinados${exclText}), tiempos pausados de masticación, hidratación fraccionada (${liters} L/día) y soporte prebiótico con ${dose34Phrase}.`
            );
        case 'NODO_2_BIOTRANSFORMACION':
            return sanitizeClinicalSpanish(
                `Soporte fisiológico hepatobiliar y nefroprotección mediante ${caloricPhrase}, hidratación estructurada (${liters} L/día de agua simple), vegetales crucíferos y fibra soluble alimentaria, sin sobrecarga osmótica ni insumos externos.`
            );
        case 'NODO_3_ENERGIA':
            return sanitizeClinicalSpanish(
                `Modulación metabólica y transporte saludable de lipoproteínas mediante ${caloricPhrase}${dietBridgeClause} y soporte bioenergético con ${dose33Phrase}.${dietSynth.epigeneticClinicalNote ? ` ${dietSynth.epigeneticClinicalNote}` : ''}`
            );
        case 'NODO_4_COMUNICACION':
            return sanitizeClinicalSpanish(
                `Sincronización circadiana neuroendocrina (luz natural matutina, cena ligera 2–3 h antes de dormir e higiene del sueño), regulación de carga alostática${c.hasThyroidAlert ? ' y correlación con perfil tiroideo sérico' : ''} y transición neurovegetativa nocturna mediante ${dose34Phrase}.`
            );
        case 'NODO_5_TRANSPORTE':
            return sanitizeClinicalSpanish(
                `Optimización endotelial, fluidez microcirculatoria y retorno venoso periférico${triadClause} mediante hidratación constante (${liters} L/día), ${cardioMoveClause}, activación de bomba muscular gemelar y protección antioxidante vascular con ${dose33Phrase}.`
            );
        case 'NODO_6_DEFENSA':
            return sanitizeClinicalSpanish(
                c.hasClinicalAllergies
                    ? `Modulación inmunológica antiinflamatoria y protección antioxidante celular (retiro estricto de irritantes y alérgenos clínicos acreditados${exclText}), acompañada de descanso reparador y ${dose34Phrase}.`
                    : `Modulación inmunológica antiinflamatoria y reparación epitelial (exclusión preventiva de irritantes mucosos; 0 alergias clínicas declaradas, con vigilancia orientativa ante reactividad biofísica${exclText}), acompañada de descanso reparador y ${dose34Phrase}.`
            );
        case 'NODO_7_ESTRUCTURAL':
            if (c.calciumLocked) {
                return sanitizeClinicalSpanish(
                    `Soporte de matriz colágena y estructural mediante ${dose34Phrase}, proteína dietética de alto valor biológico, magnesio y vitamina K2 alimentaria y ${structuralMoveClause}, con exclusión estricta de suplementos aislados de calcio inorgánico.`
                );
            }
            return sanitizeClinicalSpanish(
                `Regeneración de matriz extracelular, síntesis de colágeno y soporte osteomuscular mediante ${dose34Phrase}, proteína dietética de alto valor biológico y ${structuralMoveClause}.`
            );
        default:
            return 'Modulación nutricional personalizada e hidratación estructurada bajo monitoreo clínico.';
    }
}

function stripUnaccreditedCodesAndFlags(rawText) {
    if (!rawText) return '';
    return String(rawText)
        .replace(/\s*\[\s*⚠️?\s*REQUIERE_REVISI[ÓO]N\s*\]/giu, '')
        .replace(/\(\s*(?:CIE-10:\s*)?[A-Z]\d{2}(?:\.\d{1,2})?\s*\)/gu, '')
        .replace(/\bCIE-10:\s*[A-Z]\d{2}(?:\.\d{1,2})?\b/giu, '')
        .replace(/(\d+(?:\.\d+)?)\s+[íi]ndice(?![\p{L}\p{N}_])/giu, '$1')
        .replace(/elevaci[óo]n\s+(?:leve\s+|moderada\s+)?en\s+los\s+niveles\s+de\s+metales\s+pesados/giu, 'bioseñales bioeléctricas orientativas de depuración ambiental')
        .replace(/niveles\s+(?:elevados\s+|alterados\s+)?de\s+metales\s+pesados/giu, 'bioseñales bioeléctricas orientativas de depuración ambiental')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function formatCleanAnomalyDescriptorForSummary(anomaly) {
    const cleanLabel = sanitizeClinicalSpanish(String(anomaly?.label || '').trim());
    if (!cleanLabel) return '';
    const detail = String(anomaly?.detail || '');
    if (/•\s*Bajo\b/i.test(detail) || anomaly?.direction === 'LOW') {
        return `${cleanLabel} disminuido`;
    }
    if (/•\s*Elevado\b/i.test(detail) || anomaly?.direction === 'HIGH') {
        return `${cleanLabel} elevado`;
    }
    return cleanLabel;
}

function formatMedicalBiomarkerSummary(rawItem) {
    const translated = translateBiomarkerToSpanish(rawItem);
    return stripUnaccreditedCodesAndFlags(sanitizeClinicalSpanish(translated))
        .replace(/Ref:\s*N\/A\s*\|\s*/gi, '')
        .replace(/ANORMAL\s+SEVERO\s*(\(\+\+\+\))?/gi, (_, g1) => `Alerta Severa${g1 ? ` ${g1}` : ' (+++)'}`)
        .replace(/ANORMAL\s+MODERADO\s*(\(\+\+\))?/gi, (_, g1) => `Alerta Moderada${g1 ? ` ${g1}` : ' (++)'}`)
        .replace(/ANORMAL\s+LEVE\s*(\(\+\))?/gi, (_, g1) => `Desviación Leve${g1 ? ` ${g1}` : ' (+)'}`)
        .replace(/(\d),(\d)/g, '$1.$2')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Construye una síntesis médica determinista en prosa clínica limpia (cero CIE-10 no acreditados y cero banderas de debug).
 */
function buildDeterministicNodeSynthesis(node, contract = null) {
    const rawAnomalies = Array.isArray(node.anomalies) ? node.anomalies : [];
    const anomalies = [...rawAnomalies].sort(
        (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    );
    const count = anomalies.length;
    const hasCritical = anomalies.some(a => a.severity === 'CRÍTICA');
    const status = count === 0
        ? 'HOMEOSTASIS'
        : (hasCritical && count >= 3 ? 'CRÍTICO' : (count >= 2 ? 'PRIORIDAD_ALTA' : 'ALERTA_MODERADA'));

    const cleanNodeTitle = sanitizeClinicalSpanish(String(node.name || '').replace(/^\d+\.\s*/, '').trim());
    const topDescriptors = Array.from(
        new Set(anomalies.slice(0, 6).map(formatCleanAnomalyDescriptorForSummary).filter(Boolean))
    );
    const remainingCount = Math.max(0, count - topDescriptors.length);
    const hasConfirmedLabOrCabinet = anomalies.some(a =>
        a.source === 'OCR_LAB' || a.source === 'FUNCTIONAL_INDEX' || String(a.source || '').startsWith('CABINET_')
    );

    const orphanHomeostasisSummary = node.hasMovedElectretSignals
        ? 'Homeostasis clínica y paraclínica acreditada conservada (ver Anexo Biofísico Orientativo al pie).'
        : 'Homeostasis clínica y paraclínica acreditada conservada.';

    let summary = orphanHomeostasisSummary;
    if (count > 0) {
        const listClause = topDescriptors.join(', ') + (remainingCount > 0 ? ` y ${remainingCount} parámetros complementarios` : '');
        const triad = contract?.multimodalTriad || {};
        const triadDetParts = node.id === 'NODO_5_TRANSPORTE'
            ? [
                triad.hasCornealArcus ? 'arco corneal limbar (OD+OI)' : null,
                triad.hasSublingualVenousStasis ? 'ingurgitación de venas raninas sublinguales' : null,
                triad.hasLowerLimbVenousStasis ? 'estasis venosa con cambios hemosiderínicos en extremidades inferiores' : null
            ].filter(Boolean)
            : [];
        const triadDetSuffix = triadDetParts.length > 0
            ? ` Triangulación semiológica convergente: ${joinSpanishList(triadDetParts)}.`
            : '';
        const eubiosisDetSuffix = (node.id === 'NODO_1_ASIMILACION' && contract?.isClinicalEubiosis)
            ? ' Se documenta en coexistencia con eubiosis clínica (0 síntomas digestivos referidos).'
            : '';
        if (hasConfirmedLabOrCabinet) {
            summary = sanitizeClinicalSpanish(
                `Correlación clínica y paraclínica en ${cleanNodeTitle} (${count} hallazgos integrados), destacando ${listClause}.${triadDetSuffix} El perfil sugiere demanda adaptativa prioritaria dentro del ${node.preAssignedLabel || 'eje funcional evaluado'}.`
            );
        } else {
            summary = sanitizeClinicalSpanish(
                `Se registran ${count} hallazgos clínicos/semiológicos en ${cleanNodeTitle}, con predominio en ${listClause}.${eubiosisDetSuffix} Hallazgos compatibles con sobrecarga adaptativa funcional sujeta a correlación clínica.`
            );
        }
    }

    return {
        nodeId: node.id,
        nodeName: sanitizeClinicalSpanish(node.name),
        status,
        cie10: count > 0 ? (node.accredited_cie10 || null) : null,
        accredited_cie10: count > 0 ? (node.accredited_cie10 || null) : null,
        functionalCode: node.functionalCode || 'IFM-00',
        validation_status: 'VALIDADO',
        requires_clinical_review: Boolean(count > 0 && node.requires_clinical_review),
        summary: sanitizeArt215NonTherapeuticLexicon(stripUnaccreditedCodesAndFlags(summary)),
        key_biomarkers: anomalies.map(a => formatMedicalBiomarkerSummary(`${a.label}: ${a.detail}`)),
        therapeutic_focus: sanitizeArt215NonTherapeuticLexicon(
            count > 0
                ? resolveNodeTherapeuticFocus(node.id, contract)
                : 'Mantenimiento fisiológico preventivo e hidratación cotidiana.'
        )
    };
}

/**
 * Ejecuta 1 sola llamada estructurada a Gemini (con AbortController de 16000 ms) para redactar
 * únicamente la correlación observacional (`summary`) de todos los nodos activos, resolviendo
 * `therapeutic_focus` 100% desde el motor determinista SSoTT.
 */
async function synthesizeAllIfmNodesSSoTT(nodes, contract = null, ai = null) {
    const resolvedContract = contract || buildCanonicalTherapeuticContract({});
    const activeNodes = (Array.isArray(nodes) ? nodes : []).filter(n => n.hasAnomalies && Array.isArray(n.anomalies) && n.anomalies.length > 0);

    if (!ai || activeNodes.length === 0) {
        return (Array.isArray(nodes) ? nodes : []).map(node =>
            node.hasAnomalies
                ? buildDeterministicNodeSynthesis(node, resolvedContract)
                : {
                    nodeId: node.id,
                    nodeName: sanitizeClinicalSpanish(node.name),
                    status: 'HOMEOSTASIS',
                    cie10: null,
                    accredited_cie10: null,
                    functionalCode: node.functionalCode || 'IFM-00',
                    validation_status: 'VALIDADO',
                    requires_clinical_review: false,
                    summary: node.hasMovedElectretSignals
                        ? 'Homeostasis clínica y paraclínica acreditada conservada (ver Anexo Biofísico Orientativo al pie).'
                        : 'Homeostasis clínica y paraclínica acreditada conservada.',
                    key_biomarkers: [],
                    therapeutic_focus: 'Mantenimiento fisiológico preventivo e hidratación cotidiana.'
                }
        );
    }

    const nodesDigestText = activeNodes.map((node) => {
        const sortedAnomalies = [...(node.anomalies || [])].sort(
            (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
        );
        const topLines = sortedAnomalies
            .slice(0, 16)
            .map((a, idx) => `   ${idx + 1}. [${a.source}] ${a.label}: ${a.detail}`)
            .join('\n');
        return `NODO "${node.id}" (${node.name} | Eje: ${node.functionalCode || 'IFM'} | ${node.anomalies.length} hallazgos totales):\n${topLines}`;
    }).join('\n\n');

    const prompt = `Eres el motor médico funcional CORTEX v3.2 SSoTT (Cumplimiento NOM-004-SSA3-2012 y COFEPRIS).
Tu única tarea es redactar la síntesis observacional concisa ("summary") para cada uno de los siguientes ${activeNodes.length} Nodos IFM con hallazgos.

REGLAS EPISTEMOLÓGICAS Y NORMATIVAS ESTRICTAS (OBLIGATORIAS):
1. Devuelve exactamente un elemento en "nodes" por cada nodo listado, respetando el "nodeId" exacto.
2. En "summary" redacta máximo 2 oraciones en español médico impecable (con ortografía y acentuación perfectas, sin listas de números ni paréntesis anidados).
3. Todo hallazgo con etiqueta "[ELECTRET]" corresponde a bioimpedancia funcional orientativa (NO es estudio de laboratorio sanguíneo ni imagenología). Queda ESTRICTAMENTE PROHIBIDO afirmar diagnósticos orgánicos cerrados como "esteatosis hepática", "congestión hepatobiliar escleral", "elevación azoada", "inflamación sistémica aguda", "intoxicación de metales pesados", "disbiosis confirmada" o "prostatitis" si no están acreditados en "[OCR_LAB]" o "[CABINET_*]".
4. CERO CÓDIGOS CIE-10 NI PRESCRIPCIONES EN "summary": Queda prohibido incluir códigos CIE-10 (ej. E78.5, I10, Z00.0) o recomendar dietas, calorías, suplementos o fármacos dentro de "summary".
5. ESTILO EDITORIAL MÉDICO SIN REPETICIONES LÉXICAS: Emplea conectores variados ("asociado a", "acompañado de", "compatible con").
6. FIDELIDAD LITERAL DE GABINETE Y LABORATORIO (EGM-50): Queda ESTRICTAMENTE PROHIBIDO suavizar o alterar el grado de severidad reportado en "[CABINET_*]" (ej. NUNCA conviertas un "BLOQUEO DE LA RAMA DERECHA DEL HAZ DE HIS" o "QRS >= 120 ms" en "bloqueo incompleto", ni omitas cambios postquirúrgicos o vasculares acreditados) y NUNCA cites analitos no medidos en la lista (ej. no menciones "apo B" si solo constan LDL, no-HDL o sdLDL).

NODOS ACTIVOS A SINTETIZAR:
${nodesDigestText}`;

    const candidateModels = [
        'gemini-flash-lite-latest',
        'gemini-2.5-flash'
    ];

    let llmSummariesByNodeId = new Map();
    for (const modelName of candidateModels) {
        const controller = new AbortController();
        let timeoutId = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller.abort();
                    reject(new Error('AI_BATCH_TIMEOUT_16000MS'));
                }, 16000);
            });

            const callPromise = ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    temperature: 0.1,
                    topP: 0.8,
                    abortSignal: controller.signal,
                    responseMimeType: 'application/json',
                    responseSchema: IFM_BATCH_SUMMARY_SCHEMA
                }
            });

            const response = await Promise.race([callPromise, timeoutPromise]);
            if (response && response.text) {
                const cleanedJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedJson);
                if (Array.isArray(parsed?.nodes) && parsed.nodes.length > 0) {
                    parsed.nodes.forEach((item) => {
                        if (item?.nodeId && item?.summary) {
                            llmSummariesByNodeId.set(String(item.nodeId).trim(), item);
                        }
                    });
                    if (llmSummariesByNodeId.size > 0) {
                        break;
                    }
                }
            }
        } catch (modelErr) {
            controller.abort();
            console.warn(`⚠️ [CORTEX SSoTT] Modelo ${modelName} en lote unificado: ${modelErr.message}`);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    return (Array.isArray(nodes) ? nodes : []).map((node) => {
        if (!node.hasAnomalies) {
            return {
                nodeId: node.id,
                nodeName: sanitizeClinicalSpanish(node.name),
                status: 'HOMEOSTASIS',
                cie10: null,
                accredited_cie10: null,
                functionalCode: node.functionalCode || 'IFM-00',
                validation_status: 'VALIDADO',
                requires_clinical_review: false,
                summary: node.hasMovedElectretSignals
                    ? 'Homeostasis clínica y paraclínica acreditada conservada (ver Anexo Biofísico Orientativo al pie).'
                    : 'Homeostasis clínica y paraclínica acreditada conservada.',
                key_biomarkers: [],
                therapeutic_focus: 'Mantenimiento fisiológico preventivo e hidratación cotidiana.'
            };
        }

        const deterministicNode = buildDeterministicNodeSynthesis(node, resolvedContract);
        const llmCandidate = llmSummariesByNodeId.get(node.id);
        if (!llmCandidate || !llmCandidate.summary) {
            return deterministicNode;
        }

        let sanitizedSummary = stripUnaccreditedCodesAndFlags(sanitizeClinicalSpanish(String(llmCandidate.summary).trim()));
        if (!resolvedContract.hasLabResultsLoaded) {
            sanitizedSummary = sanitizedSummary.replace(
                /(?<![\p{L}\p{N}_])disbiosis(?:\s+intestinal)?(?![\p{L}\p{N}_])/giu,
                'desequilibrio funcional de la microbiota'
            );
        }

        // Regla EGM-50: Fidelidad Literal de Gabinete y Analitos Medidos (Prohibido suavizar bloqueos completos o inventar Apo B)
        const nodeAnomText = (node.anomalies || []).map((a) => `${a.label || ''} ${a.detail || ''}`).join(' | ');
        const hasCompleteRbbbInNode = /BLOQUEO\s+DE\s+LA\s+RAMA\s+DERECHA|QRS\s*(?:1[2-9]\d|[2-9]\d{2})\s*ms/i.test(nodeAnomText) && !/bloqueo\s+incompleto/i.test(nodeAnomText);
        if (hasCompleteRbbbInNode) {
            sanitizedSummary = sanitizedSummary.replace(
                /bloqueo\s+incompleto\s+de\s+(?:la\s+)?rama\s+derecha(?:\s+del\s+haz\s+de\s+his)?/giu,
                'bloqueo de la rama derecha del haz de His'
            );
        }
        const hasCompleteLbbbInNode = /BLOQUEO\s+DE\s+LA\s+RAMA\s+IZQUIERDA/i.test(nodeAnomText) && !/bloqueo\s+incompleto/i.test(nodeAnomText);
        if (hasCompleteLbbbInNode) {
            sanitizedSummary = sanitizedSummary.replace(
                /bloqueo\s+incompleto\s+de\s+(?:la\s+)?rama\s+izquierda(?:\s+del\s+haz\s+de\s+his)?/giu,
                'bloqueo de la rama izquierda del haz de His'
            );
        }
        const hasApoBMeasured = /\bapo(?:lipoprote[íi]na)?\s*-?\s*b\b/i.test(nodeAnomText);
        if (!hasApoBMeasured) {
            sanitizedSummary = sanitizedSummary
                .replace(/,\s*ldl\s+y\s+apo(?:lipoprote[íi]na)?\s*-?\s*b\b/giu, ', colesterol LDL, no-HDL y partículas sdLDL')
                .replace(/\by\s+apo(?:lipoprote[íi]na)?\s*-?\s*b\b/giu, 'y partículas pequeñas densas (sdLDL)')
                .replace(/\bapo(?:lipoprote[íi]na)?\s*-?\s*b\b/giu, 'colesterol no-HDL');
        }
        const hasForbiddenTherapeuticClaim = FORBIDDEN_SUMMARY_CLAIMS_REGEX.test(sanitizedSummary);
        const hasUnconfirmedNosology = !resolvedContract.hasLabResultsLoaded && UNCONFIRMED_NOSOLOGY_WITHOUT_LABS_REGEX.test(sanitizedSummary);
        let validSummary = (!hasForbiddenTherapeuticClaim && !hasUnconfirmedNosology && sanitizedSummary.length >= 25)
            ? sanitizedSummary
            : deterministicNode.summary;

        if (node.id === 'NODO_5_TRANSPORTE') {
            const triad = resolvedContract.multimodalTriad || {};
            const missingTriadItems = [
                (triad.hasCornealArcus && !/arco\s+corneal|limbar/i.test(validSummary)) ? 'arco corneal limbar (OD+OI)' : null,
                (triad.hasSublingualVenousStasis && !/raninas|sublingual/i.test(validSummary)) ? 'ingurgitación de venas raninas sublinguales' : null,
                (triad.hasLowerLimbVenousStasis && !/hemosider|estasis\s+venosa|extremidades\s+inferiores/i.test(validSummary)) ? 'estasis venosa con cambios hemosiderínicos en extremidades inferiores' : null
            ].filter(Boolean);
            if (missingTriadItems.length > 0) {
                validSummary = sanitizeClinicalSpanish(
                    `${validSummary.replace(/\.+$/, '')}. Triangulación semiológica multimodal convergente: ${joinSpanishList(missingTriadItems)}.`
                );
            }
        }
        if (node.id === 'NODO_1_ASIMILACION' && resolvedContract.isClinicalEubiosis && !/eubiosis/i.test(validSummary)) {
            validSummary = sanitizeClinicalSpanish(
                `${validSummary.replace(/\.+$/, '')} (en coexistencia con eubiosis clínica asintomática: 0 síntomas digestivos).`
            );
        }

        const validStatus = (llmCandidate.status && ['ALERTA_MODERADA', 'PRIORIDAD_ALTA', 'CRÍTICO'].includes(llmCandidate.status))
            ? llmCandidate.status
            : deterministicNode.status;

        return {
            ...deterministicNode,
            status: validStatus,
            summary: validSummary,
            therapeutic_focus: deterministicNode.therapeutic_focus
        };
    });
}

async function processCortexNodesInBatches(nodes, ai, contractOrBatchSize = null) {
    const contract = (contractOrBatchSize && typeof contractOrBatchSize === 'object')
        ? contractOrBatchSize
        : null;
    return synthesizeAllIfmNodesSSoTT(nodes, contract, ai);
}

// ============================================================================
// 5. SEMÁFORO CLÍNICO DE BIOSEGURIDAD + PRESCRIPCIÓN SINCRONIZADA (33Plus® / 34Plus®)
// ============================================================================
const CLINICAL_BIOMARKER_TRANSLATE = {
    'RETICULAR_ERYTHEMA': 'Eritema Reticular',
    'PUNCTATE_MACULES': 'Máculas Puntiformes',
    'MICROPAPULAR_ERUPTION': 'Erupción Micropapular',
    'PERIFOLLICULAR_INVOLVEMENT': 'Compromiso Perifolicular',
    'CUTANEOUS_EDEMA_SUPERFICIAL': 'Edema Cutáneo Superficial',
    'SUPERFICIAL_CUTANEOUS_EDEMA': 'Edema Cutáneo Superficial',
    'CHRONIC_VENOUS_INSUFFICIENCY_DETECTED': 'Insuficiencia Venosa Crónica',
    'CHRONIC_VENOUS_INSUFFICIENCY': 'Insuficiencia Venosa Crónica',
    'VARICOSE_VEINS_HIGH_RISK': 'Riesgo Elevado de Várices',
    'VENOUS_STASIS_DERMATITIS': 'Dermatitis por Estasis Venosa',
    'EDEMA_PERIPHERAL_MODERATE': 'Edema Periférico Moderado',
    'PERIPHERAL_EDEMA': 'Edema Periférico',
    'HYPERPIGMENTATION': 'Hiperpigmentación Cutánea',
    'HEMOSIDERIN_PIGMENTATION': 'Pigmentación por Hemosiderina',
    'FOLLICULAR_HYPERKERATOSIS': 'Hiperqueratosis Folicular',
    'XEROSIS_CUTIS': 'Xerosis Cutánea (Piel Seca)',
    'TELANGIECTASIA': 'Telangiectasias Superficiales',
    'VENOUS_ECTASIA': 'Ectasia Venosa',
    'SUBLINGUAL_VARICES': 'Várices Sublinguales',
    'LINGUAL_COATING_WHITE': 'Saburra Lingual Blanquecina',
    'GINGIVAL_CONGESTION': 'Congestión Gingival',
    'DRY_MUCOSA': 'Resequedad de Mucosa',
    'ERYTHEMATOUS_EDEMA': 'Edema Eritematoso',
    'MICROVASCULAR_CONGESTION': 'Congestión Microvascular',
    'BLOOD_VISCOSITY': 'Viscosidad Sanguínea',
    'VASCULAR_RESISTANCE': 'Resistencia Vascular',
    'VASCULAR_ELASTICITY': 'Elasticidad Vascular',
    'MYOCARDIAL_BLOOD_DEMAND': 'Demanda de Sangre Miocárdica',
    'STROKE_VOLUME': 'Volumen Sistólico',
    'LEFT_VENTRICULAR_EJECTION_IMPEDANCE': 'Impedancia Ventricular de Expulsión',
    'EFFECTIVE_PUMP_FORCE': 'Fuerza de Bombeo Efectiva',
    'CORONARY_ARTERY_ELASTICITY': 'Elasticidad Coronaria',
    'CEREBRAL_VESSEL_ELASTICITY': 'Elasticidad de Vaso Cerebral',
    'CHOLESTEROL_CRYSTAL': 'Cristal de Colesterol'
};

function translateBiomarkerToSpanish(b) {
    if (!b) return '';
    const raw = sanitizeClinicalSpanish(String(b).trim());
    const key = raw.toUpperCase().replace(/\s+/g, '_');
    return CLINICAL_BIOMARKER_TRANSLATE[key] || raw;
}

/**
 * Evalúa el Semáforo Clínico de Bioseguridad (VERDE / AMARILLO / ROJO) y determina
 * algorítmicamente el régimen de titulación para evitar contradicciones entre alerta y dosis.
 */
/**
 * Resuelve de forma determinista el contrato lingüístico y de autoridad clínica según las skills
 * institucionales activas (`tilo-communication-protocol` y `tilo-binary-protocol-v62.1`):
 * - `< 13` años (`MODO_TUTOR` — Lactantes `< 2` y Niñez `2–12`): Interlocutor directo = Madre/Padre/Tutor
 *   en trato estricto de `"Usted"`, refiriéndose al paciente en 3.ª persona (`su bebé` / `[Nombre]`).
 * - `13+` años (`Usted Global` — `CALIBRADOR_EMPODERADOR` `13–17`, `ESTRATEGA_SENIOR` `18–64`, `GERIATRIC_MODE` `≥ 65`):
 *   Cero tuteo; acusativo mexicano sin leísmo (`Lo`/`La` según sexo biológico) y triangulación con tutor en `13–17`.
 */
/**
 * Resolutor SSoTT Canónico e Inmutable de Edad y Etapa Vital en Backend (Fail-Closed Anti-Falso-Lactante).
 * Prioridad 1: Fecha de nacimiento verificada (DD/MM/YYYY, YYYY-MM-DD o CURP oficial).
 * Prioridad 2: Entero positivo estricto (> 0 y <= 125) en rutas clínicas conocidas.
 * PROHIBIDO evaluar Number(null)/Number('') === 0 o activar lactante (< 2 años) / MODO_TUTOR (< 13 años)
 * cuando la edad es null, undefined, NaN o 0 sin fecha de nacimiento verificada.
 */
function resolveVerifiedPatientAge(patientData, fallback = 35) {
    const safeFallback = Number.isInteger(fallback) && fallback > 0 ? fallback : 35;
    const baseResult = {
        ageYears: safeFallback,
        ageMonths: safeFallback * 12,
        dobDate: null,
        hasVerifiedBirthDate: false,
        hasExplicitPositiveAge: false,
        isLactanteVerified: false,
        isTutorModeVerified: false,
        isPediatricVerified: false
    };
    if (!patientData || typeof patientData !== 'object') return baseResult;

    try {
        const pInfo = patientData.identityLock?.patientInfo;
        let parsedDob = null;

        if (pInfo?.dob_year && pInfo?.dob_month && pInfo?.dob_day) {
            const y = parseInt(String(pInfo.dob_year).trim(), 10);
            const m = parseInt(String(pInfo.dob_month).trim(), 10);
            const d = parseInt(String(pInfo.dob_day).trim(), 10);
            if (Number.isInteger(y) && y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                const dt = new Date(y, m - 1, d);
                if (!Number.isNaN(dt.getTime())) parsedDob = dt;
            }
        }

        if (!parsedDob) {
            const rawDobCandidates = [
                patientData.birthDate,
                patientData.birthdate,
                patientData.fecha_nacimiento,
                patientData.dob,
                patientData.profile?.birthDate,
                patientData.profile?.birthdate,
                patientData.profile?.dob,
                patientData.identificacion?.fechaNacimiento,
                patientData.identificacion?.fechanac,
                patientData.demographics?.birthdate,
                patientData.demographics?.birthDate,
                pInfo?.birthdate
            ];
            for (const raw of rawDobCandidates) {
                if (typeof raw !== 'string' || !raw.trim()) continue;
                const s = raw.trim();
                const ddmmyyyy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
                const yyyymmdd = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
                let candidateDate = null;
                if (ddmmyyyy) {
                    const dd = parseInt(ddmmyyyy[1], 10);
                    const mm = parseInt(ddmmyyyy[2], 10);
                    const yyyy = parseInt(ddmmyyyy[3], 10);
                    if (yyyy >= 1900 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                        candidateDate = new Date(yyyy, mm - 1, dd);
                    }
                } else if (yyyymmdd) {
                    const yyyy = parseInt(yyyymmdd[1], 10);
                    const mm = parseInt(yyyymmdd[2], 10);
                    const dd = parseInt(yyyymmdd[3], 10);
                    if (yyyy >= 1900 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                        candidateDate = new Date(yyyy, mm - 1, dd);
                    }
                }
                if (candidateDate && !Number.isNaN(candidateDate.getTime())) {
                    parsedDob = candidateDate;
                    break;
                }
            }
        }

        if (!parsedDob) {
            const rawCurp = String(
                patientData.profile?.curp ||
                patientData.identificacion?.curp ||
                patientData.demographics?.curp ||
                pInfo?.curp ||
                ''
            ).trim().toUpperCase();
            const curpMatch = rawCurp.match(/^[A-Z]{4}(\d{2})(\d{2})(\d{2})[HMX][A-Z]{5}([A-Z0-9])\d$/);
            if (curpMatch) {
                const yy = parseInt(curpMatch[1], 10);
                const mm = parseInt(curpMatch[2], 10);
                const dd = parseInt(curpMatch[3], 10);
                const fullYear = /[0-9]/.test(curpMatch[4]) ? (1900 + yy) : (2000 + yy);
                if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                    const dt = new Date(fullYear, mm - 1, dd);
                    if (!Number.isNaN(dt.getTime())) parsedDob = dt;
                }
            }
        }

        if (parsedDob && !Number.isNaN(parsedDob.getTime())) {
            const now = new Date();
            let years = now.getFullYear() - parsedDob.getFullYear();
            const mDiff = now.getMonth() - parsedDob.getMonth();
            if (mDiff < 0 || (mDiff === 0 && now.getDate() < parsedDob.getDate())) {
                years -= 1;
            }
            let months = (now.getFullYear() - parsedDob.getFullYear()) * 12 + (now.getMonth() - parsedDob.getMonth());
            if (now.getDate() < parsedDob.getDate()) {
                months -= 1;
            }
            if (years >= 0 && years <= 125) {
                const safeMonths = Math.max(0, months);
                return {
                    ageYears: years,
                    ageMonths: safeMonths,
                    dobDate: parsedDob,
                    hasVerifiedBirthDate: true,
                    hasExplicitPositiveAge: years > 0,
                    isLactanteVerified: safeMonths >= 0 && safeMonths < 24,
                    isTutorModeVerified: years >= 0 && years < 13,
                    isPediatricVerified: years >= 0 && years < 18
                };
            }
        }

        const positiveIntCandidates = [
            patientData.profile?.age,
            patientData.identificacion?.edad,
            patientData.demographics?.age,
            patientData.anthropometrics?.age,
            patientData.scan_data?.electret_metrics?.patientInfo?.age,
            patientData.scan_data?.electret_metadata?.age,
            patientData.electretTelemetry?.patientMetadata?.age,
            patientData.clinical_dossier?.bioenergetics?.age,
            patientData.vitals?.age,
            pInfo?.age,
            patientData.age,
            patientData.edad
        ];
        for (const c of positiveIntCandidates) {
            if (c === null || c === undefined || typeof c === 'boolean') continue;
            const trimmed = String(c).trim();
            if (!trimmed) continue;
            const parsed = parseInt(trimmed, 10);
            if (Number.isInteger(parsed) && parsed > 0 && parsed <= 125) {
                const isExplicitAdultCat = String(patientData.profile?.pediatric_profile?.category || '').toUpperCase() === 'ADULTO';
                const babyMonths = parseInt(String(patientData.profile?.baby_age_months ?? ''), 10);
                const hasVerifiedBabyMonths = Number.isInteger(babyMonths) && babyMonths > 0 && babyMonths < 24 && !isExplicitAdultCat;
                return {
                    ageYears: parsed,
                    ageMonths: hasVerifiedBabyMonths ? babyMonths : (parsed * 12),
                    dobDate: null,
                    hasVerifiedBirthDate: false,
                    hasExplicitPositiveAge: true,
                    isLactanteVerified: parsed < 2 && hasVerifiedBabyMonths,
                    isTutorModeVerified: !isExplicitAdultCat && parsed < 13 && Boolean(patientData.profile?.pediatric_profile?.is_minor === true),
                    isPediatricVerified: !isExplicitAdultCat && parsed < 18
                };
            }
        }
    } catch (_) {
        // Fail-closed seguro a modo adulto ("Usted Global")
    }

    return baseResult;
}

function resolveClinicalAddressing({
    patientName = '',
    ageYears = 35,
    isFemale = false,
    isLactanteExplicit = false
} = {}) {
    const parsedAge = Number(ageYears);
    const safeAge = Number.isFinite(parsedAge) && parsedAge > 0
        ? parsedAge
        : (isLactanteExplicit && parsedAge === 0 ? 0 : 35);
    const isLactante = Boolean(safeAge < 2 && isLactanteExplicit);
    const isTutorChild = !isLactante && safeAge > 0 && safeAge < 13;
    const isTutorMode = isLactante || isTutorChild;
    const isAdolescent = safeAge >= 13 && safeAge < 18;
    const isSenior = safeAge >= 65;

    const cleanFullName = toSpanishTitleCaseFullName(
        cleanClinicalLabel(patientName || (isLactante ? 'su bebé' : 'Paciente'))
    );
    const hasSpecificName = !/^(paciente|su\s+beb[ée]|tu\s+beb[ée]|el\s+menor|la\s+menor|lactante)$/i.test(cleanFullName.trim());
    const rawFirstToken = cleanFullName.split(/\s+/)[0] || cleanFullName;
    const firstName = hasSpecificName
        ? rawFirstToken
        : (isTutorMode
            ? (isLactante ? 'su bebé' : (isFemale ? 'su hija' : 'su hijo'))
            : 'paciente');
    const fullVocativeName = hasSpecificName ? cleanFullName : 'Paciente';

    const childShortRef = isLactante
        ? (hasSpecificName ? firstName : 'su bebé')
        : (hasSpecificName ? firstName : (isFemale ? 'su hija' : 'su hijo'));

    const childSubjectWithKinship = isLactante
        ? (hasSpecificName ? `${firstName} (su bebé)` : 'su bebé')
        : (hasSpecificName ? `${firstName} (${isFemale ? 'su hija' : 'su hijo'})` : (isFemale ? 'su hija' : 'su hijo'));

    const mode = isTutorMode
        ? 'MODO_TUTOR'
        : isAdolescent
            ? 'CALIBRADOR_EMPODERADOR'
            : isSenior
                ? 'GERIATRIC_MODE'
                : 'ESTRATEGA_SENIOR';

    return {
        mode,
        ageYears: safeAge,
        isFemale: Boolean(isFemale),
        isLactante,
        isTutorChild,
        isTutorMode,
        isAdolescent,
        isSenior,
        hasSpecificName,
        cleanFullName,
        fullVocativeName,
        firstName,
        childShortRef,
        childSubjectWithKinship,
        estimadoLabel: isFemale ? 'Estimada' : 'Estimado',
        directObjCap: isFemale ? 'La' : 'Lo',
        directObjLower: isFemale ? 'la' : 'lo',
        seatedLabel: isFemale ? 'sentada' : 'sentado'
    };
}

function buildPatientUiLabels({ addressing, isPaused = false }) {
    const ref = addressing.childShortRef;
    const refUpper = String(ref || 'EL MENOR').toUpperCase();

    if (addressing.isLactante) {
        return {
            semaphoreFallbackTitle: 'Cuidado exclusivo de lactancia y alimentación guiada por su pediatra',
            recommendedLabsTitle: `🔬 Estudios de control sugeridos para personalizar el seguimiento pediátrico de ${ref}:`,
            systemsSectionTitle: `Los 5 Sistemas de Salud de ${ref} Explicados con Sencillez`,
            observedBoxTitle: `¿Qué observamos en la evaluación de ${ref}?`,
            alliesSectionKicker: 'Prioridad Pediátrica • Primeros 1000 Días',
            alliesSectionTitle: 'Cuidado Exclusivo de Lactancia e Hidratación Pediátrica',
            scheduleCardTitle: 'Orientación diaria de alimentación e hidratación guiada por su pediatra',
            redPauseTitle: `Primero la seguridad pediátrica de ${ref} (0 sobres activos)`,
            redPauseBody: 'En menores de 2 años no se utilizan sobres de suplementación para adultos. Continúe hoy mismo con lactancia materna o fórmula pediátrica y las indicaciones directas de su pediatra.',
            homePlanSectionTitle: `Plan de Acción Diario en Casa para ${ref}`,
            clipboardPatientLabel: 'Paciente (Atención a Madre/Padre/Tutor):',
            clipboardSystemsHeading: `LOS 5 SISTEMAS DE SALUD DE ${refUpper} EN PALABRAS SENCILLAS`,
            clipboardAlliesHeading: 'CUIDADO EXCLUSIVO DE LACTANCIA E HIDRATACIÓN PEDIÁTRICA'
        };
    }

    if (addressing.isTutorChild) {
        return {
            semaphoreFallbackTitle: `¿Cómo iniciaremos el cuidado nutricional de ${ref} de forma segura?`,
            recommendedLabsTitle: `🔬 Estudios de control sugeridos para personalizar el seguimiento de ${ref}:`,
            systemsSectionTitle: `Los 5 Sistemas de Salud de ${ref} Explicados con Sencillez`,
            observedBoxTitle: `¿Qué observamos en la evaluación de ${ref}?`,
            alliesSectionKicker: isPaused
                ? 'Vigilancia Pediátrica Preventiva'
                : `Soporte Nutricional Pediátrico Adaptado al Día de ${ref}`,
            alliesSectionTitle: isPaused
                ? `Hidratación Natural y Cuidado Digestivo para ${ref}`
                : `Soporte Nutricional Complementario para ${ref} (33Plus® y 34Plus®)`,
            scheduleCardTitle: isPaused
                ? `Cómo organizar la hidratación preventiva de ${ref} en casa`
                : `Cómo integrar las tomas e hidratación a la rutina diaria de ${ref}`,
            redPauseTitle: `Primero la seguridad médica de ${ref} (0 sobres por ahora)`,
            redPauseBody: `Por precaución clínica, aún no iniciaremos sobres de suplementación para ${ref}. Siga hoy mismo su guía de alimentación protectora e hidratación natural en casa mientras revisamos sus estudios con su pediatra o médico tratante.`,
            homePlanSectionTitle: `Plan de Acción Diario en Casa para ${ref}`,
            clipboardPatientLabel: 'Paciente (Atención a Madre/Padre/Tutor):',
            clipboardSystemsHeading: `LOS 5 SISTEMAS DE SALUD DE ${refUpper} EN PALABRAS SENCILLAS`,
            clipboardAlliesHeading: isPaused
                ? `HIDRATACIÓN PREVENTIVA Y CUIDADO DIARIO PARA ${refUpper}`
                : `SOPORTE NUTRICIONAL COMPLEMENTARIO Y HORARIOS PARA ${refUpper}`
        };
    }

    return {
        semaphoreFallbackTitle: '¿Cómo iniciaremos su protocolo de forma segura?',
        recommendedLabsTitle: '🔬 Estudios de control sugeridos para personalizar aún más su seguimiento:',
        systemsSectionTitle: 'Sus 5 Sistemas de Salud Explicados con Sencillez',
        observedBoxTitle: '¿Qué observamos en su evaluación?',
        alliesSectionKicker: 'Nutrición Funcional Sincronizada a su Despertar',
        alliesSectionTitle: 'Sus Aliados Nutricionales (33Plus® y 34Plus®)',
        scheduleCardTitle: 'Cómo integrarlo a su rutina diaria (adaptado a su hora real de despertar)',
        redPauseTitle: 'Primero su seguridad médica (0 sobres por ahora)',
        redPauseBody: addressing.isAdolescent
            ? 'Por precaución clínica, aún no iniciaremos sobres de suplementación. Siga hoy mismo su guía de alimentación protectora e hidratación natural en acompañamiento con su madre, padre o tutor legal mientras revisamos sus estudios con su médico.'
            : 'Por precaución clínica, aún no iniciaremos sobres de suplementación. Siga hoy mismo su guía de alimentación protectora e hidratación natural mientras revisamos sus estudios con su médico.',
        homePlanSectionTitle: 'Su Plan de Acción Diario en Casa',
        clipboardPatientLabel: addressing.isAdolescent
            ? 'Paciente (con acompañamiento de Madre/Padre/Tutor):'
            : 'Paciente:',
        clipboardSystemsHeading: 'SUS 5 SISTEMAS DE SALUD EN PALABRAS SENCILLAS',
        clipboardAlliesHeading: 'SUS ALIADOS NUTRICIONALES Y HORARIOS ADAPTADOS A SU DÍA'
    };
}

function evaluateBiosecurityAndTitration(
    patientData,
    serum,
    ageYears = 30,
    medications = [],
    hasStimulantsConflict = false,
    isLactanteExplicit = false,
    isPediatricExplicit = false,
    addressingOverride = null
) {
    const rawName =
        patientData?.profile?.name ||
        patientData?.profile?.first_name ||
        patientData?.identificacion?.nombre ||
        patientData?.identityLock?.patientInfo?.name ||
        (isLactanteExplicit || ageYears < 2 ? 'su bebé' : 'Paciente');
    const addr = addressingOverride || resolveClinicalAddressing({
        patientName: rawName,
        ageYears,
        isFemale: resolveBackendPatientIsFemale(patientData),
        isLactanteExplicit
    });

    const anamnesis = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
    const labs = serum?.labValues || {};
    const signals = serum?.electretSignals || {};
    const vitals = serum?.vitalsSnapshot || {};
    const isPregnant = Boolean(serum?.anamnesis360Context?.isPregnant || anamnesis.isPregnant);
    const isLactating = Boolean(serum?.anamnesis360Context?.isLactating || anamnesis.isLactating);

    const foodAllergies = patientData?.history?.allergies?.food || [];
    const drugAllergies = patientData?.history?.allergies?.drug || [];
    const allAllergiesStr = [...foodAllergies, ...drugAllergies]
        .map(a => String(typeof a === 'object' ? a.agent : a || '').toUpperCase())
        .join(' ');
    const hasFormulaAllergy = ['GUARANA', 'GUARANÁ', 'COLAGENO', 'COLÁGENO', 'INULINA', 'TEANINA', 'UVA', 'SPIRULINA'].some(
        ing => allAllergiesStr.includes(ing)
    );

    const hasSevereRenalHistory = Boolean(anamnesis.hasSevereRenalHistory);
    const hasRenalStoneOrMildHistory = Boolean(anamnesis.hasOxalateOrRenalStoneHistory);

    const redReasons = [];
    const yellowReasons = [];
    const recommendedLabsSet = new Set();
    const selective33Guard = detectSelective33PlusContraindication({ patientData, serum, medications });
    const selective34Guard = detectSelective34PlusContraindication({ patientData, serum, medications });

    // 1. Reglas de Compuerta ROJA (Pausa Preventiva de Suplementación Activa)
    if (addr.isLactante) {
        return {
            level: 'ROJO',
            modeCode: 'PAUSA_PREVENTIVA_PEDIATRICA',
            badgeLabel: 'Prioridad Pediátrica • Sin Suplementos Adultos',
            title: 'Cuidado exclusivo de lactancia y alimentación guiada por su pediatra',
            honestExplanation: `En etapa de lactancia temprana (< 2 años), la nutrición de ${addr.childShortRef} depende prioritariamente de leche materna o fórmula indicada por su pediatra y de la introducción gradual de alimentos naturales. Por seguridad pediátrica, mantenemos cualquier sobre concentrado en pausa estricta.`,
            ethicalNote: 'Toda orientación nutricional en los primeros 1000 días acompaña y respeta íntegramente las indicaciones de su pediatra tratante.',
            recommendedLabs: [],
            isPaused: true,
            isMicroDose: false,
            isSelective33Paused: true,
            titrationPlanText: '0 sobres activos (etapa de lactancia temprana bajo vigilancia pediátrica).'
        };
    }

    if (hasFormulaAllergy) {
        redReasons.push('antecedente de hipersensibilidad o alergia declarada a alguno de los componentes botánicos o proteicos');
    }
    if (hasSevereRenalHistory || (labs.gfr > 0 && labs.gfr < 45) || labs.creatinine > 1.5 || labs.potassium > 5.2) {
        redReasons.push('indicadores de compromiso renal importante que requieren valoración nefrológica antes de concentrar aminoácidos o minerales');
        recommendedLabsSet.add('Química sanguínea con Creatinina, Urea, TFG y Electrolitos séricos (Sodio, Potasio, Cloro)');
        recommendedLabsSet.add('Examen General de Orina (EGO) con relación microalbuminuria/creatinina');
    }
    if (labs.alt > 105 || labs.ast > 105 || labs.bilirubin > 2.5) {
        redReasons.push('elevación marcada de enzimas hepáticas que amerita revisión médica prioritaria');
        recommendedLabsSet.add('Perfil hepático completo (AST, ALT, GGT, Fosfatasa Alcalina y Bilirrubinas)');
    }
    if (vitals.sys >= 160 || vitals.dia >= 100) {
        redReasons.push(`presión arterial elevada (${vitals.sys}/${vitals.dia} mmHg) que requiere estabilización médica inmediata`);
    }
    if (selective33Guard.hasActiveUncontrolledTachyarrhythmia && ((vitals.hr || 0) >= 120 || (serum?.cabinetSignals?.ecgHrBpm || 0) >= 120)) {
        redReasons.push('taquiarritmia activa descontrolada que requiere estabilización cardiológica prioritaria');
        recommendedLabsSet.add('Electrocardiograma de 12 derivaciones, electrolitos séricos y valoración cardiológica presencial');
    }
    const fastGlucose = vitals.glu || labs.glucose || 0;
    if (fastGlucose >= 250 || (fastGlucose > 0 && fastGlucose < 60)) {
        redReasons.push(`glucosa fuera de margen seguro (${fastGlucose} mg/dL) que requiere ajuste médico directo`);
        recommendedLabsSet.add('Glucosa central en ayuno, Insulina basal y Hemoglobina Glucosilada (HbA1c)');
    }
    if (Number(labs.triglycerides) >= 500) {
        redReasons.push(`hipertrigliceridemia severa de ${labs.triglycerides} mg/dL con riesgo pancreático agudo que exige derivación médica inmediata`);
        recommendedLabsSet.add('Perfil lipídico en ayuno, Lipasa y Amilasa séricas y valoración médica urgente por hipertrigliceridemia severa (>= 500 mg/dL)');
    }

    if (redReasons.length > 0) {
        if (signals.hasThyroidAlert) {
            recommendedLabsSet.add('Perfil tiroideo (TSH, T4L, Anti-TPO)');
        }
        return {
            level: 'ROJO',
            modeCode: 'PAUSA_PREVENTIVA_MEDICA',
            badgeLabel: 'Prioridad Médica • Pausa Preventiva',
            title: addr.isTutorMode
                ? `Primero protegemos la seguridad de ${addr.childShortRef}: pausa temporal de suplementación`
                : 'Primero protegemos su seguridad: pausa temporal de suplementación',
            honestExplanation: addr.isTutorMode
                ? `En la evaluación de ${addr.childShortRef} observamos ${joinSpanishList(redReasons)}. Por ética clínica, hoy iniciamos únicamente con alimentación natural suave e hidratación medida en casa, dejando las fórmulas en pausa preventiva hasta contar con la validación presencial y sus estudios de control.`
                : `Observamos ${joinSpanishList(redReasons)}. Por ética clínica, hoy iniciamos únicamente con alimentación natural suave e hidratación medida, dejando las fórmulas en pausa preventiva hasta contar con la validación presencial y sus estudios de control${addr.isAdolescent ? ' en acompañamiento con su madre, padre o tutor legal' : ''}.`,
            ethicalNote: addr.isTutorMode
                ? `Las fórmulas 33Plus® y 34Plus® son soporte nutricional complementario (no medicamentos) y solo se valoran cuando los filtros naturales de ${addr.childShortRef} están listos bajo supervisión médica.`
                : `Las fórmulas 33Plus® y 34Plus® son aliados nutricionales de precisión (no medicamentos) y solo se activan cuando sus filtros naturales están listos para aprovecharlos con total seguridad${addr.isAdolescent ? ', contando siempre con el acompañamiento de su madre, padre o tutor legal' : ''}.`,
            recommendedLabs: Array.from(recommendedLabsSet),
            isPaused: true,
            isMicroDose: false,
            isSelective33Paused: true,
            titrationPlanText: '0 sobres activos por ahora (Pausa preventiva hasta revisión de estudios de laboratorio).'
        };
    }

    // 2. Reglas de Compuerta AMARILLA con Precedencia Biomédica Universal (Sangre Venosa > Gabinete > Bioimpedancia)
    const precedence = serum?.precedence || {};
    const cabinet = serum?.cabinetSignals || {};
    const subAxes = serum?.subAxisFlags || {};

    if (!precedence.venousRenalNormal && (signals.hasRenalBurden || hasRenalStoneOrMildHistory || (labs.creatinine > 1.2 && labs.creatinine <= 1.5) || (labs.gfr >= 45 && labs.gfr < 60) || labs.uricAcid > 7.0)) {
        yellowReasons.push(
            addr.isTutorMode
                ? `los riñones de ${addr.childShortRef} muestran señales de trabajo extra`
                : 'sus riñones muestran señales de trabajo extra'
        );
        if (!labs.creatinine) {
            recommendedLabsSet.add('Química sanguínea (Creatinina, Ácido Úrico, BUN) y Examen General de Orina (EGO)');
        } else {
            recommendedLabsSet.add('Examen General de Orina (EGO) con relación albúmina/creatinina');
        }
    } else if (precedence.hasGfrStageG2) {
        yellowReasons.push(
            addr.isTutorMode
                ? `su tasa de filtración glomerular (${labs.gfr} mL/min/1.73 m²) se ubica en estadio intermedio KDIGO G2, por lo que hidratamos y titulamos con suavidad`
                : `su tasa de filtración renal (${labs.gfr} mL/min/1.73 m²) se encuentra en rango intermedio preventivo (KDIGO G2), con creatinina y ácido úrico normales`
        );
        recommendedLabsSet.add('Examen General de Orina (EGO) con relación albúmina/creatinina (seguimiento preventivo de filtrado glomerular KDIGO G2)');
    }

    if (!precedence.venousHepaticNormal && (signals.hasHepaticBurden || signals.hasBiliaryBurden || (labs.alt > 61 && labs.alt <= 105) || (labs.ast > 40 && labs.ast <= 105))) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el hígado y la vesícula de ${addr.childShortRef} requieren acompañamiento depurativo gradual`
                : 'su hígado y vesícula requieren acompañamiento depurativo gradual'
        );
        if (!labs.alt && !labs.ast) {
            recommendedLabsSet.add('Perfil hepático completo (AST, ALT, GGT y Bilirrubinas)');
        }
    }

    const hasSevereHypercholesterolemiaLdl190 = Number(labs.ldl) >= 190;
    if (hasSevereHypercholesterolemiaLdl190) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el colesterol LDL de ${addr.childShortRef} (${labs.ldl} mg/dL) se ubica en rango de hipercolesterolemia severa (>= 190 mg/dL), requiriendo derivación médica prioritaria`
                : `su colesterol LDL (${labs.ldl} mg/dL) se ubica en rango de hipercolesterolemia severa (>= 190 mg/dL), por lo que indicamos derivación médica prioritaria cardiológica/endocrinológica`
        );
        recommendedLabsSet.add('Valoración médica prioritaria (Cardiología / Endocrinología) y Perfil Lipídico ampliado con Apolipoproteína B (ApoB) y Lipoproteína(a) [Lp(a)] ante LDL >= 190 mg/dL');
    } else if (subAxes.hasAtherogenicCholesterol && precedence.isHistoricalLab) {
        recommendedLabsSet.add(
            `Actualización periódica (> 6 meses${precedence.studyDateDisplay ? ` • último ${precedence.studyDateDisplay}` : ''}) de Perfil Lipídico ampliado (Colesterol total, LDL directo, no-HDL y sdLDL)`
        );
    } else if (subAxes.hasAtherogenicCholesterol) {
        recommendedLabsSet.add('Control evolutivo de Perfil Lipídico ampliado (Colesterol LDL directo, no-HDL y sdLDL) tras ciclo de 28 días');
    }

    if (cabinet.hasCardiacConductionOrBradycardia) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el estudio electrocardiográfico de ${addr.childShortRef} registra conducción eléctrica que amerita inicio gradual`
                : `su electrocardiograma en reposo registra bradicardia sinusal${cabinet.ecgHrBpm ? ` (${cabinet.ecgHrBpm} lpm)` : ''} y bloqueo de rama derecha, por lo que cuidamos su respuesta cardiovascular paso a paso ${formatBiometricMonitorPrepClause()}`
        );
    }
    if (cabinet.recommendsEchocardiogram) {
        recommendedLabsSet.add('Valoración cardiológica y Ecocardiograma transtorácico de correlación (sugerido en informe electrocardiográfico)');
    }

    const hasCalcificationTrigger = Boolean(serum?.hasHighSerumCalciumOrCalcification || signals.hasCalcificationAlert);
    if (hasCalcificationTrigger && !labs.vitaminD) {
        recommendedLabsSet.add('Vitamina D sérica (25-OH) para control de fijación mineral');
    }
    if (signals.hasThyroidAlert && !labs.tsh) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el eje tiroideo de ${addr.childShortRef} muestra señales funcionales que conviene corroborar en laboratorio`
                : 'su eje tiroideo muestra señales funcionales que conviene corroborar en laboratorio'
        );
        recommendedLabsSet.add('Perfil tiroideo (TSH, T4 libre y Anti-TPO)');
    }
    if (signals.hasDigestiveSensitivity) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el estómago e intestino de ${addr.childShortRef} presentan sensibilidad en la absorción, por lo que conviene adaptarlos poco a poco`
                : 'su estómago e intestino presentan sensibilidad en la absorción, por lo que conviene acostumbrarlos poco a poco'
        );
    }
    if ((vitals.sys >= 135 && vitals.sys < 160) || (vitals.dia >= 85 && vitals.dia < 100)) {
        yellowReasons.push(
            addr.isTutorMode
                ? `la presión arterial registrada requiere vigilancia cercana (${vitals.sys}/${vitals.dia} mmHg)`
                : `su presión arterial requiere vigilancia cercana (${vitals.sys}/${vitals.dia} mmHg)`
        );
    }
    if (selective33Guard.isSelective33Paused || isPregnant || isLactating) {
        const selClause = selective33Guard.reasonText || (isPregnant || isLactating ? 'etapa de embarazo o lactancia materna' : 'interacción farmacológica autonómica');
        yellowReasons.push(
            addr.isTutorMode
                ? `se mantiene en pausa selectiva preventiva 33Plus® (0 sobres activos) para proteger a ${addr.childShortRef} ante ${selClause}`
                : `mantenemos 33Plus® en pausa selectiva preventiva (0 sobres activos) por ${selClause}`
        );
    }
    if (!serum?.hasLabResultsLoaded && (ageYears >= 65 || (Array.isArray(medications) && medications.length >= 3))) {
        yellowReasons.push('aún no contamos con estudios de sangre recientes en su expediente para confirmar el estado exacto de sus filtros renales y hepáticos');
        recommendedLabsSet.add('Biometría hemática, Química sanguínea de 6 elementos y Examen General de Orina');
    }

    if (yellowReasons.length === 0 && hasCalcificationTrigger) {
        yellowReasons.push(
            addr.isTutorMode
                ? `el equilibrio mineral de ${addr.childShortRef} requiere hidratación constante y ajuste gradual`
                : 'su equilibrio mineral requiere hidratación constante y ajuste gradual'
        );
    }

    // EGM-59: En estado gestacional activo, tanto 33Plus® como 34Plus® permanecen en pausa preventiva materna hasta validación escrita gineco-obstétrica
    if (isPregnant) {
        return {
            level: 'AMARILLO',
            modeCode: 'PAUSA_PREVENTIVA_MATERNA',
            badgeLabel: 'Protección Materno-Fetal • Validación Obstétrica Previa',
            title: 'Prioridad fetoplacentaria: alimentación completa e hidratación materna (0 sobres hasta aval obstétrico)',
            honestExplanation: 'Durante el embarazo priorizamos al 100 % su nutrición natural completa sin restricciones calóricas e hidratación constante. Por ética materno-infantil, mantenemos tanto 33Plus® como 34Plus® en pausa preventiva hasta contar con la autorización escrita de su médico gineco-obstetra.',
            ethicalNote: 'En etapa gestacional toda suplementación concentrada requiere validación expresa por escrito de su especialista en Ginecología y Obstetricia (NOM-004 / NOM-043).',
            recommendedLabs: Array.from(recommendedLabsSet),
            isPaused: true,
            isMicroDose: false,
            isSelective33Paused: true,
            isSelective34Paused: true,
            titrationPlanText: '0 sobres activos por seguridad gestacional (nutrición materna completa; suplementación sujeta a autorización escrita de su gineco-obstetra).'
        };
    }

    if (anamnesis.hasDoacOrStrongAntiplatelet) {
        yellowReasons.push('usted cuenta con tratamiento anticoagulante o antiagregante oral directo que amerita inicio gradual bajo vigilancia médica');
    }
    if (selective34Guard.isSelective34Paused) {
        yellowReasons.push(`mantenemos 34Plus® en pausa selectiva estricta (0 sobres activos) ante ${selective34Guard.reasonText}`);
        recommendedLabsSet.add('Tiempo de Protrombina (TP) e Índice Internacional Normalizado (INR) de control con su médico tratante');
    }

    const isSelective33PausedActive = Boolean(selective33Guard.isSelective33Paused || isLactating);
    const isSelective34PausedActive = Boolean(selective34Guard.isSelective34Paused);

    if (yellowReasons.length > 0 || isPediatricExplicit || isSelective33PausedActive || isSelective34PausedActive) {
        if (yellowReasons.length === 0) {
            yellowReasons.push(
                addr.isTutorMode
                    ? `en la etapa de crecimiento de ${addr.childShortRef} priorizamos una adaptación gradual y bien diluida acorde a su edad`
                    : 'en etapa adolescente priorizamos una adaptación gradual y suave en acompañamiento con su madre, padre o tutor legal'
            );
        }
        const formattedYellowReasons = joinSpanishList(yellowReasons.slice(0, 3));
        if (isSelective33PausedActive && isSelective34PausedActive) {
            return {
                level: 'AMARILLO',
                modeCode: 'PAUSA_DUAL_INTERACCION_FARMACOLOGICA',
                badgeLabel: 'Protección Farmacológica Dual • 0 Sobres Activos',
                title: 'Resguardo farmacológico integral: prioridad en alimentación natural e hidratación segura',
                honestExplanation: `Por bioseguridad farmacológica —ya que ${formattedYellowReasons}— mantenemos temporalmente tanto 33Plus® como 34Plus® en pausa preventiva (0 sobres activos), acompañando su salud exclusivamente mediante su plan alimentario personalizado.`,
                ethicalNote: '33Plus® y 34Plus® nunca sustituyen ni deben interferir con su tratamiento anticoagulante o cardiovascular prescrito.',
                recommendedLabs: Array.from(recommendedLabsSet),
                isPaused: true,
                isMicroDose: false,
                isSelective33Paused: true,
                isSelective34Paused: true,
                titrationPlanText: '0 sobres activos por protección farmacológica simultánea (prioridad en alimentación cardioprotectora y control de INR).'
            };
        }
        if (isSelective34PausedActive) {
            return {
                level: 'AMARILLO',
                modeCode: 'MICRO_33PLUS_PAUSA_SELECTIVA_34PLUS',
                badgeLabel: 'Pausa Selectiva de 34Plus® (Protección INR) • Micro-Dosis 33Plus®',
                title: 'Protección estricta de su anticoagulación (INR): 34Plus® en pausa y 33Plus® gradual',
                honestExplanation: `Por bioseguridad farmacológica —ya que ${formattedYellowReasons}— mantenemos 34Plus® en pausa selectiva estricta (0 sobres activos para no alterar su INR con ${selective34Guard.k2LabelPatient || 'Vitamina K2 MK-7'}) e iniciamos únicamente con 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) matutino de 33Plus® en 300 ml de agua natural.`,
                ethicalNote: '33Plus® actúa como apoyo nutricional complementario y jamás sustituye su seguimiento hematológico/cardiológico ni el monitoreo de su INR.',
                recommendedLabs: Array.from(recommendedLabsSet),
                isPaused: false,
                isMicroDose: true,
                isSelective33Paused: false,
                isSelective34Paused: true,
                selective34Reasons: selective34Guard.reasons || [],
                titrationPlanText: `Micro-dosis matutina: 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® en 300 ml de agua natural + Pausa selectiva estricta de 34Plus® (0 sobres activos por protección de anticoagulación cumarínica / INR).`
            };
        }
        if (isSelective33PausedActive) {
            return {
                level: 'AMARILLO',
                modeCode: 'PAUSA_SELECTIVA_33PLUS_MICRO_34PLUS',
                badgeLabel: 'Pausa Selectiva de 33Plus® • Micro-Dosis Nocturna 34Plus®',
                title: addr.isTutorMode
                    ? `Protección neurovascular selectiva para ${addr.childShortRef}: 33Plus® en pausa y 34Plus® gradual`
                    : 'Protección neurovascular selectiva: 33Plus® en pausa preventiva y reparación nocturna gradual con 34Plus®',
                honestExplanation: addr.isTutorMode
                    ? `Por seguridad clínica —ya que ${formattedYellowReasons}— mantenemos 33Plus® en pausa selectiva (0 sobres activos, hidratación matutina simple) e iniciamos únicamente con 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de dormir en MÍNIMO 500 ml de agua simple.`
                    : `Por seguridad clínica —ya que ${formattedYellowReasons}— mantenemos 33Plus® en pausa selectiva (0 sobres activos, hidratación matutina simple) e iniciamos únicamente con 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de dormir en MÍNIMO 500 ml de agua simple.`,
                ethicalNote: addr.isTutorMode
                    ? `33Plus® y 34Plus® son soporte nutricional complementario a la alimentación diaria de ${addr.childShortRef} (nunca sustituyen sus medicamentos ni el seguimiento médico).`
                    : '33Plus® y 34Plus® son apoyo nutricional complementario a su alimentación diaria (nunca sustituyen sus medicamentos ni su seguimiento médico).',
                recommendedLabs: Array.from(recommendedLabsSet),
                isPaused: false,
                isMicroDose: true,
                isSelective33Paused: true,
                isSelective34Paused: false,
                selective33Reasons: selective33Guard.reasons || [],
                titrationPlanText: `Pausa selectiva matutina: 0 sobres activos de 33Plus® (hidratación protectora de 300 ml de agua natural al despertar) + Micro-dosis nocturna de 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de dormir en MÍNIMO 500 ml de agua simple 💧.`
            };
        }

        const cutoffContinuityText = anamnesis.isNightOrRotatingShift
            ? 'suspendiéndolo al menos 8 h antes de su horario programado de sueño diurno'
            : 'antes de las 14:00 h';
        const cardioCutoffClause = cabinet.hasCardiacConductionOrBradycardia
            ? ` Sincronizado a su despertar (${cutoffContinuityText}) y seguimiento de FC ${formatBiometricMonitorPrepClause()}.`
            : '';
        const priorAdherence = serum?.priorAdherence || detectPriorInstitutionalAdherence(patientData);
        const hasPriorSupplementAdherence = Boolean(!addr.isTutorMode && priorAdherence?.hasPriorAdherence);
        const hasEstablished3mContinuity = Boolean(!addr.isTutorMode && !isPediatricExplicit && priorAdherence?.hasEstablishedAdherence3mPlus);
        const hasHardTitrationBarrier = Boolean(
            hasFormulaAllergy ||
            hasRenalStoneOrMildHistory ||
            signals.hasDigestiveSensitivity ||
            anamnesis.hasDigestiveIssues ||
            anamnesis.hasDoacOrStrongAntiplatelet ||
            (Number(labs.gfr) > 0 && Number(labs.gfr) < 45) ||
            Number(vitals.sys) >= 140 ||
            Number(vitals.dia) >= 90
        );
        const priorDurationClause = priorAdherence?.durationText ? ` durante ${priorAdherence.durationText}` : '';
        const full33DailyGrams = formatScaledActives('33PLUS', 2).totalGramsDisplay;
        const full34DailyGrams = formatScaledActives('34PLUS', 2).totalGramsDisplay;

        if (hasEstablished3mContinuity && !hasHardTitrationBarrier) {
            return {
                level: 'AMARILLO',
                modeCode: 'CONTINUIDAD_CALIBRADA_DOSIS_COMPLETA',
                badgeLabel: 'Continuidad Calibrada en Dosis Completa • Vigilancia Focal',
                title: 'Continuidad calibrada de su pauta habitual en sobre completo con seguimiento focal preventivo',
                honestExplanation: `Reconocemos y respaldamos su constancia consolidada${priorDurationClause} con ${priorAdherence.publicSafeLabel || '33Plus® y 34Plus®'}. Dado que su organismo ya cuenta con adaptación digestiva plena y ausencia de contraindicaciones duras —mientras acompañamos preventivamente que ${formattedYellowReasons}—, mantenemos sin recortes su pauta en dosis completa: 1 a 2 sobres completos al día de 33Plus® (${FORMULA_33PLUS.sachetGramsDisplay} a ${full33DailyGrams}, ${cutoffContinuityText}) y 1 a 2 sobres completos al día de 34Plus® (${FORMULA_34PLUS.sachetGramsDisplay} a ${full34DailyGrams}, cada sobre en mínimo ${FORMULA_34PLUS.minWaterMl} ml de agua simple) conforme a su pauta habitual consolidada.`,
                ethicalNote: '33Plus® y 34Plus® actúan como apoyo nutricional complementario a su alimentación diaria (nunca sustituyen sus medicamentos ni su seguimiento médico).',
                recommendedLabs: Array.from(recommendedLabsSet),
                isPaused: false,
                isMicroDose: false,
                isEstablishedContinuityFullDose: true,
                isRecalibrationMode: false,
                hasSevereLdlReferral: hasSevereHypercholesterolemiaLdl190,
                isSelective33Paused: false,
                isSelective34Paused: false,
                titrationPlanText: `Continuidad calibrada en dosis completa (adherencia previa${priorDurationClause}): 1 a 2 sobres completos al día de 33Plus® (${FORMULA_33PLUS.sachetGramsDisplay} a ${full33DailyGrams} en ${FORMULA_33PLUS.minWaterMl} ml de agua natural por toma, ${cutoffContinuityText}) + 1 a 2 sobres completos al día de 34Plus® (${FORMULA_34PLUS.sachetGramsDisplay} a ${full34DailyGrams}, cada sobre en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧) conforme a su pauta habitual consolidada.${cabinet.hasCardiacConductionOrBradycardia ? ` Seguimiento de FC ${formatBiometricMonitorPrepClause()}.` : ''}`
            };
        }

        if (hasPriorSupplementAdherence) {
            return {
                level: 'AMARILLO',
                modeCode: 'RECALIBRACION_PREVENTIVA_DOSIS',
                badgeLabel: 'Recalibración Preventiva de Dosis • Ajuste Bioseguro',
                title: 'Recalibración preventiva de su pauta inicial para proteger su ritmo cardiovascular y asimilación',
                honestExplanation: `Reconocemos y valoramos su acercamiento previo${priorDurationClause} con ${priorAdherence.publicSafeLabel || '33Plus® y 34Plus®'}. A la luz de su evaluación clínica actual —donde ${formattedYellowReasons}— recalibramos preventivamente su posología durante los primeros 7 días (Semana 1) a 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® (${cutoffContinuityText}) y 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de su descanso en mínimo 500 ml de agua simple, optimizando su aprovechamiento sin sobrecarga.`,
                ethicalNote: `33Plus® y 34Plus® actúan como apoyo nutricional complementario a su alimentación diaria (nunca sustituyen sus medicamentos ni su seguimiento médico).`,
                recommendedLabs: Array.from(recommendedLabsSet),
                isPaused: false,
                isMicroDose: true,
                isRecalibrationMode: true,
                hasSevereLdlReferral: hasSevereHypercholesterolemiaLdl190,
                isSelective33Paused: false,
                titrationPlanText: `Recalibración preventiva de dosis (Días 1 al 7): 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® al despertar en 300 ml de agua natural (${cutoffContinuityText}) + 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de dormir en MÍNIMO 500 ml de agua simple 💧.${cardioCutoffClause} Valorar escalamiento a 1 sobre completo en Día 8 según respuesta clínica.`
            };
        }

        return {
            level: 'AMARILLO',
            modeCode: 'MICRO_DOSIS_GRADUAL_CALIBRADA',
            badgeLabel: 'Inicio Gradual Preventivo • Micro-Dosis Calibrada',
            title: addr.isTutorMode
                ? `Avanzamos paso a paso para cuidar los filtros naturales y la digestión de ${addr.childShortRef}`
                : 'Avanzamos paso a paso para cuidar su circulación, sus filtros naturales y su digestión',
            honestExplanation: addr.isTutorMode
                ? `Para cuidar el organismo de ${addr.childShortRef} con total responsabilidad —ya que ${formattedYellowReasons}— iniciaremos los primeros 7 días (Semana 1) con una micro-dosis suave (1/2 sobre de ${FORMULA_33PLUS.halfSachetGramsDisplay} de 33Plus® y 1/2 sobre de ${FORMULA_34PLUS.halfSachetGramsDisplay} de 34Plus®) bien diluida en agua natural, permitiendo una adaptación cómoda y sin sobrecarga.`
                : `Para proteger su organismo con total responsabilidad —ya que ${formattedYellowReasons}— iniciaremos los primeros 7 días (Semana 1) con una micro-dosis suave (1/2 sobre de ${FORMULA_33PLUS.halfSachetGramsDisplay} de 33Plus® ${cutoffContinuityText} y 1/2 sobre de ${FORMULA_34PLUS.halfSachetGramsDisplay} de 34Plus® antes de su descanso) bien diluida en agua simple, escalando a 1 sobre completo en Día 8 según tolerancia${addr.isAdolescent ? ', contando siempre con el acompañamiento de su madre, padre o tutor legal' : ''}.`,
            ethicalNote: addr.isTutorMode
                ? `33Plus® y 34Plus® actúan como soporte nutricional complementario a la alimentación diaria de ${addr.childShortRef} (nunca sustituyen sus medicamentos ni el seguimiento de su pediatra o médico tratante).`
                : `33Plus® y 34Plus® actúan como apoyo nutricional complementario a su alimentación diaria (nunca sustituyen sus medicamentos ni su seguimiento médico${addr.isAdolescent ? ', y se integran en conjunto con su madre, padre o tutor legal' : ''}).`,
            recommendedLabs: Array.from(recommendedLabsSet),
            isPaused: false,
            isMicroDose: true,
            hasSevereLdlReferral: hasSevereHypercholesterolemiaLdl190,
            isSelective33Paused: false,
            titrationPlanText: `Fase de adaptación (Días 1 al 7): 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® al despertar en 300 ml de agua natural (${cutoffContinuityText}) + 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de dormir en MÍNIMO 500 ml de agua simple 💧.${cardioCutoffClause} Escalar a 1 sobre completo en Día 8 según tolerancia.`
        };
    }

    // 3. Compuerta VERDE (Dosis Estándar Circadiana Completa)
    return {
        level: 'VERDE',
        modeCode: 'DOSIS_ESTANDAR_COMPLETA',
        badgeLabel: 'Vía Libre Biosegura • Protocolo Completo',
        title: addr.isTutorMode
            ? `Los filtros principales de ${addr.childShortRef} están en equilibrio para su acompañamiento nutricional`
            : 'Sus filtros principales están listos para su protocolo completo',
        honestExplanation: addr.isTutorMode
            ? `Los indicadores vitales de ${addr.childShortRef} permiten integrar su acompañamiento nutricional sincronizado con su horario natural de despertar y descanso.`
            : `Sus indicadores vitales permiten iniciar su acompañamiento nutricional completo, sincronizado con su horario natural de despertar y descanso${addr.isAdolescent ? ', en acompañamiento con su madre, padre o tutor legal' : ''}.`,
        ethicalNote: addr.isTutorMode
            ? `33Plus® y 34Plus® son fórmulas de nutrición celular que acompañan la alimentación diaria e hidratación constante de ${addr.childShortRef}.`
            : `33Plus® y 34Plus® son fórmulas de nutrición celular que acompañan su alimentación diaria e hidratación constante${addr.isAdolescent ? ', supervisadas junto con su madre, padre o tutor legal' : ''}.`,
        recommendedLabs: Array.from(recommendedLabsSet),
        isPaused: false,
        isMicroDose: false,
        isSelective33Paused: false,
        titrationPlanText: `Protocolo estándar sincronizado a su día: 2 tomas matutinas de 33Plus® (${FORMULA_33PLUS.sachetGramsDisplay} c/u en 300 ml de agua) y 2 tomas vespertinas/nocturnas de 34Plus® (${FORMULA_34PLUS.sachetGramsDisplay} c/u en MÍNIMO 500 ml de agua simple 💧).`
    };
}

function buildOrthomolecularPrescription(
    patientData,
    processedNodes = [],
    serum,
    bioenergetics,
    hasStimulantsConflict,
    biosecuritySemaphore = null,
    canonicalContract = null,
    addressingOverride = null
) {
    const fallbackAge = Number(
        patientData?.identityLock?.patientInfo?.age ??
        patientData?.profile?.age ??
        patientData?.identificacion?.edad ??
        patientData?.age ??
        30
    );
    const safeFallbackAge = Number.isFinite(fallbackAge) && fallbackAge >= 0 ? fallbackAge : 30;
    const addr = addressingOverride || resolveClinicalAddressing({
        patientName:
            patientData?.profile?.name ||
            patientData?.profile?.first_name ||
            patientData?.identificacion?.nombre ||
            patientData?.identityLock?.patientInfo?.name ||
            (safeFallbackAge < 2 ? 'su bebé' : 'Paciente'),
        ageYears: safeFallbackAge,
        isFemale: resolveBackendPatientIsFemale(patientData),
        isLactanteExplicit: Boolean(patientData?.isLactante || safeFallbackAge < 2)
    });

    const semaphore = biosecuritySemaphore || evaluateBiosecurityAndTitration(
        patientData,
        serum,
        addr.ageYears,
        patientData?.history?.medications || [],
        hasStimulantsConflict,
        addr.isLactante,
        addr.ageYears < 18,
        addr
    );

    const contract = canonicalContract || buildCanonicalTherapeuticContract({
        serum,
        bioenergetics,
        biosecuritySemaphore: semaphore,
        hasStimulantsConflict
    });

    // Iteración exhaustiva SSoTT sobre el 100% de hallazgos acreditados de laboratorio y gabinete (0 truncamiento .slice(0,4))
    const collectAxisBiomarkers = (targetNodeIds = []) => {
        const serumNodes = Array.isArray(serum?.nodes) ? serum.nodes : [];
        const accredited = [];
        const functionalFallback = [];
        targetNodeIds.forEach((nId) => {
            const rawNode = serumNodes.find(sn => sn.id === nId);
            if (rawNode && Array.isArray(rawNode.anomalies)) {
                rawNode.anomalies.forEach((a) => {
                    const formatted = formatMedicalBiomarkerSummary(`${a.label}: ${a.detail}`);
                    if (!formatted) return;
                    const src = String(a.source || '');
                    if (src === 'OCR_LAB' || src === 'FUNCTIONAL_INDEX' || src.startsWith('CABINET_')) {
                        if (!accredited.includes(formatted)) accredited.push(formatted);
                    } else if (!functionalFallback.includes(formatted)) {
                        functionalFallback.push(formatted);
                    }
                });
            } else {
                const procNode = processedNodes.find(pn => pn.nodeId === nId);
                (procNode?.key_biomarkers || []).forEach((b) => {
                    const formatted = formatMedicalBiomarkerSummary(b);
                    if (formatted && !functionalFallback.includes(formatted)) functionalFallback.push(formatted);
                });
            }
        });
        return accredited.length > 0 ? accredited : functionalFallback.slice(0, 5);
    };

    const energyBiomarkers = collectAxisBiomarkers(['NODO_3_ENERGIA', 'NODO_5_TRANSPORTE']);
    const tissueBiomarkers = collectAxisBiomarkers(['NODO_1_ASIMILACION', 'NODO_2_BIOTRANSFORMACION', 'NODO_4_COMUNICACION', 'NODO_6_DEFENSA', 'NODO_7_ESTRUCTURAL']);

    const anamnesisOrtho = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
    const isSelective33Paused = Boolean(contract.isSelective33Paused || semaphore.isSelective33Paused) && !semaphore.isPaused;
    const isSelective34Paused = Boolean(contract.isSelective34Paused || semaphore.isSelective34Paused) && !semaphore.isPaused;
    const scaled33 = contract.posology?.scaled33 || formatScaledActives('33PLUS', (semaphore.isPaused || isSelective33Paused) ? 0 : (semaphore.isMicroDose ? 0.5 : 2));
    const scaled34 = contract.posology?.scaled34 || formatScaledActives('34PLUS', (semaphore.isPaused || isSelective34Paused) ? 0 : (semaphore.isMicroDose ? 0.5 : 2));
    const hasConductionCaution = Boolean(serum?.cabinetSignals?.hasCardiacConductionOrBradycardia);
    const hasFluidRestrictionOrtho = contract.hydrationTargetLiters === null || Boolean(anamnesisOrtho.hasMedicalFluidRestriction);
    const isNightShift = Boolean(anamnesisOrtho.isNightOrRotatingShift);
    const hasThyroidFastingSpacing = Boolean(anamnesisOrtho.hasFastingThyroidOrBisphosphonate);
    const hasCationDrugSpacing = Boolean(anamnesisOrtho.hasCationChelatedDrug);

    const collagenActive = getCatalogActiveDynamic(FORMULA_34PLUS, /COL[ÁA]GENO/i);
    const collagenNameSafe = collagenActive ? collagenActive.name : 'Colágeno Hidrolizado';
    const collagenCodeSafe = collagenActive ? collagenActive.code : '';
    const veganCollagenClinicalNote = anamnesisOrtho.isVegan
        ? ` Nota de consentimiento ético informado: contiene péptidos de ${collagenNameSafe}${collagenCodeSafe ? ` (${collagenCodeSafe})` : ''} de origen animal.`
        : '';
    const veganCollagenPatientNote = anamnesisOrtho.isVegan
        ? ` Nota de transparencia ética: le informamos con total respeto a su elección vegana que 34Plus® incorpora péptidos de ${collagenNameSafe.toLowerCase()} de origen animal, para que usted decida su integración con pleno consentimiento informado.`
        : '';

    const fastingToma1Slot = isNightShift
        ? (hasThyroidFastingSpacing
            ? 'Al menos 60 min después de su medicamento tras despertar (primeras 4 h post-despertar; suspender >= 8 h antes de su sueño diurno)'
            : 'Al iniciar su jornada tras despertar (dentro de las primeras 4 h post-despertar; suspender >= 8 h antes de su sueño diurno)')
        : (hasThyroidFastingSpacing
            ? 'Al menos 60 min después de su medicamento en ayunas (antes de las 14:00 h)'
            : 'Al despertar en ayunas (antes de las 14:00 h)');
    const fastingSpacingSuffix = hasThyroidFastingSpacing
        ? ' • Respetar separación mínima de 60 minutos después de su medicamento en ayunas tomado solo con agua simple'
        : '';
    const sleepToma4Slot = isNightShift
        ? '30 a 60 min antes de iniciar su bloque principal de descanso diurno (nunca antes ni durante su turno nocturno operativo)'
        : '30 a 60 min antes de dormir';
    const cationSpacingSuffix = hasCationDrugSpacing
        ? ' • Separar al menos 3 horas respecto a su antibiótico o suplemento de hierro oral para evitar interferencia mineral'
        : '';
    const cutoffShortText = isNightShift
        ? 'suspender al menos 8 horas antes de su horario programado de sueño diurno'
        : 'antes de las 14:00 h';
    const cutoffFriendlyText = isNightShift
        ? 'suspendiéndolo al menos 8 horas antes de su descanso diurno'
        : 'siempre antes de las 2:00 PM';

    const label33Formula = '🔴 33Plus® (Energía Celular y Circulación)';

    let circadianSchedule = [];
    let sup33 = null;
    let sup34 = null;
    let protocolName = 'Protocolo Circadiano Dual de Restauración Celular (33Plus® y 34Plus®)';

    if (semaphore.isPaused) {
        const isMaternalPause = semaphore.modeCode === 'PAUSA_PREVENTIVA_MATERNA';
        protocolName = addr.isLactante
            ? 'Prioridad Pediátrica • Lactancia y Alimentación Guiada (0 Sobres Adultos)'
            : isMaternalPause
                ? 'Protección Materno-Fetal • Nutrición Gestacional Completa (0 Sobres hasta Aval Obstétrico)'
                : 'Pausa Preventiva de Suplementación • Prioridad Alimentación e Hidratación';
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: isNightShift ? 'Al despertar e iniciar su jornada' : 'Al despertar en ayunas',
                phase: 'PAUSA PREVENTIVA — Hidratación Protectora Inicial',
                formula: '💧 Agua natural purificada (Suplementos en pausa preventiva)',
                dosage: addr.isLactante
                    ? '0 sobres activos • Continuar lactancia materna o fórmula indicada por su pediatra'
                    : hasFluidRestrictionOrtho
                        ? '0 sobres activos • Respetar estrictamente el techo diario de líquidos totales indicado por su especialista (sin cargas hídricas extra)'
                        : '0 sobres activos • Beber 300 ml de agua simple a sorbos pausados',
                clinicalObjective: hasFluidRestrictionOrtho
                    ? 'Resguardar equilibrio hemodinámico e hidroelectrolítico bajo restricción médica de volumen (0 sobres activos).'
                    : 'Proteger la filtración renal, hepática y estabilidad hemodinámica mientras se validan estudios o autorización médica.',
                patientObjective: addr.isLactante
                    ? `Respetar la etapa de lactancia y maduración digestiva de ${addr.childShortRef} bajo guía pediátrica.`
                    : hasFluidRestrictionOrtho
                        ? 'Cuidar su equilibrio de líquidos siguiendo exactamente el volumen diario autorizado por su médico especialista.'
                        : (addr.isTutorMode
                            ? `Hidratar suavemente el organismo de ${addr.childShortRef} al despertar sin sobrecargar sus filtros naturales.`
                            : 'Hidratar suavemente sus órganos al despertar sin sobrecargar sus filtros naturales.'),
                waterVolumeMl: (addr.isLactante || hasFluidRestrictionOrtho) ? 0 : 300,
                isPaused: true
            },
            {
                tomaNumber: 2,
                timeSlot: sleepToma4Slot,
                phase: 'PAUSA PREVENTIVA — Descanso y Vigilancia Clínica',
                formula: '💧 Hidratación ligera controlada (Pendiente revisión médica)',
                dosage: hasFluidRestrictionOrtho
                    ? '0 sobres activos • Sin carga hídrica nocturna adicional (apego al techo médico de líquidos)'
                    : '0 sobres activos • Pendiente valoración médica de control',
                clinicalObjective: 'Resguardar bioseguridad clínica bajo NOM-004 hasta contar con validación médica presencial.',
                patientObjective: addr.isTutorMode
                    ? `Favorecer un descanso tranquilo para ${addr.childShortRef} mientras completamos su valoración médica.`
                    : 'Favorecer un descanso tranquilo mientras completamos su valoración médica de control.',
                waterVolumeMl: (addr.isLactante || hasFluidRestrictionOrtho) ? 0 : 250,
                isPaused: true
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: '33Plus® (En Pausa Preventiva de Bioseguridad)',
            name: scaled33.clinicalHeaderName,
            dosage: '0 sobres activos (Pausa preventiva por prioridad médica)',
            timing: addr.isLactante
                ? 'No indicado en menores de 2 años (etapa exclusiva de lactancia/pediatría)'
                : isMaternalPause
                    ? 'En pausa preventiva materna hasta contar con autorización escrita de su gineco-obstetra'
                    : 'Se activará únicamente tras revisión médica de sus estudios de laboratorio',
            clinical_timing: addr.isLactante
                ? 'Contraindicado en lactantes menores de 2 años (etapa exclusiva de lactancia y pediatría)'
                : isMaternalPause
                    ? 'Diferido en etapa gestacional hasta autorización expresa por escrito de Ginecología y Obstetricia'
                    : 'Diferido temporalmente hasta valoración médica de estudios de control',
            rationale: addr.isLactante
                ? 'PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004 / NOM-043): Exclusión obligatoria de fórmulas concentradas para adultos en lactantes menores de 2 años.'
                : isMaternalPause
                    ? 'PAUSA PREVENTIVA MATERNO-FETAL (NOM-004 / NOM-043): Prioridad en nutrición gestacional completa; suplementación concentrada sujeta a aval escrito gineco-obstétrico.'
                    : 'PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004): Diferimiento temporal de suplementación concentrada hasta acreditación de laboratorios de control y estabilización orgánica del paciente.',
            patient_rationale: addr.isLactante
                ? 'En menores de 2 años no se utilizan fórmulas concentradas para adultos; la base nutricional exclusiva es la indicada por su pediatra.'
                : isMaternalPause
                    ? 'Durante su embarazo priorizamos al 100 % su alimentación natural completa y mantenemos 33Plus® en pausa hasta contar con el visto bueno escrito de su médico gineco-obstetra.'
                    : (addr.isTutorMode
                        ? `Por cuidado a la salud de ${addr.childShortRef}, mantenemos 33Plus® en pausa temporal hasta revisar sus análisis y confirmar que sus filtros naturales estén listos.`
                        : 'Por cuidado a su salud, mantenemos 33Plus® en pausa temporal hasta revisar sus análisis y confirmar que sus filtros naturales estén listos.'),
            status: 'paused_by_biosecurity'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: '34Plus® (En Pausa Preventiva de Bioseguridad)',
            name: scaled34.clinicalHeaderName,
            dosage: '0 sobres activos (Pausa preventiva por prioridad médica)',
            timing: addr.isLactante
                ? 'No indicado en menores de 2 años (etapa exclusiva de lactancia/pediatría)'
                : isMaternalPause
                    ? 'En pausa preventiva materna hasta contar con autorización escrita de su gineco-obstetra'
                    : 'Se activará únicamente tras revisión médica de sus estudios de laboratorio',
            clinical_timing: addr.isLactante
                ? 'Contraindicado en lactantes menores de 2 años (etapa exclusiva de lactancia y pediatría)'
                : isMaternalPause
                    ? 'Diferido en etapa gestacional hasta autorización expresa por escrito de Ginecología y Obstetricia'
                    : 'Diferido temporalmente hasta valoración médica de estudios de control',
            rationale: addr.isLactante
                ? 'PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004 / NOM-043): Exclusión obligatoria de fórmulas concentradas para adultos en lactantes menores de 2 años.'
                : isMaternalPause
                    ? `PAUSA PREVENTIVA MATERNO-FETAL (NOM-004 / NOM-043): Suplementación diferida hasta autorización escrita gineco-obstétrica.${veganCollagenClinicalNote}`
                    : `PAUSA PREVENTIVA DE BIOSEGURIDAD (NOM-004): Diferimiento temporal de suplementación concentrada hasta acreditación de laboratorios de control y estabilización orgánica del paciente.${veganCollagenClinicalNote}`,
            patient_rationale: addr.isLactante
                ? `Mantenemos 34Plus® fuera del esquema de ${addr.childShortRef}, priorizando su alimentación natural acorde a la pauta pediátrica.`
                : isMaternalPause
                    ? 'Mantenemos 34Plus® en pausa preventiva durante su embarazo hasta contar con la autorización por escrito de su médico gineco-obstetra.'
                    : (addr.isTutorMode
                        ? `Mantenemos 34Plus® en pausa preventiva mientras cuidamos la hidratación y alimentación natural de ${addr.childShortRef} en casa.`
                        : 'Mantenemos 34Plus® en pausa preventiva mientras cuidamos su hidratación y alimentación natural en casa.'),
            status: 'paused_by_biosecurity'
        };
    } else if (isSelective34Paused) {
        const k2Act = getCatalogActiveDynamic(FORMULA_34PLUS, /VITAMINA\s+K2/i);
        const k2ClinText = k2Act ? `${k2Act.name} ${k2Act.code} (${k2Act.amountNumeric} ${k2Act.unit}/sobre)` : 'Vitamina K2 MK-7';
        const cardioNote34Sel = hasConductionCaution
            ? ` • ${isNightShift ? 'Suspender >= 8 h antes de su sueño diurno' : 'Corte estricto antes de las 14:00 h'} y vigilancia de FC ${formatBiometricMonitorPrepClause()}`
            : '';
        protocolName = 'Protocolo de Protección Anticoagulante (Micro-Dosis 33Plus® • 34Plus® en Pausa Selectiva de INR)';
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: fastingToma1Slot,
                phase: 'FASE INICIAL — Energía Celular Gradual (33Plus®)',
                formula: label33Formula,
                dosage: `1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) disuelto en 300 ml de agua natural o tibia${fastingSpacingSuffix}${cardioNote34Sel}`,
                clinicalObjective: `Aporte controlado al 50 % de 33Plus® (${scaled33.activeListText}) sin interferir con la vía de la Vitamina K.`,
                patientObjective: `Apoyar su energía y circulación de forma suave (${cutoffFriendlyText}), respetando íntegramente su tratamiento anticoagulante.`,
                waterVolumeMl: 300,
                isMicroDose: true
            },
            {
                tomaNumber: 2,
                timeSlot: sleepToma4Slot,
                phase: 'FASE DE DESCANSO — Protección de Anticoagulación (34Plus® en Pausa Selectiva)',
                formula: '💧 Hidratación Suave (34Plus® en pausa selectiva: 0 sobres activos)',
                dosage: hasFluidRestrictionOrtho
                    ? '0 sobres activos de 34Plus® • Respetar su techo médico diario de líquidos'
                    : '0 sobres activos de 34Plus® • Beber 250 ml de agua simple natural',
                clinicalObjective: `Pausa selectiva estricta de 34Plus® para evitar antagonismo farmacodinámico de ${k2ClinText} sobre anticoagulantes cumarínicos y preservar estabilidad del INR.`,
                patientObjective: 'Proteger la estabilidad exacta de su medicamento anticoagulante (INR) manteniendo 34Plus® en pausa preventiva.',
                waterVolumeMl: hasFluidRestrictionOrtho ? 0 : 250,
                isPaused: true,
                isMicroDose: true
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: '33Plus® (Micro-Dosis Gradual • Energía y Circulación)',
            name: scaled33.clinicalHeaderName,
            dosage: FORMULA_33PLUS.dosageByMode.MICRO_DOSE,
            timing: `Sincronizado a su despertar (${cutoffFriendlyText}${hasThyroidFastingSpacing ? '; >= 60 min post-medicamento en ayunas' : ''})`,
            clinical_timing: `Sincronizado al despertar (${cutoffShortText}${hasThyroidFastingSpacing ? '; >= 60 min post-fármaco en ayunas' : ''})`,
            rationale: `${scaled33.regulatorySummary}.${energyBiomarkers.length > 0 ? ` Hallazgos objetivos integrados (${energyBiomarkers.length}): ${energyBiomarkers.join(' | ')}.` : ''}`,
            patient_rationale: `${addr.directObjCap} acompaña con L-Taurina, L-Carnitina, Coenzima Q10, semilla de uva, vitamina C y cromo, iniciando con medio sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}, ${cutoffFriendlyText}) bajo vigilancia médica.`,
            status: 'approved'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: '34Plus® (En Pausa Selectiva Estricta por Protección de INR)',
            name: scaled34.clinicalHeaderName,
            dosage: '0 sobres activos de 34Plus® (Pausa selectiva por tratamiento anticoagulante antagonista de Vitamina K)',
            timing: 'En pausa selectiva estricta mientras mantenga anticoagulación cumarínica',
            clinical_timing: `Contraindicación farmacodinámica selectiva: 0 sobres activos por contenido de ${k2ClinText} frente a cumarínicos (Warfarina/Acenocumarol)`,
            rationale: `PAUSA SELECTIVA FARMACOLÓGICA (NOM-004): Se excluye 34Plus® (0 sobres activos) debido a que ${k2ClinText} antagoniza directamente a los anticoagulantes cumarínicos y reduce el INR.${veganCollagenClinicalNote}`,
            patient_rationale: `Por su seguridad cardiovascular, mantenemos 34Plus® en pausa estricta (0 sobres activos) porque contiene ${k2Act ? k2Act.name : 'Vitamina K2 MK-7'}, un nutriente que modificaría el efecto de su medicamento anticoagulante (INR).`,
            status: 'paused_by_biosecurity'
        };
    } else if (isSelective33Paused) {
        protocolName = 'Protocolo de Protección Selectiva (33Plus® en Pausa Preventiva • Micro-Dosis 34Plus®)';
        const selReason = contract.selective33ReasonText || 'precaución farmacológica o fisiológica activa';
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: isNightShift ? 'Al iniciar su jornada tras despertar' : 'Al despertar en ayunas',
                phase: 'FASE INICIAL — Hidratación Protectora (33Plus® en Pausa Selectiva)',
                formula: '💧 Hidratación Preparatoria (33Plus® en pausa selectiva: 0 sobres activos)',
                dosage: hasFluidRestrictionOrtho
                    ? '0 sobres activos de 33Plus® • Hidratación sujeta al techo diario indicado por su médico'
                    : '0 sobres activos de 33Plus® • Beber 300 ml de agua simple natural',
                clinicalObjective: `Pausa selectiva preventiva de ergogénicos naturales de 33Plus® por ${selReason}, preservando estabilidad autonómica y cardiovascular.`,
                patientObjective: addr.isTutorMode
                    ? `Hidratar suavemente el organismo de ${addr.childShortRef} por la mañana manteniendo 33Plus® en pausa de seguridad.`
                    : 'Hidratar suavemente su organismo al despertar manteniendo 33Plus® en pausa preventiva de seguridad.',
                waterVolumeMl: hasFluidRestrictionOrtho ? 0 : 300,
                isPaused: true,
                isMicroDose: true
            },
            {
                tomaNumber: 2,
                timeSlot: isNightShift ? 'A mitad de su primera mitad de jornada' : 'A media mañana',
                phase: 'FASE INTERMEDIA — Hidratación Preparatoria Continua',
                formula: '💧 Hidratación Preparatoria (Agua Simple)',
                dosage: hasFluidRestrictionOrtho
                    ? 'Sorbos medidos dentro del límite hídrico de su especialista'
                    : '300 ml de agua simple purificada a sorbos',
                clinicalObjective: 'Sostener perfusión tisular e hidratación celular sin estímulo simpaticomimético.',
                patientObjective: addr.isTutorMode
                    ? `Mantener la hidratación natural de ${addr.childShortRef} a mitad de la mañana.`
                    : 'Mantener su hidratación natural constante durante su jornada.',
                waterVolumeMl: hasFluidRestrictionOrtho ? 0 : 300,
                isPaused: true,
                isMicroDose: true
            },
            {
                tomaNumber: 3,
                timeSlot: isNightShift ? 'Segunda mitad de su jornada activa' : 'A media tarde',
                phase: 'FASE VESPERTINA — Hidratación de Limpieza Renal y Digestiva',
                formula: '💧 Hidratación Preparatoria (Agua Simple)',
                dosage: hasFluidRestrictionOrtho
                    ? 'Sorbos medidos respetando su techo médico de líquidos'
                    : '500 ml de agua simple purificada a sorbos 💧',
                clinicalObjective: 'Mantener flujo urinario adecuado y preparar la mucosa intestinal para la reparación.',
                patientObjective: addr.isTutorMode
                    ? `Ayudar a los riñones e intestino de ${addr.childShortRef} a limpiar desechos suavemente.`
                    : 'Ayudar a sus riñones e intestino a limpiar desechos suavemente.',
                waterVolumeMl: hasFluidRestrictionOrtho ? 0 : 500,
                isMicroDose: true
            },
            {
                tomaNumber: 4,
                timeSlot: sleepToma4Slot,
                phase: 'FASE DE DESCANSO — Reparación Suave de Tejidos y Mucosa Digestiva',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: `1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) disuelto en MÍNIMO 500 ml de agua simple 💧${cationSpacingSuffix}`,
                clinicalObjective: `Aporte controlado en micro-dosis (${scaled34.activeListText}) con amplia dilución hídrica.${veganCollagenClinicalNote}`,
                patientObjective: addr.isTutorMode
                    ? `Nutrir articulaciones, piel y digestión mientras ${addr.childShortRef} descansa, siempre con suficiente agua simple.`
                    : `Nutrir sus articulaciones, piel y digestión durante su bloque principal de descanso, siempre con suficiente agua simple.${veganCollagenPatientNote}`,
                waterVolumeMl: 500,
                isMicroDose: true
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: '33Plus® (En Pausa Selectiva de Bioseguridad)',
            name: scaled33.clinicalHeaderName,
            dosage: FORMULA_33PLUS.dosageByMode.PAUSED_SELECTIVE_33,
            timing: 'En pausa selectiva preventiva (sustituir por agua simple al despertar)',
            clinical_timing: 'Pausa selectiva (0 sobres activos por precaución autonómica/fisiológica)',
            rationale: `PAUSA SELECTIVA DE BIOSEGURIDAD (NOM-004): Se difiere temporalmente la administración de 33Plus® (0 sobres activos) ante ${selReason}, preservando intacta la reparación tisular con 34Plus®.`,
            patient_rationale: addr.isTutorMode
                ? `Por seguridad y cuidado del sistema nervioso y cardiovascular de ${addr.childShortRef}, mantenemos 33Plus® en pausa preventiva (0 sobres activos) mientras acompañamos su hidratación natural.`
                : `Por seguridad clínica ante ${selReason}, mantenemos 33Plus® en pausa selectiva preventiva (0 sobres activos) y priorizamos su hidratación natural.`,
            status: 'paused_by_biosecurity'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: '34Plus® (Micro-Dosis Gradual • Reparación y Digestión)',
            name: scaled34.clinicalHeaderName,
            dosage: `${FORMULA_34PLUS.dosageByMode.MICRO_DOSE}${hasCationDrugSpacing ? ' (separar >= 3 h de antibiótico o hierro oral)' : ''}`,
            timing: `${sleepToma4Slot} (siempre en medio litro de agua simple 💧)`,
            clinical_timing: `Sincronizado a ventana pre-descanso (${sleepToma4Slot} en mínimo 500 ml de agua simple 💧${hasCationDrugSpacing ? '; separar >= 3 h de quinolonas/tetraciclinas/hierro' : ''})`,
            rationale: `${scaled34.regulatorySummary}.${tissueBiomarkers.length > 0 ? ` Hallazgos objetivos integrados (${tissueBiomarkers.length}): ${tissueBiomarkers.join(' | ')}.` : ''}${veganCollagenClinicalNote}`,
            patient_rationale: addr.isTutorMode
                ? `Trabaja mientras ${addr.childShortRef} descansa aportando colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, magnesio, vitamina C, vitamina K2 y zinc (${FORMULA_34PLUS.halfSachetGramsDisplay} en medio litro de agua simple 💧).`
                : `Trabaja durante su descanso principal aportando colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, citrato de magnesio, vitamina C, vitamina K2 MK-7 y zinc (1/2 sobre de ${FORMULA_34PLUS.halfSachetGramsDisplay} —50% del sobre oficial de ${FORMULA_34PLUS.sachetGramsDisplay}— en mínimo 500 ml de agua simple 💧).${veganCollagenPatientNote}`,
            status: 'approved'
        };
    } else if (semaphore.isMicroDose) {
        const priorAdh = serum?.priorAdherence || contract?.priorAdherence || detectPriorInstitutionalAdherence(patientData);
        const isRecalibration = Boolean(semaphore.isRecalibrationMode || contract?.isRecalibrationMode || (!addr.isTutorMode && priorAdh?.hasPriorAdherence));
        const activeList33Safe = scaled33.activeListText || scaled33.activesInline || 'L-Taurina, L-Carnitina, Coenzima Q10, Semilla de Uva, Vitamina C y Picolinato de Cromo';
        const activeList34Safe = scaled34.activeListText || scaled34.activesInline || 'Colágeno Hidrolizado, L-Teanina, L-Glicina, FOS-Inulina, Citrato de Magnesio, Vitamina C, Vitamina K2 MK-7 y Zinc';
        protocolName = isRecalibration
            ? 'Protocolo de Recalibración Preventiva de Dosis (Ajuste Calibrado 33Plus® y 34Plus®)'
            : 'Protocolo de Inicio Gradual Calibrado (Micro-Dosis Protectora 33Plus® y 34Plus®)';
        const cardioTimingNote = hasConductionCaution
            ? ` • ${isNightShift ? 'Suspender >= 8 h antes de su sueño diurno' : 'Corte estricto antes de las 14:00 h'} y vigilancia de FC ${formatBiometricMonitorPrepClause()}`
            : '';
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: fastingToma1Slot,
                phase: isRecalibration
                    ? 'FASE INICIAL — Recalibración Preventiva de Energía y Circulación'
                    : 'FASE INICIAL — Adaptación Suave de Energía y Circulación',
                formula: label33Formula,
                dosage: `1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) disuelto en 300 ml de agua natural o tibia${fastingSpacingSuffix}${cardioTimingNote}`,
                clinicalObjective: `Aporte escalado al 50% de sobre oficial de ${FORMULA_33PLUS.sachetGramsDisplay} (${activeList33Safe}) respetando tolerancia gástrica, farmacocinética en ayunas y conducción cardiovascular.`,
                patientObjective: addr.isTutorMode
                    ? `Apoyar la energía matutina y la circulación de ${addr.childShortRef} de forma suave y progresiva.`
                    : isRecalibration
                        ? `Sostener su energía y circulación con dosis recalibrada de precisión (${cutoffFriendlyText}).`
                        : `Encender su energía inicial y apoyar su circulación de forma suave y progresiva (${cutoffFriendlyText}).`,
                waterVolumeMl: 300,
                isMicroDose: true,
                isRecalibration
            },
            {
                tomaNumber: 2,
                timeSlot: isNightShift
                    ? '4 h después de despertar (Semana 1: solo agua • Semana 2: valorar escalamiento)'
                    : 'A media mañana (Semana 1: solo agua • Semana 2: valorar escalamiento)',
                phase: 'FASE INTERMEDIA — Hidratación Preparatoria y Escalamiento Gradual',
                formula: '💧 Hidratación Preparatoria (Agua Simple en Semana 1)',
                dosage: `Iniciar solo con 300 ml de agua natural (Semana 1) • Valorar 1/2 sobre adicional (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® en Semana 2 según tolerancia`,
                clinicalObjective: `Ventana de hidratación preparatoria en Semana 1; titulación escalonada en Semana 2 sujeta a tolerancia digestiva, respuesta cardiovascular ${formatBiometricMonitorPrepClause()} y seguimiento clínico.`,
                patientObjective: addr.isTutorMode
                    ? `Hidratar a ${addr.childShortRef} con agua natural la primera semana antes de valorar una segunda toma.`
                    : 'Hidratar su organismo con agua simple durante la primera semana antes de valorar una segunda toma.',
                waterVolumeMl: 300,
                isMicroDose: true
            },
            {
                tomaNumber: 3,
                timeSlot: isNightShift ? 'Mitad vespertina/nocturna de su jornada' : 'A media tarde',
                phase: 'FASE INTERMEDIA — Hidratación de Limpieza Renal y Digestiva',
                formula: '💧 Hidratación Preparatoria (Agua Simple)',
                dosage: '500 ml de agua simple purificada a sorbos 💧',
                clinicalObjective: 'Mantener flujo urinario constante y preparar la mucosa intestinal para la reparación.',
                patientObjective: addr.isTutorMode
                    ? `Ayudar a los riñones e intestino de ${addr.childShortRef} a limpiar desechos suavemente.`
                    : 'Ayudar a sus riñones e intestino a limpiar desechos suavemente.',
                waterVolumeMl: 500,
                isMicroDose: true
            },
            {
                tomaNumber: 4,
                timeSlot: sleepToma4Slot,
                phase: isRecalibration
                    ? 'FASE DE DESCANSO — Recalibración de Tejidos y Mucosa Digestiva'
                    : 'FASE DE DESCANSO — Reparación Suave de Tejidos y Mucosa Digestiva',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: `1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) disuelto en MÍNIMO 500 ml de agua simple 💧${cationSpacingSuffix}`,
                clinicalObjective: `Aporte escalado al 50% de sobre oficial de ${FORMULA_34PLUS.sachetGramsDisplay} (${activeList34Safe}) con amplia dilución hídrica.${veganCollagenClinicalNote}`,
                patientObjective: addr.isTutorMode
                    ? `Nutrir articulaciones, piel y digestión mientras ${addr.childShortRef} duerme, siempre con suficiente agua simple.`
                    : `Nutrir sus articulaciones, piel y digestión durante su descanso principal, siempre con suficiente agua simple.${veganCollagenPatientNote}`,
                waterVolumeMl: 500,
                isMicroDose: true,
                isRecalibration
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: isRecalibration
                ? '33Plus® (Recalibración Preventiva • Energía y Circulación)'
                : '33Plus® (Micro-Dosis Gradual • Energía y Circulación)',
            name: scaled33.clinicalHeaderName,
            dosage: isRecalibration
                ? (FORMULA_33PLUS.dosageByMode.RECALIBRATION_DOSE || FORMULA_33PLUS.dosageByMode.MICRO_DOSE)
                : FORMULA_33PLUS.dosageByMode.MICRO_DOSE,
            timing: addr.isTutorMode
                ? `Sincronizado al despertar de ${addr.childShortRef} (evitar ofrecerlo después de las 2:00 PM)`
                : `Sincronizado a su despertar real (${cutoffFriendlyText}${hasThyroidFastingSpacing ? '; >= 60 min después de su medicamento en ayunas' : ''}${hasConductionCaution ? ` y vigilancia ${formatBiometricMonitorPrepClause()}` : ''})`,
            clinical_timing: `Sincronizado al despertar del paciente (${cutoffShortText}${hasThyroidFastingSpacing ? '; separar >= 60 min post-fármaco en ayunas' : ''}${hasConductionCaution ? ` y vigilancia cronotrópica ${formatBiometricMonitorPrepClause()}` : ''})`,
            rationale: `${scaled33.regulatorySummary}.${energyBiomarkers.length > 0 ? ` Hallazgos objetivos integrados (${energyBiomarkers.length}): ${energyBiomarkers.join(' | ')}.` : ''}`,
            patient_rationale: addr.isTutorMode
                ? `Acompaña a ${addr.childShortRef} por la mañana con L-Taurina, L-Carnitina, Coenzima Q10, semilla de uva, vitamina C y cromo para apoyar su energía diaria y circulación, iniciando con medio sobre (${FORMULA_33PLUS.halfSachetGramsDisplay} —50% del sobre de ${FORMULA_33PLUS.sachetGramsDisplay}—) para cuidar su adaptación.`
                : isRecalibration
                    ? `Continuamos su adherencia previa con 33Plus® aportando L-Taurina, L-Carnitina, Coenzima Q10, antioxidantes de semilla de uva, vitamina C y picolinato de cromo, recalibrando preventivamente su toma inicial a medio sobre (${FORMULA_33PLUS.halfSachetGramsDisplay} —50% del sobre oficial de ${FORMULA_33PLUS.sachetGramsDisplay}—, ${cutoffFriendlyText}) para acompañar con total seguridad su conducción cardiovascular.`
                    : `${addr.directObjCap} acompaña al iniciar su día con L-Taurina, L-Carnitina, Coenzima Q10, antioxidantes de semilla de uva, vitamina C y picolinato de cromo para apoyar su energía diaria y la flexibilidad de su circulación, iniciando con medio sobre (${FORMULA_33PLUS.halfSachetGramsDisplay} —50% del sobre oficial de ${FORMULA_33PLUS.sachetGramsDisplay}—, ${cutoffFriendlyText}) para cuidar su adaptación.`,
            status: 'approved'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: isRecalibration
                ? '34Plus® (Recalibración Preventiva • Reparación y Digestión)'
                : '34Plus® (Micro-Dosis Gradual • Reparación y Digestión)',
            name: scaled34.clinicalHeaderName,
            dosage: isRecalibration
                ? (FORMULA_34PLUS.dosageByMode.RECALIBRATION_DOSE || FORMULA_34PLUS.dosageByMode.MICRO_DOSE)
                : FORMULA_34PLUS.dosageByMode.MICRO_DOSE,
            timing: `${sleepToma4Slot} (siempre en medio litro de agua simple 💧${hasCationDrugSpacing ? '; separar >= 3 h de su antibiótico o hierro' : ''})`,
            clinical_timing: `Sincronizado a ventana pre-descanso (${sleepToma4Slot} en mínimo 500 ml de agua simple 💧${hasCationDrugSpacing ? '; separar >= 3 h de quinolonas/tetraciclinas/hierro' : ''})`,
            rationale: `${scaled34.regulatorySummary}.${tissueBiomarkers.length > 0 ? ` Hallazgos objetivos integrados (${tissueBiomarkers.length}): ${tissueBiomarkers.join(' | ')}.` : ''}${veganCollagenClinicalNote}`,
            patient_rationale: addr.isTutorMode
                ? `Trabaja mientras ${addr.childShortRef} descansa aportando colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, magnesio, vitamina C, vitamina K2 y zinc (${FORMULA_34PLUS.halfSachetGramsDisplay} —50% del sobre de ${FORMULA_34PLUS.sachetGramsDisplay}— en medio litro de agua simple 💧).`
                : isRecalibration
                    ? `Mantenemos su soporte pre-descanso con 34Plus® (colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, citrato de magnesio, vitamina C, vitamina K2 MK-7 y zinc), recalibrando preventivamente su posología a 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay} —50% del sobre oficial de ${FORMULA_34PLUS.sachetGramsDisplay}— en mínimo 500 ml de agua simple 💧) para optimizar la absorción digestiva y el descanso.${veganCollagenPatientNote}`
                    : `Trabaja durante su bloque principal de descanso aportando colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, citrato de magnesio, vitamina C, vitamina K2 MK-7 y zinc para su digestión, descanso, piel y articulaciones (1/2 sobre de ${FORMULA_34PLUS.halfSachetGramsDisplay} —50% del sobre oficial de ${FORMULA_34PLUS.sachetGramsDisplay}— en mínimo 500 ml de agua simple 💧).${veganCollagenPatientNote}`,
            status: 'approved'
        };
    } else {
        const isEstablishedContinuity = Boolean(
            semaphore.isEstablishedContinuityFullDose ||
            semaphore.modeCode === 'CONTINUIDAD_CALIBRADA_DOSIS_COMPLETA' ||
            contract?.isEstablishedContinuityFullDose
        );
        if (isEstablishedContinuity) {
            protocolName = 'Protocolo de Continuidad Calibrada en Dosis Completa (33Plus® y 34Plus®)';
        }
        const cardioFullDoseSuffix = hasConductionCaution
            ? ` • Vigilancia de FC ${formatBiometricMonitorPrepClause()}`
            : '';
        circadianSchedule = [
            {
                tomaNumber: 1,
                timeSlot: isNightShift
                    ? (hasThyroidFastingSpacing ? 'Al menos 60 min después de su medicamento tras despertar' : 'Al iniciar su jornada tras despertar')
                    : (hasThyroidFastingSpacing ? 'Al menos 60 min después de su medicamento en ayunas' : 'Al despertar en ayunas'),
                phase: isEstablishedContinuity
                    ? 'FASE ACTIVA — Continuidad de Energía Celular y Circulación'
                    : 'FASE ACTIVA — Encendido de Energía Celular y Circulación',
                formula: label33Formula,
                dosage: `1 sobre (${FORMULA_33PLUS.sachetGramsDisplay}) disuelto en 300 ml de agua natural o tibia${fastingSpacingSuffix}${cardioFullDoseSuffix}`,
                clinicalObjective: 'Inducción de energía mitocondrial, oxigenación tisular y soporte endotelial respetando biodisponibilidad en ayunas.',
                patientObjective: addr.isTutorMode
                    ? `Impulsar la energía natural y atención matutina de ${addr.childShortRef} desde temprano.`
                    : 'Despertar su energía natural con claridad y apoyar una circulación ligera desde el inicio de su jornada.',
                waterVolumeMl: 300,
                isEstablishedContinuityFullDose: isEstablishedContinuity
            },
            {
                tomaNumber: 2,
                timeSlot: isNightShift
                    ? 'Aprox. 4 h después de despertar (suspender >= 8 h antes de su sueño diurno)'
                    : 'A media mañana (aprox. 4 h después de despertar, antes de las 14:00 h)',
                phase: 'FASE ACTIVA — Estabilidad de Energía y Circulación',
                formula: label33Formula,
                dosage: `1 sobre (${FORMULA_33PLUS.sachetGramsDisplay}) disuelto en 300 ml de agua natural${isEstablishedContinuity ? ' (según su pauta habitual de 1 a 2 sobres/día)' : ''}`,
                clinicalObjective: 'Protección antioxidante vascular y sensibilidad metabólica respetando corte circadiano.',
                patientObjective: addr.isTutorMode
                    ? `Mantener la vitalidad de ${addr.childShortRef} estable a mitad del día.`
                    : 'Mantener su vitalidad estable a mitad de su jornada evitando bajones de energía.',
                waterVolumeMl: 300,
                isEstablishedContinuityFullDose: isEstablishedContinuity
            },
            {
                tomaNumber: 3,
                timeSlot: isNightShift ? 'Segunda mitad de su jornada (previo a su descanso)' : 'A media tarde',
                phase: 'FASE DE TRANSICIÓN — Bienestar Digestivo y Desinflamación',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: `1 sobre (${FORMULA_34PLUS.sachetGramsDisplay}) disuelto en MÍNIMO 500 ml de agua simple 💧${cationSpacingSuffix}`,
                clinicalObjective: 'Soporte a la barrera mucosa intestinal y transición neurovegetativa.',
                patientObjective: addr.isTutorMode
                    ? `Cuidar la digestión vespertina de ${addr.childShortRef} e hidratar profundamente sus tejidos con medio litro de agua simple.`
                    : 'Cuidar su digestión e hidratar profundamente sus tejidos con medio litro de agua simple.',
                waterVolumeMl: 500,
                isEstablishedContinuityFullDose: isEstablishedContinuity
            },
            {
                tomaNumber: 4,
                timeSlot: sleepToma4Slot,
                phase: 'FASE DE DESCANSO — Reparación Profunda de Tejidos y Articulaciones',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: `1 sobre (${FORMULA_34PLUS.sachetGramsDisplay}) disuelto en MÍNIMO 500 ml de agua simple 💧${cationSpacingSuffix}`,
                clinicalObjective: `Síntesis de matriz de colágeno, relajación neuromuscular y fijación mineral.${veganCollagenClinicalNote}`,
                patientObjective: addr.isTutorMode
                    ? `Aportar a los músculos, huesos, piel y articulaciones de ${addr.childShortRef} los nutrientes que emplea para repararse mientras duerme.`
                    : `Aportar a sus músculos, huesos, piel y articulaciones los nutrientes que emplean para repararse durante su descanso.${veganCollagenPatientNote}`,
                waterVolumeMl: 500,
                isEstablishedContinuityFullDose: isEstablishedContinuity
            }
        ];

        sup33 = {
            id: 'sup_33plus',
            cortex: isEstablishedContinuity
                ? '33Plus® (Continuidad Calibrada • Energía Celular y Circulación)'
                : '33Plus® (Ignición Mitocondrial y Reología Vascular)',
            name: scaled33.clinicalHeaderName,
            dosage: isEstablishedContinuity
                ? `Continuidad calibrada en dosis completa: 1 a 2 sobres completos al día (${FORMULA_33PLUS.sachetGramsDisplay} a ${scaled33.totalGramsDisplay}) conforme a su pauta habitual consolidada, disueltos en ${FORMULA_33PLUS.minWaterMl} ml de agua natural por toma`
                : FORMULA_33PLUS.dosageByMode.STANDARD_DOSE,
            timing: addr.isTutorMode
                ? `Sincronizado a la mañana de ${addr.childShortRef} (Al despertar y a media mañana)`
                : `Sincronizado a su despertar (${cutoffFriendlyText}${hasThyroidFastingSpacing ? '; >= 60 min post-medicamento en ayunas' : ''}${hasConductionCaution ? ` y seguimiento ${formatBiometricMonitorPrepClause()}` : ''})`,
            clinical_timing: `Sincronizado al ciclo activo del paciente (${cutoffShortText}${hasThyroidFastingSpacing ? '; separar >= 60 min post-fármaco en ayunas' : ''}${hasConductionCaution ? ` y seguimiento cronotrópico ${formatBiometricMonitorPrepClause()}` : ''})`,
            rationale: `${scaled33.regulatorySummary}.${energyBiomarkers.length > 0 ? ` Hallazgos objetivos integrados (${energyBiomarkers.length}): ${energyBiomarkers.join(' | ')}.` : ' Optimización de microcirculación, oxigenación tisular diurna y metabolismo celular.'}`,
            patient_rationale: addr.isTutorMode
                ? `Acompaña a ${addr.childShortRef} por la mañana: aporta L-Taurina, L-Carnitina, antioxidantes de semilla de uva, Coenzima Q10, vitamina C y cromo (${scaled33.totalGramsDisplay}/día en 2 sobres de ${FORMULA_33PLUS.sachetGramsDisplay}) para apoyar su circulación y una energía limpia durante el día.`
                : isEstablishedContinuity
                    ? `Reconocemos su constancia consolidada: continuamos con 1 a 2 sobres completos al día de 33Plus® (${FORMULA_33PLUS.sachetGramsDisplay} a ${scaled33.totalGramsDisplay} conforme a su pauta habitual consolidada), aportando L-Taurina, L-Carnitina, Coenzima Q10, semilla de uva, vitamina C y picolinato de cromo para apoyar su circulación y energía limpia (${cutoffFriendlyText}).`
                    : `Su aliado de energía activa: ${addr.directObjLower} acompaña con L-Taurina, L-Carnitina, Coenzima Q10, semilla de uva, vitamina C y picolinato de cromo (${scaled33.totalGramsDisplay}/día en 2 sobres de ${FORMULA_33PLUS.sachetGramsDisplay}) para apoyar su circulación, su corazón y una energía limpia (${cutoffFriendlyText}).`,
            isEstablishedContinuityFullDose: isEstablishedContinuity,
            status: 'approved'
        };

        sup34 = {
            id: 'sup_34plus',
            cortex: isEstablishedContinuity
                ? '34Plus® (Continuidad Calibrada • Reparación Celular y Colágeno)'
                : '34Plus® (Ingeniería Tisular y Homeostasis Mucosa)',
            name: scaled34.clinicalHeaderName,
            dosage: isEstablishedContinuity
                ? `Continuidad calibrada en dosis completa: 1 a 2 sobres completos al día (${FORMULA_34PLUS.sachetGramsDisplay} a ${scaled34.totalGramsDisplay}) conforme a su pauta habitual consolidada, cada sobre disuelto en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`
                : FORMULA_34PLUS.dosageByMode.STANDARD_DOSE,
            timing: `Previo y 30–60 min antes de su descanso principal (${isNightShift ? 'nunca durante turno nocturno operativo' : 'tarde y noche'}, en medio litro de agua simple 💧${hasCationDrugSpacing ? '; separar >= 3 h de su antibiótico o hierro' : ''})`,
            clinical_timing: `Sincronizado a ventana de transición y descanso (${sleepToma4Slot} en mínimo 500 ml de agua simple 💧${hasCationDrugSpacing ? '; separar >= 3 h de quinolonas/tetraciclinas/hierro' : ''})`,
            rationale: `${scaled34.regulatorySummary}.${tissueBiomarkers.length > 0 ? ` Hallazgos objetivos integrados (${tissueBiomarkers.length}): ${tissueBiomarkers.join(' | ')}.` : ' Reparación de matriz de colágeno, relajación y recubrimiento digestivo.'}${veganCollagenClinicalNote}`,
            patient_rationale: addr.isTutorMode
                ? `Soporte de reparación vespertino y nocturno para ${addr.childShortRef}: aporta colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, magnesio, vitamina C, vitamina K2 y zinc (${scaled34.totalGramsDisplay}/día en 2 sobres de ${FORMULA_34PLUS.sachetGramsDisplay}). Disuélvalo siempre en medio litro de agua simple 💧.`
                : isEstablishedContinuity
                    ? `Continuamos su soporte vespertino y pre-descanso con 1 a 2 sobres completos al día de 34Plus® (${FORMULA_34PLUS.sachetGramsDisplay} a ${scaled34.totalGramsDisplay} conforme a su pauta habitual consolidada), aportando colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, citrato de magnesio, vitamina C, vitamina K2 MK-7 y zinc en MÍNIMO 500 ml de agua simple 💧 por toma.${veganCollagenPatientNote}`
                    : `Su aliado de reparación y descanso: aporta colágeno hidrolizado, L-Teanina, L-Glicina, fibra prebiótica FOS-inulina, citrato de magnesio, vitamina C, vitamina K2 MK-7 y zinc (${scaled34.totalGramsDisplay}/día en 2 sobres de ${FORMULA_34PLUS.sachetGramsDisplay}) para confortar su intestino, favorecer su descanso y nutrir articulaciones, huesos y piel. Disuélvalo siempre en medio litro de agua simple 💧.${veganCollagenPatientNote}`,
            isEstablishedContinuityFullDose: isEstablishedContinuity,
            status: 'approved'
        };
    }

    return {
        protocolName,
        biosecurity_semaphore: semaphore,
        hydrationTargetLiters: contract.hydrationTargetLiters,
        dietaryPlan: {
            regimen: contract.regimen,
            regimenBadge: contract.regimenBadge,
            universalExclusions: ['0 Picante', '0 Cerdo', '0 Azúcares refinados'],
            patientSpecificExclusions: contract.patientSpecificExclusions
        },
        evolutionTimeline: contract.evolutionTimeline,
        therapeutic_contract: contract,
        circadianSchedule,
        supplements: [sup33, sup34],
        has_calcium_contraction_lock: contract.calciumLocked,
        calcium_alert_text: contract.calciumLocked
            ? 'Detectamos tendencia a depósito de calcio fuera del hueso: evitamos suplementos aislados de calcio inorgánico y priorizamos hidratación constante junto con magnesio y vitamina K2 alimentaria.'
            : null,
        calcium_clinical_safeguard_text: contract.calciumLocked
            ? `Riesgo biofísico de calcificación ectópica: se excluye suplementación aislada con sales de calcio inorgánico; priorizar hidratación estructurada (${contract.hydrationTargetLiters} L/día), magnesio y vitamina K2 alimentaria.`
            : null,
        bioenergetics_summary: bioenergetics
    };
}

/**
 * Traduce etiquetas crudas de bioimpedancia/clínica a lenguaje ciudadano empático,
 * filtrando marcadores esotéricos o alarmantes (p. ej. Radiación Electromagnética, Mercurio, Arsénico).
 */
function stripBalancedParenthesesSafe(str) {
    let out = String(str || '');
    let prev = '';
    while (out !== prev) {
        prev = out;
        out = out.replace(/\([^()]*\)/g, '');
    }
    return out.replace(/[()]/g, '').replace(/\s{2,}/g, ' ').trim();
}

function humanizeBiomarkerTopicForPatient(rawLabel, systemId = '') {
    if (!rawLabel) return '';
    const fullStr = sanitizeClinicalSpanish(String(rawLabel).trim());
    const iccMatch = fullStr.match(/relaci[óo]n\s+cintura[-\s]*cadera\s+f[íi]sica\s*\(\s*icc\s*:\s*([0-9.]+)\s*\)/i);
    if (iccMatch) {
        return `relación cintura-cadera física [ICC ${iccMatch[1]}]`;
    }
    const base = cleanClinicalLabel(fullStr.split(':')[0].trim());
    if (!base) return '';

    // Excluir marcadores ambientales no-orgánicos de las tarjetas fisiológicas del paciente
    if (/radiaci[óo]n\s+electromagn[ée]tica|electromagn[ée]tic/i.test(base)) {
        return '';
    }
    if (/vigilancia\s+epigen[ée]tica|heredo[-\s]*familiar|carga\s+familiar/i.test(base)) {
        return 'prevención personalizada por antecedentes familiares';
    }
    if (/arco\s+corneal|halo\s+lip[íi]dico|limbar/i.test(base)) {
        return 'halo lipídico incipiente en córnea asociado a colesterol';
    }
    if (/venas\s+raninas|sublingual/i.test(base)) {
        return 'retorno venoso sublingual e hidratación microvascular';
    }
    if (/estasis\s+venosa|hemosider[ií]n|extremidad\s+inferior/i.test(base)) {
        return 'retorno venoso en piernas y microcirculación cutánea';
    }
    if (/relaci[óo]n\s+cintura[-\s]*cadera|\bicc\b/i.test(base)) {
        return 'relación cintura-cadera física [ICC]';
    }

    if (/mercurio|ars[ée]nico|plomo|cadmio|pesticida|metales?\s+pesados?|toxina/i.test(base)) {
        return 'depuración de desechos ambientales';
    }
    if (/tiroglobulina|tiroides|tiroide[ao]|tsh|t3|t4|paratiroides/i.test(base)) {
        return 'equilibrio funcional de la tiroides';
    }
    if (/prostatitis|pr[óo]stata|prost[áa]tic|testosterona|gonadotropina|esperma/i.test(base)) {
        return 'bienestar y equilibrio prostático y hormonal';
    }
    if (/estr[óo]geno|progesterona|ginecol|mamari|[úu]tero|ovario/i.test(base)) {
        return 'equilibrio hormonal cíclico';
    }
    if (/hiperplasia\s+[óo]sea|densidad\s+mineral|osteoporosis|osteocalcina|calcificaci[óo]n|cervical|lumbar|fosfatasa|[óo]se[ao]|hueso|crecimiento\s+[óo]seo/i.test(base)) {
        return 'firmeza mineral de huesos y columna';
    }
    if (/reumatismo|articular|articulaci|ligamento|cart[íi]lago/i.test(base)) {
        return 'confort y movilidad articular';
    }
    if (/col[áa]geno|piel|cut[áa]ne|cabello|tejido|muscular|m[úu]sculo/i.test(base)) {
        return 'reservas de colágeno en articulaciones, piel y tejidos';
    }
    if (/grasa\s+en\s+el\s+h[íi]gado|h[íi]gado|hep[áa]tic|ves[íi]cula|biliar|bilirrubina|\bglobulina\b|desintoxicaci[óo]n|energ[íi]a\s+del\s+h[íi]gado/i.test(base)) {
        return 'procesamiento de grasas y limpieza en hígado';
    }
    if (/filtraci[óo]n\s+glomerular|\btfge\b/i.test(base)) {
        return 'tasa de filtración renal preventiva';
    }
    if (/proteinuria|[áa]cido\s+[úu]rico|urobilin[óo]geno|nitr[óo]geno|urea|creatinina|renal|ri[ñn][óo]n/i.test(base)) {
        return 'filtración de minerales y proteínas en riñón';
    }
    if (/memoria|cerebr|craneal|nervio\s+craneal|enfoque|cognitiv|emoci[óo]n/i.test(base)) {
        return 'claridad mental, enfoque y memoria';
    }
    if (/punta\s+lingual|hpa|suprarrenal|adrenal|pineal|melatonina|cortisol|sue[ñn]o|estr[ée]s|insomnio|timo/i.test(base)) {
        return 'recuperación frente al estrés y calidad de descanso';
    }
    if (/alergia|sensibilidad|polen|polvo|leche|l[áa]cteo|marisco|pintura|fibra\s+qu[íi]mica|antibi[óo]tico|alcohol|tabaco/i.test(base)) {
        return 'reactividad ambiental o alimentaria orientativa';
    }
    if (/c[íi]rculos\s+oscuros|bolsas\s+en\s+los\s+ojos|ojeras|fatiga\s+visual/i.test(base)) {
        return 'oxigenación microvascular y descanso visual';
    }
    if (systemId === 'digestion_absorcion' && /treonina|histidina|lisina|valina|leucina|isoleucina|tript[óo]fano|metionina|fenilalanina|arginina|amino[áa]cido/i.test(base)) {
        return 'aprovechamiento digestivo de aminoácidos y proteínas';
    }
    if (systemId === 'circulacion_energia' && /coenzima|vitamina\s+b|nicotinamida|biotina|pantot[ée]nic|hierro|mitocondri/i.test(base)) {
        return 'producción de energía celular diaria';
    }
    if (/vitamina|zinc|selenio|hierro|magnesio|potasio|calcio|coenzima|treonina|histidina|lisina|valina|leucina|isoleucina|tript[óo]fano|metionina|fenilalanina|arginina|amino[áa]cido|inmunoglobulina|linf[áa]tic|am[íi]gdala|bazo|m[ée]dula|respiratori|mucosa/i.test(base)) {
        return 'reservas de vitaminas, minerales y defensas naturales';
    }
    if (/electrocardiograma|\becg\b|rama\s+derecha|bradicardia/i.test(base)) {
        return 'ritmo y conducción eléctrica del corazón en reposo';
    }
    if (/radiograf|\brx\b|arco\s+a[óo]rtico|cardiotor[áa]cico/i.test(base)) {
        return 'elasticidad de sus grandes arterias y función pulmonar';
    }
    if (/ultrasonido|inguinal|doppler/i.test(base)) {
        return 'firmeza de la pared abdominal/inguinal y flujo vascular';
    }
    if (/bas[óo]filos/i.test(base)) {
        return 'equilibrio de sensibilidad inmunológica e histamínica';
    }
    if (/mioc[áa]rdic|coronari|latido|bombeo|viscosidad|elasticidad|vascular|arteri|venos|microcirculaci|ox[íi]geno|pulmonar|riesgo\s+cerebrovascular|stroke|presi[óo]n|impedancia|volumen\s+de\s+perfusi/i.test(base)) {
        return 'fluidez de la circulación y oxigenación del corazón';
    }
    if (/colesterol|ldl|aterog[ée]nic|sd\s*ldl/i.test(base)) {
        return 'transporte saludable de colesterol en sus arterias';
    }
    if (/araquid[óo]nico|omega|triglic[ée]ridos?|lipoprote[íi]na|grasa\s+en\s+sangre|adiposo|obesidad|l[íi]pido/i.test(base)) {
        return 'equilibrio de grasas saludables en sangre';
    }
    if (/insulina|glucosa|az[úu]car|gluc[óo]geno/i.test(base)) {
        return 'aprovechamiento diario de glucosa';
    }
    if (/energ[íi]a|mitocondri|metabolismo|cuerpo\s+[áa]cido|ph/i.test(base)) {
        return 'producción de energía celular diaria';
    }
    if (/peristalsis|intestin|col[óo]nic|colon|flora|microbiota|estre[ñn]imiento|evacuaci/i.test(base)) {
        return 'ritmo de movimiento del estómago e intestino';
    }
    if (/saburra|indentaci[óo]n|festonead|topograf[íi]a\s+lingual/i.test(base)) {
        return 'equilibrio hidrosalino y recubrimiento lingual';
    }
    if (/absorci[óo]n|g[áa]stric|pepsina|est[óo]mago|lingual|digestiv|amilasa/i.test(base)) {
        return 'producción de jugos digestivos y absorción de nutrientes';
    }

    return stripBalancedParenthesesSafe(
        base.replace(/^(?:grado|coeficiente|[íi]ndice|s[íi]ndrome|factor|tasa)\s+de\s+/i, '')
    ).toLowerCase();
}

function deduplicateFriendlyTopicList(topics = []) {
    const out = [];
    const seenStems = new Set();
    for (const raw of (Array.isArray(topics) ? topics : [])) {
        const clean = stripBalancedParenthesesSafe(String(raw || '').trim()) === String(raw || '').trim()
            ? String(raw || '').trim()
            : String(raw || '').replace(/[()]/g, '').trim();
        if (!clean) continue;
        const stem = normalizeForMatch(clean).replace(/_diari[oa]s?$/g, '');
        if (seenStems.has(stem)) continue;
        seenStems.add(stem);
        out.push(clean);
    }
    return out;
}

/**
 * Clasificador Clínico Honesto de Severidad en los 5 Sistemas de la Guía del Paciente (`EGM-56`):
 * Erradica la inflación artificial 5/5 🔴 por simples bioseñales orientativas del Electret cuando
 * la química sanguínea venosa, escalas de estilo de vida y gabinete confirman estabilidad.
 */
function resolvePatientSystemSeverity(sysId, sourceNodes, serum = {}, patientData = {}) {
    try {
        const mergedBiomarkers = sourceNodes.flatMap((n) => Array.isArray(n.key_biomarkers) ? n.key_biomarkers : []);
        const hasAny = mergedBiomarkers.length > 0;
        if (!hasAny) {
            return { status: 'EN_EQUILIBRIO', statusLabel: 'Fortaleza consolidada' };
        }

        const labs = serum?.labValues || {};
        const subAxes = serum?.subAxisFlags || {};
        const cab = serum?.cabinetSignals || {};
        const prec = serum?.precedence || {};
        const vSnap = serum?.vitalsSnapshot || {};
        const isEubiosis = Boolean(serum?.isClinicalEubiosis);
        const hasAllergies = Boolean(serum?.hasClinicalAllergies);

        if (sysId === 'circulacion_energia') {
            const hasMajorCardioOrMetabolic = Boolean(
                subAxes.hasAtherogenicCholesterol ||
                subAxes.hasHypertriglyceridemia ||
                subAxes.hasTrueDysglycemia ||
                cab.hasCardiacConductionOrBradycardia ||
                Number(vSnap.sys) >= 140 ||
                Number(vSnap.dia) >= 90 ||
                (Number(vSnap.spo2) > 0 && Number(vSnap.spo2) < (serum?.altitudeInfo?.spo2NormalFloor || 92))
            );
            if (hasMajorCardioOrMetabolic) {
                return { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' };
            }
            return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
        }

        if (sysId === 'digestion_absorcion') {
            const anamSev = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
            const hasActiveGiDisease = anamSev.unifiedPathologies.some((p) =>
                /gastritis|colitis|reflujo|[úu]lcera|colecist|crohn|celiaq|cel[íi]ac|disfagia/i.test(String(p || ''))
            ) || anamSev.hasBariatricSurgery || anamSev.hasCholecystectomy;
            if (!isEubiosis || anamSev.hasDigestiveIssues || hasActiveGiDisease) {
                return { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' };
            }
            return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
        }

        if (sysId === 'filtros_naturales') {
            const anamSev = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
            const hasTrueHepatoRenalLabAlert = Boolean(
                anamSev.hasSevereRenalHistory ||
                (Number(labs.creatinine) > 1.2) ||
                (Number(labs.gfr) > 0 && Number(labs.gfr) < 60) ||
                (Number(labs.uricAcid) > 7.0) ||
                (Number(labs.alt) > 61) ||
                (Number(labs.ast) > 40) ||
                (Number(labs.ggt) > 61) ||
                (Number(labs.bilirubin) > 1.2)
            );
            if (hasTrueHepatoRenalLabAlert) {
                return { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' };
            }
            if (prec.venousRenalNormal && prec.venousHepaticNormal && !prec.hasGfrStageG2 && !anamSev.isSmoker && !anamSev.isHeavyAlcohol && mergedBiomarkers.length <= 1) {
                return { status: 'EN_EQUILIBRIO', statusLabel: 'Fortaleza consolidada • vigilancia focal' };
            }
            return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
        }

        if (sysId === 'descanso_defensas') {
            const anamSev = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
            const sleepGood = Boolean(anamSev.hasOptimalSleep && !anamSev.hasPoorSleep);
            const stressLow = Boolean(anamSev.hasLowStress && !anamSev.hasHighStress);
            const hasMajorNeuroImmuneAlert = Boolean(
                subAxes.hasAcutePhaseInflammation ||
                hasAllergies ||
                anamSev.hasPoorSleep ||
                anamSev.hasHighStress ||
                anamSev.hasAmenorrhea ||
                Number(labs.tsh) > 4.5 ||
                (Number(labs.tsh) > 0 && Number(labs.tsh) < 0.4) ||
                Number(labs.cortisol) > 20 ||
                Number(labs.leukocytes) > 11600 ||
                (Number(labs.leukocytes) > 0 && Number(labs.leukocytes) < 3800)
            );
            if (hasMajorNeuroImmuneAlert) {
                return { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' };
            }
            const hscrpCalm = !labs.hscrpMgL || Number(labs.hscrpMgL) <= 1.5;
            if (sleepGood && stressLow && hscrpCalm && !hasAllergies) {
                return { status: 'EN_EQUILIBRIO', statusLabel: 'Fortaleza consolidada • vigilancia focal' };
            }
            return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
        }

        if (sysId === 'huesos_musculos') {
            const hasMajorStructuralAlert = Boolean(
                Number(labs.serumCalcium) > 10.2 ||
                (Number(labs.vitaminD) > 0 && Number(labs.vitaminD) < 20) ||
                Number(vSnap.bmi) >= 35 ||
                Number(vSnap.ica) >= 0.65
            );
            if (hasMajorStructuralAlert) {
                return { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' };
            }
            return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
        }

        return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
    } catch (_) {
        return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
    }
}

/**
 * Construye la Guía Empática para el Paciente ("Carta de su Director Clínico"),
 * traduciendo la Matriz IFM a 5 grandes sistemas humanos sin códigos CIE-10 ni jerga intimidante,
 * cumpliendo 100% `MODO_TUTOR (< 13 años)`, `Usted Global (13+ años)` y Semaforización Real `🔴/🟡/🟢`.
 */
function buildPatientFriendlyGuide({
    patientData = {},
    patientName,
    ageYears,
    isFemale = false,
    isLactanteExplicit,
    isPediatricExplicit,
    processedNodes,
    serum,
    bioenergetics,
    orthomolecularPrescription,
    biosecuritySemaphore,
    addressingOverride = null
}) {
    const addr = addressingOverride || resolveClinicalAddressing({
        patientName,
        ageYears,
        isFemale,
        isLactanteExplicit
    });
    const ref = addr.childShortRef;
    const isPausedProtocol = Boolean(biosecuritySemaphore?.isPaused || addr.isLactante);
    const uiLabels = buildPatientUiLabels({ addressing: addr, isPaused: isPausedProtocol });

    const getNode = (id) => processedNodes.find(n => n.nodeId === id) || { key_biomarkers: [], status: 'HOMEOSTASIS' };

    const sampleBalancedFriendlyTopics = (sourceNodes, systemId) => {
        const perNodeTopics = sourceNodes.map((n) => {
            const rawList = Array.isArray(n.key_biomarkers) ? n.key_biomarkers : [];
            return deduplicateFriendlyTopicList(rawList.map((b) => humanizeBiomarkerTopicForPatient(b, systemId)).filter(Boolean));
        });

        if (perNodeTopics.length <= 1) {
            return deduplicateFriendlyTopicList(perNodeTopics[0] || []).slice(0, 4);
        }

        // Muestreo balanceado round-robin 2 + 2 para sistemas fusionados ([N5 + N3], [N4 + N6])
        const selected = [];
        const addUnique = (topic) => {
            if (!topic || selected.length >= 4) return;
            const stem = normalizeForMatch(topic).replace(/_diari[oa]s?$/g, '');
            if (!selected.some((s) => normalizeForMatch(s).replace(/_diari[oa]s?$/g, '') === stem)) {
                selected.push(topic);
            }
        };

        perNodeTopics.forEach((nodeTopics) => {
            let takenFromNode = 0;
            for (const t of nodeTopics) {
                if (takenFromNode >= 2 || selected.length >= 4) break;
                const beforeLen = selected.length;
                addUnique(t);
                if (selected.length > beforeLen) takenFromNode++;
            }
        });

        if (selected.length < 4) {
            perNodeTopics.forEach((nodeTopics) => {
                for (const t of nodeTopics) {
                    addUnique(t);
                }
            });
        }

        return selected;
    };

    const makeSystemCard = ({ id, title, subtitle, iconKey, sourceNodes, observedWhenActive, meaningWhenActive, healthyObserved, healthyMeaning }) => {
        const mergedBiomarkers = sourceNodes.flatMap(n => Array.isArray(n.key_biomarkers) ? n.key_biomarkers : []);
        const hasAny = mergedBiomarkers.length > 0;
        const resolvedSev = resolvePatientSystemSeverity(id, sourceNodes, serum, patientData);

        const topFriendlyTopics = sampleBalancedFriendlyTopics(sourceNodes, id);

        return {
            id,
            title,
            subtitle,
            iconKey,
            status: resolvedSev.status,
            statusLabel: resolvedSev.statusLabel,
            findingsCount: mergedBiomarkers.length,
            cleanHighlights: topFriendlyTopics,
            whatWeObserved: hasAny
                ? observedWhenActive(topFriendlyTopics.length > 0 ? topFriendlyTopics : ['equilibrio funcional preventivo'], resolvedSev.status)
                : healthyObserved,
            whatItMeans: hasAny ? meaningWhenActive : healthyMeaning
        };
    };

    const n1 = getNode('NODO_1_ASIMILACION');
    const n2 = getNode('NODO_2_BIOTRANSFORMACION');
    const n3 = getNode('NODO_3_ENERGIA');
    const n4 = getNode('NODO_4_COMUNICACION');
    const n5 = getNode('NODO_5_TRANSPORTE');
    const n6 = getNode('NODO_6_DEFENSA');
    const n7 = getNode('NODO_7_ESTRUCTURAL');

    const subAxes = serum?.subAxisFlags || {};
    const cabinet = serum?.cabinetSignals || {};
    const triad = serum?.multimodalTriad || {};
    const isClinicalEubiosis = Boolean(serum?.isClinicalEubiosis);
    const dietSynth = orthomolecularPrescription?.therapeutic_contract?.dietaryEpigeneticSynthesis ||
        serum?.dietaryEpigeneticSynthesis ||
        extractDietaryAndEpigeneticSynthesis(patientData, serum, bioenergetics);

    const adultCardioMeaning = (() => {
        const clauses = [];
        if (subAxes.hasAtherogenicCholesterol) {
            clauses.push(
                subAxes.hasVenousNormoglycemia && subAxes.hasVenousNormalTriglycerides
                    ? `sus análisis muestran colesterol LDL${serum?.labValues?.ldl ? ` (${serum.labValues.ldl} mg/dL)` : ''} y partículas pequeñas sdLDL elevadas mientras su glucosa y triglicéridos se mantienen en rango óptimo saludable`
                    : 'existe carga de partículas de colesterol circulando en sus arterias'
            );
        } else if (subAxes.hasHypertriglyceridemia) {
            clauses.push('hay exceso de triglicéridos circulando en sangre');
        }
        if (subAxes.hasTrueDysglycemia) {
            clauses.push('su aprovechamiento de glucosa requiere apoyo cercano');
        }
        if (cabinet.hasCardiacConductionOrBradycardia || cabinet.hasAorticOrThoracicRemodeling) {
            clauses.push('sus estudios de gabinete cardiovascular sugieren acompañar el ritmo y la elasticidad arterial sin esfuerzos bruscos');
        }
        const visualTriadParts = [
            triad.hasCornealArcus ? 'halo lipídico incipiente en córnea' : null,
            triad.hasSublingualVenousStasis ? 'congestión venosa sublingual' : null,
            triad.hasLowerLimbVenousStasis ? 'signos de retorno venoso lento en piernas' : null
        ].filter(Boolean);
        if (visualTriadParts.length > 0) {
            clauses.push(`la exploración visual converge en ${joinSpanishList(visualTriadParts)}`);
        }
        const detailLead = clauses.length > 0
            ? `En sus resultados observamos que ${joinSpanishList(clauses)}. `
            : 'Imagine sus arterias como tuberías flexibles y a sus células como pequeñas baterías: ';
        return `${detailLead}Con hidratación constante, grasas nobles, fibra soluble, los polifenoles de semilla de uva, Coenzima Q10 y Vitamina C de 33Plus® por la mañana y el colágeno hidrolizado de 34Plus® por la noche apoyaremos el recubrimiento y retorno de sus vasos sanguíneos.`;
    })();

    const adultDefenseMeaning = subAxes.hasAcutePhaseInflammation
        ? 'Sus marcadores muestran activación inflamatoria sistémica que requiere descanso reparador nocturno, hidratación y nutrición desinflamatoria.'
        : 'Usted cuenta con una base sólida de sueño reparador, buen manejo del estrés y proteína C reactiva sistémica en rango tranquilo (con 0 alergias clínicas declaradas). Acompañamos de forma preventiva las bioseñales menores de vitaminas, minerales y sensibilidad histamínica leve manteniendo cena temprana y nutrición celular nocturna.';

    const fiveSystems = addr.isTutorMode
        ? [
            makeSystemCard({
                id: 'circulacion_energia',
                title: `Circulación, Corazón y Energía Diaria de ${ref}`,
                subtitle: 'Cómo viajan el oxígeno y el combustible hacia sus órganos en crecimiento',
                iconKey: 'heart',
                sourceNodes: [n5, n3],
                observedWhenActive: (topics) =>
                    `Notamos que el sistema circulatorio y las reservas de energía de ${ref} están haciendo un esfuerzo extra (especialmente en indicadores como ${topics.join(', ')}).`,
                meaningWhenActive:
                    `Imagine las arterias como tuberías flexibles y las células de ${ref} como pequeñas baterías: cuando hay mayor demanda de nutrientes o hidratación, su organismo trabaja más. Con hidratación natural y alimentación fresca le ayudaremos a mantener vitalidad estable.`,
                healthyObserved: `Los indicadores principales de circulación, oxigenación y manejo de energía de ${ref} se mantienen estables.`,
                healthyMeaning: `El transporte de oxígeno y energía celular de ${ref} responde adecuadamente; el objetivo en casa será conservar ese equilibrio día con día.`
            }),
            makeSystemCard({
                id: 'digestion_absorcion',
                title: `Digestión y Aprovechamiento de Nutrientes de ${ref}`,
                subtitle: 'Cómo reciben su estómago e intestino los alimentos del día',
                iconKey: 'utensils',
                sourceNodes: [n1],
                observedWhenActive: (topics) =>
                    `Observamos en ${ref} señales de digestión lenta o sensibilidad en el recubrimiento digestivo (${topics.join(', ')}).`,
                meaningWhenActive:
                    `Aunque ${ref} reciba buenos alimentos, si su estómago o intestino presentan sensibilidad cuesta más absorber vitaminas y minerales. Retirar irritantes (picante, embutidos y azúcares) en casa le dará un descanso inmediato a su mucosa digestiva.`,
                healthyObserved: `El sistema digestivo de ${ref} muestra buena capacidad general de asimilación.`,
                healthyMeaning: `Su intestino está en buenas condiciones para aprovechar los nutrientes de su alimentación diaria.`
            }),
            makeSystemCard({
                id: 'filtros_naturales',
                title: `Filtros Naturales de ${ref}: Hígado y Riñones`,
                subtitle: 'Los órganos encargados de depurar y mantener limpio su organismo',
                iconKey: 'droplets',
                sourceNodes: [n2],
                observedWhenActive: (topics) =>
                    `Los filtros naturales de ${ref} muestran señales de carga acumulada de trabajo (${topics.join(', ')}).`,
                meaningWhenActive:
                    `El hígado y los riñones funcionan como los filtros de agua de casa: limpian todos los días lo que el organismo de ${ref} ya no necesita. Por eso cuidamos con tanta prudencia su hidratación natural y ajustamos cualquier pauta sin forzarlos.`,
                healthyObserved: `Los filtros hepático y renal de ${ref} se observan despejados y trabajando a buen ritmo.`,
                healthyMeaning: `Sus órganos depuradores cuentan con buen margen funcional acorde a su etapa de crecimiento.`
            }),
            makeSystemCard({
                id: 'descanso_defensas',
                title: `Descanso, Desarrollo y Defensas de ${ref}`,
                subtitle: 'Su reloj interno, calidad de sueño y escudo inmunológico',
                iconKey: 'shield',
                sourceNodes: [n4, n6],
                observedWhenActive: (topics) =>
                    `Identificamos mayor demanda en la recuperación nocturna o en las defensas naturales de ${ref} (${topics.join(', ')}).`,
                meaningWhenActive:
                    `El organismo infantil crece y se repara a profundidad cuando ${ref} descansa bien por la noche. Al cuidar sus horarios de descanso, hidratación y alimentación diaria, usted ayuda directamente a fortalecer su sistema inmunológico.`,
                healthyObserved: `El descanso y las defensas naturales de ${ref} mantienen un equilibrio favorable.`,
                healthyMeaning: `Su escudo protector responde de forma ordenada; conservar sus rutinas de sueño sostendrá esta fortaleza.`
            }),
            makeSystemCard({
                id: 'huesos_musculos',
                title: `Huesos, Músculos, Piel y Crecimiento de ${ref}`,
                subtitle: 'El sostén estructural que acompaña su desarrollo y movimiento',
                iconKey: 'bone',
                sourceNodes: [n7],
                observedWhenActive: (topics) =>
                    `Observamos en ${ref} mayor demanda de nutrientes de soporte estructural, minerales y colágeno (${topics.join(', ')}).`,
                meaningWhenActive:
                    `Las proteínas limpias, vitaminas y minerales son los ladrillos que sostienen el crecimiento óseo y muscular de ${ref}. Los acompañaremos con alimentación natural y juego activo seguro acorde a su edad.`,
                healthyObserved: `La estructura ósea, muscular y cutánea de ${ref} conserva buena firmeza funcional.`,
                healthyMeaning: `Mantendremos un buen aporte de nutrientes naturales y movimiento diario para acompañar su desarrollo.`
            })
        ]
        : [
            makeSystemCard({
                id: 'circulacion_energia',
                title: 'Su Circulación, Corazón y Energía Diaria',
                subtitle: 'Cómo viajan el oxígeno, los lípidos y la energía hacia sus órganos',
                iconKey: 'heart',
                sourceNodes: [n5, n3],
                observedWhenActive: (topics) => {
                    const filteredTopics = subAxes.hasVenousNormoglycemia
                        ? topics.filter(t => !/az[úu]car|glucosa/i.test(t))
                        : topics;
                    const safeTopics = filteredTopics.length > 0 ? filteredTopics : topics;
                    return `Notamos atención prioritaria en indicadores cardiovasculares, microcirculatorios y lipídicos (${safeTopics.join(', ')}).`;
                },
                meaningWhenActive: adultCardioMeaning,
                healthyObserved: 'Sus indicadores principales de circulación, oxigenación y manejo de energía se mantienen estables.',
                healthyMeaning: 'Sus arterias y su energía celular responden adecuadamente; el objetivo será conservar esa vitalidad día con día.'
            }),
            makeSystemCard({
                id: 'digestion_absorcion',
                title: 'Su Digestión y Aprovechamiento de Nutrientes',
                subtitle: 'Cómo recibe su estómago e intestino lo que usted consume',
                iconKey: 'utensils',
                sourceNodes: [n1],
                observedWhenActive: (topics) =>
                    isClinicalEubiosis
                        ? `Con base en su evaluación preventiva integral —aun cursando hoy sin molestias digestivas (eubiosis)—, registramos bioseñales orientativas de tránsito digestivo pausado y topografía lingual hidrosalina (${topics.join(', ')}).`
                        : `Observamos señales de digestión lenta o sensibilidad en el recubrimiento digestivo (${topics.join(', ')}).`,
                meaningWhenActive:
                    isClinicalEubiosis
                        ? 'Usted goza hoy de confort digestivo sin inflamación ni reflujo; retirar preventivamente irritantes (picante, cerdo y azúcares refinados), masticar con calma y nutrir su mucosa por la noche con fibra prebiótica (34Plus® en mínimo 500 ml de agua simple) optimizará al 100 % la absorción de vitaminas, minerales y líquidos.'
                        : 'Aunque usted consuma buenos alimentos, si el estómago y el intestino trabajan lento o están irritados, no logramos absorber al 100 % las vitaminas y minerales. Retirar irritantes (picante, cerdo y azúcares refinados) y comer sin prisa le dará un respiro inmediato a su digestión.',
                healthyObserved: 'Su sistema digestivo muestra buena capacidad general de asimilación.',
                healthyMeaning: 'Su intestino está listo para aprovechar los nutrientes de su plan de alimentación.'
            }),
            makeSystemCard({
                id: 'filtros_naturales',
                title: 'Sus Filtros Naturales: Hígado y Riñones',
                subtitle: 'Los encargados de depurar y mantener limpio su organismo',
                iconKey: 'droplets',
                sourceNodes: [n2],
                observedWhenActive: (topics) =>
                    `Sus filtros naturales muestran indicadores preventivos que acompañamos con hidratación medida (${topics.join(', ')}).`,
                meaningWhenActive:
                    serum?.precedence?.venousRenalNormal && serum?.precedence?.venousHepaticNormal
                        ? 'Sus análisis de sangre confirman enzimas hepáticas, creatinina y ácido úrico en rango normal; acompañamos preventivamente su tasa de filtración renal (estadio intermedio KDIGO G2) con hidratación fraccionada constante y dilución amplia para mantener sus filtros despejados sin sobrecargarlos.'
                        : 'Su hígado y sus riñones funcionan como los filtros de agua de casa: limpian todos los días lo que su organismo ya no necesita. Por eso cuidamos tanto la cantidad de agua simple que usted ingiere y ajustamos su suplementación con prudencia.',
                healthyObserved: 'Sus filtros hepático y renal se observan despejados y trabajando a buen ritmo en sus análisis de sangre.',
                healthyMeaning: 'Sus órganos depuradores cuentan con buen margen funcional; mantendremos su hidratación diaria constante para conservarlos así.'
            }),
            makeSystemCard({
                id: 'descanso_defensas',
                title: 'Su Descanso, Equilibrio Hormonal y Defensas',
                subtitle: 'Su reloj interno, manejo del estrés y escudo protector',
                iconKey: 'shield',
                sourceNodes: [n4, n6],
                observedWhenActive: (topics, sevStatus) =>
                    sevStatus === 'EN_EQUILIBRIO'
                        ? `Su descanso nocturno, manejo del estrés y marcadores inflamatorios sanguíneos muestran fortaleza consolidada, manteniendo vigilancia preventiva tranquila sobre bioseñales menores (${topics.join(', ')}).`
                        : `Identificamos señales en su ritmo de descanso, manejo de estrés o sensibilidad inmunológica (${topics.join(', ')}).`,
                meaningWhenActive: adultDefenseMeaning,
                healthyObserved: 'Su comunicación hormonal y sus defensas mantienen un equilibrio favorable.',
                healthyMeaning: 'Su escudo protector responde de forma ordenada; cuidar su sueño mantendrá esta fortaleza.'
            }),
            makeSystemCard({
                id: 'huesos_musculos',
                title: 'Sus Huesos, Músculos, Piel y Sostén Estructural',
                subtitle: 'La estructura muscular, articular y de colágeno que sostiene su movimiento',
                iconKey: 'bone',
                sourceNodes: [n7],
                observedWhenActive: (topics) =>
                    `Observamos oportunidad preventiva en composición abdominal, soporte de colágeno y cuidado biomecánico (${topics.join(', ')}).`,
                meaningWhenActive:
                    cabinet.hasPostsurgicalInguinalOrAbdominalWall
                        ? 'El colágeno, el magnesio, la vitamina K2 y los aminoácidos mantienen firmes sus tejidos, articulaciones y su pared inguinal con antecedente quirúrgico (hoy íntegra sin hernia en su ultrasonido Doppler). Los nutriremos por la noche y cuidaremos su postura evitando cargar peso con pujo abdominal mientras optimizamos su cintura.'
                        : 'Los aminoácidos, minerales, vitamina K2 y el colágeno mantienen firmes sus huesos, músculos y articulaciones. Vamos a nutrirlos con proteína de fácil digestión y movimiento seguro sin impacto.',
                healthyObserved: 'Su estructura ósea, muscular y de colágeno conserva buena firmeza funcional.',
                healthyMeaning: 'Mantendremos un buen aporte de proteína y movimiento diario para proteger su masa muscular.'
            })
        ];

    const anamnesisGuide = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
    const routeCtxGuide = serum?.routeContext || resolveActiveClinicalRoutes(patientData, addr.ageYears, isLactanteExplicit, isPediatricExplicit);
    const isTcaBehavioralSafety = Boolean(routeCtxGuide?.isTcaBehavioralSafety || bioenergetics?.isTcaBehavioralSafety);
    const labsGuide = serum?.labValues || {};
    const vitalsGuide = serum?.vitalsSnapshot || {};
    const rawVitalsObj = patientData?.vitals || {};
    const restHrGuide = Number(rawVitalsObj.heart_rate || rawVitalsObj.hr || cabinet.ecgHrBpm || 0);
    const tempGuide = Number(rawVitalsObj.temperature || 0);
    const fastGluGuide = Number(labsGuide.glucose || vitalsGuide.glu || rawVitalsObj.glucose || 0);

    const fluidRestrictionActive = Boolean(
        orthomolecularPrescription?.hydrationTargetLiters === null ||
        anamnesisGuide.hasMedicalFluidRestriction ||
        (Number(labsGuide.gfr) > 0 && Number(labsGuide.gfr) < 30) ||
        (Number(labsGuide.sodium) > 0 && Number(labsGuide.sodium) < 132)
    );
    const weightForWater = Number(bioenergetics?.weightKg) > 0 ? Number(bioenergetics.weightKg) : 70;
    const totalLitersRecommended = fluidRestrictionActive
        ? null
        : (Number(orthomolecularPrescription?.hydrationTargetLiters) > 0
            ? Number(orthomolecularPrescription.hydrationTargetLiters)
            : Math.min(3.4, Math.max(1.8, Number((((weightForWater * 32) / 1000) + (anamnesisGuide.isLactating ? 0.6 : 0)).toFixed(1)))));

    const specificExclusions = (serum?.combinedExclusions || [])
        .map(cleanClinicalLabel)
        .filter((val) => {
            const clean = String(val || '').trim();
            if (!clean) return false;
            return !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean);
        });

    // EGM-60: Freno Biomecánico ACSM ante descontrol hemodinámico/glucémico/febril y descarga articular/neurovascular
    const isRelativePhysicalRestRequired = Boolean(
        Number(vitalsGuide.sys) >= 160 ||
        Number(vitalsGuide.dia) >= 100 ||
        fastGluGuide >= 250 ||
        (fastGluGuide > 0 && fastGluGuide < 70) ||
        restHrGuide >= 115 ||
        (Number(vitalsGuide.spo2) > 0 && Number(vitalsGuide.spo2) < 88) ||
        tempGuide >= 37.8
    );
    const isSeatedOrNonImpactDischarge = Boolean(
        anamnesisGuide.hasNonImpactDischargeNeed ||
        anamnesisGuide.hasDysphagia ||
        (addr.ageYears >= 65 && Number(bioenergetics?.bmi) > 0 && Number(bioenergetics.bmi) < 19.0)
    );

    const buildSafeAdultMovementGuidance = () => {
        if (isRelativePhysicalRestRequired) {
            const dischargeNote = isSeatedOrNonImpactDischarge
                ? ' Una vez estabilizados sus signos vitales por su médico, retomaremos únicamente movilidad suave sin impacto articular en silla o descarga.'
                : '';
            return `Reposo físico relativo hoy (evitar caminata rápida, escaleras intensas o ejercicio aeróbico estructurado) hasta estabilizar sus constantes vitales bajo valoración médica presencial.${dischargeNote}`;
        }
        if (isSeatedOrNonImpactDischarge) {
            return 'Movilidad funcional segura sin impacto ni carga vertical sobre articulaciones y pies (bicicleta fija con respaldo, ejercicios suaves en silla, ligas ligeras de tren superior y equilibrio asistido sin riesgo de caída).';
        }
        const parts = [];
        const tcxMetaGuide = orthomolecularPrescription?.therapeutic_contract?.confirmedTcxMeta || null;
        const monitorPrep = formatBiometricMonitorPrepClause();
        if (cabinet.hasCardiacConductionOrBradycardia || cabinet.hasAorticOrThoracicRemodeling) {
            parts.push(`Ejercicio aeróbico sin impacto (elíptica suave, natación o caminata en terreno plano) manteniendo un techo cardioprotector seguro de FC <= 130 lpm ${monitorPrep} y valoración ecocardiográfica de seguimiento`);
        } else if (addr.ageYears >= 55) {
            parts.push('Caminata suave o elíptica sin impacto de 20 a 30 minutos a ritmo conversacional');
        } else {
            parts.push(`Actividad aeróbica ligera de 20 a 30 minutos al día a ritmo conversacional y pausas activas cada hora si usted permanece mucho tiempo ${addr.seatedLabel}`);
        }

        if (tcxMetaGuide) {
            const devName = sanitizeClinicalSpanish(tcxMetaGuide.device_name || 'su reloj inteligente');
            const discNames = Array.isArray(tcxMetaGuide.disciplines) && tcxMetaGuide.disciplines.length > 0
                ? tcxMetaGuide.disciplines.map((d) => sanitizeClinicalSpanish(d.sport)).filter(Boolean).join(', ')
                : '';
            const wkMins = Number(tcxMetaGuide.weekly_minutes || 0);
            const wkKcal = Number(tcxMetaGuide.weekly_calories || 0);
            const avgHr = Number(tcxMetaGuide.average_hr || 0);
            const maxHr = Number(tcxMetaGuide.max_hr || 0);
            const hrProof = maxHr > 0 && maxHr <= 130
                ? ` —acreditando que su FC media (${avgHr || '--'} lpm) y FC máxima medida (${maxHr} lpm) ya operan de forma ejemplar dentro de la ventana cardioprotectora <= 130 lpm—`
                : (maxHr > 0 ? ` (FC media ${avgHr || '--'} lpm / máxima ${maxHr} lpm)` : '');
            parts.push(
                `dando continuidad calibrada a su rutina validada en ${devName}${discNames ? ` (${discNames}${wkMins ? ` • ${wkMins} min/sem` : ''}${wkKcal ? ` • ${wkKcal} kcal/sem` : ''})` : ''}${hrProof}`
            );
        }

        if (cabinet.hasPostsurgicalInguinalOrAbdominalWall) {
            parts.push('protegiendo su región inguinal (cero maniobras de Valsalva pesadas ni pujo conteniendo el aire al realizar esfuerzos)');
        } else if (cabinet.hasAxialLoadRestriction) {
            parts.push('evitando cargas axiales verticales o saltos sobre columna y rodillas');
        }

        if (subAxes.hasDistalVenousStasis || triad.hasLowerLimbVenousStasis || triad.hasSublingualVenousStasis) {
            parts.push('sumando ejercicios rítmicos de tobillo y pantorrilla para activar la bomba venosa de retorno hacia el corazón');
        } else {
            parts.push('acompañada de movilidad articular progresiva');
        }
        return `${parts.join(', ')}.`;
    };

    const movementGuidance = addr.isLactante
        ? `Estimulación motriz temprana (tiempo boca abajo supervisado, gateo libre y juego sensorial acorde a la edad de ${ref}), además de contacto suave con luz natural matutina.`
        : addr.isTutorChild
            ? (isRelativePhysicalRestRequired
                ? `Reposo tranquilo en casa para ${ref} hasta valoración médica presencial de sus signos vitales.`
                : `Juego activo diario acorde a la etapa de crecimiento de ${ref}, coordinación motriz libre al aire libre y contacto matutino con luz natural.`)
            : buildSafeAdultMovementGuidance();

    const greetingTitle = addr.isLactante
        ? `Estimada madre, padre o tutor: lectura clara del bienestar de ${ref}`
        : addr.isTutorChild
            ? `Estimada madre, padre o tutor: lectura clara de la salud de ${ref}`
            : `${addr.estimadoLabel} ${addr.fullVocativeName || addr.cleanFullName}: esta es la lectura clara de su salud hoy`;

    const hasExplicitComplaints = Boolean(
        !isClinicalEubiosis ||
        anamnesisGuide.hasDigestiveIssues ||
        String(patientData?.clinical_context?.specific_ailment || '').trim() ||
        (Array.isArray(patientData?.clinical_context?.pain_zones) && patientData.clinical_context.pain_zones.length > 0)
    );

    const empatheticLead = addr.isLactante
        ? `Integramos con todo cuidado la valoración de crecimiento, tolerancia digestiva y desarrollo de ${addr.childSubjectWithKinship} para explicarle con claridad qué observamos y acompañarle paso a paso en casa.`
        : addr.isTutorChild
            ? `Con base en la historia clínica y las mediciones integrales de ${addr.childSubjectWithKinship}, le explicamos con total claridad qué observamos en su organismo y cómo vamos a acompañar a ${ref} paso a paso en casa, sin prisas ni sobrecargas.`
            : addr.isAdolescent
                ? `Con base en su historia clínica y las mediciones de su evaluación integral, le explicamos con total claridad cómo se encuentra su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso junto con su madre, padre o tutor legal.`
                : hasExplicitComplaints
                    ? `Reunimos sus síntomas, su historia clínica y las mediciones de su evaluación para explicarle con total claridad qué está ocurriendo en su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso, sin prisas ni sobrecargas.`
                    : `Con base en su historia clínica, su evaluación preventiva integral y las mediciones obtenidas —aun cursando hoy sin molestias digestivas (eubiosis)—, le explicamos con total claridad cómo se encuentra su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso, sin prisas ni sobrecargas.`;

    const resolvedMacros = orthomolecularPrescription?.therapeutic_contract?.macros || bioenergetics?.macros || { carbs: 40, protein: 30, fat: 30 };
    const resolvedRegimen = orthomolecularPrescription?.dietaryPlan?.regimen || bioenergetics?.regimen || 'Alimentación Funcional Antiinflamatoria Personalizada';
    const safeExamples = buildSafeDietaryExamplesSSoT({
        combinedExclusions: specificExclusions,
        anamnesis: anamnesisGuide
    });
    const macroDistributionNote = (!addr.isLactante && !isTcaBehavioralSafety)
        ? ` Distribución equilibrada: ${resolvedMacros.carbs}% carbohidratos integrales, ${resolvedMacros.protein}% proteínas limpias y ${resolvedMacros.fat}% grasas saludables.`
        : '';
    const personalizedDietTail = (!addr.isLactante && !addr.isTutorMode && !isTcaBehavioralSafety && dietSynth?.patientSummaryText)
        ? ` ${dietSynth.patientSummaryText}`
        : '';

    const universalRulesList = addr.isTutorMode
        ? [
            '0 Picante (protege la mucosa digestiva)',
            anamnesisGuide.isVegan ? 'Alimentación 100 % basada en plantas completas' : '0 Carne de cerdo y embutidos',
            '0 Azúcares refinados ni refrescos'
        ]
        : [
            '0 Picante (protege su mucosa digestiva)',
            anamnesisGuide.isVegan ? 'Alimentación 100 % basada en plantas completas' : '0 Carne de cerdo y embutidos',
            '0 Azúcares refinados ni refrescos'
        ];
    if (anamnesisGuide.hasCeliacOrGlutenFree) {
        universalRulesList.push('0 Gluten estricto (trigo, cebada, centeno y contaminación cruzada)');
    }
    if (anamnesisGuide.hasDysphagia) {
        universalRulesList.push('Textura suave homogénea segura para deglución (cero semillas enteras ni trozos secos)');
    }

    const waterGapRampClause = (!fluidRestrictionActive && totalLitersRecommended && anamnesisGuide.ffqWaterGlasses !== null && (anamnesisGuide.ffqWaterGlasses * 0.25) < (totalLitersRecommended * 0.6))
        ? ` Como actualmente registra ${anamnesisGuide.ffqWaterGlasses} vasos/día, aumente gradualmente +2 vasos por semana hasta llegar a su meta con comodidad.`
        : '';

    const resolvedLogistics = orthomolecularPrescription?.therapeutic_contract?.logisticsSummary || serum?.logisticsSummary || translateLogisticsProfile(patientData);
    const resolvedAppointment = resolveScheduledAppointmentSummary(patientData, biosecuritySemaphore);

    return {
        greetingTitle,
        empatheticLead,
        ui_labels: uiLabels,
        biosecurity_semaphore: biosecuritySemaphore,
        metabolic_age_study: orthomolecularPrescription?.therapeutic_contract?.metabolicAgeStudy || null,
        logistics_summary: resolvedLogistics,
        dietary_epigenetic_synthesis: dietSynth || null,
        scheduled_appointment_summary: resolvedAppointment,
        calcium_alert_text: orthomolecularPrescription?.calcium_alert_text || null,
        five_systems: fiveSystems,
        home_action_plan: {
            protective_nutrition: {
                title: 'Alimentación Protectora en Casa',
                targetKcal: isTcaBehavioralSafety ? null : (bioenergetics?.targetKcal || null),
                isTcaBehavioralSafety,
                regimen: resolvedRegimen,
                macros: isTcaBehavioralSafety ? null : resolvedMacros,
                summary: addr.isLactante
                    ? `Mantener lactancia materna o fórmula indicada por su pediatra e introducción gradual de alimentos naturales para ${ref}, sin sal añadida ni azúcares.`
                    : isTcaBehavioralSafety
                        ? `Su plan (${resolvedRegimen}) acompaña su energía diaria, saciedad amable y paz nutricional sin conteo de calorías, integrando ${safeExamples.veggiePhrase}, ${safeExamples.fatsPhrase}, fibra soluble y ${safeExamples.proteinPhrase}.`
                        : addr.isTutorChild
                            ? `El plan alimentario de ${ref} (${bioenergetics?.targetKcal || 1600} kcal al día • ${resolvedRegimen}) está calculado acorde a su crecimiento, priorizando ${safeExamples.veggiePhrase}, ${safeExamples.fatsPhrase}, fruta natural y ${safeExamples.proteinPhrase}.${macroDistributionNote}`
                            : `Su plan (${resolvedRegimen}) está calculado a la medida de su organismo (${bioenergetics?.targetKcal || 1800} kcal al día), priorizando ${safeExamples.veggiePhrase}, ${safeExamples.fatsPhrase}, fibra soluble y ${safeExamples.proteinPhrase}.${macroDistributionNote}${personalizedDietTail}`,
                universalRules: universalRulesList,
                personalExclusions: specificExclusions
            },
            smart_hydration: {
                title: fluidRestrictionActive ? 'Control Hídrico Médico Especializado' : 'Hidratación Inteligente Durante el Día',
                litersPerDay: (addr.isLactante || fluidRestrictionActive) ? null : totalLitersRecommended,
                fluidRestrictionActive,
                summary: addr.isLactante
                    ? 'En menores de 2 años la hidratación principal proviene de la leche materna o fórmula pediátrica; ofrezca pequeños sorbos de agua natural simple únicamente según la indicación de su pediatra.'
                    : fluidRestrictionActive
                        ? 'Por protección cardiaca y renal, su consumo total diario de líquidos debe apegarse estrictamente al techo máximo indicado por su médico especialista (evitando cargas adicionales de agua).'
                        : addr.isTutorChild
                            ? `La meta aproximada para ${ref} es de ${totalLitersRecommended} litros de agua simple purificada repartidos a sorbos desde la mañana hasta media tarde, disminuyendo cerca de su hora de dormir.${waterGapRampClause}`
                            : `Su meta aproximada es de ${totalLitersRecommended} litros de agua simple purificada repartidos a sorbos durante su jornada activa (disminuyendo antes de su horario de descanso para no interrumpir su sueño).${waterGapRampClause}`,
                keyRule34Plus: addr.isLactante
                    ? 'En etapa de lactancia temprana no se utilizan sobres concentrados; continúe exclusivamente con la pauta de su pediatra.'
                    : (biosecuritySemaphore?.isPaused || biosecuritySemaphore?.isSelective34Paused
                        ? (fluidRestrictionActive
                            ? 'Sus sobres concentrados permanecen en pausa de seguridad; respete el volumen máximo diario de líquidos indicado por su especialista.'
                            : (addr.isTutorChild
                                ? `Por ahora mantenemos los sobres en pausa preventiva para ${ref} y priorizamos únicamente agua natural simple.`
                                : 'Por ahora mantenemos 34Plus® en pausa preventiva de seguridad y nos enfocamos en hidratación natural controlada.'))
                        : 'Regla de oro para 34Plus®: disuélvalo siempre en MÍNIMO 500 ml (medio litro) de agua simple natural para que su fibra y nutrientes se absorban con suavidad.')
            },
            gentle_movement: {
                title: addr.isTutorMode ? 'Juego y Desarrollo Motor Diario' : (isRelativePhysicalRestRequired ? 'Reposo Físico Relativo y Seguridad Vital' : 'Movimiento Cotidiano Seguro y Articular'),
                isPediatric: Boolean(addr.isTutorMode),
                isRelativeRestActive: isRelativePhysicalRestRequired,
                summary: movementGuidance,
                sleepHabit: addr.isLactante
                    ? `Favorezca rutinas tranquilas de sueño para ${ref} con luz tenue y ambiente sereno libre de pantallas.`
                    : anamnesisGuide.isNightOrRotatingShift
                        ? 'Al concluir su turno nocturno procure una comida ligera previa, oscurezca su habitación y descanse sin pantallas brillantes.'
                        : addr.isTutorChild
                            ? `Procure ofrecer a ${ref} una cena ligera al menos 2 horas antes de dormir y apagar pantallas brillantes con anticipación.`
                            : 'Procure cenar ligero al menos 2 a 3 horas antes de dormir y descansar lejos de pantallas brillantes.'
            },
            mid_cycle_pulse_day14: {
                day: 14,
                title: 'Hito de Pulso Día 14 (Mitad de Ciclo)',
                summary: addr.isLactante
                    ? `A mitad del ciclo (Día 14), registre la tolerancia digestiva, sueño y bienestar diario de ${ref} para compartirlo en su seguimiento.`
                    : isTcaBehavioralSafety
                        ? 'A mitad de su Ciclo 1 (Día 14), registre cómo percibe su energía al despertar (escala 1 a 10), su confort digestivo y la constancia de sus 4 momentos diarios de hidratación y complementación.'
                        : 'A mitad de su Ciclo 1 (Día 14), tome por la mañana en ayunas su medida de cintura con cinta flexible a la altura del ombligo, califique su energía al despertar (escala 1 a 10) y confirme la constancia de sus 4 momentos diarios de hidratación y complementación.'
            }
        }
    };
}

/**
 * POST /api/cortex/synthesize-dossier
 * Arquitectura Compilador Clínico SSoTT v3.2 (EGM-49):
 * 1. Tronco Determinista Multi-Paciente (Precedencia de Evidencia Orgánica pre-Nodos,
 *    Sin CIE-10 automáticos no acreditados, Macronutrientes Dinámicos y Estequiometría Oficial 33Plus® / 34Plus®).
 * 2. Inferencia Concurrente Controlada (1 llamada observacional estructurada + Paridad 1:1 Guía / NOM-004).
 */
const synthesizeDossier = async (req, res) => {
    const { citationId: rawCitationId, patientData: bodyPatientData } = req.body;
    const citationId = normalizeControllerCitationId(rawCitationId);

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta o es inválido el parámetro citationId (Guardia NOM-004)." });
    }

    try {
        const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
        const row = stmtSelect.get(citationId.toString());
        let storedSnapshot = null;
        if (row && row.patient_data_snapshot) {
            const rawSnapshot = cryptoVault.decryptClinicalData(row.patient_data_snapshot);
            try {
                storedSnapshot = typeof rawSnapshot === 'string' ? JSON.parse(rawSnapshot || '{}') : (rawSnapshot || {});
            } catch (pe) {
                storedSnapshot = null;
            }
        }

        let patientData = bodyPatientData || storedSnapshot || {};
        if (bodyPatientData && storedSnapshot) {
            const storedExt = storedSnapshot?.scan_data?.external_metrics;
            const bodyExt = bodyPatientData?.scan_data?.external_metrics;
            if (storedExt && typeof storedExt === 'object') {
                patientData = {
                    ...storedSnapshot,
                    ...bodyPatientData,
                    clinical_flags: Array.from(new Set([
                        ...(Array.isArray(storedSnapshot.clinical_flags) ? storedSnapshot.clinical_flags : []),
                        ...(Array.isArray(bodyPatientData.clinical_flags) ? bodyPatientData.clinical_flags : [])
                    ])),
                    scan_data: {
                        ...(storedSnapshot.scan_data || {}),
                        ...(bodyPatientData.scan_data || {}),
                        external_metrics: {
                            ...storedExt,
                            ...(bodyExt || {}),
                            external_studies: bodyExt?.external_studies || storedExt.external_studies,
                            imaging: bodyExt?.imaging || storedExt.imaging,
                            vigencia: bodyExt?.vigencia || storedExt.vigencia,
                            totalParameters: bodyExt?.totalParameters ?? storedExt.totalParameters
                        }
                    }
                };
            }
        }

        // Saneamiento recursivo determinista + purga quirúrgica de telemetría .TCX legada no confirmada
        patientData = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively(patientData || {}));
        const isFemalePatient = resolveBackendPatientIsFemale(patientData);

        const clinicalFlags = patientData.clinical_flags || [];
        const foodAllergies = patientData.history?.allergies?.food || [];
        const drugAllergies = patientData.history?.allergies?.drug || [];
        const medications = patientData.history?.medications || [];

        // ==========================================
        // 1. SANITIZACIÓN Y PARSEO CRONOLÓGICO BLINDADO SSoTT (Fail-Closed Anti-Falso-Lactante)
        // ==========================================
        const verifiedAge = resolveVerifiedPatientAge(patientData, 35);
        let ageYears = verifiedAge.ageYears;
        let ageMonths = verifiedAge.ageMonths ?? (ageYears * 12);
        let correctedAgeMonths = null;

        if (verifiedAge.hasVerifiedBirthDate && ageMonths < 36) {
            const semanasGestacion = parseInt(patientData.vitals?.semanas_gestacion || patientData.history?.semanas_gestacion, 10);
            if (!isNaN(semanasGestacion) && semanasGestacion < 37) {
                const semanasFaltantes = 40 - semanasGestacion;
                const mesesFaltantes = semanasFaltantes / 4;
                correctedAgeMonths = Math.max(0, ageMonths - mesesFaltantes);
            }
        }

        const isLactanteExplicit = Boolean(ageYears < 2 && verifiedAge.isLactanteVerified);
        const isPediatricExplicit = Boolean(ageYears < 18 && (isLactanteExplicit || verifiedAge.isPediatricVerified));

        const pName = isLactanteExplicit ? "su bebé" : formatInstitutionalFullName(patientData);

        const clinicalAddressing = resolveClinicalAddressing({
            patientName: pName,
            ageYears,
            isFemale: isFemalePatient,
            isLactanteExplicit
        });

        // ==========================================
        // 2. DESTILACIÓN DEL SUERO CLÍNICO + MACRONUTRIENTES DINÁMICOS SSoTT
        // ==========================================
        const serum = distillClinicalSerum(patientData, isLactanteExplicit);
        const bioenergetics = calculatePrecisionBioenergetics(patientData, ageYears, ageMonths, isLactanteExplicit, isPediatricExplicit);
        const dynamicDiet = resolveDynamicMacronutrientsAndRegimen({
            patientData,
            serum,
            bioenergetics,
            isLactanteExplicit,
            isPediatricExplicit
        });
        if (!isLactanteExplicit && dynamicDiet?.macros) {
            bioenergetics.macros = dynamicDiet.macros;
            bioenergetics.macrosDynamicApplied = true;
            bioenergetics.regimen = dynamicDiet.regimen;
            bioenergetics.regimenBadge = dynamicDiet.regimenBadge;
        }

        // ==========================================
        // 3. CASCADA DE ENRUTAMIENTO PEDIÁTRICO / ADULTO
        // ==========================================
        let determinedRoute = "RUTA_D";
        const hasLipidOrGlycemicAlert = serum.nodes.find(n => n.id === 'NODO_3_ENERGIA')?.hasAnomalies || false;

        if (ageYears < 18 && (isLactanteExplicit || isPediatricExplicit)) {
            determinedRoute = "RUTA_A";
        } else {
            const reasonText = String(patientData.reason_for_consultation || patientData.motivo || patientData.history?.primaryRoute || "").toUpperCase();
            if (hasLipidOrGlycemicAlert || bioenergetics.bmi >= 25 || reasonText.includes("PESO") || reasonText.includes("GRASA") || reasonText.includes("DIABETES") || reasonText.includes("COLESTEROL") || reasonText.includes("METABOLIC")) {
                determinedRoute = "RUTA_C";
            } else if (reasonText.includes("ENTRENAMIENTO") || reasonText.includes("VO2") || reasonText.includes("DOLOR") || reasonText.includes("POSTURA") || reasonText.includes("BIOMECANICA")) {
                determinedRoute = "RUTA_B";
            }
        }

        // 4. Compuertas Duras de Bioseguridad ( Farmacopea Real, Esfuerzo y Lactantes )
        const lpActSynthesize = patientData.lifestyle_profile?.activity || patientData.clinical_context?.activity?.exercise || {};
        const confirmedTcxMeta = lpActSynthesize?.source_type === 'TELEMETRY_TCX' && !lpActSynthesize?.telemetry_metadata?.preview_pending_confirm
            ? lpActSynthesize.telemetry_metadata
            : null;
        const weeklyMinutesSynthesize = Number(
            lpActSynthesize?.weekly_minutes ||
            confirmedTcxMeta?.weekly_minutes ||
            ((Number(confirmedTcxMeta?.daily_minutes || 0) * Number(confirmedTcxMeta?.weekly_days || 0)) || 0)
        );
        const hasValidatedHabitualExercise = Boolean(lpActSynthesize?.has_scheduled_exercise && (weeklyMinutesSynthesize >= 90 || confirmedTcxMeta));

        const activityLevel = String(
            patientData.activity_level ||
            patientData.physical_activity ||
            patientData.habits?.activity_level ||
            patientData.profile?.activity_level ||
            (hasValidatedHabitualExercise ? "MODERADO" : (clinicalAddressing.isTutorMode ? "JUEGO ACTIVO" : "SEDENTARIO"))
        ).toUpperCase();

        const isSedentary = !isPediatricExplicit && !hasValidatedHabitualExercise && (activityLevel.includes("SEDENTARIO") || activityLevel.includes("LIGERO") || activityLevel.includes("NULA"));
        const heartRate = parseInt(patientData.vitals?.heart_rate || patientData.vitals?.hr || (isLactanteExplicit ? 90 : 70), 10);
        const hasBradycardia = !isPediatricExplicit && heartRate < 60;
        const hasCardioFlags = !isPediatricExplicit && clinicalFlags.some(f => String(f).includes("BRADICARDIA") || String(f).includes("CARDIO"));
        const isExerciseRestricted = !isPediatricExplicit && (isSedentary || (!hasValidatedHabitualExercise && ageYears >= 55) || hasBradycardia || hasCardioFlags);

        const selective33Guard = detectSelective33PlusContraindication({
            patientData,
            serum,
            medications
        });
        const hasStimulantsConflict = Boolean(selective33Guard.isSelective33Paused);

        let pediatricDisclaimer = "";
        if (isLactanteExplicit || (verifiedAge.hasVerifiedBirthDate && ageMonths < 12)) {
            pediatricDisclaimer = "⚠️ DESCARGO REGULATORIO NOM-043/COFEPRIS: En lactantes menores de 1 año, la lactancia materna y la fórmula de continuación son la base nutricional primaria. Toda sugerencia de modulación nutricional celular (34Plus®) es de carácter orientativo y requiere validación explícita por el Pediatra tratante.";
        }

        // Estrategia técnica multimodal para vista médica (Gabinete ECG/RX/US + Freno ACSM + Descarga Articular + Telemetría)
        let physicalStrategyText = "";
        const cabSig = serum?.cabinetSignals || {};
        const subAx = serum?.subAxisFlags || {};
        const anamSynth = serum?.anamnesisUnified || extractUnifiedAnamnesisSignals(patientData);
        const vSnapSynth = serum?.vitalsSnapshot || {};
        const fastGluSynth = Number(serum?.labValues?.glucose || vSnapSynth.glu || patientData?.vitals?.glucose || 0);
        const tempSynth = Number(patientData?.vitals?.temperature || 0);
        const isRelativeRestSynth = Boolean(
            Number(vSnapSynth.sys) >= 160 ||
            Number(vSnapSynth.dia) >= 100 ||
            fastGluSynth >= 250 ||
            (fastGluSynth > 0 && fastGluSynth < 70) ||
            heartRate >= 115 ||
            (Number(vSnapSynth.spo2) > 0 && Number(vSnapSynth.spo2) < 88) ||
            tempSynth >= 37.8
        );
        const isNonImpactDischargeSynth = Boolean(
            anamSynth.hasNonImpactDischargeNeed ||
            anamSynth.hasDysphagia ||
            (ageYears >= 65 && Number(bioenergetics?.bmi) > 0 && Number(bioenergetics.bmi) < 19.0)
        );
        if (clinicalAddressing.isLactante) {
            physicalStrategyText = "Estimulación Psicomotriz Pediátrica: Gateo Activo, Coordinación Motora Gruesa/Fina y Tiempo de Juego Supervisado (Tummy Time).";
        } else if (isRelativeRestSynth) {
            physicalStrategyText = `Contraindicación Temporal de Esfuerzo Estructurado (ACSM): Reposo físico relativo hasta estabilización clínica presencial de constantes vitales${isNonImpactDischargeSynth ? '; posterior readaptación exclusivamente en descarga articular / sedestación sin impacto' : ''}.`;
        } else if (isNonImpactDischargeSynth) {
            physicalStrategyText = "Prescripción Biomecánica en Descarga Articular y Neurovascular: Movilidad funcional sin impacto vertical en sedestación o cicloergómetro con respaldo, fortalecimiento isométrico suave y prevención activa de caídas.";
        } else if (clinicalAddressing.isTutorChild) {
            physicalStrategyText = "Desarrollo Psicomotor Escolar: Juego Activo Diario, Coordinación Motriz Libre y Exposición Matutina Segura a Luz Natural.";
        } else if (clinicalAddressing.isAdolescent) {
            physicalStrategyText = "Acondicionamiento Físico Juvenil Guiado: Actividad aeróbica recreativa, coordinación neuromuscular y movilidad articular progresiva acorde a etapa adolescente.";
        } else if (cabSig.hasCardiacConductionOrBradycardia || cabSig.hasPostsurgicalInguinalOrAbdominalWall || cabSig.hasAorticOrThoracicRemodeling) {
            const rxSegments = [];
            const monitorPrepRx = formatBiometricMonitorPrepClause();
            if (cabSig.hasCardiacConductionOrBradycardia || cabSig.hasAorticOrThoracicRemodeling) {
                rxSegments.push(
                    `Ejercicio aeróbico sin impacto (elíptica controlada, natación o caminata llana) en Zona 1–2 cardioprotectora con techo estricto de FC <= 130 lpm ${monitorPrepRx}${cabSig.recommendsEchocardiogram ? ' e interconsulta/ecocardiograma transtorácico de correlación' : ''}`
                );
            }
            if (cabSig.hasPostsurgicalInguinalOrAbdominalWall) {
                rxSegments.push("protección de pared inguinal postquirúrgica (prohibición estricta de maniobras de Valsalva pesadas o apneas isométricas)");
            }
            if (subAx.hasDistalVenousStasis || serum?.multimodalTriad?.hasLowerLimbVenousStasis || serum?.multimodalTriad?.hasSublingualVenousStasis) {
                rxSegments.push("activación rítmica de bomba muscular gemelar (pantorrilla-corazón) para retorno venoso distal");
            }
            if (confirmedTcxMeta) {
                const devLabel = confirmedTcxMeta.device_name || "Wearable .TCX";
                const discNamesRx = Array.isArray(confirmedTcxMeta.disciplines) && confirmedTcxMeta.disciplines.length > 0
                    ? confirmedTcxMeta.disciplines.map((d) => d.sport).filter(Boolean).join(' + ')
                    : 'Rutina Multicomponente';
                const wkKcalRx = Number(confirmedTcxMeta.weekly_calories || 0);
                const avgHrRx = Number(confirmedTcxMeta.average_hr || 0);
                const maxHrRx = Number(confirmedTcxMeta.max_hr || 0);
                const hrAccreditation = maxHrRx > 0 && maxHrRx <= 130
                    ? `, acreditando empíricamente entrenamiento dentro de ventana cardioprotectora (FC media ${avgHrRx || '--'} lpm / FC máxima ${maxHrRx} lpm <= 130 lpm)`
                    : (maxHrRx > 0 ? ` (FC media ${avgHrRx || '--'} lpm / FC máxima ${maxHrRx} lpm)` : '');
                rxSegments.push(
                    `continuidad calibrada de telemetría ${devLabel} (${discNamesRx} • ${weeklyMinutesSynthesize || confirmedTcxMeta.daily_minutes} min${weeklyMinutesSynthesize ? '/sem' : '/día'}${wkKcalRx ? ` • ${wkKcalRx} kcal/sem` : ''}${hrAccreditation})`
                );
            }
            physicalStrategyText = `Prescripción Multimodal Guiada por Gabinete: ${rxSegments.join(' + ')}.`;
        } else if (isExerciseRestricted) {
            physicalStrategyText = "Prescripción Adaptativa Ligera: Actividad aeróbica suave conversacional (6\u00A0000 a 8\u00A0000 pasos/día) + Readaptación Articular Progresiva sin impacto ni esfuerzo máximo.";
        } else if (confirmedTcxMeta) {
            const devLabel = confirmedTcxMeta.device_name || "Wearable .TCX";
            const discNames = Array.isArray(confirmedTcxMeta.disciplines) && confirmedTcxMeta.disciplines.length > 0
                ? confirmedTcxMeta.disciplines.map(d => d.sport).join(' + ')
                : 'Rutina Multicomponente';
            physicalStrategyText = `Continuidad de Rutina Telemétrica Validada (${devLabel}: ${discNames} • ${weeklyMinutesSynthesize || confirmedTcxMeta.daily_minutes} min${weeklyMinutesSynthesize ? '/sem' : '/día'} • FC media ${confirmedTcxMeta.average_hr || '--'} lpm / FC máxima ${confirmedTcxMeta.max_hr || '--'} lpm) en Zona Aeróbica Controlada 1–2 con protección articular.`;
        } else {
            physicalStrategyText = "Acondicionamiento Aeróbico Moderado + Fortalecimiento Muscular Progresivo en 3 Fases con control biomecánico.";
        }

        // ==========================================
        // 5. MOTOR DETERMINISTA PRIMERO (SSoTT): SEMÁFORO DE BIOSEGURIDAD + CONTRATO TERAPÉUTICO CANÓNICO
        // ==========================================
        const biosecuritySemaphore = evaluateBiosecurityAndTitration(
            patientData,
            serum,
            ageYears,
            medications,
            hasStimulantsConflict,
            isLactanteExplicit,
            isPediatricExplicit,
            clinicalAddressing
        );

        const metabolicAgeStudy = calculateBidirectionalMetabolicAge(patientData, serum, bioenergetics);

        const canonicalContract = buildCanonicalTherapeuticContract({
            patientData,
            serum,
            bioenergetics,
            biosecuritySemaphore,
            medications,
            hasStimulantsConflict,
            metabolicAgeStudy,
            isLactanteExplicit,
            isPediatricExplicit,
            physicalPrescription: physicalStrategyText
        });
        if (confirmedTcxMeta) {
            canonicalContract.confirmedTcxMeta = confirmedTcxMeta;
        }

        // ==========================================
        // 6. SÍNTESIS OBSERVACIONAL UNIFICADA EN 1 SOLA LLAMADA GEMINI (16000 ms + therapeutic_focus 100% determinista)
        // ==========================================
        let aiInstance = null;
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            } catch (initErr) {
                console.warn("⚠️ No se pudo inicializar GoogleGenAI, operando en modo determinista SSoTT local:", initErr.message);
            }
        }

        console.log(`🧠 CORTEX SSoTT v3.2.0: Sintetizando 7 Nodos IFM en llamada unificada (timeout=16000ms, temp=0.1) para Ruta ${determinedRoute}...`);
        const processedIfmNodes = await synthesizeAllIfmNodesSSoTT(serum.nodes, canonicalContract, aiInstance);

        // ==========================================
        // 7. PRESCRIPCIÓN ORTOMOLECULAR SINCRONIZADA + GUÍA EMPÁTICA DEL PACIENTE (PARIDAD BILATERAL 100%)
        // ==========================================
        const orthomolecularPrescription = buildOrthomolecularPrescription(
            patientData,
            processedIfmNodes,
            serum,
            bioenergetics,
            hasStimulantsConflict,
            biosecuritySemaphore,
            canonicalContract,
            clinicalAddressing
        );

        const formatNodeAxisBadge = (n) => n.accredited_cie10 ? ` (${n.accredited_cie10})` : '';

        const preliminary_diagnosis = processedIfmNodes.map((n, idx) => {
            return sanitizeClinicalSpanish(`${idx + 1}. ${n.nodeName.replace(/^\d+\.\s*/, '')}${formatNodeAxisBadge(n)}: ${n.summary}`);
        });

        const activeNodesWithAnomalies = processedIfmNodes.filter(n => n.status !== 'HOMEOSTASIS');

        const rawFriendlyGuide = buildPatientFriendlyGuide({
            patientData,
            patientName: pName,
            ageYears,
            isFemale: isFemalePatient,
            isLactanteExplicit,
            isPediatricExplicit,
            processedNodes: processedIfmNodes,
            serum,
            bioenergetics,
            orthomolecularPrescription,
            biosecuritySemaphore,
            addressingOverride: clinicalAddressing
        });
        const applyGenderRecurse = (node) => {
            if (typeof node === 'string') return sanitizeArt215NonTherapeuticLexicon(enforcePatientGenderConcordance(node, isFemalePatient));
            if (Array.isArray(node)) return node.map(applyGenderRecurse);
            if (node && typeof node === 'object') {
                const out = {};
                for (const [k, v] of Object.entries(node)) out[k] = applyGenderRecurse(v);
                return out;
            }
            return node;
        };
        const patientFriendlyGuide = applyGenderRecurse(rawFriendlyGuide);
        physicalStrategyText = sanitizeArt215NonTherapeuticLexicon(physicalStrategyText);

        const diagnosticoCausaRaiz = isLactanteExplicit
            ? `Lactante de ${ageMonths || 11} meses en fase acelerada de crecimiento y desarrollo L-OMS. Constantes vitales dentro de parámetros normales (FC ${heartRate} LPM). Evaluación orientada a la maduración de la mucosa intestinal, tolerancia a alimentos sólidos y neurodesarrollo motor.`
            : (activeNodesWithAnomalies.length > 0
                ? activeNodesWithAnomalies.map(n => `• ${n.nodeName.replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '')}${formatNodeAxisBadge(n)}: ${n.summary}`).join(' ')
                : 'Homeostasis funcional conservada en los 7 Nodos de la Matriz IFM.');

        const critical_alerts = [];
        if (Number(serum?.labValues?.triglycerides) >= 500) {
            critical_alerts.push(`DERIVACIÓN MÉDICA URGENTE (TG >= 500 mg/dL): Hipertrigliceridemia severa (${serum.labValues.triglycerides} mg/dL) con riesgo de pancreatitis aguda; se indica valoración médica presencial inmediata y pausa preventiva de suplementación.`);
        }
        if (Number(serum?.labValues?.ldl) >= 190) {
            critical_alerts.push(`DERIVACIÓN MÉDICA PRIORITARIA (LDL >= 190 mg/dL): Colesterol LDL en rango de hipercolesterolemia severa (${serum.labValues.ldl} mg/dL); se indica interconsulta cardiológica/endocrinológica prioritaria y determinación de ApoB y Lp(a).`);
        }
        if (isLactanteExplicit) {
            critical_alerts.push(`PROTOCOLO LACTANTE: Constantes vitales normales en escala PALS/OMS (FC ${heartRate} LPM). Indicada Estimulación Psicomotriz.`);
        } else if (isExerciseRestricted || cabSig.hasCardiacConductionOrBradycardia || cabSig.hasPostsurgicalInguinalOrAbdominalWall) {
            critical_alerts.push(`SALVAGUARDA BIOMECÁNICA Y DE ESFUERZO FÍSICO: ${physicalStrategyText}`);
        }

        if (selective33Guard.isSelective33Paused && !biosecuritySemaphore.isPaused) {
            critical_alerts.push(`PAUSA SELECTIVA DE 33PLUS® (NOM-004): Se difiere temporalmente 33Plus® (0 sobres activos) por ${selective33Guard.reasonText || 'precaución farmacológica/fisiológica activa'}, manteniendo hidratación matutina protectora y 34Plus® nocturno en micro-dosis.`);
        }

        if (biosecuritySemaphore.level !== 'VERDE') {
            critical_alerts.push(`SEMÁFORO DE BIOSEGURIDAD (${biosecuritySemaphore.level}): ${biosecuritySemaphore.badgeLabel} — ${biosecuritySemaphore.titrationPlanText}`);
        }

        if (orthomolecularPrescription.has_calcium_contraction_lock && (orthomolecularPrescription.calcium_clinical_safeguard_text || orthomolecularPrescription.calcium_alert_text)) {
            critical_alerts.push(`SALVAGUARDA MINERAL (BLOQUEO DE CALCIO EXÓGENO): ${orthomolecularPrescription.calcium_clinical_safeguard_text || orthomolecularPrescription.calcium_alert_text}`);
        }

        foodAllergies.forEach(a => {
            const agent = typeof a === 'object' ? a.agent : a;
            if (agent) critical_alerts.push(`ALERGIA ALIMENTARIA ESTRICTA: ${cleanClinicalLabel(String(agent)).toUpperCase()}`);
        });
        drugAllergies.forEach(a => {
            const agent = typeof a === 'object' ? a.agent : a;
            if (agent) critical_alerts.push(`ALERGIA MEDICAMENTOSA: ${cleanClinicalLabel(String(agent)).toUpperCase()}`);
        });

        activeNodesWithAnomalies.forEach(n => {
            if (Array.isArray(n.key_biomarkers) && n.key_biomarkers.length > 0) {
                critical_alerts.push(`HALLAZGOS ${n.nodeName.replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '').toUpperCase()} [${n.accredited_cie10 || n.functionalCode || 'IFM'}]: ${n.key_biomarkers.slice(0, 6).join(' | ')}`);
            }
        });

        const suggested_management = (isLactanteExplicit ? [
            "1. Preservación de Lactancia Materna / Fórmula Pediátrica + Introducción Guiada de Sólidos (BLW/Papillas)",
            "2. Monitoreo Ponderal y Crecimiento Longitudinal (L-OMS)",
            "3. Estimulación Psicomotriz Activa y Tiempo de Juego (Tummy Time)",
            "4. Soporte Nutricional Pediátrico bajo Supervisión del Pediatra Tratante"
        ] : [
            ...activeNodesWithAnomalies.map((n, idx) => `${idx + 1}. [${n.nodeName.replace(/^(?:(?:Nodo\s*)?\d+[.:\s-]*)+/i, '')} • ${n.accredited_cie10 || n.functionalCode || 'IFM'}] ${n.therapeutic_focus}`),
            `${activeNodesWithAnomalies.length + 1}. [Bioenergética ${bioenergetics.equationUsed} • ${canonicalContract.regimen}] TMB: ${bioenergetics.bmr} kcal | TDEE: ${bioenergetics.tdee} kcal | Meta Energética Sugerida: ${bioenergetics.targetKcal} kcal (${bioenergetics.macros.carbs}% C / ${bioenergetics.macros.protein}% P / ${bioenergetics.macros.fat}% L) | Hidratación Meta: ${canonicalContract.hydrationTargetLiters} L/día | ${canonicalContract.logisticsSummary?.operationalSummary || `Logística: ${canonicalContract.logisticsSummary?.venueLabel || 'Casa'} (${canonicalContract.logisticsSummary?.cookLabel || 'Preparación propia'})`}${canonicalContract.patientSpecificExclusions.length > 0 ? ` | Exclusiones personalizadas: ${canonicalContract.patientSpecificExclusions.join(', ')}` : ''}.${canonicalContract.dietaryEpigeneticSynthesis?.clinicalSummaryText ? ` ${canonicalContract.dietaryEpigeneticSynthesis.clinicalSummaryText}` : ''}`,
            `${activeNodesWithAnomalies.length + 2}. [Readaptación Biomecánica y Pauta de Movimiento Seguro] ${physicalStrategyText}`,
            `${activeNodesWithAnomalies.length + 3}. [Bioseguridad y Posología (${biosecuritySemaphore.level})] ${biosecuritySemaphore.titrationPlanText}`,
            `${activeNodesWithAnomalies.length + 4}. [Hito de Pulso Día 14 (Mitad de Ciclo)] ${canonicalContract.evolutionTimeline?.midCyclePulseDay14?.clinicalInstruction || 'Control intermedio Día 14 de circunferencia abdominal en ayunas, vitalidad (1–10) y constancia de sus 4 momentos.'}`,
            `${activeNodesWithAnomalies.length + 5}. [Estudio de Edad Metabólica SSoTT] ${metabolicAgeStudy.clinicalSummary}`
        ]).map(sanitizeArt215NonTherapeuticLexicon);

        const payload = {
            doctrina_aplicada: determinedRoute === 'RUTA_A'
                ? 'Ruta Clínica A • Endocrinología y Desarrollo Pediátrico L-OMS (Primeros 1000 Días)'
                : `Ruta Clínica ${determinedRoute.replace('RUTA_', '')} • Medicina Funcional de Sistemas (Matriz IFM SSoTT v3.5)`,
            diagnostico_causa_raiz: sanitizeArt215NonTherapeuticLexicon(sanitizeClinicalSpanish(diagnosticoCausaRaiz)),
            preliminary_diagnosis,
            ifm_nodes_matrix: processedIfmNodes,
            electret_informative_annex: serum.electretInformativeAnnex || null,
            auxiliary_bioenergetics: (serum.auxiliaryBioenergetics || []).map(item => ({
                ...item,
                label: sanitizeBioelectricScreeningLabel(sanitizeClinicalSpanish(item?.label || '')),
                detail: formatMedicalBiomarkerSummary(item?.detail || '')
            })),
            bioenergetics,
            metabolic_age_study: metabolicAgeStudy,
            nom004_identification_sheet: canonicalContract.nom004Sheet,
            dietary_epigenetic_synthesis: canonicalContract.dietaryEpigeneticSynthesis,
            scheduled_appointment_summary: canonicalContract.scheduledAppointmentSummary,
            logistics_summary: canonicalContract.logisticsSummary,
            prior_adherence: canonicalContract.priorAdherence,
            biosecurity_semaphore: biosecuritySemaphore,
            canonical_clinical_plan: canonicalContract,
            therapeutic_contract: canonicalContract,
            orthomolecular_prescription: orthomolecularPrescription,
            patient_friendly_guide: patientFriendlyGuide,
            critical_alerts,
            suggested_management,
            alertas_bioseguridad: critical_alerts.join(' • ') || (pediatricDisclaimer || 'Parámetros de bioseguridad verificados bajo la NOM-004-SSA3-2012.'),
            sistemas_afectados: activeNodesWithAnomalies.length > 0
                ? activeNodesWithAnomalies.map(n => `${n.nodeName.replace(/^\d+\.\s*/, '')}${formatNodeAxisBadge(n)}`)
                : ["Homeostasis Sistémica Conservada"],
            estrategia_terapeutica: {
                nutricion_defensora: sanitizeArt215NonTherapeuticLexicon(
                    isLactanteExplicit
                        ? "Matriz de Nutrición Celular 34Plus® Pediátrica: Leche Materna / Fórmula de Continuación + Introducción Guiada de Sólidos (BLW / Papillas caseras)."
                        : `${canonicalContract.regimen} — Pauta Bioenergética Sugerida (${bioenergetics.equationUsed}): TDEE ${bioenergetics.tdee} kcal → Meta ${bioenergetics.targetKcal} kcal/día (${bioenergetics.macros.carbs}% Carbohidratos / ${bioenergetics.macros.protein}% Proteínas / ${bioenergetics.macros.fat}% Lípidos) + ${canonicalContract.hydrationTargetLiters !== null ? `Hidratación diaria ${canonicalContract.hydrationTargetLiters} L/día` : 'Control hídrico estricto individualizado bajo techo médico nefro-cardiológico'} + Regla 0 Picante, 0 Cerdo, 0 Azúcares refinados${canonicalContract.patientSpecificExclusions.length > 0 ? ` (Exclusiones personalizadas: ${canonicalContract.patientSpecificExclusions.join(', ')})` : ''}.${canonicalContract.dietaryEpigeneticSynthesis?.clinicalSummaryText ? ` ${canonicalContract.dietaryEpigeneticSynthesis.clinicalSummaryText}` : ''}`
                ),
                readaptacion_fisica: physicalStrategyText
            },
            guia_paciente_whatsapp: {
                titulo_resumen: clinicalAddressing.isTutorMode
                    ? `El Crecimiento y Salud de ${clinicalAddressing.childShortRef}`
                    : `Su Guía Personal de Salud — ${pName}`,
                pilar_salud_crecimiento: patientFriendlyGuide.empatheticLead,
                pilar_alimentacion_diaria: patientFriendlyGuide.home_action_plan.protective_nutrition.summary,
                pilar_juegos_movimiento: patientFriendlyGuide.home_action_plan.gentle_movement.summary,
                pilar_cuidados_suplementacion: `${biosecuritySemaphore.badgeLabel}: ${biosecuritySemaphore.titrationPlanText}`
            },
            human_approved_diagnosis: preliminary_diagnosis,
            human_approved_management: suggested_management,
            dossier_seal_sha256: crypto
                .createHash('sha256')
                .update(JSON.stringify({
                    citationId: String(citationId),
                    diagnosis: preliminary_diagnosis,
                    management: suggested_management,
                    metabolicAge: metabolicAgeStudy?.metabolicAgeExact ?? null
                }))
                .digest('hex'),
            ssot_contract_version: "3.5.0-Aniversario19-SSoTT",
            status: "SYNTHESIZED_READY_FOR_REVIEW"
        };

        // ==========================================
        // 7. PERSISTENCIA CIFRADA NOM-004 + SANEAMIENTO RECURSIVO + AUDIT LEDGER SHA-256
        // ==========================================
        try {
            const stmtCheck = db.prepare('SELECT is_completed, patient_data_snapshot FROM session_persistence WHERE citation_id = ?');
            const existingRow = stmtCheck.get(citationId.toString());
            if (existingRow && existingRow.patient_data_snapshot) {
                const decryptedRaw = cryptoVault.decryptClinicalData(existingRow.patient_data_snapshot);
                const parsedStored = typeof decryptedRaw === 'string'
                    ? JSON.parse(decryptedRaw || '{}')
                    : (decryptedRaw || {});
                const healedSnapshot = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively(parsedStored));
                const validUid = normalizeControllerUserId(
                    healedSnapshot?.profile?.usuarioId ??
                    healedSnapshot?.identificacion?.usuarioId ??
                    healedSnapshot?.usuarioId,
                    citationId
                );
                if (validUid) {
                    healedSnapshot.profile = { ...(healedSnapshot.profile || {}), usuarioId: validUid, citaId: citationId, citationId };
                    healedSnapshot.identificacion = { ...(healedSnapshot.identificacion || {}), usuarioId: validUid, idCita: citationId, citaId: citationId };
                }
                if (Number.isInteger(ageYears) && ageYears > 0) {
                    healedSnapshot.profile = { ...(healedSnapshot.profile || {}), age: ageYears };
                    healedSnapshot.identificacion = { ...(healedSnapshot.identificacion || {}), edad: ageYears };
                }
                if (ageYears >= 18) {
                    delete healedSnapshot.isLactante;
                    delete healedSnapshot.isPediatrico;
                }
                if (bioenergetics?.targetKcal && healedSnapshot.nutrition?.protocol) {
                    healedSnapshot.nutrition = {
                        ...healedSnapshot.nutrition,
                        protocol: {
                            ...healedSnapshot.nutrition.protocol,
                            target: bioenergetics.targetKcal,
                            bmr: bioenergetics.bmr,
                            tdee: bioenergetics.tdee
                        }
                    };
                }
                if (Number(existingRow.is_completed) === 1) {
                    healedSnapshot.is_completed = true;
                }
                healedSnapshot.clinical_dossier = payload;

                const cipherSnapshot = cryptoVault.encryptClinicalData(healedSnapshot);
                const stmtUpdate = db.prepare(`
                    UPDATE session_persistence 
                    SET user_id = CASE
                            WHEN ? IS NOT NULL AND ? != '0' THEN ?
                            WHEN user_id IS NOT NULL AND user_id != '0' THEN user_id
                            ELSE NULL
                        END,
                        patient_data_snapshot = ?,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE citation_id = ?
                `);
                stmtUpdate.run(validUid, validUid, validUid, cipherSnapshot, citationId.toString());

                cryptoVault.appendAuditLedger({
                    actorId: 'CORTEX_SYNTHESIZER_V2_5',
                    action: 'SYNTHESIZE_DOSSIER_NOM004',
                    patientId: citationId.toString(),
                    payload: {
                        route: determinedRoute,
                        semaphore: biosecuritySemaphore.level,
                        synthesizedAt: new Date().toISOString()
                    }
                });
            }
        } catch (persistErr) {
            console.warn("⚠️ No se pudo pre-guardar clinical_dossier cifrado en SQLite:", persistErr.message);
        }

        res.json({
            success: true,
            dossier: payload
        });

    } catch (err) {
        console.error("🔥 Error en synthesize-dossier:", err.message);
        res.status(500).json({ success: false, message: "Error interno al sintetizar el expediente." });
    }
};

/**
 * POST /api/cortex/approve-dossier
 * Sella el expediente en SQLite y calcula silenciosamente los deltas de cambios del médico para RLHF.
 */
const approveDossier = async (req, res) => {
    const {
        citationId: rawCitationId,
        approvedDiagnosis,
        approvedManagement,
        additionalSymptoms,
        originalDiagnosis,
        originalManagement,
        ifmNodesMatrix,
        bioenergetics,
        orthomolecularPrescription
    } = req.body;
    const citationId = normalizeControllerCitationId(rawCitationId);

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta o es inválido el parámetro citationId (Guardia NOM-004)." });
    }

    try {
        const stmtSelect = db.prepare('SELECT * FROM session_persistence WHERE citation_id = ?');
        const row = stmtSelect.get(citationId.toString());

        if (!row) {
            return res.status(404).json({ success: false, message: "No se encontró sesión activa." });
        }

        const decryptedRaw = cryptoVault.decryptClinicalData(row.patient_data_snapshot || '{}');
        const parsedSnapshot = typeof decryptedRaw === 'string'
            ? JSON.parse(decryptedRaw || '{}')
            : (decryptedRaw || {});
        const patientData = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively(parsedSnapshot));

        const rlhf_deltas = {
            original_diagnosis: originalDiagnosis || [],
            approved_diagnosis: approvedDiagnosis || [],
            original_management: originalManagement || [],
            approved_management: approvedManagement || [],
            modified_at: new Date().toISOString()
        };

        const existingDossier = patientData.clinical_dossier || {};
        const mergedIfmNodes = ifmNodesMatrix || existingDossier.ifm_nodes_matrix || [];
        const mergedBioenergetics = bioenergetics || existingDossier.bioenergetics || null;
        const mergedOrtho = orthomolecularPrescription || existingDossier.orthomolecular_prescription || null;
        const mergedSemaphore = mergedOrtho?.biosecurity_semaphore || existingDossier.biosecurity_semaphore || null;

        let updatedFriendlyGuide = existingDossier.patient_friendly_guide || null;
        if (mergedIfmNodes.length > 0 && (ifmNodesMatrix || bioenergetics || orthomolecularPrescription || !updatedFriendlyGuide)) {
            const isFem = resolveBackendPatientIsFemale(patientData);
            const verifiedSnapAge = resolveVerifiedPatientAge(patientData, 35);
            const ageNum = verifiedSnapAge.ageYears;
            const isLact = Boolean(ageNum < 2 && verifiedSnapAge.isLactanteVerified);
            const isPed = Boolean(ageNum < 18 && (isLact || verifiedSnapAge.isPediatricVerified));
            const pName = isLact ? 'su bebé' : formatInstitutionalFullName(patientData);
            const serumSnap = distillClinicalSerum(patientData, isLact);
            const rawGuide = buildPatientFriendlyGuide({
                patientData,
                patientName: pName,
                ageYears: ageNum,
                isFemale: isFem,
                isLactanteExplicit: isLact,
                isPediatricExplicit: isPed,
                processedNodes: mergedIfmNodes,
                serum: serumSnap,
                bioenergetics: mergedBioenergetics,
                orthomolecularPrescription: mergedOrtho,
                biosecuritySemaphore: mergedSemaphore
            });
            const recurseGender = (node) => {
                if (typeof node === 'string') return enforcePatientGenderConcordance(node, isFem);
                if (Array.isArray(node)) return node.map(recurseGender);
                if (node && typeof node === 'object') {
                    const out = {};
                    for (const [k, v] of Object.entries(node)) out[k] = recurseGender(v);
                    return out;
                }
                return node;
            };
            updatedFriendlyGuide = recurseGender(rawGuide);
        }

        const wasAlreadyCompleted = Number(row.is_completed) === 1 || Number(row.last_active_phase) >= 21;

        patientData.clinical_dossier = {
            ...existingDossier,
            human_approved_diagnosis: (approvedDiagnosis || []).map((d) => sanitizeArt215NonTherapeuticLexicon(sanitizeClinicalSpanish(d))),
            human_approved_management: (approvedManagement || []).map((m) => sanitizeArt215NonTherapeuticLexicon(sanitizeClinicalSpanish(m))),
            ifm_nodes_matrix: mergedIfmNodes,
            electret_informative_annex: existingDossier.electret_informative_annex || null,
            bioenergetics: mergedBioenergetics,
            orthomolecular_prescription: mergedOrtho,
            nom004_identification_sheet: existingDossier.nom004_identification_sheet || extractNom004IdentificationSheet(patientData, null, mergedBioenergetics),
            dietary_epigenetic_synthesis: existingDossier.dietary_epigenetic_synthesis || extractDietaryAndEpigeneticSynthesis(patientData, null, mergedBioenergetics),
            scheduled_appointment_summary: resolveScheduledAppointmentSummary(patientData, existingDossier?.biosecurity_semaphore),
            patient_friendly_guide: updatedFriendlyGuide,
            additional_symptoms_reported: sanitizeClinicalSpanish(additionalSymptoms || ""),
            rlhf_deltas,
            doctor_approval_timestamp: new Date().toISOString(),
            dossier_seal_sha256: crypto
                .createHash('sha256')
                .update(JSON.stringify({
                    citationId: String(citationId),
                    diagnosis: (approvedDiagnosis || []).map((d) => sanitizeArt215NonTherapeuticLexicon(sanitizeClinicalSpanish(d))),
                    management: (approvedManagement || []).map((m) => sanitizeArt215NonTherapeuticLexicon(sanitizeClinicalSpanish(m))),
                    metabolicAge: existingDossier?.metabolic_age_study?.metabolicAgeExact ?? null,
                    status: 'approved'
                }))
                .digest('hex'),
            ssot_contract_version: "3.5.0-Aniversario19-SSoTT",
            status: "approved"
        };

        patientData.diagnosis_approved = true;
        if (wasAlreadyCompleted) {
            patientData.is_completed = true;
        }

        const validUid = normalizeControllerUserId(
            patientData?.profile?.usuarioId ??
            patientData?.identificacion?.usuarioId ??
            patientData?.usuarioId ??
            row.user_id,
            citationId
        );
        if (validUid) {
            patientData.profile = { ...(patientData.profile || {}), usuarioId: validUid, citaId: citationId, citationId };
            patientData.identificacion = { ...(patientData.identificacion || {}), usuarioId: validUid, idCita: citationId, citaId: citationId };
        }

        const nextPhase = wasAlreadyCompleted ? Math.max(21, Number(row.last_active_phase) || 21) : 20;
        const nextBlock = wasAlreadyCompleted ? "finished" : "PHASE_20_READY";

        const stmtSave = db.prepare(`
            INSERT INTO session_persistence (citation_id, user_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                user_id = CASE
                    WHEN excluded.user_id IS NOT NULL AND excluded.user_id != '0' THEN excluded.user_id
                    WHEN session_persistence.user_id IS NOT NULL AND session_persistence.user_id != '0' THEN session_persistence.user_id
                    ELSE NULL
                END,
                last_active_phase = CASE
                    WHEN session_persistence.is_completed = 1 THEN MAX(COALESCE(session_persistence.last_active_phase, 21), excluded.last_active_phase)
                    ELSE excluded.last_active_phase
                END,
                last_active_block = CASE
                    WHEN session_persistence.is_completed = 1 THEN 'finished'
                    ELSE excluded.last_active_block
                END,
                patient_data_snapshot = excluded.patient_data_snapshot,
                is_completed = CASE
                    WHEN excluded.is_completed = 1 OR session_persistence.is_completed = 1 THEN 1
                    ELSE 0
                END,
                last_updated = CURRENT_TIMESTAMP
        `);

        const cipherSnapshot = cryptoVault.encryptClinicalData(patientData);
        stmtSave.run(citationId.toString(), validUid, nextPhase, nextBlock, cipherSnapshot, wasAlreadyCompleted ? 1 : 0);

        cryptoVault.appendAuditLedger({
            actorId: 'SPECIALIST_SHERPA',
            action: 'APPROVE_DOSSIER',
            patientId: citationId.toString(),
            payload: { phase: nextPhase, approvedAt: new Date().toISOString() }
        });

        console.log(`💾 [RLHF SUCCESS] Expediente v2.5 sellado con deltas de especialista para Cita #${citationId}`);
        res.json({ success: true, message: "Expediente sellado por el especialista con metadatos RLHF." });

    } catch (err) {
        console.error("🔥 Error en approveDossier:", err.message);
        res.status(500).json({ success: false, message: "Error al sellar el expediente clínico." });
    }
};

/**
 * POST /api/cortex/presync-baseline
 * Persiste silenciosamente el snapshot basal completo ($T_0$) de los 245 biomarcadores
 * antes de la reducción del payload de red, blindando la línea base para revaloración a 28 días.
 */
const presyncBaselineSnapshot = async (req, res) => {
    const { citationId: rawCitationId, rawPatientData, electret245Baseline } = req.body;
    const citationId = normalizeControllerCitationId(rawCitationId);

    if (!citationId) {
        return res.status(400).json({ success: false, message: "Falta o es inválido el parámetro citationId (Guardia NOM-004)." });
    }

    try {
        const validUid = normalizeControllerUserId(
            rawPatientData?.profile?.usuarioId ??
            rawPatientData?.identificacion?.usuarioId ??
            rawPatientData?.usuarioId ??
            req.body.userId,
            citationId
        );

        const fullBaseline = sanitizeLegacyTelemetryInPatientData(sanitizeSnapshotStringsRecursively({
            ...(rawPatientData || {}),
            profile: {
                ...(rawPatientData?.profile || {}),
                citaId: citationId,
                citationId,
                ...(validUid ? { usuarioId: validUid } : {})
            },
            identificacion: {
                ...(rawPatientData?.identificacion || {}),
                idCita: citationId,
                citaId: citationId,
                ...(validUid ? { usuarioId: validUid } : {})
            },
            electretTelemetry: electret245Baseline || rawPatientData?.electretTelemetry || {},
            presyncedAt: new Date().toISOString(),
            isBaselineT0: true
        }));

        const cipherSnapshot = cryptoVault.encryptClinicalData(fullBaseline);

        const stmt = db.prepare(`
            INSERT INTO session_persistence (citation_id, user_id, last_active_phase, last_active_block, patient_data_snapshot, is_completed, last_updated)
            VALUES (?, ?, 19, 'BASELINE_T0', ?, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(citation_id) DO UPDATE SET
                user_id = CASE
                    WHEN excluded.user_id IS NOT NULL AND excluded.user_id != '0' THEN excluded.user_id
                    WHEN session_persistence.user_id IS NOT NULL AND session_persistence.user_id != '0' THEN session_persistence.user_id
                    ELSE NULL
                END,
                patient_data_snapshot = excluded.patient_data_snapshot,
                last_active_phase = 19,
                last_active_block = 'BASELINE_T0',
                last_updated = CURRENT_TIMESTAMP
        `);
        stmt.run(citationId.toString(), validUid, cipherSnapshot);

        cryptoVault.appendAuditLedger({
            actorId: 'CORTEX_PRESYNC',
            action: 'PRESYNC_BASELINE_T0',
            patientId: citationId.toString(),
            payload: { baselineSaved: true, timestamp: new Date().toISOString() }
        });

        console.log(`💾 [PRESYNC T0] Línea base de 245 biomarcadores Electret asegurada para Cita #${citationId}`);
        res.json({
            success: true,
            message: "Línea base cuántica T0 de 245 biomarcadores preservada exitosamente en SQLite.",
            citationId
        });
    } catch (err) {
        console.error("🔥 Error en presyncBaselineSnapshot:", err.message);
        res.status(500).json({ success: false, message: "Error al presincronizar la línea base T0.", details: err.message });
    }
};

module.exports = {
    synthesizeDossier,
    approveDossier,
    presyncBaselineSnapshot,
    distillClinicalSerum,
    calculateBidirectionalMetabolicAge,
    resolvePatientAltitudeMsnm,
    normalizeInternationalLabUnit,
    calculateCkdEpi2021Egfr,
    resolveActiveClinicalRoutes,
    detectPriorInstitutionalAdherence,
    translateLogisticsProfile,
    resolveBiometricMonitorLabel,
    enforceTemporalEmbargoOnText,
    resolveScheduledAppointmentSummary,
    extractNom004IdentificationSheet,
    extractDietaryAndEpigeneticSynthesis,
    resolvePatientSystemSeverity,
    buildCanonicalTherapeuticContract,
    detectSelective33PlusContraindication,
    detectSelective34PlusContraindication,
    resolveDynamicMacronutrientsAndRegimen,
    resolveNodeTherapeuticFocus,
    synthesizeAllIfmNodesSSoTT,
    evaluateBiosecurityAndTitration,
    buildOrthomolecularPrescription,
    buildPatientFriendlyGuide,
    humanizeBiomarkerTopicForPatient,
    calculatePrecisionWeights,
    calculatePrecisionBioenergetics,
    processCortexNodesInBatches,
    sanitizeLegacyTelemetryInPatientData,
    resolveBackendPatientIsFemale
};
