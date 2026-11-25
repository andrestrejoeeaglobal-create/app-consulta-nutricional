/**
 * Adaptador Resiliente de Guía Empática para el Paciente y Sanitizador Clínico Frontend
 * Ecosistema T.I.L.O. — Cumplimiento NOM-004-SSA3-2012 y WCAG 2.2 AAA
 *
 * Garantiza retrocompatibilidad 100% con citas históricas que carezcan de `patient_friendly_guide`,
 * filtrando falsos positivos (`NORMAL (-)`), reclasificando desbordes legados del Nodo 7,
 * sincronizando el Semáforo de Bioseguridad con la posología y eliminando jerga intimidante.
 */

import { enforcePatientGenderConcordance, resolvePatientSex } from './genderConcordance.js';
import { FORMULA_33PLUS, FORMULA_34PLUS, formatScaledActives } from './pharmacopeiaCatalogSSoT.js';

export { enforcePatientGenderConcordance };

const SINERGIX_PUBLIC_RELEASE_MS = new Date('2026-12-18T00:00:00-06:00').getTime();

export function isPostSinergixEmbargoDate(referenceDate = new Date()) {
    try {
        const dt = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
        const ts = dt.getTime();
        if (!Number.isFinite(ts)) return false;
        return ts >= SINERGIX_PUBLIC_RELEASE_MS;
    } catch (_) {
        return false;
    }
}

export function resolveBiometricMonitorLabel(referenceDate = new Date()) {
    return isPostSinergixEmbargoDate(referenceDate)
        ? 'EcoSinergix'
        : 'monitoreo biométrico de Ritmo Vital';
}

export function enforceTemporalEmbargoOnText(rawText = '', referenceDate = new Date()) {
    const str = String(rawText || '');
    if (!str || isPostSinergixEmbargoDate(referenceDate)) return str;
    return str
        .replace(/monitoreo\s+(?:cronotr[óo]pico\s+|de\s+FC\s+)?con\s+EcoSinergix/giu, 'monitoreo biométrico de Ritmo Vital')
        .replace(/monitoread[oa]\s+con\s+EcoSinergix/giu, 'bajo monitoreo biométrico de Ritmo Vital')
        .replace(/\bcon\s+EcoSinergix\b/giu, 'mediante monitoreo biométrico de Ritmo Vital')
        .replace(/\bEcoSinergix\b/giu, 'monitoreo biométrico de Ritmo Vital');
}

export function translateLogisticsProfile(patientData = {}) {
    try {
        const lp = patientData?.logistics_profile || patientData?.logistics || {};
        const saved = patientData?.clinical_dossier?.logistics_summary || {};
        const rawVenue = String(
            lp?.environment?.venue ||
            saved?.venueCode ||
            'HOME'
        ).trim().toUpperCase();
        const rawCook = String(
            lp?.cook_type ||
            saved?.cookCode ||
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

        const venueLabel = venueMap[rawVenue] || 'Casa';
        const cookLabel = cookMap[rawCook] || 'Preparación propia';
        const cookingTimeMinutes = Number(lp?.cooking_time_minutes || saved?.cookingTimeMinutes || 0) || null;
        const dinersCount = Number(lp?.sharing_diners_count || saved?.dinersCount || 0) || null;
        const sharingDynamicsCode = String(lp?.sharing_dynamics || saved?.sharingDynamicsCode || '').trim().toUpperCase();
        const sharingDemographicsCode = String(lp?.sharing_demographics || saved?.sharingDemographicsCode || '').trim().toUpperCase();

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
        if (dinersCount && dinersCount > 1) {
            opSegments.push(
                `${sharingDynamicsLabel || 'Mesa compartida'}: ${dinersCount} comensales${intergenerationalNote ? ` (${intergenerationalNote})` : ''}`
            );
        } else if (intergenerationalNote) {
            opSegments.push(intergenerationalNote);
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
            operationalSummary: 'Entorno: Casa | Preparación: Preparación propia'
        };
    }
}

export function resolveScheduledAppointmentSummary(patientData = {}) {
    try {
        const raw = patientData?.scheduledAppointment ||
            patientData?.clinical_dossier?.scheduled_appointment_summary ||
            patientData?.clinical_dossier?.patient_friendly_guide?.scheduled_appointment_summary ||
            {};
        const rawDate = String(raw?.chosenDate || raw?.rawDateLabel || raw?.dateLabel || '').trim();
        const rawTime = String(raw?.chosenTime || raw?.timeLabel || '').trim();
        const rawFolio = String(raw?.folio || '').replace(/^#/, '').trim();
        if (!rawDate) {
            return {
                hasScheduled: false,
                dateLabel: null,
                timeLabel: null,
                folio: null,
                formattedLine: 'Revaloración clínica comparativa al cierre del Ciclo 1 (Día 28)'
            };
        }
        const normalizedDate = rawDate.replace(
            /^(Lunes|Martes|Mi[ée]rcoles|Jueves|Viernes|S[áa]bado|Domingo),?\s+/iu,
            (_, wd) => `${wd.toLowerCase()} `
        );
        const parts = [normalizedDate];
        if (rawTime) parts.push(rawTime);
        if (rawFolio) parts.push(`Folio #${rawFolio}`);
        return {
            hasScheduled: true,
            dateLabel: normalizedDate,
            rawDateLabel: rawDate,
            timeLabel: rawTime || null,
            folio: rawFolio || null,
            formattedLine: parts.join(' • ')
        };
    } catch (_) {
        return {
            hasScheduled: false,
            dateLabel: null,
            timeLabel: null,
            folio: null,
            formattedLine: 'Revaloración clínica comparativa al cierre del Ciclo 1 (Día 28)'
        };
    }
}

export function resolveNom004IdentificationSheet(patientData = {}) {
    try {
        const saved = patientData?.clinical_dossier?.nom004_identification_sheet;
        const appt = resolveScheduledAppointmentSummary(patientData);
        if (saved && typeof saved === 'object' && saved.vitals && saved.somatometry) {
            return {
                ...saved,
                scheduledAppointment: appt
            };
        }

        const verifiedAge = resolveVerifiedPatientAge(patientData, 35);
        const { isFemale } = resolvePatientSex(patientData);
        const alt = resolveClientAltitudeMsnm(patientData);
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
        const emgName = String(emg?.nombre || emg?.name || '').trim();
        const emgKin = String(emg?.parentesco || emg?.kin || '').trim();
        const emgPhone = String(emg?.telefono || emg?.phone || '').trim();
        const emergencyContactText = emgName
            ? `${emgName}${emgKin || emgPhone ? ` (${[emgKin, emgPhone ? `Tel. ${emgPhone}` : ''].filter(Boolean).join(' • ')})` : ''}`
            : 'No registrado';

        const primaryMotive = String(
            patientData?.clinical_context?.primary_motive ||
            patientData?.motivo_consulta ||
            patientData?.motivo ||
            patientData?.reason_for_consultation ||
            patientData?.clinical_context?.ai_analysis?.gem_reasoning ||
            'Evaluación nutricional preventiva integral'
        ).trim();

        const rawFamily = Array.isArray(patientData?.history?.family_structured) && patientData.history.family_structured.length > 0
            ? patientData.history.family_structured
            : (Array.isArray(patientData?.familyTree?.antecedentes) ? patientData.familyTree.antecedentes : []);
        const ahfMap = new Map();
        rawFamily.forEach((it) => {
            const cond = String(it?.condition || it?.patologia || it?.disease || '').trim();
            const kin = String(it?.relative || it?.familiar || it?.relationship || '').trim();
            if (!cond || /^(ningun[oa]?|niega|negad[oa]s?|no|n\/a)$/i.test(cond)) return;
            const k = cond.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (!ahfMap.has(k)) ahfMap.set(k, { cond, kins: new Set() });
            if (kin) ahfMap.get(k).kins.add(kin);
        });
        const ahfList = Array.from(ahfMap.values()).map((x) =>
            x.kins.size > 0 ? `${x.cond} (${Array.from(x.kins).join(', ')})` : x.cond
        );
        const ahfText = ahfList.length > 0 ? ahfList.join('; ') : 'Negados';

        const rawPaths = Array.isArray(patientData?.history?.pathologies) ? patientData.history.pathologies : [];
        const appItems = rawPaths
            .map((p) => String(typeof p === 'object' ? (p?.name || p?.patologia || p?.label || '') : p || '').trim())
            .filter((s) => s && !/^(ningun[oa]?|niega|negad[oa]s?|no)$/i.test(s));
        const appText = appItems.length > 0 ? appItems.join(', ') : 'Niega patológicos crónicos';

        const rawSurg = Array.isArray(patientData?.history?.surgical) ? patientData.history.surgical : [];
        const surgItems = rawSurg
            .map((s) => String(typeof s === 'object' ? (s?.label || s?.name || '') : s || '').trim())
            .filter((s) => s && !/^(ningun[oa]?|niega|negad[oa]s?|no)$/i.test(s));
        const surgicalText = surgItems.length > 0 ? surgItems.join(', ') : 'Negados';

        const foodAllergies = (patientData?.history?.allergies?.food || [])
            .map((a) => String(typeof a === 'object' ? (a?.agent || a?.name || '') : a || '').trim())
            .filter(Boolean);
        const drugAllergies = (patientData?.history?.allergies?.drug || [])
            .map((a) => String(typeof a === 'object' ? (a?.agent || a?.name || '') : a || '').trim())
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
            .map((m) => String(typeof m === 'object' ? (m?.name || m?.drug || '') : m || '').trim())
            .filter((s) => s && !/^(ningun[oa]?|niega|no)$/i.test(s));
        const medicationsText = medItems.length > 0 ? medItems.join(', ') : 'Ninguno (0 fármacos activos)';

        const rawSups = Array.isArray(patientData?.history?.supplements) ? patientData.history.supplements : [];
        const supBrands = [];
        let supDur = '';
        rawSups.forEach((s) => {
            const nm = String(typeof s === 'object' ? (s?.name || '') : s || '');
            if (/33\s*plus/i.test(nm) && !supBrands.includes('33Plus®')) supBrands.push('33Plus®');
            if (/34\s*plus/i.test(nm) && !supBrands.includes('34Plus®')) supBrands.push('34Plus®');
            if (typeof s === 'object' && s?.duration && String(s.duration).length > supDur.length) supDur = String(s.duration).trim();
        });
        const priorSupplementsText = supBrands.length > 0
            ? `${supBrands.join(' y ')}${supDur ? ` (adherencia previa de ${supDur})` : ''}`
            : 'Ninguna declarada';

        const digProfile = patientData?.digestive_profile || {};
        const digSymptoms = [
            ...(Array.isArray(digProfile?.symptoms) ? digProfile.symptoms : []),
            ...(Array.isArray(patientData?.history?.digestive_symptoms) ? patientData.history.digestive_symptoms : [])
        ].map((s) => String(s || '').trim()).filter((s) => s && !/^(ningun[oa]?|niega|no)$/i.test(s));
        const isClinicalEubiosis = !digProfile?.has_issues && digSymptoms.length === 0;
        const digestivePhenotypeText = isClinicalEubiosis
            ? 'Eubiosis clínica (0 síntomas digestivos)'
            : `Sintomatología reportada: ${digSymptoms.join(', ') || digProfile?.phenotype || 'Sensibilidad digestiva'}`;

        const v = patientData?.vitals || {};
        const bp = v?.blood_pressure || v?.bloodPressure || {};
        const sysBp = Number(bp?.systolic || 0) || null;
        const diaBp = Number(bp?.diastolic || 0) || null;
        const fcVal = Number(v?.heart_rate ?? v?.hr ?? 0) || null;
        const frVal = Number(v?.respiratory_rate ?? v?.rr ?? 0) || null;
        const spo2Val = Number(v?.spo2 ?? 0) || null;
        const tempVal = Number(v?.temperature ?? 0) || null;
        const gluVal = Number(v?.glucose ?? 0) || null;

        const vitalsParts = [
            sysBp && diaBp ? `PA ${sysBp}/${diaBp} mmHg` : null,
            fcVal ? `FC ${fcVal} lpm` : null,
            frVal ? `FR ${frVal} rpm` : null,
            spo2Val ? `SpO2 ${spo2Val} %${alt?.msnm >= 1500 ? ` (${alt.msnm} msnm)` : ''}` : null,
            tempVal ? `Temp ${tempVal} °C` : null,
            gluVal ? `Glucosa basal ${gluVal} mg/dL` : null
        ].filter(Boolean);

        const weightKg = Number(v?.weight || patientData?.clinical_dossier?.bioenergetics?.weightKg || patientData?.peso || 0) || null;
        const rawH = Number(v?.height || patientData?.clinical_dossier?.bioenergetics?.heightCm || patientData?.talla || 0) || null;
        const heightCm = rawH ? (rawH < 3 ? Number((rawH * 100).toFixed(1)) : rawH) : null;
        const bmi = (weightKg && heightCm)
            ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
            : (Number(v?.bmi || 0) || null);
        const bmiClass = String(v?.bmi_class || (bmi >= 30 ? 'Obesidad' : bmi >= 25 ? 'Sobrepeso' : bmi ? 'Normopeso' : '')).trim();
        const bodyFatPct = Number(v?.body_fat || patientData?.clinical_dossier?.bioenergetics?.bodyFatPct || 0) || null;
        const leanMassKg = (weightKg && bodyFatPct)
            ? Number((weightKg * (1 - bodyFatPct / 100)).toFixed(1))
            : (Number(patientData?.clinical_dossier?.bioenergetics?.leanBodyMassKg || 0) ? Number(Number(patientData.clinical_dossier.bioenergetics.leanBodyMassKg).toFixed(1)) : null);
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

        return {
            ageYears: verifiedAge.ageYears,
            sexLabel: isFemale ? 'Femenino' : 'Masculino',
            birthDate: birthDate || null,
            curp: curp || null,
            altitudeMsnm: alt?.msnm || 0,
            altitudeLabel: alt?.label || 'Nivel basal',
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
            scheduledAppointment: appt
        };
    } catch (_) {
        return null;
    }
}

function resolveClientAltitudeMsnm(patientData = {}) {
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
            patientData?.profile?.altitude_msnm,
            patientData?.altitude_msnm
        ];
        for (const cand of explicitCandidates) {
            if (cand !== null && cand !== undefined && String(cand).trim() !== '') {
                const n = parseFloat(String(cand).replace(/[^0-9.-]/g, ''));
                if (Number.isFinite(n) && n >= -100 && n <= 5500) {
                    const m = Math.round(n);
                    return { msnm: Math.max(0, m), spo2Floor: m >= 2400 ? 92 : (m >= 1500 ? 94 : 95), label: `${m} msnm` };
                }
            }
        }
        const lat = parseFloat(dom?.coordinates?.lat ?? dom?.lat ?? ident?.lat ?? NaN);
        const lng = parseFloat(dom?.coordinates?.lng ?? dom?.lng ?? ident?.lng ?? NaN);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            if (lat >= 19.12 && lat <= 19.46 && lng >= -99.85 && lng <= -99.42) return { msnm: 2660, spo2Floor: 92, label: 'Valle de Toluca • 2660 msnm' };
            if (lat >= 19.20 && lat <= 19.65 && lng >= -99.36 && lng <= -98.88) return { msnm: 2240, spo2Floor: 94, label: 'Valle de México • 2240 msnm' };
            if (lat >= 20.02 && lat <= 20.22 && lng >= -98.85 && lng <= -98.60) return { msnm: 2420, spo2Floor: 92, label: 'Pachuca • 2420 msnm' };
        }
        const cp = String(dom.cp || dom.codigoPostal || ident.cp || ident.codigoPostal || '').trim();
        if (/^(50\d{3}|520\d{2}|521\d{2})$/.test(cp)) return { msnm: 2660, spo2Floor: 92, label: 'Valle de Toluca • 2660 msnm' };
        if (/^(0[1-9]\d{3}|1[0-6]\d{3})$/.test(cp)) return { msnm: 2240, spo2Floor: 94, label: 'Ciudad de México • 2240 msnm' };
        const geo = `${dom.municipio || ''} ${dom.ciudad || ''} ${dom.estado || ''} ${dom.direccion_capturada_usuario || ''} ${ident.municipio || ''} ${ident.ciudad || ''} ${ident.estado || ''}`
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (/\b(?:toluca|metepec|zinacantepec|lerma|bogota|quito|zacatecas|pachuca|tlaxcala)\b/.test(geo)) {
            return { msnm: 2600, spo2Floor: 92, label: 'Alta montaña (>= 2,400 msnm)' };
        }
        if (/\b(?:ciudad de mexico|cdmx|puebla|queretaro|tasquillo|morelia|leon|guanajuato|san luis potosi|aguascalientes|guadalajara|zapopan)\b/.test(geo)) {
            return { msnm: 1850, spo2Floor: 94, label: 'Altitud media (>= 1,500 msnm)' };
        }
    } catch (_) {
        // Fallback seguro
    }
    return { msnm: 0, spo2Floor: 95, label: 'Nivel basal (< 1,500 msnm)' };
}

/**
 * Selector Resiliente SSoTT del Estudio de Edad Metabólica (`EGM-51` v2).
 * Prioriza el objeto sellado en `clinical_dossier.metabolic_age_study` y provee
 * respaldo determinista idéntico (17 rutas, altitud, composición deportiva y metas 28d/90d)
 * para expedientes históricos previos a la re-síntesis.
 */
export function resolveMetabolicAgeStudySSoT(patientData = {}) {
    const dossier = patientData?.clinical_dossier || {};
    const persisted =
        dossier?.metabolic_age_study ||
        dossier?.canonical_clinical_plan?.metabolicAgeStudy ||
        dossier?.therapeutic_contract?.metabolicAgeStudy ||
        dossier?.patient_friendly_guide?.metabolic_age_study ||
        null;

    if (persisted && typeof persisted === 'object' && persisted.engineVersion) {
        if (persisted.isSuppressedBySafetyGate && !persisted.suppressionReasonText) {
            return {
                ...persisted,
                suppressionReasonCode: persisted.suppressionReasonCode || persisted.safetyGateReasonCode,
                suppressionReasonText: persisted.safetyGatePatientExplanation || persisted.patientSummary || persisted.safetyGateClinicalExplanation
            };
        }
        return persisted;
    }

    const verified = resolveVerifiedPatientAge(patientData, 35);
    const chronoAge = Number(verified.ageYears) || 35;
    const { isFemale } = resolvePatientSex(patientData);

    try {
        const rawTokens = [
            patientData?.clinical_context?.primary_route,
            ...(Array.isArray(patientData?.clinical_context?.routes) ? patientData.clinical_context.routes : []),
            ...(Array.isArray(patientData?.activeRoutes) ? patientData.activeRoutes : [patientData?.activeRoutes]),
            patientData?.history?.primaryRoute,
            patientData?.route,
            patientData?.profile?.goal,
            patientData?.motivo_consulta,
            patientData?.motivo,
            patientData?.reason_for_consultation,
            ...(Array.isArray(patientData?.history?.pathologies)
                ? patientData.history.pathologies.map((p) => (typeof p === 'object' ? (p.name || p.patologia) : p))
                : []),
            JSON.stringify(patientData?.history?.special_context || '')
        ]
            .filter(Boolean)
            .map((x) => String(x).toUpperCase())
            .join(' | ');

        const isPedGate = chronoAge < 18 || verified.isLactanteVerified || verified.isPediatricVerified || /GOAL_PEDIATRICS|PEDIATR/.test(rawTokens);
        const isPregGate = Boolean(patientData?.physio?.is_pregnant || patientData?.physio?.is_lactating) || /GOAL_PREGNANCY|EMBARAZ|GESTACI[ÓO]N|LACTANCIA\s+MATERNA/.test(rawTokens);
        const isTcaGate = /GOAL_MENTAL_HEALTH|\bTCA\b|ANOREXIA|BULIMIA|ATRAC[ÓO]N|ORTOREXIA|VIGOREXIA|DISMORFIA|CONDUCTA\s+ALIMENTARIA/.test(rawTokens);
        const isPalGate = /GOAL_PALLIATIVE|CUIDADOS?\s+PALIATIV|TERMINAL/.test(rawTokens);
        const isSportRoute = /GOAL_MUSCLE|GANAR\s+M[ÚU]SCULO|HIPERTROFIA|ATLETA|DEPORTE\s+DE\s+FUERZA/.test(rawTokens);

        const extMetrics = patientData?.scan_data?.external_metrics || {};
        const hasLabs = Boolean(
            patientData?.lab_results ||
            (extMetrics?.sections && Object.keys(extMetrics.sections).length > 0) ||
            (extMetrics?.biomarkers && Object.keys(extMetrics.biomarkers).length > 0) ||
            (Array.isArray(extMetrics?.external_studies?.clinical_imaging_and_cabinet) && extMetrics.external_studies.clinical_imaging_and_cabinet.length > 0)
        );
        const hasBio = Boolean(patientData?.scan_data?.electret_metrics || patientData?.scan_data?.ocular_metrics || patientData?.scan_data?.lingual_metrics);
        const evidenceTier = hasLabs ? 'BIOQUIMICO_INTEGRAL' : (hasBio ? 'BIOFISICO_MULTIMODAL' : 'CLINICO_ANTROPOMETRICO');
        const evidenceTierBadge = evidenceTier === 'BIOQUIMICO_INTEGRAL'
            ? 'Certeza Bioquímica y Clínica Integral'
            : evidenceTier === 'BIOFISICO_MULTIMODAL'
                ? 'Certeza Biofísica y Clínica Multimodal'
                : 'Certeza Clínica y Antropométrica Basal';

        if (isPedGate || isPregGate || isTcaGate || isPalGate) {
            const reasonCode = isPedGate
                ? 'PEDIATRICS_GROWTH_PERCENTILES'
                : isPregGate
                    ? 'PREGNANCY_LACTATION_PROTECTION'
                    : isTcaGate
                        ? 'TCA_BEHAVIORAL_SAFETY'
                        : 'PALLIATIVE_COMFORT_CARE';
            const badge = isPedGate
                ? 'Protección Pediátrica Activa • Desarrollo Longitudinal'
                : isPregGate
                    ? 'Protección Materno-Infantil • Embarazo y Lactancia'
                    : isTcaGate
                        ? 'Seguridad Conductual Activa • Bienestar Integral'
                        : 'Cuidado Compasivo Integral • Confort y Calidad de Vida';
            const title = isPedGate
                ? 'Seguimiento por Curvas de Crecimiento y Desarrollo (Sin Edad Metabólica Comparativa)'
                : isPregGate
                    ? 'Acompañamiento Fisiológico Gestacional y de Lactancia (Edad Metabólica Desactivada)'
                    : isTcaGate
                        ? 'Acompañamiento Nutricional Centrado en Vitalidad y Relación Saludable con la Alimentación'
                        : 'Soporte Nutricional Enfocado en Confort Digestivo, Hidratación y Bienestar Diario';
            const msg = isPedGate
                ? 'En menores de 18 años acompañamos el crecimiento saludable mediante curvas pediátricas de talla, peso y vitalidad diaria, sin aplicar comparaciones de edad metabólica de adultos.'
                : isPregGate
                    ? 'Durante el embarazo y la lactancia evaluamos su bienestar materno e hidratación sin comparaciones punitivas de edad metabólica.'
                    : isTcaGate
                        ? 'Su plan prioriza su energía diaria, descanso reparador y paz nutricional, prescindiendo deliberadamente de marcadores comparativos de edad corporal.'
                        : 'Nuestro acompañamiento se centra plenamente en su confort diario, hidratación suave y aprovechamiento amable de sus alimentos.';
            return {
                engineVersion: '3.3.0-EGM51-CLIENT-SSOTT',
                isSuppressedBySafetyGate: true,
                safetyGateReasonCode: reasonCode,
                suppressionReasonCode: reasonCode,
                safetyGateBadge: badge,
                safetyGateTitle: title,
                safetyGatePatientExplanation: msg,
                safetyGateClinicalExplanation: msg,
                suppressionReasonText: msg,
                chronologicalAge: chronoAge,
                metabolicAge: null,
                metabolicAgeExact: null,
                deltaYears: null,
                deltaYearsRounded: null,
                cycle1TargetAge28d: null,
                cycle1Delta28d: null,
                cycle3ProjectionAge90d: null,
                cycle3Delta90d: null,
                evidenceTier,
                evidenceTierBadge,
                evidenceConfidencePct: hasLabs ? 95 : 80,
                patientSummary: msg,
                clinicalSummary: msg
            };
        }

        const vitals = patientData?.vitals || {};
        const bio = dossier?.bioenergetics || {};
        const alt = resolveClientAltitudeMsnm(patientData);
        const weightKg = parseFloat(vitals.weight ?? bio.weightKg ?? patientData?.peso ?? NaN);
        const rawH = parseFloat(vitals.height ?? bio.heightCm ?? patientData?.talla ?? NaN);
        const heightCm = Number.isFinite(rawH) ? (rawH < 3 ? rawH * 100 : rawH) : NaN;
        const waistCm = parseFloat(vitals.waist ?? patientData?.biometria?.cintura ?? patientData?.cintura ?? NaN);
        const hipCm = parseFloat(vitals.hip ?? patientData?.biometria?.cadera ?? patientData?.cadera ?? NaN);
        const bodyFat = parseFloat(vitals.body_fat ?? bio.bodyFatPct ?? patientData?.biometria?.grasa_corporal ?? NaN);
        const bmi = Number.isFinite(weightKg) && Number.isFinite(heightCm) && heightCm > 0
            ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
            : (Number.isFinite(parseFloat(vitals.bmi ?? bio.bmi)) ? Number(parseFloat(vitals.bmi ?? bio.bmi).toFixed(1)) : null);
        const ica = Number.isFinite(waistCm) && Number.isFinite(heightCm) && heightCm > 0 ? Number((waistCm / heightCm).toFixed(2)) : null;
        const icc = Number.isFinite(waistCm) && Number.isFinite(hipCm) && hipCm > 0
            ? Number((waistCm / hipCm).toFixed(2))
            : (Number.isFinite(parseFloat(vitals.whr ?? patientData?.icc)) ? Number(parseFloat(vitals.whr ?? patientData?.icc).toFixed(2)) : null);

        const iccLimit = isFemale ? 0.85 : 0.90;
        const isAthletic = Boolean(
            isSportRoute ||
            (Number.isFinite(bodyFat) && bodyFat <= (isFemale ? 25 : 18) && (ica === null || ica < 0.52) && (icc === null || icc < iccLimit))
        );

        let weightedSum = 0;
        let weightTotal = 0;
        if (bmi !== null || ica !== null || icc !== null || Number.isFinite(bodyFat)) {
            let s1 = 0;
            if (isAthletic) {
                s1 = Number.isFinite(bodyFat) && bodyFat <= (isFemale ? 22 : 15) ? -3.2 : -2.0;
                if (ica !== null && ica < 0.49) s1 -= 1.0;
            } else {
                if (ica !== null) s1 += ica < 0.50 ? -1.6 : (ica <= 0.54 ? 0.6 : (ica <= 0.60 ? 2.2 : 4.2));
                else if (bmi !== null) s1 += bmi < 25 ? -1.2 : (bmi < 30 ? 1.6 : 3.8);
                if (icc !== null) s1 += icc < iccLimit ? -0.6 : 1.0;
                const optFat = (isFemale ? 28 : 20) + (chronoAge >= 60 ? 2 : 0);
                if (Number.isFinite(bodyFat)) s1 += bodyFat <= optFat ? -0.8 : (bodyFat <= optFat + 5 ? 0.8 : 2.2);
            }
            weightedSum += 0.30 * Math.max(-6, Math.min(9, s1));
            weightTotal += 0.30;
        }

        const bp = vitals.blood_pressure || vitals.bloodPressure || {};
        const sys = parseInt(bp.systolic || 0, 10);
        const dia = parseInt(bp.diastolic || 0, 10);
        const spo2 = parseFloat(vitals.spo2 || 0);
        const hasEx = Boolean(patientData?.lifestyle_profile?.activity?.source_type === 'TELEMETRY_TCX' || Number(patientData?.lifestyle_profile?.activity?.weekly_minutes) >= 120);
        if (sys > 0 || spo2 > 0 || hasEx) {
            let s2 = 0;
            if (sys > 0 && dia > 0) s2 += (sys < 122 && dia < 80) ? -1.2 : (sys >= 140 || dia >= 90 ? 4.8 : (sys >= 130 || dia >= 85 ? 2.0 : -0.3));
            if (spo2 > 0) s2 += spo2 >= alt.spo2Floor ? -0.5 : 1.8;
            if (hasEx) s2 -= 1.8;
            weightedSum += 0.20 * Math.max(-5.5, Math.min(8.5, s2));
            weightTotal += 0.20;
        }

        const gluRaw = parseFloat(vitals.glucose || 0);
        if (gluRaw > 0) {
            const s3 = gluRaw >= 126 ? 6.5 : (gluRaw >= 100 ? 3.2 : -1.5);
            weightedSum += 0.20 * s3;
            weightTotal += 0.20;
        }

        const rawDelta = weightTotal > 0 ? weightedSum / weightTotal : 0;
        const clampedDelta = Number(Math.max(-8.0, Math.min(12.0, rawDelta)).toFixed(1));
        const metaExact = Number(Math.max(18.0, chronoAge + clampedDelta).toFixed(1));
        const c1Delta = clampedDelta > 0.4
            ? -Number(Math.min(clampedDelta, clampedDelta >= 3.0 ? 1.5 : (clampedDelta >= 1.2 ? 1.2 : Math.max(0.5, clampedDelta))).toFixed(1))
            : -0.5;
        const c3Delta = clampedDelta > 0.4
            ? -Number(Math.min(clampedDelta, Math.max(Math.abs(c1Delta), Math.min(4.5, Number((clampedDelta * 0.6).toFixed(1))))).toFixed(1))
            : -1.0;
        const c1Age = Number((metaExact + c1Delta).toFixed(1));
        const c3Age = Number((metaExact + c3Delta).toFixed(1));

        return {
            engineVersion: '3.3.0-EGM51-CLIENT-SSOTT',
            isSuppressedBySafetyGate: false,
            safetyGateReasonCode: null,
            chronologicalAge: chronoAge,
            metabolicAge: Math.round(metaExact),
            metabolicAgeExact: metaExact,
            deltaYears: clampedDelta,
            deltaYearsRounded: Math.round(metaExact) - chronoAge,
            cycle1TargetAge28d: c1Age,
            cycle1Delta28d: c1Delta,
            cycle3ProjectionAge90d: c3Age,
            cycle3Delta90d: c3Delta,
            evidenceTier,
            evidenceTierBadge,
            evidenceConfidencePct: hasLabs ? 95 : (hasBio ? 82 : 72),
            altitudeMsnm: alt.msnm,
            altitudeLabel: alt.label,
            isAthleticHighLeanMass: isAthletic,
            patientSummary: `Su Edad Cronológica es de ${chronoAge} años y su Edad Metabólica estimada es de ${metaExact} años (${clampedDelta >= 0 ? `+${clampedDelta}` : clampedDelta} años • ${evidenceTierBadge}). Meta Ciclo 1 (28 días): ${c1Age} años | Proyección a 90 días: ${c3Age} años.`,
            clinicalSummary: `Estudio Multivariable EGM-51 v2 (${evidenceTier}): Edad Cronológica ${chronoAge} a vs Edad Metabólica ${metaExact} a (Delta ${clampedDelta >= 0 ? `+${clampedDelta}` : clampedDelta} a). Meta 28d: ${c1Age} a | Proyección 90d: ${c3Age} a.`
        };
    } catch (_) {
        return {
            engineVersion: '3.3.0-EGM51-CLIENT-SAFE',
            isSuppressedBySafetyGate: false,
            safetyGateReasonCode: null,
            chronologicalAge: chronoAge,
            metabolicAge: chronoAge,
            metabolicAgeExact: chronoAge,
            deltaYears: 0,
            deltaYearsRounded: 0,
            cycle1TargetAge28d: chronoAge,
            cycle1Delta28d: 0,
            cycle3ProjectionAge90d: chronoAge,
            cycle3Delta90d: 0,
            evidenceTier: 'CLINICO_ANTROPOMETRICO',
            evidenceTierBadge: 'Certeza Clínica y Antropométrica Basal',
            evidenceConfidencePct: 72,
            patientSummary: `Su Edad Cronológica (${chronoAge} años) guarda equilibrio con su referencia metabólica actual.`,
            clinicalSummary: `Referencia basal segura: ${chronoAge} años.`
        };
    }
}

const SPANISH_ACCENT_PROPER_TOKENS = {
    andres: 'Andrés',
    jesus: 'Jesús',
    jose: 'José',
    maria: 'María',
    angel: 'Ángel',
    oscar: 'Óscar',
    cesar: 'César',
    hector: 'Héctor',
    victor: 'Víctor',
    raul: 'Raúl',
    ruben: 'Rubén',
    ivan: 'Iván',
    adrian: 'Adrián',
    fabiola: 'Fabiola',
    sofia: 'Sofía',
    lucia: 'Lucía',
    monica: 'Mónica',
    veronica: 'Verónica',
    hernandez: 'Hernández',
    garcia: 'García',
    martinez: 'Martínez',
    lopez: 'López',
    gonzalez: 'González',
    perez: 'Pérez',
    rodriguez: 'Rodríguez',
    sanchez: 'Sánchez',
    ramirez: 'Ramírez',
    gomez: 'Gómez',
    diaz: 'Díaz',
    vazquez: 'Vázquez',
    jimenez: 'Jiménez',
    gutierrez: 'Gutiérrez',
    ruiz: 'Ruiz',
    mendez: 'Méndez'
};

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

export function formatInstitutionalFullName(patientData, fallback = 'Paciente') {
    const pInfo = patientData?.identityLock?.patientInfo || {};
    const composedIdent = composeDeduplicatedFullName(
        patientData?.identificacion?.nombres || patientData?.identificacion?.nombre_pila || patientData?.identificacion?.nombre,
        patientData?.identificacion?.apellidoPaterno,
        patientData?.identificacion?.apellidoMaterno
    );
    const composedProfile = composeDeduplicatedFullName(
        patientData?.profile?.first_name || patientData?.profile?.firstName || patientData?.profile?.nombre,
        patientData?.profile?.last_name || patientData?.profile?.lastName || patientData?.profile?.apellidos,
        patientData?.profile?.second_last_name
    );

    const candidates = [
        pInfo.full_name,
        pInfo.name,
        patientData?.identificacion?.nombreCompleto,
        composedIdent,
        patientData?.profile?.fullName,
        patientData?.profile?.name,
        composedProfile,
        patientData?.fullName,
        patientData?.name
    ]
        .map((x) => String(x || '').replace(/\s+/g, ' ').trim())
        .filter((x) => x && !/^(paciente|usuario|invitado|su\s+beb[ée]|el\s+menor|la\s+menor|null|undefined|s\/n|---)$/i.test(x));

    const bestRaw = candidates.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)[0] || fallback;
    const lowercaseConnectors = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
    return bestRaw
        .split(/\s+/)
        .map((tok, idx) => {
            const lowerPlain = tok
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
            if (idx > 0 && lowercaseConnectors.has(lowerPlain)) return lowerPlain;
            if (SPANISH_ACCENT_PROPER_TOKENS[lowerPlain]) return SPANISH_ACCENT_PROPER_TOKENS[lowerPlain];
            const low = tok.toLocaleLowerCase('es-MX');
            return low.charAt(0).toLocaleUpperCase('es-MX') + low.slice(1);
        })
        .join(' ');
}

function matchCase(sourceWord, targetLower, targetCapitalized) {
    if (!sourceWord) return targetLower;
    if (sourceWord === sourceWord.toUpperCase() && sourceWord.length > 1) {
        return targetCapitalized.toUpperCase();
    }
    const first = sourceWord.charAt(0);
    if (first === first.toUpperCase() && first !== first.toLowerCase()) {
        return targetCapitalized;
    }
    return targetLower;
}

const UNICODE_WORD_FIXES = [
    [/cardiov[íi]asculares/giu, (m) => matchCase(m, 'cardiovasculares', 'Cardiovasculares')],
    [/cardiov[íi]ascular/giu, (m) => matchCase(m, 'cardiovascular', 'Cardiovascular')],
    [/cerebrov[íi]asculares/giu, (m) => matchCase(m, 'cerebrovasculares', 'Cerebrovasculares')],
    [/cerebrov[íi]ascular/giu, (m) => matchCase(m, 'cerebrovascular', 'Cerebrovascular')],
    [/microv[íi]asculares/giu, (m) => matchCase(m, 'microvasculares', 'Microvasculares')],
    [/microv[íi]ascular/giu, (m) => matchCase(m, 'microvascular', 'Microvascular')],
    [/periv[íi]asculares/giu, (m) => matchCase(m, 'perivasculares', 'Perivasculares')],
    [/periv[íi]ascular/giu, (m) => matchCase(m, 'perivascular', 'Perivascular')],
    [/endov[íi]asculares/giu, (m) => matchCase(m, 'endovasculares', 'Endovasculares')],
    [/endov[íi]ascular/giu, (m) => matchCase(m, 'endovascular', 'Endovascular')],
    [/neurov[íi]ascular/giu, (m) => matchCase(m, 'neurovascular', 'Neurovascular')],
    [/renov[íi]ascular/giu, (m) => matchCase(m, 'renovascular', 'Renovascular')],
    [/v[íi]ascularizaci[óo•\ufffd]n/giu, (m) => matchCase(m, 'vascularización', 'Vascularización')],
    [/v[íi]asculares/giu, (m) => matchCase(m, 'vasculares', 'Vasculares')],
    [/v[íi]ascular/giu, (m) => matchCase(m, 'vascular', 'Vascular')],
    [/(?<![\p{L}\p{N}_])v[íi]asos(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'vasos', 'Vasos')],
    [/(?<![\p{L}\p{N}_])v[íi]aso(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'vaso', 'Vaso')],
    [/inv[íi]asiv(o|a|os|as)/giu, (m, suf) => matchCase(m, `invasiv${suf.toLowerCase()}`, `Invasiv${suf.toLowerCase()}`)],
    [/significativ[íi]as/giu, (m) => matchCase(m, 'significativas', 'Significativas')],
    [/ev[íi]asluaci[óo•\ufffd]n/giu, (m) => matchCase(m, 'evaluación', 'Evaluación')],
    [/v[íi]aslor/giu, (m) => matchCase(m, 'valor', 'Valor')],
    [/cora[íi]z[óo]n/giu, (m) => matchCase(m, 'corazón', 'Corazón')],

    [/(?<![\p{L}\p{N}_])est[•\ufffd]ndar(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'estándar', 'Estándar')],
    [/(?<![\p{L}\p{N}_])p[•\ufffd]rdidas?(?![\p{L}\p{N}_])/giu, (m) => {
        const plural = /s$/i.test(m) ? 's' : '';
        return matchCase(m, `pérdida${plural}`, `Pérdida${plural}`);
    }],
    [/(?<![\p{L}\p{N}_])d[•\ufffd]cadas?(?![\p{L}\p{N}_])/giu, (m) => {
        const plural = /s$/i.test(m) ? 's' : '';
        return matchCase(m, `década${plural}`, `Década${plural}`);
    }],
    [/(?<![\p{L}\p{N}_])r[•\ufffd]pid(o|a|os|as)(?![\p{L}\p{N}_])/giu, (m, suf) => matchCase(m, `rápid${suf.toLowerCase()}`, `Rápid${suf.toLowerCase()}`)],
    [/(?<![\p{L}\p{N}_])f[•\ufffd]?sic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (m, suf) => matchCase(m, `físic${suf.toLowerCase()}`, `Físic${suf.toLowerCase()}`)],
    [/(?<![\p{L}\p{N}_])cat[•\ufffd]?lic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (m, suf) => matchCase(m, `católic${suf.toLowerCase()}`, `Católic${suf.toLowerCase()}`)],
    [/(?<![\p{L}\p{N}_])m[•\ufffd]xico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'méxico', 'México')],
    [/(?<![\p{L}\p{N}_])quer[•\ufffd]taro(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'querétaro', 'Querétaro')],
    [/(?<![\p{L}\p{N}_])a[•\ufffd]os(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'años', 'Años')],
    [/([\p{L}]+?[cs])i[•\ufffd]n(?![\p{L}\p{N}_])/giu, (_, prefix) => `${prefix}ión`],
    [/([\p{L}]+?)ol[•\ufffd]gic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (_, prefix, suf) => `${prefix}ológic${suf}`],
    [/([\p{L}]+?)[•\ufffd]mic(o|a|os|as)(?![\p{L}\p{N}_])/giu, (_, prefix, suf) => `${prefix}émic${suf}`],

    [/(?<![\p{L}\p{N}_])lipo\s*prote[íi]nas?\s+de\s+muy\s+baja\s+denc?idad(?:\s*\(VLDL-C\))?/giu, (m) => /VLDL-C/i.test(m) ? 'Lipoproteínas de Muy Baja Densidad (VLDL-C)' : 'Lipoproteínas de Muy Baja Densidad'],
    [/(?<![\p{L}\p{N}_])lipo\s*prote[íi]nas?\s+de\s+alta\s+denc?idad(?:\s*\(HDL-C\))?/giu, (m) => /HDL-C/i.test(m) ? 'Lipoproteínas de Alta Densidad (HDL-C)' : 'Lipoproteínas de Alta Densidad'],
    [/(?<![\p{L}\p{N}_])lipo\s*prote[íi]nas?\s+de\s+baja\s+denc?idad(?:\s*\(LDL-C\))?/giu, (m) => /LDL-C/i.test(m) ? 'Lipoproteínas de Baja Densidad (LDL-C)' : 'Lipoproteínas de Baja Densidad'],
    [/(?<![\p{L}\p{N}_])lipo\s+prote[íi]nas(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'lipoproteínas', 'Lipoproteínas')],
    [/(?<![\p{L}\p{N}_])dencidad(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'densidad', 'Densidad')],
    [/(?<![\p{L}\p{N}_])hipotalmico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'hipotalámico', 'Hipotalámico')],
    [/(?<![\p{L}\p{N}_])hipotalamico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'hipotalámico', 'Hipotalámico')],
    [/(?<![\p{L}\p{N}_])proteinas(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'proteínas', 'Proteínas')],
    [/(?<![\p{L}\p{N}_])proteina(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'proteína', 'Proteína')],
    [/(?<![\p{L}\p{N}_])[iïìî]ndices?(?![\p{L}\p{N}_])/giu, (m) => {
        const plural = /s$/i.test(m) ? 's' : '';
        return matchCase(m, `índice${plural}`, `Índice${plural}`);
    }],
    [/(?<![\p{L}\p{N}_])trigliceridos?(?![\p{L}\p{N}_])/giu, (m) => {
        const plural = /s$/i.test(m) ? 's' : '';
        return matchCase(m, `triglicérido${plural}`, `Triglicérido${plural}`);
    }],
    [/(?<![\p{L}\p{N}_])la\s+tiroglobulina(?![\p{L}\p{N}_])/giu, 'Tiroglobulina'],
    [/Osteocalcina\(BGP\)/gu, 'Osteocalcina (BGP)'],
    [/[ÍIÏï]ndice\s+de\s+Stroke/giu, 'Índice de Riesgo Cerebrovascular'],
    [/(?<![\p{L}\p{N}_])sistolico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'sistólico', 'Sistólico')],
    [/(?<![\p{L}\p{N}_])sistolica(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'sistólica', 'Sistólica')],
    [/(?<![\p{L}\p{N}_])diastolico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'diastólico', 'Diastólico')],
    [/(?<![\p{L}\p{N}_])diastolica(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'diastólica', 'Diastólica')],
    [/(?<![\p{L}\p{N}_])periferica(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'periférica', 'Periférica')],
    [/(?<![\p{L}\p{N}_])periferico(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'periférico', 'Periférico')],
    [/(?<![\p{L}\p{N}_])saturacion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'saturación', 'Saturación')],
    [/(?<![\p{L}\p{N}_])presion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'presión', 'Presión')],
    [/(?<![\p{L}\p{N}_])oxigeno(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'oxígeno', 'Oxígeno')],
    [/(?<![\p{L}\p{N}_])numero(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'número', 'Número')],
    [/(?<![\p{L}\p{N}_])licuefaccion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'licuefacción', 'Licuefacción')],
    [/(?<![\p{L}\p{N}_])estomago(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'estómago', 'Estómago')],
    [/(?<![\p{L}\p{N}_])vesicula(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'vesícula', 'Vesícula')],
    [/(?<![\p{L}\p{N}_])circulacion(?![\p{L}\p{N}_])/giu, (m) => matchCase(m, 'circulación', 'Circulación')],
    [/(?<![\p{L}\p{N}_])sangre\s+miocardial(?![\p{L}\p{N}_])/giu, 'Sangre Miocárdica'],
    [/(?<![\p{L}\p{N}_])sangu[íi]nea\s+miocardial(?![\p{L}\p{N}_])/giu, 'Sanguínea Miocárdica'],
    [/(?<![\p{L}\p{N}_])ox[íi]geno\s+miocardial(?![\p{L}\p{N}_])/giu, 'Oxígeno Miocárdico']
];

export function deduplicateRepeatedClauseVerbs(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText.replace(
        /\b(sugieren|sugiere|indican|indica|muestran|muestra|reflejan|refleja|evidencian|evidencia|revelan|revela|apuntan\s+a|apunta\s+a)\s+([^.!?;]+?)\s+(?:y|e)\s+\1\s+(?=[\p{L}\p{N}])/giu,
        (_, verb, firstClause, offset, fullStr) => {
            const afterMatch = fullStr.slice(offset + _.length).trimStart();
            const conj = /^(?:i|hi(?![aeouáéóú]))/iu.test(afterMatch) ? 'e' : 'y';
            return `${verb} ${firstClause.trim()} ${conj} `;
        }
    );
}

export function normalizeMetricDecimals(rawText) {
    if (rawText === null || rawText === undefined) return '';
    const str = String(rawText);
    if (/\b(?:pasos|kcal)\b/iu.test(str)) {
        return str.replace(/\(Ref:\s*([^)]+)\)/giu, (_, inner) => `(Ref: ${inner.replace(/(\d),(\d)/g, '$1.$2')})`);
    }
    return str.replace(/(\d),(\d)/g, '$1.$2');
}

export function joinSpanishList(items = []) {
    const clean = (Array.isArray(items) ? items : [])
        .map((x) => String(x || '').trim().replace(/[,;.\s]+$/g, ''))
        .filter(Boolean);
    if (clean.length === 0) return '';
    if (clean.length === 1) return clean[0];
    const last = clean[clean.length - 1];
    const conjunction = /^(?:i|hi(?![aeouáéóú]))/iu.test(last) ? ' e ' : ' y ';
    if (clean.length === 2) return `${clean[0]}${conjunction}${last}`;
    return `${clean.slice(0, -1).join(', ')}${conjunction}${last}`;
}

export function sanitizeClinicalSpanish(rawText) {
    if (rawText === null || rawText === undefined) return '';
    if (typeof rawText !== 'string') return String(rawText);
    let text = rawText;
    for (const [pattern, replacement] of UNICODE_WORD_FIXES) {
        text = text.replace(pattern, replacement);
    }
    text = text
        .replace(/\[\s*⚠️?\s*REQUIERE_REVISI[ÓO]N\s*\]/giu, '')
        .replace(/\bNOM-028\b/giu, 'NOM-004')
        .replace(/\(\s*Variante\s+(?:Suave\s+)?(?:Libre|Sin)\s+de\s+Estimulantes\s*\)/giu, '(Energía Celular y Circulación)')
        .replace(/\(\s*Variante\s+Suave\s+Sin\s+Estimulantes\s*\)/giu, '(Energía Celular y Circulación)')
        .replace(/\s*&\s*/gu, ' y ');
    text = enforceTemporalEmbargoOnText(text);
    text = text.replace(/\(Ref:\s*([^)]+)\)/giu, (_, inner) => `(Ref: ${inner.replace(/(\d),(\d)/g, '$1.$2')})`);
    text = deduplicateRepeatedClauseVerbs(text);
    return text.replace(/\s{2,}/g, ' ').trim();
}

function polishPatientEditorialPhrasing(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText
        .replace(/qu[ée]\s+est[áa]\s+pasando\s+en\s+su\s+cuerpo/giu, 'qué está ocurriendo en su organismo')
        .replace(/Para\s+proteger\s+su\s+cuerpo/gu, 'Para proteger su organismo')
        .replace(/complementari(o|a|os|as)\s+a\s+su\s+comida\s+real/giu, (_, suf) => `complementari${suf} a su alimentación diaria`)
        .replace(/complementari(o|a|os|as)\s+a\s+la\s+comida\s+real/giu, (_, suf) => `complementari${suf} a la alimentación diaria`)
        .replace(/\bcomida\s+real\b/giu, 'alimentación diaria')
        .replace(/\bcomida\s+limpia\b/giu, 'alimentación limpia')
        .replace(/lo\s+que\s+(su|el)\s+cuerpo(\s+de\s+[^.]+?)?\s+ya\s+no\s+necesita/giu, (_, art, tail = '') => `lo que ${art} organismo${tail} ya no necesita`)
        .replace(/El\s+cuerpo\s+se\s+repara\s+de\s+verdad\s+cuando\s+usted\s+duerme\s+profundo/giu, 'Su organismo se repara a profundidad cuando usted descansa bien');
}

export function capitalizeLeadingSpanish(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().replace(/^(\(\d+\)\s*)?([\p{Ll}])/u, (_, prefix = '', ch) => `${prefix}${ch.toUpperCase()}`);
}

export function isPhysiologicallyNormal(statusStr) {
    if (statusStr === null || statusStr === undefined) return true;
    const s = String(statusStr).trim().toUpperCase();
    if (!s || s === '-' || s === 'N/A' || s === 'NONE') return true;
    return (
        s === 'NORMAL' ||
        s === 'NORMALES' ||
        s.startsWith('NORMAL ') ||
        s.startsWith('NORMAL(') ||
        s === 'OPTIMAL' ||
        s.startsWith('OPTIMAL ') ||
        s === 'OPTIMO' ||
        s === 'ÓPTIMO' ||
        s.startsWith('OPTIMO ') ||
        s.startsWith('ÓPTIMO ') ||
        s === 'NEGATIVO' ||
        s === 'CONSERVADO' ||
        s === 'HOMEOSTASIS' ||
        s === 'DENTRO DE RANGO' ||
        s === 'SIN ALTERACIONES'
    );
}

const CLINICAL_BIOMARKER_DICT = {
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
    'MICROVASCULAR_CONGESTION': 'Congestión Microvascular'
};

export function formatCleanBiomarkerString(b) {
    if (!b) return '';
    let text = normalizeMetricDecimals(sanitizeClinicalSpanish(String(b).trim()));
    const exactKey = text.toUpperCase().replace(/\s+/g, '_');
    if (CLINICAL_BIOMARKER_DICT[exactKey]) return CLINICAL_BIOMARKER_DICT[exactKey];
    for (const [enKey, esVal] of Object.entries(CLINICAL_BIOMARKER_DICT)) {
        const re = new RegExp(`(?<![\\p{L}\\p{N}_])${enKey}(?![\\p{L}\\p{N}_])`, 'giu');
        text = text.replace(re, esVal);
    }
    return capitalizeLeadingSpanish(text);
}

/**
 * Descarta cadenas de biomarcadores legados que contienen un estado NORMAL (-), NORMAL (+), OPTIMAL, etc.
 */
export function isBiomarkerStringActuallyNormal(bStr) {
    if (!bStr) return true;
    const s = String(bStr).toUpperCase();
    if (/\|\s*NORMAL\s*(?:\([+-]+\))?\s*\)/.test(s)) return true;
    if (/ESTADO:\s*NORMAL\b/.test(s)) return true;
    if (/\(\s*NORMAL\s*(?:\([+-]+\))?\s*\)/.test(s)) return true;
    return false;
}

function classifyLegacyBiomarkerToSystemId(rawLabel) {
    const norm = sanitizeClinicalSpanish(String(rawLabel || ''))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    if (/(meridiano|shao_yin|yangmin|sutra|vejiga\s+plexo\s+solar|mano\s+intestino)/.test(norm)) {
        return 'EXCLUDED_MERIDIAN';
    }
    if (/(gastro|estomag|intestin|colon|pepsin|pancrea|absorcion|saburra|reflujo|colitis|treonina)/.test(norm)) {
        return 'digestion_absorcion';
    }
    if (/(higado|hepat|vesicul|biliar|renal|rinon|urobilin|proteinuri|acido\s+urico|creatinin|toxin|pesticid|metal|plomo|mercuri|arsenic|cadmi|metionina|molibdeno)/.test(norm)) {
        return 'filtros_naturales';
    }
    if (/(cardio|vascular|coronari|miocard|pulmon|respirat|capacidad\s+vital|paco2|sao2|viscosidad|bombeo|latido|glucos|insulina|colesterol|triglic|lipoprotein|hdl|ldl|coenzim|obesid|vitamina\s+b|potasio|magnesio|hierro|cobre|arginina|bolsas\s+en\s+los\s+ojos|circulos\s+oscuros|hipoxia)/.test(norm)) {
        return 'circulacion_energia';
    }
    if (/(endocrin|tiroid|cerebr|craneal|memoria|pineal|hipotal|prostat|esperma|semen|testosteron|ginecol|menstru|sueno|insomnio|estres|cortisol|inmun|linf|amigdal|alerg|histamin|cutane|melanin|vitamina\s+[ace]\b|zinc|selenio|lisina|triptofano|fenilalanina|yodo|fatiga\s+visual)/.test(norm)) {
        return 'descanso_defensas';
    }
    return 'huesos_musculos';
}

/**
 * Resolutor SSoTT Canónico e Inmutable de Edad y Etapa Vital (Fail-Closed Anti-Falso-Lactante).
 * Prioridad 1: Fecha de nacimiento verificada (DD/MM/YYYY, YYYY-MM-DD o CURP oficial).
 * Prioridad 2: Entero positivo estricto (> 0 y <= 125) en rutas clínicas conocidas.
 * PROHIBIDO evaluar Number(null)/Number('') === 0 o activar lactante (< 2 años) / MODO_TUTOR (< 13 años)
 * cuando la edad es null, undefined, NaN o 0 sin fecha de nacimiento verificada.
 */
export function resolveVerifiedPatientAge(patientData, fallback = 35) {
    const safeFallback = Number.isInteger(fallback) && fallback > 0 ? fallback : 35;
    const baseResult = {
        ageYears: safeFallback,
        ageMonths: null,
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
                return {
                    ageYears: years,
                    ageMonths: Math.max(0, months),
                    hasVerifiedBirthDate: true,
                    hasExplicitPositiveAge: years > 0,
                    isLactanteVerified: months >= 0 && months < 24,
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

export function extractPatientAge(patientData, fallback = 35) {
    return resolveVerifiedPatientAge(patientData, fallback).ageYears;
}

function humanizeLegacyTimeSlot(rawSlot, idx) {
    const s = sanitizeClinicalSpanish(String(rawSlot || '').trim());
    // Preservar calificadores clínicos explícitos (ej. "Días 8 en adelante, según tolerancia" o "(aprox. 4 h...)")
    if (/\((?:d[íi]as\s*8|seg[úu]n\s+tolerancia|semana\s*2|aprox\.)/i.test(s)) {
        return s;
    }
    if (/04:00|alba|despertar/i.test(s)) return 'Al despertar en ayunas';
    if (/09:30|media\s+mañana/i.test(s)) return 'A media mañana (aprox. 4 h después de despertar)';
    if (/15:00|media\s+tarde/i.test(s)) return 'A media tarde';
    if (/20:30|previa\s+al\s+sueño|antes\s+de\s+dormir|noche/i.test(s)) return '30 a 60 min antes de dormir';
    const defaults = [
        'Al despertar en ayunas',
        'A media mañana',
        'A media tarde',
        '30 a 60 min antes de dormir'
    ];
    return s || defaults[idx] || `Momento ${idx + 1}`;
}

function stripBalancedParenthesesSafe(str) {
    let out = String(str || '');
    let prev = '';
    while (out !== prev) {
        prev = out;
        out = out.replace(/\([^()]*\)/g, '');
    }
    return out.replace(/[()]/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function humanizeBiomarkerTopicForPatient(rawLabel, systemId = '') {
    if (!rawLabel) return '';
    const fullStr = sanitizeClinicalSpanish(String(rawLabel).trim());
    const iccMatch = fullStr.match(/relaci[óo]n\s+cintura[-\s]*cadera\s+f[íi]sica\s*(?:\(\s*icc\s*:?\s*([0-9.]+)\s*\)|\[\s*icc\s*:?\s*([0-9.]+)\s*\])/i);
    if (iccMatch) {
        const iccNum = iccMatch[1] || iccMatch[2];
        return `relación cintura-cadera física [ICC ${iccNum}]`;
    }
    if (/relaci[óo]n\s+cintura[-\s]*cadera\s+f[íi]sica\s*\(\s*icc/i.test(fullStr)) {
        return 'relación cintura-cadera física [ICC]';
    }
    const base = sanitizeClinicalSpanish(fullStr.split(':')[0].trim());
    if (!base) return '';

    if (/radiaci[óo]n\s+electromagn[ée]tica|electromagn[ée]tic/i.test(base)) {
        return '';
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
    if (systemId === 'circulacion_energia' && /coenzima|vitamina\s+b|hierro|mitocondri/i.test(base)) {
        return 'producción de energía celular diaria';
    }
    if (/vitamina|zinc|selenio|hierro|magnesio|potasio|calcio|coenzima|treonina|histidina|lisina|valina|leucina|isoleucina|tript[óo]fano|metionina|fenilalanina|arginina|amino[áa]cido|inmunoglobulina|linf[áa]tic|am[íi]gdala|bazo|m[ée]dula|respiratori|mucosa/i.test(base)) {
        return 'reservas de vitaminas, minerales y defensas naturales';
    }
    if (/ecg|electrocardiog|bradicard|qrs|rama\s+derecha|qtc/i.test(base)) {
        return 'ritmo y conducción eléctrica del corazón en reposo';
    }
    if (/rx\s+t[óo]rax|arco\s+a[óo]rtic|ict|cardiotor[áa]c/i.test(base)) {
        return 'elasticidad de sus grandes arterias y función pulmonar';
    }
    if (/ultrasonido|inguinal|doppler\s+femoral|valsalva/i.test(base)) {
        return 'firmeza de la pared abdominal/inguinal y flujo vascular';
    }
    if (/bas[óo]fil|histam[íi]n/i.test(base)) {
        return 'equilibrio de sensibilidad inmunológica e histamínica';
    }
    if (/mioc[áa]rdic|coronari|latido|bombeo|viscosidad|elasticidad|vascular|arteri|venos|microcirculaci|ox[íi]geno|pulmonar|riesgo\s+cerebrovascular|stroke|presi[óo]n|impedancia|volumen\s+de\s+perfusi/i.test(base)) {
        return 'fluidez de la circulación y oxigenación del corazón';
    }
    if (/sd\s*ldl|ldl|colesterol|aterog[ée]n|araquid[óo]nico|omega|triglic[ée]ridos?|lipoprote[íi]na|grasa\s+en\s+sangre|adiposo|obesidad|l[íi]pido/i.test(base)) {
        return 'transporte saludable de colesterol y lípidos en sus arterias';
    }
    if (/insulina|glucosa|az[úu]car|gluc[óo]geno|hba1c/i.test(base)) {
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

const RAW_ALARMING_PATIENT_LABEL_RE = /(mercurio|ars[ée]nico|plomo|radiaci[óo]n\s+electromagn[ée]tica|prostatitis|tiroglobulina|hiperplasia\s+[óo]sea|coeficiente\s+de\s+reumatismo|\(ojos\)|\[electret\]|\[ocr_lab\])/i;

/**
 * Detector Anti-Tuteo de Doble Capa (v2.7.1):
 * - Capa 1 (`STRICT_TUTEO_TOKEN_RE`): Pronombres, posesivos, desinencias verbales inequívocas de 2.ª persona singular
 *   e infinitivos/imperativos con enclítico de tuteo. Excluye homógrafos de 3.ª persona (`bebe`, `evita`, `sigue`, `procura`)
 *   para jamás colisionar con frases formales legítimas (`usted bebe`, `el menor bebe`, `0 Picante (evita irritar...)`).
 * - Capa 2 (`DIRECTIVE_IMPERATIVE_TUTEO_RE`): Captura imperativos homógrafos únicamente cuando encabezan una oración directiva.
 */
export const STRICT_TUTEO_TOKEN_RE = /(?<![\p{L}\p{N}_])(tú|tu|tus|te|ti|contigo|tienes|comes|comas|bebes|duermes|descansas|sientes|pasas|bajas|puedas|puedes|agitarte|requieres|recuperes|imagina|tómalo|disuélvelo|acostarte|acuéstate|enfócate|hidrátate|hidratarte|cuidarte|explicarte|acompañarte|moverte|sentirte)(?![\p{L}\p{N}_])/iu;

export const DIRECTIVE_IMPERATIVE_TUTEO_RE = /(?:^|[.!?]\s+)(?:sigue\s+hoy|procura\s+cenar|bebe\s+aproximadamente|evita\s+(?:tomarlo|cenar|pantallas))\b/iu;

export function hasLegacyTuteo(rawValue) {
    if (!rawValue) return false;
    if (typeof rawValue === 'string') {
        return STRICT_TUTEO_TOKEN_RE.test(rawValue) || DIRECTIVE_IMPERATIVE_TUTEO_RE.test(rawValue);
    }
    if (Array.isArray(rawValue)) {
        return rawValue.some((item) => hasLegacyTuteo(item));
    }
    if (typeof rawValue === 'object') {
        return Object.values(rawValue).some((val) => hasLegacyTuteo(val));
    }
    return false;
}

export const PEDIATRIC_CONTAMINATION_RE = /(madre,\s*padre\s+o\s+tutor|\(su\s+beb[ée]\)|\bsu\s+beb[ée]\b|lactancia|f[óo]rmula\s+(?:indicada\s+por\s+su\s+)?pediatr|pediatra|primeros\s+1000\s+d[íi]as|PAUSA_PREVENTIVA_PEDIATRICA|prioridad\s+pedi[áa]trica|sin\s+suplementos\s+adultos|no\s+suplementos\s+adultos|menores\s+de\s+2\s+a[ñn]os|organismo\s+infantil|juego\s+sensorial|gateo\s+libre)/i;

export function resolveClinicalAddressing({
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

    const cleanFullName = capitalizeLeadingSpanish(
        sanitizeClinicalSpanish(patientName || (isLactante ? 'su bebé' : 'Paciente'))
    );
    const hasSpecificName = !/^(paciente|su\s+beb[ée]|tu\s+beb[ée]|el\s+menor|la\s+menor|lactante)$/i.test(cleanFullName.trim());
    const rawFirstToken = cleanFullName.split(/\s+/)[0] || cleanFullName;
    const firstName = hasSpecificName
        ? rawFirstToken
        : (isTutorMode
            ? (isLactante ? 'su bebé' : (isFemale ? 'su hija' : 'su hijo'))
            : 'paciente');

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
        firstName,
        childShortRef,
        childSubjectWithKinship,
        estimadoLabel: isFemale ? 'Estimada' : 'Estimado',
        directObjCap: isFemale ? 'La' : 'Lo',
        directObjLower: isFemale ? 'la' : 'lo',
        seatedLabel: isFemale ? 'sentada' : 'sentado'
    };
}

export function buildPatientUiLabels({ addressing, isPaused = false }) {
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

/**
 * Resuelve de manera 100% determinista y resiliente toda la información necesaria para
 * la Vista Empática del Paciente (tanto en expedientes nuevos v2.7.1 como en citas históricas legadas en `tú`).
 */
export function resolvePatientFriendlyGuide(patientData = {}) {
    const dossier = patientData?.clinical_dossier || {};
    const ortho = dossier?.orthomolecular_prescription || {};
    const bioenergetics = dossier?.bioenergetics || ortho?.bioenergetics_summary || {};
    const verifiedAge = resolveVerifiedPatientAge(patientData, 35);
    const ageYears = verifiedAge.ageYears;
    const { isFemale } = resolvePatientSex(patientData);
    const isLactante = Boolean(verifiedAge.isLactanteVerified);
    const isPediatric = Boolean(verifiedAge.isPediatricVerified);

    const rawName = formatInstitutionalFullName(
        patientData,
        isLactante ? 'su bebé' : 'Paciente'
    );

    const addr = resolveClinicalAddressing({
        patientName: rawName,
        ageYears,
        isFemale,
        isLactanteExplicit: isLactante
    });
    const ref = addr.childShortRef;
    const fullName = addr.cleanFullName;
    const firstName = addr.firstName;

    const rawVenousGlucose = Number(
        patientData?.scan_data?.external_metrics?.biomarkers?.glucosa?.value ??
        patientData?.scan_data?.external_metrics?.labs?.glucosa ??
        patientData?.vitals?.glucose
    );
    const isNormoglycemicVenous = Number.isFinite(rawVenousGlucose) && rawVenousGlucose > 0 && rawVenousGlucose < 100;

    const existingGuide = dossier?.patient_friendly_guide || null;
    const rawIfmNodes = Array.isArray(dossier?.ifm_nodes_matrix) ? dossier.ifm_nodes_matrix : [];

    // 1. Filtrar y reclasificar biomarcadores técnicos reales (cero NORMAL (-))
    const bucketsBySystem = {
        circulacion_energia: [],
        digestion_absorcion: [],
        filtros_naturales: [],
        descanso_defensas: [],
        huesos_musculos: []
    };
    const bucketsByNode = {
        NODO_1_ASIMILACION: [],
        NODO_2_BIOTRANSFORMACION: [],
        NODO_3_ENERGIA: [],
        NODO_4_COMUNICACION: [],
        NODO_5_TRANSPORTE: [],
        NODO_6_DEFENSA: [],
        NODO_7_ESTRUCTURAL: []
    };

    const NODE_TO_DEFAULT_SYSTEM = {
        NODO_1_ASIMILACION: 'digestion_absorcion',
        NODO_2_BIOTRANSFORMACION: 'filtros_naturales',
        NODO_3_ENERGIA: 'circulacion_energia',
        NODO_4_COMUNICACION: 'descanso_defensas',
        NODO_5_TRANSPORTE: 'circulacion_energia',
        NODO_6_DEFENSA: 'descanso_defensas',
        NODO_7_ESTRUCTURAL: 'huesos_musculos'
    };

    rawIfmNodes.forEach((node) => {
        const list = Array.isArray(node?.key_biomarkers) ? node.key_biomarkers : [];
        list.forEach((rawB) => {
            if (isBiomarkerStringActuallyNormal(rawB)) return;
            const cleaned = formatCleanBiomarkerString(rawB);
            if (!cleaned) return;

            let sysId = NODE_TO_DEFAULT_SYSTEM[node?.nodeId] || 'filtros_naturales';
            if (node?.nodeId === 'NODO_7_ESTRUCTURAL') {
                const reclassified = classifyLegacyBiomarkerToSystemId(cleaned);
                if (reclassified === 'EXCLUDED_MERIDIAN') return;
                sysId = reclassified;
            }
            if (!bucketsBySystem[sysId].includes(cleaned)) {
                bucketsBySystem[sysId].push(cleaned);
            }
            if (node?.nodeId && bucketsByNode[node.nodeId] && !bucketsByNode[node.nodeId].includes(cleaned)) {
                bucketsByNode[node.nodeId].push(cleaned);
            }
        });
    });

    const normalizeTopicStem = (str) =>
        String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/_diari[oa]s?$/g, '')
            .replace(/^_|_$/g, '');

    const dedupeClientTopics = (arr = []) => {
        const out = [];
        const seen = new Set();
        for (const item of arr) {
            const clean = String(item || '').replace(/[()]/g, '').trim();
            if (!clean) continue;
            const stem = normalizeTopicStem(clean);
            if (seen.has(stem)) continue;
            seen.add(stem);
            out.push(clean);
        }
        return out;
    };

    const sampleBalancedFriendlyTopicsForSystem = (sysId) => {
        const nodePairs = {
            circulacion_energia: ['NODO_5_TRANSPORTE', 'NODO_3_ENERGIA'],
            digestion_absorcion: ['NODO_1_ASIMILACION'],
            filtros_naturales: ['NODO_2_BIOTRANSFORMACION'],
            descanso_defensas: ['NODO_4_COMUNICACION', 'NODO_6_DEFENSA'],
            huesos_musculos: ['NODO_7_ESTRUCTURAL']
        }[sysId] || [];

        const perNode = nodePairs.map((nid) =>
            dedupeClientTopics((bucketsByNode[nid] || []).map((b) => humanizeBiomarkerTopicForPatient(b, sysId)).filter(Boolean))
        );

        if (perNode.every((arr) => arr.length === 0)) {
            return dedupeClientTopics((bucketsBySystem[sysId] || []).map((b) => humanizeBiomarkerTopicForPatient(b, sysId)).filter(Boolean)).slice(0, 4);
        }

        if (perNode.length <= 1) {
            return (perNode[0] || []).slice(0, 4);
        }

        const selected = [];
        const addTopicUnique = (t) => {
            if (!t || selected.length >= 4) return false;
            const st = normalizeTopicStem(t);
            if (selected.some((x) => normalizeTopicStem(x) === st)) return false;
            selected.push(t);
            return true;
        };

        perNode.forEach((arr) => {
            let taken = 0;
            for (const t of arr) {
                if (taken >= 2 || selected.length >= 4) break;
                if (addTopicUnique(t)) taken++;
            }
        });
        if (selected.length < 4) {
            perNode.forEach((arr) => {
                for (const t of arr) {
                    if (selected.length >= 4) break;
                    addTopicUnique(t);
                }
            });
        }
        return selected;
    };

    const getCanonicalSystemMeta = (sysId, topics, hasAny) => {
        const listText = (Array.isArray(topics) && topics.length > 0 ? topics : ['equilibrio funcional preventivo']).join(', ');
        if (addr.isTutorMode) {
            const mapTutor = {
                circulacion_energia: {
                    title: `Circulación, Corazón y Energía Diaria de ${ref}`,
                    subtitle: 'Cómo viajan el oxígeno y el combustible hacia sus órganos en crecimiento',
                    observed: hasAny
                        ? `Notamos que el sistema circulatorio y las reservas de energía de ${ref} están haciendo un esfuerzo extra (especialmente en indicadores como ${listText}).`
                        : `Los indicadores principales de circulación, oxigenación y manejo de energía de ${ref} se mantienen estables.`,
                    meaning: hasAny
                        ? `Imagine las arterias como tuberías flexibles y las células de ${ref} como pequeñas baterías: cuando hay mayor demanda de nutrientes o hidratación, su organismo trabaja más. Con hidratación natural y alimentación fresca le ayudaremos a mantener vitalidad estable.`
                        : `El transporte de oxígeno y energía celular de ${ref} responde adecuadamente; el objetivo en casa será conservar ese equilibrio día con día.`
                },
                digestion_absorcion: {
                    title: `Digestión y Aprovechamiento de Nutrientes de ${ref}`,
                    subtitle: 'Cómo reciben su estómago e intestino los alimentos del día',
                    observed: hasAny
                        ? `Observamos en ${ref} señales de digestión lenta o sensibilidad en el recubrimiento digestivo (${listText}).`
                        : `El sistema digestivo de ${ref} muestra buena capacidad general de asimilación.`,
                    meaning: hasAny
                        ? `Aunque ${ref} reciba buenos alimentos, si su estómago o intestino presentan sensibilidad cuesta más absorber vitaminas y minerales. Retirar irritantes (picante, embutidos y azúcares) en casa le dará un descanso inmediato a su mucosa digestiva.`
                        : 'Su intestino está en buenas condiciones para aprovechar los nutrientes de su alimentación diaria.'
                },
                filtros_naturales: {
                    title: `Filtros Naturales de ${ref}: Hígado y Riñones`,
                    subtitle: 'Los órganos encargados de depurar y mantener limpio su organismo',
                    observed: hasAny
                        ? `Los filtros naturales de ${ref} muestran señales de carga acumulada de trabajo (${listText}).`
                        : `Los filtros hepático y renal de ${ref} se observan despejados y trabajando a buen ritmo.`,
                    meaning: hasAny
                        ? `El hígado y los riñones funcionan como los filtros de agua de casa: limpian todos los días lo que el organismo de ${ref} ya no necesita. Por eso cuidamos con tanta prudencia su hidratación natural y ajustamos cualquier pauta sin forzarlos.`
                        : 'Sus órganos depuradores cuentan con buen margen funcional acorde a su etapa de crecimiento.'
                },
                descanso_defensas: {
                    title: `Descanso, Desarrollo y Defensas de ${ref}`,
                    subtitle: 'Su reloj interno, calidad de sueño y escudo inmunológico',
                    observed: hasAny
                        ? `Identificamos mayor demanda en la recuperación nocturna o en las defensas naturales de ${ref} (${listText}).`
                        : `El descanso y las defensas naturales de ${ref} mantienen un equilibrio favorable.`,
                    meaning: hasAny
                        ? `El organismo infantil crece y se repara a profundidad cuando ${ref} descansa bien por la noche. Al cuidar sus horarios de descanso, hidratación y alimentación diaria, usted ayuda directamente a fortalecer su sistema inmunológico.`
                        : 'Su escudo protector responde de forma ordenada; conservar sus rutinas de sueño sostendrá esta fortaleza.'
                },
                huesos_musculos: {
                    title: `Huesos, Músculos, Piel y Crecimiento de ${ref}`,
                    subtitle: 'El sostén estructural que acompaña su desarrollo y movimiento',
                    observed: hasAny
                        ? `Observamos en ${ref} mayor demanda de nutrientes de soporte estructural, minerales y colágeno (${listText}).`
                        : `La estructura ósea, muscular y cutánea de ${ref} conserva buena firmeza funcional.`,
                    meaning: hasAny
                        ? `Las proteínas limpias, vitaminas y minerales son los ladrillos que sostienen el crecimiento óseo y muscular de ${ref}. Los acompañaremos con alimentación natural y juego activo seguro acorde a su edad.`
                        : 'Mantendremos un buen aporte de nutrientes naturales y movimiento diario para acompañar su desarrollo.'
                }
            };
            return mapTutor[sysId] || mapTutor.huesos_musculos;
        }

        const hasGlycemicTopic = Array.isArray(topics) && topics.some((t) => /glucosa|az[úu]car|insulina/i.test(String(t)));
        const mapUsted = {
            circulacion_energia: {
                title: 'Su Circulación, Corazón y Energía Diaria',
                subtitle: 'Cómo viaja el oxígeno y el combustible hacia sus órganos',
                observed: hasAny
                    ? `Notamos que su sistema circulatorio y sus reservas de energía están haciendo un esfuerzo extra (especialmente en indicadores como ${listText}).`
                    : 'Sus indicadores principales de circulación, oxigenación y manejo de energía se mantienen estables.',
                meaning: hasAny
                    ? ((isNormoglycemicVenous || !hasGlycemicTopic)
                        ? 'Imagine sus arterias como tuberías flexibles y a sus células como pequeñas baterías: cuando hay mayor carga de partículas de colesterol circulando o menor fluidez vascular, el corazón hace un esfuerzo extra. Con hidratación medida, grasas nobles y antioxidantes ayudaremos a que su circulación fluya con ligereza mientras mantenemos estable su nivel saludable de glucosa.'
                        : 'Imagine sus arterias como tuberías flexibles y a sus células como pequeñas baterías: cuando la sangre viaja un poco más espesa o hay exceso de grasas y glucosa circulando, el corazón trabaja más y usted puede sentir cansancio. Con hidratación, alimentación limpia y antioxidantes ayudaremos a que todo fluya con ligereza.')
                    : 'Sus "tuberías" y "baterías celulares" responden adecuadamente; el objetivo será conservar esa vitalidad día con día.'
            },
            digestion_absorcion: {
                title: 'Su Digestión y Aprovechamiento de Nutrientes',
                subtitle: 'Cómo recibe su estómago e intestino lo que usted consume',
                observed: hasAny
                    ? `Observamos señales de digestión lenta o sensibilidad en el recubrimiento digestivo (${listText}).`
                    : 'Su sistema digestivo muestra buena capacidad general de asimilación.',
                meaning: hasAny
                    ? 'Aunque usted consuma buenos alimentos, si el estómago y el intestino trabajan lento o están irritados, no logramos absorber al 100% las vitaminas y minerales. Retirar irritantes (picante, cerdo y azúcares) y comer sin prisa le dará un respiro inmediato a su digestión.'
                    : 'Su intestino está listo para aprovechar los nutrientes de su plan de alimentación.'
            },
            filtros_naturales: {
                title: 'Sus Filtros Naturales: Hígado y Riñones',
                subtitle: 'Los encargados de depurar y mantener limpio su organismo',
                observed: hasAny
                    ? `Sus filtros naturales muestran señales de carga acumulada de trabajo (${listText}).`
                    : 'Sus filtros hepático y renal se observan despejados y trabajando a buen ritmo.',
                meaning: hasAny
                    ? 'Su hígado y sus riñones funcionan como los filtros de agua de casa: limpian todos los días lo que su organismo ya no necesita. Por eso cuidamos tanto la cantidad de agua simple que usted ingiere y ajustamos su suplementación con prudencia para acompañarlos sin forzarlos.'
                    : 'Sus órganos depuradores tienen buen margen para procesar nutrientes con normalidad.'
            },
            descanso_defensas: {
                title: 'Su Descanso, Equilibrio Hormonal y Defensas',
                subtitle: 'Su reloj interno, manejo del estrés y escudo protector',
                observed: hasAny
                    ? `Identificamos desgaste en su recuperación nerviosa, hormonal o en sus defensas (${listText}).`
                    : 'Su comunicación hormonal y sus defensas mantienen un equilibrio favorable.',
                meaning: hasAny
                    ? 'Su organismo se repara a profundidad cuando usted descansa bien y baja el ritmo por la noche. Al ordenar sus horarios de cena, hidratarse bien y nutrir sus defensas, ayudamos a que su sistema nervioso e inmunológico disminuyan la inflamación.'
                    : 'Su escudo protector responde de forma ordenada; cuidar su sueño mantendrá esta fortaleza.'
            },
            huesos_musculos: {
                title: 'Sus Huesos, Músculos, Piel y Articulaciones',
                subtitle: 'El sostén y la estructura que le permite moverse con libertad',
                observed: hasAny
                    ? `Observamos mayor demanda de nutrientes de soporte estructural, minerales y colágeno (${listText}).`
                    : 'Su estructura ósea, muscular y de colágeno conserva buena firmeza funcional.',
                meaning: hasAny
                    ? 'Los aminoácidos, minerales, vitamina D y el colágeno son como los ladrillos y el cemento que mantienen firmes sus huesos, músculos y articulaciones. Vamos a nutrirlos con proteína de fácil digestión y movimiento suave que no lastime sus articulaciones.'
                    : 'Mantendremos un buen aporte de proteína y movimiento diario para proteger su masa muscular.'
            }
        };
        return mapUsted[sysId] || mapUsted.huesos_musculos;
    };

    // 2. Resolver Semáforo Clínico de Bioseguridad (con sanitización retroactiva anti-tuteo)
    const buildCanonicalSemaphore = (levelHint, recommendedLabs = []) => {
        if (addr.isLactante) {
            return {
                level: 'ROJO',
                modeCode: 'PAUSA_PREVENTIVA_PEDIATRICA',
                badgeLabel: 'Prioridad Pediátrica • Sin Suplementos Adultos',
                title: 'Cuidado exclusivo de lactancia y alimentación guiada por su pediatra',
                honestExplanation: `En etapa de lactancia temprana (< 2 años), la nutrición de ${ref} depende prioritariamente de leche materna o fórmula indicada por su pediatra y de la introducción gradual de alimentos naturales. Por seguridad pediátrica, mantenemos cualquier sobre concentrado en pausa estricta.`,
                ethicalNote: 'Toda orientación nutricional en los primeros 1000 días acompaña y respeta íntegramente las indicaciones de su pediatra tratante.',
                recommendedLabs: [],
                isPaused: true,
                isMicroDose: false,
                titrationPlanText: '0 sobres activos (etapa de lactancia temprana bajo vigilancia pediátrica).'
            };
        }

        if (levelHint === 'ROJO') {
            return {
                level: 'ROJO',
                modeCode: 'PAUSA_PREVENTIVA_MEDICA',
                badgeLabel: 'Prioridad Médica • Pausa Preventiva',
                title: addr.isTutorMode
                    ? `Primero protegemos la seguridad de ${ref}: pausa temporal de suplementación`
                    : 'Primero protegemos su seguridad: pausa temporal de suplementación',
                honestExplanation: addr.isTutorMode
                    ? `En la evaluación de ${ref} identificamos parámetros que ameritan revisión médica prioritaria. Por ética clínica, hoy iniciamos únicamente con alimentación natural suave e hidratación medida en casa, dejando las fórmulas en pausa preventiva hasta contar con sus estudios de control.`
                    : `Por ética clínica, hoy iniciamos únicamente con alimentación natural suave e hidratación medida, dejando las fórmulas en pausa preventiva hasta contar con la validación presencial y sus estudios de control${addr.isAdolescent ? ' en acompañamiento con su madre, padre o tutor legal' : ''}.`,
                ethicalNote: addr.isTutorMode
                    ? `Las fórmulas 33Plus® y 34Plus® son soporte nutricional complementario (no medicamentos) y solo se valoran cuando los filtros naturales de ${ref} están listos bajo supervisión médica.`
                    : `Las fórmulas 33Plus® y 34Plus® son aliados nutricionales de precisión (no medicamentos) y solo se activan cuando sus filtros naturales están listos para aprovecharlos con total seguridad${addr.isAdolescent ? ', contando siempre con el acompañamiento de su madre, padre o tutor legal' : ''}.`,
                recommendedLabs,
                isPaused: true,
                isMicroDose: false,
                titrationPlanText: '0 sobres activos por ahora (Pausa preventiva hasta revisión de estudios de laboratorio).'
            };
        }

        const rawHistorySups = patientData?.history?.supplements;
        const historySupsText = Array.isArray(rawHistorySups)
            ? rawHistorySups.map((s) => (typeof s === 'object' ? `${s.name || ''} ${s.brand || ''} ${s.duration || ''} ${s.notes || ''}` : String(s || ''))).join(' | ')
            : String(rawHistorySups || '');
        const hasPriorInstitutionalSups = /(?:33\s*plus|34\s*plus|multisinergix|aminosinergix|equipo\s+en\s+acci[óo]n)/i.test(historySupsText);

        if (levelHint === 'AMARILLO') {
            if (hasPriorInstitutionalSups && !addr.isTutorMode) {
                return {
                    level: 'AMARILLO',
                    modeCode: 'RECALIBRACION_PREVENTIVA_DOSIS',
                    isRecalibrationMode: true,
                    badgeLabel: 'Recalibración Preventiva de Dosis • Acompañamiento Continuo',
                    title: 'Recalibramos preventivamente su pauta habitual para acompañar sus indicadores actuales',
                    honestExplanation: 'Reconocemos su constancia previa con las fórmulas nutricionales de Equipo en Acción®. Para acompañar con total bioseguridad sus indicadores actuales, recalibramos preventivamente su posología los primeros 7 días (Semana 1) a media toma bien diluida en agua natural, optimizando su asimilación sin sobrecarga.',
                    ethicalNote: `33Plus® y 34Plus® son aliados nutricionales complementarios a su alimentación diaria (nunca sustituyen sus medicamentos ni su seguimiento médico${addr.isAdolescent ? ', y se integran en conjunto con su madre, padre o tutor legal' : ''}).`,
                    recommendedLabs: recommendedLabs.length > 0
                        ? recommendedLabs
                        : ['Química sanguínea (Creatinina, Ácido Úrico, BUN) y Examen General de Orina (EGO)'],
                    isPaused: false,
                    isMicroDose: true,
                    titrationPlanText: `Recalibración preventiva de dosis (Días 1 al 7): 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® al despertar en ${FORMULA_33PLUS.minWaterMl} ml de agua natural + 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de dormir en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧. Valorar retorno gradual a su dosis habitual según control.`
                };
            }
            return {
                level: 'AMARILLO',
                modeCode: 'MICRO_DOSIS_GRADUAL_CALIBRADA',
                isRecalibrationMode: false,
                badgeLabel: 'Inicio Gradual Preventivo • Micro-Dosis Calibrada',
                title: addr.isTutorMode
                    ? `Avanzamos paso a paso para cuidar los filtros naturales y la digestión de ${ref}`
                    : 'Avanzamos paso a paso para cuidar sus filtros naturales y su digestión',
                honestExplanation: addr.isTutorMode
                    ? `Para cuidar el organismo de ${ref} con total responsabilidad, iniciaremos los primeros 7 días (Semana 1) con una micro-dosis suave (medio sobre) bien diluida en agua natural, permitiendo una adaptación cómoda y sin sobrecarga.`
                    : `Sus indicadores muestran carga de trabajo en sus filtros naturales o sensibilidad digestiva. Por seguridad iniciamos los primeros 7 días (Semana 1) con una micro-dosis suave (medio sobre) bien diluida en agua simple, permitiendo que su organismo se adapte sin sobrecarga${addr.isAdolescent ? ', contando siempre con el acompañamiento de su madre, padre o tutor legal' : ''}.`,
                ethicalNote: addr.isTutorMode
                    ? `33Plus® y 34Plus® actúan como soporte nutricional complementario a la alimentación diaria de ${ref} (nunca sustituyen sus medicamentos ni el seguimiento de su pediatra o médico tratante).`
                    : `33Plus® y 34Plus® son aliados nutricionales complementarios a su alimentación diaria (nunca sustituyen sus medicamentos ni su seguimiento médico${addr.isAdolescent ? ', y se integran en conjunto con su madre, padre o tutor legal' : ''}).`,
                recommendedLabs: recommendedLabs.length > 0
                    ? recommendedLabs
                    : ['Química sanguínea (Creatinina, Ácido Úrico, BUN) y Examen General de Orina (EGO)'],
                isPaused: false,
                isMicroDose: true,
                titrationPlanText: `Fase de adaptación (Días 1 al 7): 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® al despertar en ${FORMULA_33PLUS.minWaterMl} ml de agua natural + 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® antes de dormir en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧. Escalar gradualmente según tolerancia.`
            };
        }

        return {
            level: 'VERDE',
            modeCode: 'DOSIS_ESTANDAR_COMPLETA',
            badgeLabel: 'Vía Libre Biosegura • Protocolo Completo',
            title: addr.isTutorMode
                ? `Los filtros principales de ${ref} están en equilibrio para su acompañamiento nutricional`
                : 'Sus filtros principales están listos para su protocolo completo',
            honestExplanation: addr.isTutorMode
                ? `Los indicadores vitales de ${ref} permiten integrar su acompañamiento nutricional sincronizado con su horario natural de despertar y descanso.`
                : `Sus indicadores permiten acompañar su alimentación con el protocolo completo sincronizado a su despertar y descanso${addr.isAdolescent ? ', en acompañamiento con su madre, padre o tutor legal' : ''}.`,
            ethicalNote: addr.isTutorMode
                ? `33Plus® y 34Plus® son fórmulas de nutrición celular que acompañan la alimentación diaria e hidratación constante de ${ref}.`
                : `33Plus® y 34Plus® son fórmulas de nutrición celular que acompañan su alimentación diaria e hidratación constante${addr.isAdolescent ? ', supervisadas junto con su madre, padre o tutor legal' : ''}.`,
            recommendedLabs: [],
            isPaused: false,
            isMicroDose: false,
            titrationPlanText: `Protocolo estándar sincronizado a su día: 2 tomas matutinas de 33Plus® (${FORMULA_33PLUS.sachetGramsDisplay} c/u en ${FORMULA_33PLUS.minWaterMl} ml de agua) y 2 tomas vespertinas/nocturnas de 34Plus® (${FORMULA_34PLUS.sachetGramsDisplay} c/u en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧).`
        };
    };

    let rawSem = existingGuide?.biosecurity_semaphore || dossier?.biosecurity_semaphore || ortho?.biosecurity_semaphore || null;
    if (
        !addr.isTutorMode &&
        rawSem &&
        (
            rawSem.modeCode === 'PAUSA_PREVENTIVA_PEDIATRICA' ||
            PEDIATRIC_CONTAMINATION_RE.test(
                `${rawSem.badgeLabel || ''} ${rawSem.title || ''} ${rawSem.honestExplanation || ''} ${rawSem.ethicalNote || ''} ${rawSem.titrationPlanText || ''}`
            )
        )
    ) {
        rawSem = null;
    }
    let semaphore = null;

    const repairLegacySemaphoreExplanation = (text) => {
        if (!text) return '';
        let out = polishPatientEditorialPhrasing(text).replace(/los primeros 7 a 14 d[íi]as/gi, 'los primeros 7 días (Semana 1)');
        // Si existen razones previas seguidas por la cláusula redundante de calcio fuera del hueso, retirarla y reparar la conjunción española
        out = out.replace(
            /^(En su evaluación observamos:\s*)(.+?),\s*detectamos tendencia a acumular calcio fuera del hueso(\.)/iu,
            (_, prefix, visceralPart, dot) => {
                const clauses = visceralPart.split(/,\s*(?=(?:sus|su|se\s+registran|hay|presenta)\b)/iu);
                return `${prefix}${clauses.length > 1 ? joinSpanishList(clauses) : visceralPart}${dot}`;
            }
        );
        return out;
    };

    if (addr.isLactante) {
        semaphore = buildCanonicalSemaphore('ROJO', []);
    } else if (rawSem) {
        const effectiveLevel = rawSem.isPaused || rawSem.level === 'ROJO'
            ? 'ROJO'
            : (rawSem.isMicroDose || rawSem.level === 'AMARILLO' ? 'AMARILLO' : 'VERDE');
        const safeLabs = (Array.isArray(rawSem.recommendedLabs) ? rawSem.recommendedLabs : []).map(sanitizeClinicalSpanish);
        const canonicalSem = buildCanonicalSemaphore(effectiveLevel, safeLabs);
        const cleanedTitle = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(rawSem.title));
        const cleanedExplanation = repairLegacySemaphoreExplanation(sanitizeClinicalSpanish(rawSem.honestExplanation));
        const cleanedEthical = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(rawSem.ethicalNote));
        const cleanedTitration = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(rawSem.titrationPlanText))
            .replace(/1\/2\s+sobre\s*\(5\s*g\)\s+de\s+33Plus®/gi, `1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus®`)
            .replace(/1\/2\s+sobre\s*\(5\s*g\)\s+de\s+34Plus®/gi, `1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus®`);
        const mismatchTutorSem = addr.isTutorMode && /\b(su cuerpo|sus síntomas|usted requiere)\b/i.test(cleanedExplanation);
        const missingTeenTutorNote = addr.isAdolescent && !/tutor|madre|padre/i.test(`${cleanedExplanation} ${cleanedEthical}`);

        semaphore = {
            ...rawSem,
            level: effectiveLevel,
            badgeLabel: sanitizeClinicalSpanish(rawSem.badgeLabel) || canonicalSem.badgeLabel,
            title: (!cleanedTitle || hasLegacyTuteo(cleanedTitle) || mismatchTutorSem) ? canonicalSem.title : cleanedTitle,
            honestExplanation: (!cleanedExplanation || hasLegacyTuteo(cleanedExplanation) || mismatchTutorSem || missingTeenTutorNote)
                ? canonicalSem.honestExplanation
                : cleanedExplanation,
            ethicalNote: (!cleanedEthical || hasLegacyTuteo(cleanedEthical) || mismatchTutorSem || missingTeenTutorNote)
                ? canonicalSem.ethicalNote
                : cleanedEthical,
            titrationPlanText: (!cleanedTitration || hasLegacyTuteo(cleanedTitration))
                ? canonicalSem.titrationPlanText
                : cleanedTitration,
            recommendedLabs: safeLabs,
            isPaused: effectiveLevel === 'ROJO',
            isMicroDose: effectiveLevel === 'AMARILLO'
        };
    } else if (rawIfmNodes.length === 0 && !existingGuide) {
        // Guardia FAIL-CLOSED: jamás prescribir Semáforo VERDE (40 g/día) sobre un expediente sin síntesis diagnóstica
        const basePaused = buildCanonicalSemaphore('ROJO', []);
        semaphore = {
            ...basePaused,
            modeCode: 'PAUSA_PREVENTIVA_MEDICA',
            badgeLabel: 'Pendiente de Síntesis Diagnóstica • 0 Sobres Activos',
            isPaused: true,
            isMicroDose: false
        };
    } else {
        const hasRenalOrHepatic = bucketsBySystem.filtros_naturales.some((b) =>
            /(proteinuria|creatinina|acido\s+urico|ácido\s+úrico|grasa\s+en\s+el\s+hígado|grasa\s+en\s+el\s+higado)/i.test(b)
        );
        const hasCalcLock = Boolean(ortho?.has_calcium_contraction_lock);
        semaphore = buildCanonicalSemaphore((hasRenalOrHepatic || hasCalcLock || isPediatric) ? 'AMARILLO' : 'VERDE');
    }

    // 3. Construir o normalizar las 5 Tarjetas de Sistemas Humanos (cero tuteo legado, cero etiquetas crudas alarmantes y cero contaminación pediátrica en adultos)
    const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const adultThirdPersonLeakRe = new RegExp(`\\bde\\s+${escapedFirst}\\b|\\bmientras\\s+${escapedFirst}\\b|\\ben\\s+${escapedFirst}\\b|en\\s+crecimiento|desarrollo\\s+y\\s+defensas`, 'i');

    const nom004Sheet = resolveNom004IdentificationSheet(patientData);
    const isClinicalEubiosisClient = Boolean(nom004Sheet?.isClinicalEubiosis);
    const hasClinicalAllergiesClient = Boolean(nom004Sheet?.hasClinicalAllergies);

    const resolveClientSystemSeverity = (sysId, countVal, rawSys = null) => {
        try {
            if (rawSys?.status && dossier?.ssot_contract_version === '3.3.0-EGM56-SSOTT') {
                return {
                    status: rawSys.status,
                    statusLabel: sanitizeClinicalSpanish(String(rawSys.statusLabel || (
                        rawSys.status === 'ATENCION_PRIORITARIA'
                            ? 'Atención prioritaria'
                            : rawSys.status === 'VIGILANCIA_PREVENTIVA'
                                ? 'Optimización preventiva'
                                : 'Fortaleza consolidada'
                    )).replace(/\(\s*con\s+vigilancia\s+focal\s*\)/giu, '• vigilancia focal'))
                };
            }
            if (countVal === 0) {
                return { status: 'EN_EQUILIBRIO', statusLabel: 'Fortaleza consolidada' };
            }
            const sysText = (bucketsBySystem[sysId] || []).join(' | ');
            if (sysId === 'circulacion_energia') {
                const hasMajor = /(?:Estado:\s*ELEVADO|colesterol|ldl|electrocardiograma|bradicardia|rama\s+derecha|tensi[óo]n\s+arterial)/i.test(sysText);
                return hasMajor
                    ? { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' }
                    : { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
            }
            if (sysId === 'digestion_absorcion') {
                return !isClinicalEubiosisClient
                    ? { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' }
                    : { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
            }
            if (sysId === 'filtros_naturales') {
                const hasMajorRenalHep = /(?:Sobrecarga\s+de\s+Biotransformaci[óo]n|Creatinina:.*ELEVADO|ALT.*ELEVADO|AST.*ELEVADO)/i.test(sysText);
                return hasMajorRenalHep
                    ? { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' }
                    : { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
            }
            if (sysId === 'descanso_defensas') {
                const sleepObj = patientData?.habits?.sleep || patientData?.lifestyle_profile?.sleep || {};
                const sleepHours = Number(sleepObj?.hours ?? sleepObj?.hours_avg ?? 0);
                const sleepGood = sleepHours >= 6.5 && !/mala|poor|insomnio/i.test(String(sleepObj?.quality || ''));
                const rawStress = String(patientData?.habits?.stress || patientData?.lifestyle_profile?.stress?.level || '').toUpperCase();
                const stressLow = !/ALTO|HIGH|SEVER/.test(rawStress);
                const hasAcute = /(?:Reactantes\s+de\s+Fase\s+Aguda|Alergia\s+Alimentaria|Alergia\s+Farmacol[óo]gica|TSH:.*ELEVADO)/i.test(sysText);
                if (hasAcute || hasClinicalAllergiesClient) {
                    return { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' };
                }
                if (sleepGood && stressLow) {
                    return { status: 'EN_EQUILIBRIO', statusLabel: 'Fortaleza consolidada • vigilancia focal' };
                }
                return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
            }
            if (sysId === 'huesos_musculos') {
                const hasMajorBone = /(?:Calcio\s+S[ée]rico\s+Elevado)/i.test(sysText) || Number(nom004Sheet?.somatometry?.bmi) >= 35;
                return hasMajorBone
                    ? { status: 'ATENCION_PRIORITARIA', statusLabel: 'Atención prioritaria' }
                    : { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
            }
            return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
        } catch (_) {
            return { status: 'VIGILANCIA_PREVENTIVA', statusLabel: 'Optimización preventiva' };
        }
    };

    let fiveSystems = [];
    if (Array.isArray(existingGuide?.five_systems) && existingGuide.five_systems.length > 0) {
        fiveSystems = existingGuide.five_systems.map((sys) => {
            const rawTitle = sanitizeClinicalSpanish(sys.title);
            const rawSub = sanitizeClinicalSpanish(sys.subtitle);
            let rawObs = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(sys.whatWeObserved))
                .replace(/\(\s*relaci[óo]n\s+cintura[-\s]*cadera\s+f[íi]sica\s*\(\s*icc\s*,/giu, '(relación cintura-cadera física [ICC],')
                .replace(/producci[óo]n\s+de\s+energ[íi]a\s+celular\s+diaria,\s*producci[óo]n\s+de\s+energ[íi]a\s+celular\b/giu, 'producción de energía celular diaria');
            let rawMean = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(sys.whatItMeans));
            const hasRawAlarmingLabel = RAW_ALARMING_PATIENT_LABEL_RE.test(rawObs);
            const balancedTopics = sampleBalancedFriendlyTopicsForSystem(sys.id);
            const safeHighlights = hasRawAlarmingLabel && balancedTopics.length > 0
                ? balancedTopics
                : dedupeClientTopics(
                    (Array.isArray(sys.cleanHighlights) ? sys.cleanHighlights : [])
                        .map((h) => humanizeBiomarkerTopicForPatient(h, sys.id))
                        .filter((h) => Boolean(h) && !hasLegacyTuteo(h))
                );

            const finalHighlights = safeHighlights.length > 0 ? safeHighlights : balancedTopics;
            const countVal = Number(sys.findingsCount) || (bucketsBySystem[sys.id] || []).length;
            const calibratedSev = resolveClientSystemSeverity(sys.id, countVal, sys);
            const hasAny = countVal > 0 || finalHighlights.length > 0;
            const canonicalSys = getCanonicalSystemMeta(sys.id, finalHighlights, hasAny);
            const mismatchTutorSys = addr.isTutorMode && /^(su|sus)\s+(circulaci|digesti|filtros|descanso|huesos)/i.test(rawTitle);
            const mismatchAdultSys = !addr.isTutorMode && (
                PEDIATRIC_CONTAMINATION_RE.test(`${rawTitle} ${rawSub} ${rawObs} ${rawMean}`) ||
                adultThirdPersonLeakRe.test(`${rawTitle} ${rawSub} ${rawObs} ${rawMean}`)
            );
            const mismatchNormoglycemicSugarClaim = sys.id === 'circulacion_energia' && isNormoglycemicVenous && /exceso\s+de\s+grasas\s+y\s+az[úu]cares/i.test(rawMean);

            if (sys.id === 'digestion_absorcion' && isClinicalEubiosisClient && /est[áa]n\s+irritados/i.test(rawMean)) {
                rawObs = `Con base en su evaluación preventiva integral —aun cursando hoy sin molestias digestivas (eubiosis)—, registramos bioseñales orientativas de tránsito digestivo pausado y topografía lingual hidrosalina (${finalHighlights.join(', ')}).`;
                rawMean = 'Usted goza hoy de confort digestivo sin inflamación ni reflujo; retirar preventivamente irritantes (picante, cerdo y azúcares refinados), masticar con calma y nutrir su mucosa por la noche con fibra prebiótica (34Plus® en mínimo 500 ml de agua simple) optimizará al 100 % la absorción de vitaminas, minerales y líquidos.';
            }

            return {
                ...sys,
                status: calibratedSev.status,
                statusLabel: calibratedSev.statusLabel,
                title: (!rawTitle || hasLegacyTuteo(rawTitle) || mismatchTutorSys || mismatchAdultSys) ? canonicalSys.title : rawTitle,
                subtitle: (!rawSub || hasLegacyTuteo(rawSub) || mismatchTutorSys || mismatchAdultSys) ? canonicalSys.subtitle : rawSub,
                whatWeObserved: (!rawObs || hasRawAlarmingLabel || hasLegacyTuteo(rawObs) || mismatchTutorSys || mismatchAdultSys)
                    ? canonicalSys.observed
                    : rawObs,
                whatItMeans: (!rawMean || hasLegacyTuteo(rawMean) || mismatchTutorSys || mismatchAdultSys || mismatchNormoglycemicSugarClaim)
                    ? canonicalSys.meaning
                    : rawMean,
                cleanHighlights: finalHighlights,
                findingsCount: countVal
            };
        });
    } else {
        const systemDefs = [
            { id: 'circulacion_energia', iconKey: 'heart', list: bucketsBySystem.circulacion_energia },
            { id: 'digestion_absorcion', iconKey: 'utensils', list: bucketsBySystem.digestion_absorcion },
            { id: 'filtros_naturales', iconKey: 'droplets', list: bucketsBySystem.filtros_naturales },
            { id: 'descanso_defensas', iconKey: 'shield', list: bucketsBySystem.descanso_defensas },
            { id: 'huesos_musculos', iconKey: 'bone', list: bucketsBySystem.huesos_musculos }
        ];
        fiveSystems = systemDefs.map(({ id, iconKey, list }) => {
            const highlights = sampleBalancedFriendlyTopicsForSystem(id);
            const hasAny = list.length > 0;
            const calibratedSev = resolveClientSystemSeverity(id, list.length, null);
            const canonicalSys = getCanonicalSystemMeta(id, highlights, hasAny);
            return {
                id,
                title: canonicalSys.title,
                subtitle: canonicalSys.subtitle,
                iconKey,
                status: calibratedSev.status,
                statusLabel: calibratedSev.statusLabel,
                findingsCount: list.length,
                cleanHighlights: highlights,
                whatWeObserved: canonicalSys.observed,
                whatItMeans: canonicalSys.meaning
            };
        });
    }

    // 4. Sincronizar Horario Circadiano y Tarjetas de Fórmulas (33Plus® y 34Plus®) con el Contrato SSoTT y Semáforo
    const canonicalPlan = dossier?.canonical_clinical_plan || dossier?.therapeutic_contract || ortho?.therapeutic_contract || null;
    const rawSupplements = Array.isArray(ortho?.supplements) ? ortho.supplements : [];
    const raw33 = rawSupplements.find((s) => String(s?.id || s?.name || '').toLowerCase().includes('33')) || {};
    const raw34 = rawSupplements.find((s) => String(s?.id || s?.name || '').toLowerCase().includes('34')) || {};
    const isSelective33Paused = Boolean(
        (canonicalPlan?.isSelective33Paused || semaphore?.isSelective33Paused || raw33?.status === 'paused_by_biosecurity') &&
        !semaphore.isPaused
    );

    const buildCanonicalSchedule = () => {
        if (semaphore.isPaused) {
            return [
                {
                    tomaNumber: 1,
                    timeSlot: 'Al despertar en ayunas',
                    phase: 'Pausa Preventiva — Hidratación Suave',
                    formula: '💧 Agua natural simple (Suplementos en pausa preventiva)',
                    dosage: addr.isLactante
                        ? '0 sobres activos • Continuar lactancia materna o fórmula indicada por su pediatra'
                        : '0 sobres activos • Beber 300 ml de agua natural a sorbos pausados',
                    patientObjective: addr.isLactante
                        ? `Respetar la etapa de lactancia y maduración digestiva de ${ref} bajo guía pediátrica.`
                        : (addr.isTutorMode
                            ? `Hidratar suavemente el organismo de ${ref} al despertar sin sobrecargar sus filtros naturales.`
                            : 'Hidratar sus órganos con suavidad mientras validamos sus estudios de laboratorio.'),
                    isPaused: true
                },
                {
                    tomaNumber: 2,
                    timeSlot: '30 a 60 min antes de dormir',
                    phase: 'Pausa Preventiva — Descanso Nocturno',
                    formula: '💧 Hidratación ligera nocturna (Pendiente revisión médica)',
                    dosage: '0 sobres activos • Pendiente valoración médica',
                    patientObjective: addr.isTutorMode
                        ? `Cuidar los filtros naturales de ${ref} con total seguridad antes de valorar suplementación.`
                        : 'Cuidar sus filtros naturales con total seguridad antes de iniciar suplementación.',
                    isPaused: true
                }
            ];
        }
        if (isSelective33Paused) {
            return [
                {
                    tomaNumber: 1,
                    timeSlot: 'Al despertar en ayunas',
                    phase: 'Mañana — Hidratación Protectora (33Plus® en Pausa Selectiva)',
                    formula: '💧 Hidratación Preparatoria (33Plus® en pausa selectiva: 0 sobres activos)',
                    dosage: '0 sobres activos de 33Plus® • Beber 300 ml de agua simple natural',
                    patientObjective: addr.isTutorMode
                        ? `Hidratar suavemente a ${ref} por la mañana manteniendo 33Plus® en pausa de seguridad.`
                        : 'Hidratar suavemente su organismo al despertar manteniendo 33Plus® en pausa preventiva de seguridad.',
                    isPaused: true,
                    isMicroDose: true
                },
                {
                    tomaNumber: 2,
                    timeSlot: 'A media mañana',
                    phase: 'Mañana — Hidratación Preparatoria Continua',
                    formula: '💧 Hidratación Preparatoria (Agua Simple)',
                    dosage: '300 ml de agua simple purificada a sorbos',
                    patientObjective: addr.isTutorMode
                        ? `Mantener la hidratación natural de ${ref} a mitad de la mañana.`
                        : 'Mantener su hidratación natural constante a mitad de la mañana.',
                    isPaused: true,
                    isMicroDose: true
                },
                {
                    tomaNumber: 3,
                    timeSlot: 'A media tarde',
                    phase: 'Tarde — Hidratación Preparatoria de Limpieza',
                    formula: '💧 Hidratación Preparatoria (Agua Simple)',
                    dosage: '500 ml de agua simple purificada a sorbos durante la tarde 💧',
                    patientObjective: addr.isTutorMode
                        ? `Ayudar a los riñones e intestino de ${ref} a limpiar desechos suavemente durante la tarde.`
                        : 'Ayudar a sus riñones e intestino a limpiar desechos suavemente durante la tarde.',
                    isMicroDose: true
                },
                {
                    tomaNumber: 4,
                    timeSlot: '30 a 60 min antes de dormir',
                    phase: 'Noche — Reparación Suave de Tejidos y Digestión',
                    formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                    dosage: `1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) disuelto en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`,
                    patientObjective: addr.isTutorMode
                        ? `Nutrir articulaciones, piel y digestión mientras ${ref} duerme, siempre con medio litro de agua simple.`
                        : 'Nutrir sus articulaciones, piel y digestión mientras usted duerme, siempre con suficiente agua simple.',
                    isMicroDose: true
                }
            ];
        }
        if (semaphore.isMicroDose) {
            return [
                {
                    tomaNumber: 1,
                    timeSlot: 'Al despertar en ayunas (antes de las 2:00 PM)',
                    phase: 'Mañana — Adaptación Suave de Energía y Circulación',
                    formula: '🔴 33Plus® (Energía Celular y Circulación)',
                    dosage: `1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) disuelto en ${FORMULA_33PLUS.minWaterMl} ml de agua natural o tibia`,
                    patientObjective: addr.isTutorMode
                        ? `Apoyar la energía matutina y la circulación de ${ref} con una dosis gradual y amable.`
                        : 'Encender su energía de la mañana y apoyar su circulación de forma suave y progresiva.',
                    isMicroDose: true
                },
                {
                    tomaNumber: 2,
                    timeSlot: 'A media mañana (Semana 1: solo agua • Semana 2: valorar escalamiento)',
                    phase: 'Mañana — Hidratación Preparatoria y Escalamiento Gradual',
                    formula: '💧 Hidratación Preparatoria (Agua Simple en Semana 1)',
                    dosage: `Iniciar solo con 300 ml de agua natural (Semana 1) • Valorar 1/2 sobre adicional (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® en Semana 2`,
                    patientObjective: addr.isTutorMode
                        ? `Hidratar a ${ref} con agua natural la primera semana antes de valorar una segunda toma matutina.`
                        : 'Hidratar su organismo con agua simple la primera semana antes de valorar una segunda toma matutina.',
                    isMicroDose: true
                },
                {
                    tomaNumber: 3,
                    timeSlot: 'A media tarde',
                    phase: 'Tarde — Hidratación Preparatoria de Limpieza',
                    formula: '💧 Hidratación Preparatoria (Agua Simple)',
                    dosage: '500 ml de agua simple purificada a sorbos durante la tarde 💧',
                    patientObjective: addr.isTutorMode
                        ? `Ayudar a los riñones e intestino de ${ref} a limpiar desechos suavemente durante la tarde.`
                        : 'Ayudar a sus riñones e intestino a limpiar desechos suavemente durante la tarde.',
                    isMicroDose: true
                },
                {
                    tomaNumber: 4,
                    timeSlot: '30 a 60 min antes de dormir',
                    phase: 'Noche — Reparación Suave de Tejidos y Digestión',
                    formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                    dosage: `1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) disuelto en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`,
                    patientObjective: addr.isTutorMode
                        ? `Nutrir articulaciones, piel y digestión mientras ${ref} duerme, siempre con medio litro de agua simple.`
                        : 'Nutrir sus articulaciones, piel y digestión mientras usted duerme, siempre con suficiente agua simple.',
                    isMicroDose: true
                }
            ];
        }
        return [
            {
                tomaNumber: 1,
                timeSlot: 'Al despertar en ayunas',
                phase: 'Mañana — Energía Celular y Circulación',
                formula: '🔴 33Plus® (Energía Celular y Circulación)',
                dosage: `1 sobre (${FORMULA_33PLUS.sachetGramsDisplay}) en ${FORMULA_33PLUS.minWaterMl} ml de agua natural o tibia`,
                patientObjective: addr.isTutorMode
                    ? `Impulsar la vitalidad y atención matutina de ${ref} desde temprano.`
                    : 'Despertar su vitalidad y apoyar su circulación desde temprano.'
            },
            {
                tomaNumber: 2,
                timeSlot: 'A media mañana (aprox. 4 h después de despertar)',
                phase: 'Mañana — Enfoque y Estabilidad',
                formula: '🔴 33Plus® (Energía Celular y Circulación)',
                dosage: `1 sobre (${FORMULA_33PLUS.sachetGramsDisplay}) en ${FORMULA_33PLUS.minWaterMl} ml de agua natural`,
                patientObjective: addr.isTutorMode
                    ? `Mantener la energía de ${ref} estable sin bajones a mitad del día.`
                    : 'Mantener su energía estable sin bajones a mitad del día.'
            },
            {
                tomaNumber: 3,
                timeSlot: 'A media tarde',
                phase: 'Tarde — Bienestar Digestivo',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: `1 sobre (${FORMULA_34PLUS.sachetGramsDisplay}) en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`,
                patientObjective: addr.isTutorMode
                    ? `Cuidar la digestión vespertina de ${ref} e hidratar profundamente sus tejidos.`
                    : 'Cuidar su digestión e hidratar profundamente sus tejidos.'
            },
            {
                tomaNumber: 4,
                timeSlot: '30 a 60 min antes de dormir',
                phase: 'Noche — Reparación de Tejidos y Colágeno',
                formula: '🟢 34Plus® (Reparación Celular y Colágeno)',
                dosage: `1 sobre (${FORMULA_34PLUS.sachetGramsDisplay}) en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`,
                patientObjective: addr.isTutorMode
                    ? `Aportar los bloques de reparación nocturna para articulaciones, músculos y piel mientras ${ref} duerme.`
                    : 'Aportar los bloques de reparación nocturna para articulaciones, músculos y piel mientras usted duerme.'
            }
        ];
    };

    const canonicalSchedule = buildCanonicalSchedule();
    let schedule = [];
    const hasRawPediatricScheduleOnAdult = !addr.isTutorMode &&
        Array.isArray(ortho?.circadianSchedule) &&
        ortho.circadianSchedule.some((s) =>
            PEDIATRIC_CONTAMINATION_RE.test(`${s?.phase || ''} ${s?.formula || ''} ${s?.dosage || ''} ${s?.patientObjective || ''} ${s?.clinicalObjective || ''}`)
        );
    if (!addr.isLactante && !hasRawPediatricScheduleOnAdult && Array.isArray(ortho?.circadianSchedule) && ortho.circadianSchedule.length > 0) {
        schedule = ortho.circadianSchedule.map((slot, idx) => {
            const fallbackSlot = canonicalSchedule[idx] || canonicalSchedule[canonicalSchedule.length - 1];
            const cleanPhase = sanitizeClinicalSpanish(slot.phase);
            const cleanObj = sanitizeClinicalSpanish(slot.patientObjective || slot.clinicalObjective || '');
            const mismatchTutorSlot = addr.isTutorMode && /\b(usted|sus órganos|sus articulaciones)\b/i.test(cleanObj);
            const mismatchAdultSlot = !addr.isTutorMode && (PEDIATRIC_CONTAMINATION_RE.test(cleanObj) || adultThirdPersonLeakRe.test(cleanObj));
            let cleanFormulaStr = sanitizeClinicalSpanish(slot.formula || fallbackSlot.formula);
            let normalizedDosage = sanitizeClinicalSpanish(slot.dosage || fallbackSlot.dosage).replace(/🍵/g, '💧');
            if (/iniciar\s+solo\s+con\s+(?:300\s*ml\s+de\s+)?agua/i.test(normalizedDosage) && !/hidrataci[óo]n\s+preparatoria/i.test(cleanFormulaStr)) {
                cleanFormulaStr = '💧 Hidratación Preparatoria (Agua Simple en Semana 1)';
            }
            const isSlot33 = /33/.test(cleanFormulaStr);
            const isSlot34 = /34/.test(cleanFormulaStr);
            if (isSlot33) {
                normalizedDosage = normalizedDosage
                    .replace(/1\/2\s+sobre\s*\(5\s*g\)/gi, `1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay})`)
                    .replace(/1\s+sobre\s*\(10\s*g\)/gi, `1 sobre (${FORMULA_33PLUS.sachetGramsDisplay})`);
            } else if (isSlot34) {
                normalizedDosage = normalizedDosage
                    .replace(/1\/2\s+sobre\s*\(5\s*g\)/gi, `1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay})`)
                    .replace(/1\s+sobre\s*\(10\s*g\)/gi, `1 sobre (${FORMULA_34PLUS.sachetGramsDisplay})`);
            }
            return {
                ...slot,
                timeSlot: humanizeLegacyTimeSlot(slot.timeSlot, idx),
                phase: (!cleanPhase || hasLegacyTuteo(cleanPhase)) ? fallbackSlot.phase : cleanPhase,
                formula: cleanFormulaStr,
                dosage: normalizedDosage,
                patientObjective: (!cleanObj || hasLegacyTuteo(cleanObj) || mismatchTutorSlot || mismatchAdultSlot)
                    ? fallbackSlot.patientObjective
                    : cleanObj
            };
        });
    } else {
        schedule = canonicalSchedule;
    }

    const default33Explanation = semaphore.isPaused
        ? (addr.isLactante
            ? 'En menores de 2 años no se utilizan fórmulas concentradas para adultos; la base nutricional exclusiva es la indicada por su pediatra.'
            : (addr.isTutorMode
                ? `Por cuidado a la salud de ${ref}, mantenemos 33Plus® en pausa temporal hasta revisar sus análisis de control.`
                : 'Por cuidado a su salud, mantenemos 33Plus® en pausa temporal hasta revisar sus análisis de control.'))
        : isSelective33Paused
            ? (addr.isTutorMode
                ? `Por seguridad y cuidado del sistema nervioso y cardiovascular de ${ref}, mantenemos 33Plus® en pausa selectiva preventiva (0 sobres activos) y priorizamos su hidratación natural por la mañana.`
                : 'Por seguridad clínica ante su medicación o condición actual, mantenemos 33Plus® en pausa selectiva preventiva (0 sobres activos) y priorizamos su hidratación natural por la mañana.')
            : (addr.isTutorMode
                ? `Acompaña a ${ref} por la mañana con L-Taurina, L-Carnitina, Coenzima Q10, semilla de uva, vitamina C y cromo para apoyar su energía diaria y circulación${semaphore.isMicroDose ? `, iniciando con medio sobre (${FORMULA_33PLUS.halfSachetGramsDisplay} —50% del sobre de ${FORMULA_33PLUS.sachetGramsDisplay}—) para cuidar su adaptación` : ''}.`
                : `${addr.directObjCap} acompaña por la mañana con L-Taurina, L-Carnitina, Coenzima Q10, extracto de semilla de uva (95 % proantocianidinas), Vitamina C y Picolinato de Cromo para apoyar su energía celular diaria y la flexibilidad de su circulación${semaphore.isMicroDose ? `, iniciando con medio sobre (${FORMULA_33PLUS.halfSachetGramsDisplay} —50% del sobre oficial de ${FORMULA_33PLUS.sachetGramsDisplay}—, antes de las 14:00 h) para cuidar su adaptación` : ''}.`);

    const default34Explanation = semaphore.isPaused
        ? (addr.isLactante
            ? `Mantenemos 34Plus® fuera del esquema de ${ref}, priorizando su alimentación natural acorde a la pauta pediátrica.`
            : (addr.isTutorMode
                ? `Mantenemos 34Plus® en pausa preventiva mientras cuidamos la hidratación y alimentación diaria de ${ref} en casa.`
                : 'Mantenemos 34Plus® en pausa preventiva mientras cuidamos su hidratación y alimentación diaria en casa.'))
        : (addr.isTutorMode
            ? `Trabaja mientras ${ref} descansa aportando bloques de construcción (péptidos de colágeno, L-Glicina, L-Teanina, fibra prebiótica FOS-Inulina, Citrato de Magnesio y Vitamina C) para su digestión, piel y tejidos en crecimiento (${semaphore.isMicroDose ? `${FORMULA_34PLUS.halfSachetGramsDisplay} —50% del sobre de ${FORMULA_34PLUS.sachetGramsDisplay}— ` : ''}en medio litro de agua simple 💧).`
            : `Trabaja mientras usted descansa aportando bloques de construcción (péptidos de colágeno, L-Glicina, L-Teanina, fibra prebiótica FOS-Inulina, Citrato de Magnesio, Vitamina C, Vitamina K2 MK-7 y Zinc Optizinc) para su digestión, piel y articulaciones (${semaphore.isMicroDose ? `1/2 sobre de ${FORMULA_34PLUS.halfSachetGramsDisplay} —50% del sobre oficial de ${FORMULA_34PLUS.sachetGramsDisplay}— ` : ''}en MÍNIMO 500 ml de agua simple 💧).`);

    const raw33Expl = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(raw33.patient_rationale || ''));
    const raw34Expl = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(raw34.patient_rationale || ''));
    const hasForbiddenTheanineIn33 = /l-?teanina/i.test(raw33Expl);
    const hasFictionalSkuIn33 = /libre\s+de\s+estimulantes|sin\s+estimulantes/i.test(raw33Expl);
    const mismatch33Tutor = addr.isTutorMode && /^(lo|la)\s+acompaña/i.test(raw33Expl);
    const mismatch34Tutor = addr.isTutorMode && /\bmientras\s+usted\s+descansa\b/i.test(raw34Expl);
    const mismatch33Adult = !addr.isTutorMode && (PEDIATRIC_CONTAMINATION_RE.test(raw33Expl) || adultThirdPersonLeakRe.test(raw33Expl) || hasForbiddenTheanineIn33 || hasFictionalSkuIn33);
    const mismatch34Adult = !addr.isTutorMode && (PEDIATRIC_CONTAMINATION_RE.test(raw34Expl) || adultThirdPersonLeakRe.test(raw34Expl));

    const isRecalibrationActive = Boolean(
        semaphore.isRecalibrationMode ||
        semaphore.modeCode === 'RECALIBRACION_PREVENTIVA_DOSIS' ||
        semaphore.modeCode === 'RECALIBRACION_DOSIS_PREVENTIVA' ||
        raw33?.isRecalibrationMode ||
        raw34?.isRecalibrationMode
    );

    const formula33Card = {
        code: '33PLUS',
        brandTitle: '33Plus®',
        isSelectivePaused: isSelective33Paused,
        isRecalibrationMode: isRecalibrationActive,
        subtitle: isSelective33Paused
            ? 'En pausa selectiva preventiva de bioseguridad (0 sobres activos)'
            : (addr.isTutorMode
                ? `Soporte matutino de energía celular y circulación para ${ref}`
                : 'Su aliado matutino de energía celular y circulación'),
        dosage: semaphore.isPaused
            ? (addr.isLactante
                ? '0 sobres activos (etapa exclusiva de lactancia y pediatría)'
                : '0 sobres activos por ahora (en pausa preventiva hasta revisar sus estudios de laboratorio)')
            : isSelective33Paused
                ? FORMULA_33PLUS.dosageByMode.PAUSED_SELECTIVE_33
                : (semaphore.isMicroDose
                    ? (isRecalibrationActive
                        ? (FORMULA_33PLUS.dosageByMode.RECALIBRATION_DOSE || `Recalibración preventiva de dosis (Días 1–7): 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) al despertar en ayunas en ${FORMULA_33PLUS.minWaterMl} ml de agua natural`)
                        : `Inicio gradual (Días 1–7): 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) al despertar en ayunas en ${FORMULA_33PLUS.minWaterMl} ml de agua natural`)
                    : `2 tomas por la mañana: 1 sobre (${FORMULA_33PLUS.sachetGramsDisplay}) al despertar en ayunas y 1 sobre (${FORMULA_33PLUS.sachetGramsDisplay}) a media mañana (en ${FORMULA_33PLUS.minWaterMl} ml de agua natural)`),
        timing: semaphore.isPaused
            ? (addr.isLactante ? 'No indicado en menores de 2 años' : 'En espera de validación médica')
            : isSelective33Paused
                ? 'En pausa selectiva (sustituir por 300 ml de agua natural al despertar)'
                : (addr.isTutorMode
                    ? `Sincronizado al despertar de ${ref} (evitar después de las 2:00 PM)`
                    : 'Sincronizado a su despertar real (corte estricto antes de las 2:00 PM)'),
        explanation: (!raw33Expl || hasLegacyTuteo(raw33Expl) || mismatch33Tutor || mismatch33Adult || hasFictionalSkuIn33 || addr.isLactante)
            ? default33Explanation
            : raw33Expl
    };

    const formula34Card = {
        code: '34PLUS',
        brandTitle: '34Plus®',
        isRecalibrationMode: isRecalibrationActive,
        subtitle: addr.isTutorMode
            ? `Soporte vespertino y nocturno de reparación y digestión para ${ref}`
            : 'Su aliado vespertino y nocturno de reparación y digestión',
        dosage: semaphore.isPaused
            ? (addr.isLactante
                ? '0 sobres activos (etapa exclusiva de lactancia y pediatría)'
                : '0 sobres activos por ahora (en pausa preventiva hasta revisar sus estudios de laboratorio)')
            : (semaphore.isMicroDose
                ? (isRecalibrationActive
                    ? (FORMULA_34PLUS.dosageByMode.RECALIBRATION_DOSE || `Recalibración preventiva de dosis (Días 1–7): 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) antes de dormir disuelto en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`)
                    : `Inicio gradual (Días 1–7): 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) antes de dormir disuelto en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`)
                : `2 tomas tarde/noche: 1 sobre (${FORMULA_34PLUS.sachetGramsDisplay}) a media tarde y 1 sobre (${FORMULA_34PLUS.sachetGramsDisplay}) 30–60 min antes de dormir, cada uno en MÍNIMO ${FORMULA_34PLUS.minWaterMl} ml de agua simple 💧`),
        timing: semaphore.isPaused
            ? (addr.isLactante ? 'No indicado en menores de 2 años' : 'En espera de validación médica')
            : 'Tarde y 30 a 60 min antes de dormir (siempre en medio litro de agua simple 💧)',
        explanation: (!raw34Expl || hasLegacyTuteo(raw34Expl) || mismatch34Tutor || mismatch34Adult || addr.isLactante)
            ? default34Explanation
            : raw34Expl
    };

    const isMeaningfulExclusion = (val) => {
        const clean = String(val || '').trim();
        if (!clean) return false;
        return !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean);
    };

    // 5. Plan de Acción en Casa (1:1 con canonicalClinicalPlan: kcal, macros, régimen, hidratación y exclusiones)
    const weightKg = Number(bioenergetics?.weightKg) > 0 ? Number(bioenergetics.weightKg) : 70;
    const litersRecommended = Number(canonicalPlan?.hydrationTargetLiters || ortho?.hydrationTargetLiters) > 0
        ? Number(canonicalPlan?.hydrationTargetLiters || ortho?.hydrationTargetLiters)
        : Math.min(3.2, Math.max(1.8, Number(((weightKg * 32) / 1000).toFixed(1))));
    const personalExclusions = (canonicalPlan?.patientSpecificExclusions || ortho?.dietaryPlan?.patientSpecificExclusions || [])
        .map((x) => capitalizeLeadingSpanish(sanitizeClinicalSpanish(x)))
        .filter(isMeaningfulExclusion);
    const resolvedMacros = canonicalPlan?.macros || bioenergetics?.macros || { carbs: 40, protein: 30, fat: 30 };
    const resolvedRegimen = sanitizeClinicalSpanish(canonicalPlan?.regimen || ortho?.dietaryPlan?.regimen || bioenergetics?.regimen || 'Alimentación Funcional Antiinflamatoria Personalizada');
    const macroTail = !addr.isLactante
        ? ` Distribución equilibrada: ${resolvedMacros.carbs}% carbohidratos integrales, ${resolvedMacros.protein}% proteínas limpias y ${resolvedMacros.fat}% grasas saludables.`
        : '';

    const canonicalHomePlan = {
        protective_nutrition: {
            title: 'Alimentación Protectora en Casa',
            targetKcal: canonicalPlan?.targetKcal || bioenergetics?.targetKcal || null,
            regimen: resolvedRegimen,
            macros: resolvedMacros,
            summary: addr.isLactante
                ? `Mantener lactancia materna o fórmula indicada por su pediatra e introducción gradual de alimentos naturales para ${ref}, sin sal añadida ni azúcares.`
                : addr.isTutorChild
                    ? `El plan alimentario de ${ref} (${bioenergetics?.targetKcal ? `${bioenergetics.targetKcal} kcal al día` : 'acorde a su crecimiento'} • ${resolvedRegimen}) prioriza verduras frescas, grasas nobles (aguacate, aceite de oliva), fruta natural y proteínas limpias como pescado, pollo o huevo.${macroTail}`
                    : `Su plan (${resolvedRegimen}) está calculado a la medida de su organismo (${bioenergetics?.targetKcal ? `${bioenergetics.targetKcal} kcal al día` : 'personalizado'}), priorizando verduras frescas, grasas nobles (aguacate, aceite de oliva, semillas), fibra soluble y proteínas limpias como pescado, pollo o huevo.${macroTail}`,
            universalRules: addr.isTutorMode
                ? [
                    '0 Picante (protege la mucosa digestiva)',
                    '0 Carne de cerdo y embutidos',
                    '0 Azúcares refinados ni refrescos'
                ]
                : [
                    '0 Picante (protege su mucosa digestiva)',
                    '0 Carne de cerdo y embutidos',
                    '0 Azúcares refinados ni refrescos'
                ],
            personalExclusions
        },
        smart_hydration: {
            title: 'Hidratación Inteligente Durante el Día',
            litersPerDay: addr.isLactante ? null : litersRecommended,
            summary: addr.isLactante
                ? 'En menores de 2 años la hidratación principal proviene de la leche materna o fórmula pediátrica; ofrezca pequeños sorbos de agua natural simple únicamente según la indicación de su pediatra.'
                : addr.isTutorChild
                    ? `La meta aproximada para ${ref} es de ${litersRecommended} litros de agua simple purificada repartidos a sorbos desde la mañana hasta media tarde, disminuyendo cerca de su hora de dormir.`
                    : `Su meta aproximada es de ${litersRecommended} litros de agua simple purificada repartidos a sorbos desde la mañana hasta media tarde (disminuyendo cerca de su hora de dormir para no interrumpir su sueño).`,
            keyRule34Plus: addr.isLactante
                ? 'En etapa de lactancia temprana no se utilizan sobres concentrados; continúe exclusivamente con la pauta de su pediatra.'
                : (semaphore.isPaused
                    ? (addr.isTutorChild
                        ? `Por ahora mantenemos los sobres en pausa preventiva para ${ref} y priorizamos únicamente agua natural simple.`
                        : 'Por ahora mantenemos sus suplementos en pausa preventiva y nos enfocamos únicamente en agua natural simple.')
                    : 'Regla de oro para 34Plus®: disuélvalo siempre en MÍNIMO 500 ml (medio litro) de agua simple natural para que su fibra y colágeno se absorban con suavidad.')
        },
        gentle_movement: {
            title: addr.isTutorMode ? 'Juego y Desarrollo Motor Diario' : 'Movimiento Cotidiano Seguro y Articular',
            isPediatric: Boolean(addr.isTutorMode),
            summary: addr.isLactante
                ? `Estimulación motriz temprana (tiempo boca abajo supervisado, gateo libre y juego sensorial acorde a la edad de ${ref}), además de contacto suave con luz natural matutina.`
                : addr.isTutorChild
                    ? `Juego activo diario acorde a la etapa de crecimiento de ${ref}, coordinación motriz libre al aire libre y contacto matutino con luz natural.`
                    : (addr.ageYears >= 55
                        ? 'Caminata suave y constante a paso cómodo de 15 a 20 minutos después de sus comidas principales (a un ritmo donde usted pueda conversar sin agitarse), acompañada de estiramientos suaves de cuello, hombros y cadera.'
                        : `Caminata ligera de 20 a 30 minutos al día a ritmo conversacional y pausas activas cada hora si usted permanece mucho tiempo ${addr.seatedLabel}, sumando movilidad articular suave sin impactos bruscos.`),
            sleepHabit: addr.isLactante
                ? `Favorezca rutinas tranquilas de sueño para ${ref} con luz tenue y ambiente sereno libre de pantallas.`
                : addr.isTutorChild
                    ? `Procure ofrecer a ${ref} una cena ligera al menos 2 horas antes de dormir y apagar pantallas brillantes con anticipación.`
                    : 'Procure cenar ligero al menos 2 a 3 horas antes de dormir y descansar lejos de pantallas brillantes.'
        }
    };

    const rawHome = existingGuide?.home_action_plan;
    let homeActionPlan = canonicalHomePlan;
    if (rawHome && !addr.isLactante) {
        const rawNutSummary = sanitizeClinicalSpanish(rawHome.protective_nutrition?.summary);
        const rawHydSummary = sanitizeClinicalSpanish(rawHome.smart_hydration?.summary);
        const rawHydKeyRule = sanitizeClinicalSpanish(rawHome.smart_hydration?.keyRule34Plus);
        const rawMovSummary = sanitizeClinicalSpanish(rawHome.gentle_movement?.summary);
        const rawSleepHabit = sanitizeClinicalSpanish(rawHome.gentle_movement?.sleepHabit);
        const rawRules = (rawHome.protective_nutrition?.universalRules || canonicalHomePlan.protective_nutrition.universalRules)
            .map(sanitizeClinicalSpanish);
        const rulesHaveTuteo = rawRules.some((r) => hasLegacyTuteo(r));
        const mismatchHomeTutor = addr.isTutorMode && /\bsu plan está calculado a la medida de su organismo\b/i.test(rawNutSummary);
        const mismatchHomeAdultNut = !addr.isTutorMode && (PEDIATRIC_CONTAMINATION_RE.test(rawNutSummary) || adultThirdPersonLeakRe.test(rawNutSummary));
        const mismatchHomeAdultHyd = !addr.isTutorMode && (PEDIATRIC_CONTAMINATION_RE.test(`${rawHydSummary} ${rawHydKeyRule}`) || adultThirdPersonLeakRe.test(rawHydSummary));
        const mismatchHomeAdultMov = !addr.isTutorMode && (PEDIATRIC_CONTAMINATION_RE.test(`${rawMovSummary} ${rawSleepHabit}`) || /juego activo diario acorde a su etapa/i.test(rawMovSummary) || adultThirdPersonLeakRe.test(`${rawMovSummary} ${rawSleepHabit}`));

        homeActionPlan = {
            protective_nutrition: {
                ...canonicalHomePlan.protective_nutrition,
                ...rawHome.protective_nutrition,
                title: sanitizeClinicalSpanish(rawHome.protective_nutrition?.title) || canonicalHomePlan.protective_nutrition.title,
                summary: (!rawNutSummary || hasLegacyTuteo(rawNutSummary) || mismatchHomeTutor || mismatchHomeAdultNut)
                    ? canonicalHomePlan.protective_nutrition.summary
                    : rawNutSummary,
                universalRules: (rulesHaveTuteo || mismatchHomeAdultNut) ? canonicalHomePlan.protective_nutrition.universalRules : rawRules,
                personalExclusions: (rawHome.protective_nutrition?.personalExclusions || personalExclusions)
                    .map(sanitizeClinicalSpanish)
                    .filter(isMeaningfulExclusion)
            },
            smart_hydration: {
                ...canonicalHomePlan.smart_hydration,
                ...rawHome.smart_hydration,
                litersPerDay: rawHome.smart_hydration?.litersPerDay || litersRecommended,
                summary: (!rawHydSummary || hasLegacyTuteo(rawHydSummary) || mismatchHomeTutor || mismatchHomeAdultHyd)
                    ? canonicalHomePlan.smart_hydration.summary
                    : rawHydSummary,
                keyRule34Plus: (!rawHydKeyRule || hasLegacyTuteo(rawHydKeyRule) || mismatchHomeAdultHyd)
                    ? canonicalHomePlan.smart_hydration.keyRule34Plus
                    : rawHydKeyRule
            },
            gentle_movement: {
                ...canonicalHomePlan.gentle_movement,
                ...rawHome.gentle_movement,
                title: canonicalHomePlan.gentle_movement.title,
                isPediatric: Boolean(addr.isTutorMode),
                summary: (!rawMovSummary || hasLegacyTuteo(rawMovSummary) || mismatchHomeAdultMov)
                    ? canonicalHomePlan.gentle_movement.summary
                    : rawMovSummary,
                sleepHabit: (!rawSleepHabit || hasLegacyTuteo(rawSleepHabit) || mismatchHomeAdultMov)
                    ? canonicalHomePlan.gentle_movement.sleepHabit
                    : rawSleepHabit
            }
        };
    }

    const vocativeAdultName = addr.hasSpecificName ? fullName : firstName;
    const canonicalGreeting = addr.isLactante
        ? `Estimada madre, padre o tutor: lectura clara del bienestar de ${ref}`
        : addr.isTutorChild
            ? `Estimada madre, padre o tutor: lectura clara de la salud de ${ref}`
            : `${addr.estimadoLabel} ${vocativeAdultName}: esta es la lectura clara de su salud hoy`;

    const hasExplicitComplaintsClient = Boolean(
        !isClinicalEubiosisClient ||
        String(patientData?.clinical_context?.specific_ailment || '').trim() ||
        (Array.isArray(patientData?.clinical_context?.pain_zones) && patientData.clinical_context.pain_zones.length > 0)
    );

    const canonicalLead = addr.isLactante
        ? `Integramos con todo cuidado la valoración de crecimiento, tolerancia digestiva y desarrollo de ${addr.childSubjectWithKinship} para explicarle con claridad qué observamos y acompañarle paso a paso en casa.`
        : addr.isTutorChild
            ? `Con base en la historia clínica y las mediciones integrales de ${addr.childSubjectWithKinship}, le explicamos con total claridad qué observamos en su organismo y cómo vamos a acompañar a ${ref} paso a paso en casa, sin prisas ni sobrecargas.`
            : addr.isAdolescent
                ? `Con base en su historia clínica y las mediciones de su evaluación integral, le explicamos con total claridad cómo se encuentra su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso junto con su madre, padre o tutor legal.`
                : hasExplicitComplaintsClient
                    ? `Reunimos sus síntomas, su historia clínica y las mediciones de su evaluación para explicarle con total claridad qué está ocurriendo en su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso, sin prisas ni sobrecargas.`
                    : `Con base en su historia clínica, su evaluación preventiva integral y las mediciones obtenidas —aun cursando hoy sin molestias digestivas (eubiosis)—, le explicamos con total claridad cómo se encuentra su organismo y cómo vamos a ${addr.directObjLower === 'la' ? 'acompañarla' : 'acompañarlo'} paso a paso, sin prisas ni sobrecargas.`;

    const rawGreeting = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(existingGuide?.greetingTitle || ''));
    const rawLead = polishPatientEditorialPhrasing(sanitizeClinicalSpanish(existingGuide?.empatheticLead || ''));
    const hasSymptomContradictionOnEubiosis = !hasExplicitComplaintsClient && /\bsus\s+s[íi]ntomas\b/i.test(rawLead);
    const isLegacyHolaGreeting = /^hola\b/i.test(rawGreeting.trim());
    const hasMultiWordFullName = fullName.trim().split(/\s+/).length >= 2;
    const isTruncatedSingleNameGreeting = !addr.isTutorMode && hasMultiWordFullName && !rawGreeting.toLowerCase().includes(fullName.toLowerCase());
    const mismatchTutorGreeting = addr.isTutorMode && !/madre,\s*padre\s+o\s+tutor/i.test(rawGreeting);
    const mismatchAdultGreeting = !addr.isTutorMode && (PEDIATRIC_CONTAMINATION_RE.test(rawGreeting) || adultThirdPersonLeakRe.test(rawGreeting) || isTruncatedSingleNameGreeting);
    const mismatchAdultLead = !addr.isTutorMode && !addr.isAdolescent && (PEDIATRIC_CONTAMINATION_RE.test(rawLead) || adultThirdPersonLeakRe.test(rawLead) || hasSymptomContradictionOnEubiosis);
    const missingTeenLeadTutor = addr.isAdolescent && !/tutor|madre|padre/i.test(rawLead);

    const uiLabels = buildPatientUiLabels({
        addressing: addr,
        isPaused: Boolean(semaphore.isPaused)
    });

    const totalAbnormalCount = Object.values(bucketsBySystem).reduce((acc, arr) => acc + arr.length, 0);
    const rawCalciumAlert = existingGuide?.calcium_alert_text || (ortho?.has_calcium_contraction_lock ? ortho?.calcium_alert_text : null);
    const resolvedCalciumAlert = rawCalciumAlert && !hasLegacyTuteo(String(rawCalciumAlert))
        ? sanitizeClinicalSpanish(rawCalciumAlert)
        : (rawCalciumAlert
            ? 'Detectamos tendencia a depósito de calcio fuera del hueso: evitamos suplementos aislados de calcio inorgánico y priorizamos hidratación constante junto con magnesio y vitamina K2 alimentaria.'
            : null);

    const applyGenderDeep = (val) => {
        if (val === null || val === undefined) return val;
        if (typeof val === 'string') return enforcePatientGenderConcordance(val, isFemale);
        if (Array.isArray(val)) return val.map(applyGenderDeep);
        if (typeof val === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(val)) {
                out[k] = applyGenderDeep(v);
            }
            return out;
        }
        return val;
    };

    const metabolicAgeStudy = resolveMetabolicAgeStudySSoT(patientData);
    const logisticsSummary = translateLogisticsProfile(patientData);
    const scheduledAppointmentSummary = resolveScheduledAppointmentSummary(patientData);

    return applyGenderDeep({
        patientFullName: fullName,
        patientFirstName: firstName,
        ageYears,
        isFemale,
        isLactante,
        isTutorMode: addr.isTutorMode,
        isAdolescent: addr.isAdolescent,
        isPediatric,
        uiLabels,
        greetingTitle: (!rawGreeting || hasLegacyTuteo(rawGreeting) || isLegacyHolaGreeting || mismatchTutorGreeting || mismatchAdultGreeting)
            ? canonicalGreeting
            : rawGreeting,
        empatheticLead: (!rawLead || hasLegacyTuteo(rawLead) || mismatchTutorGreeting || mismatchAdultLead || missingTeenLeadTutor)
            ? canonicalLead
            : rawLead,
        biosecuritySemaphore: semaphore,
        metabolicAgeStudy,
        nom004Sheet,
        logisticsSummary,
        scheduledAppointmentSummary,
        fiveSystems,
        formula33Card,
        formula34Card,
        circadianSchedule: schedule,
        calciumAlertText: resolvedCalciumAlert,
        homeActionPlan,
        totalAbnormalCount
    });
}
