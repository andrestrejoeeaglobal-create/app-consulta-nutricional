import { resolvePatientSex, stripNegatedSentinels } from '../utils/genderConcordance';
import React, { useState, useEffect, useRef } from 'react';
import tiloImg from "../assets/tilo.png";
import { formatText, getGenderedTerm, fuzzyMatch, calculateCurp, cleanServerInfo, buildPediatricContext, inferGenderFromName, formatPhoneNumber, toTitleCase } from "../utils/utils";
import useCitationValidation from './useCitationValidation';
import { fetchZipData, fetchMexicanCoordinates } from '../utils/geoServices';
import { useClinicalGenome } from '../store/useClinicalGenome';

// --- INITIAL STATES (EXTRACTED FOR RESET CAPABILITY) ---
export function buildSessionRecoveryCardMessage({
    holderName = 'Paciente',
    userId = '---',
    citationId = '---',
    phaseNum = 20,
    isCompleted = false,
    options = undefined,
    isTutorMode = false
} = {}) {
    try {
        const cleanHolder = String(holderName || 'Paciente')
            .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/gu, '')
            .trim() || 'Paciente';
        const cleanUid = String(userId || '---').trim() || '---';
        const cleanCita = String(citationId || '---').replace(/^#+/, '').trim() || '---';
        const parsedPhase = Number(phaseNum);
        const safePhaseNum = Number.isFinite(parsedPhase) && parsedPhase > 0
            ? (isCompleted ? Math.max(21, parsedPhase) : parsedPhase)
            : (isCompleted ? 21 : 20);
        const statusLabel = `Fase\u00A0${safePhaseNum} (${isCompleted ? 'Estudio Completado' : 'En Curso'})`;

        const cleanedOptions = Array.isArray(options)
            ? options.map((opt) => {
                if (!opt || typeof opt !== 'object') return opt;
                const cleanLabel = String(opt.label || '')
                    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/gu, '')
                    .replace(/\s*➔\s*$/u, '')
                    .trim();
                const inferredIconKey = opt.iconKey || (
                    opt.value === 'GO_TO_PHASE_20' ? 'file_text' :
                    opt.value === 'GO_TO_PHASE_21' ? 'calendar' :
                    opt.value === 'RESTART_FROM_PHASE_0' ? 'rotate_ccw' :
                    undefined
                );
                return {
                    ...opt,
                    label: cleanLabel,
                    ...(inferredIconKey ? { iconKey: inferredIconKey } : {})
                };
            })
            : undefined;

        const confirmationNote = isTutorMode
            ? 'Se han restaurado y desplegado en el Dashboard todos los datos de la valoración pediátrica: Biometría y Vitales, Bioquímica Cuántica, Evaluaciones Multimodales, Historia Clínica y Diagnóstico.'
            : 'Se han restaurado y desplegado en el Dashboard todos los datos de su estudio: Biometría y Vitales, Bioquímica Cuántica, Evaluaciones Multimodales, Historia Clínica y Diagnóstico.';

        return {
            id: 'session_recovery_ssot_card',
            role: 'assistant',
            avatar: tiloImg,
            headerBadge: {
                iconKey: 'clipboard_check',
                label: 'EXPEDIENTE CLÍNICO RECUPERADO EXITOSAMENTE • NOM-004'
            },
            recoveryMeta: {
                holderName: cleanHolder,
                userId: cleanUid,
                citationId: `#${cleanCita}`,
                statusLabel,
                isCompleted: Boolean(isCompleted)
            },
            confirmationNote,
            content: 'Expediente Clínico Recuperado Exitosamente — Puede consultar y revisar libremente cada pestaña superior.',
            ...(cleanedOptions ? { options: cleanedOptions } : {})
        };
    } catch (err) {
        console.warn('⚠️ [buildSessionRecoveryCardMessage Safe Catch]:', err?.message || err);
        return {
            id: 'session_recovery_ssot_card',
            role: 'assistant',
            avatar: tiloImg,
            headerBadge: {
                iconKey: 'clipboard_check',
                label: 'EXPEDIENTE CLÍNICO RECUPERADO EXITOSAMENTE • NOM-004'
            },
            recoveryMeta: {
                holderName: 'Paciente',
                userId: '---',
                citationId: '---',
                statusLabel: isCompleted ? 'Fase\u00A021 (Estudio Completado)' : 'Fase\u00A020 (En Curso)',
                isCompleted: Boolean(isCompleted)
            },
            confirmationNote: 'Se han restaurado y desplegado en el Dashboard todos los datos de su estudio: Biometría y Vitales, Bioquímica Cuántica, Evaluaciones Multimodales, Historia Clínica y Diagnóstico.',
            content: 'Expediente Clínico Recuperado Exitosamente — Puede consultar y revisar libremente cada pestaña superior.',
            ...(Array.isArray(options) ? { options } : {})
        };
    }
}

const INITIAL_CURRENT_PHASE = 'PHASE_0_AUTH';
const INITIAL_ACTIVE_TAB = 'profile';
const INITIAL_MESSAGES = [
    {
        role: "assistant",
        content: "Hola, soy el Ecosistema de Transformación Inteligente y Logro Optimizado (T.I.L.O.), el **Companion Clínico y Metabólico** de Equipo en Acción®. He inicializado mis protocolos de seguridad para garantizar la protección absoluta de su información clínica y validar la vigencia de su consulta.\n\n---\n\nPara blindar su sesión e iniciar el proceso, por favor **proporcione su número de cita** (recuerde que esta es personal e intransferible):",
        avatar: tiloImg,
        inputType: 'number' // Explicit declaration of expected input type
    },
];

const INITIAL_PATIENT_DATA = {
    // Fases 1, 2, 4
    profile: {
        first_name: "",
        last_name_pat: "",
        last_name_mat: "",
        name: "", // Full name
        birthdate: "",
        pediatric_profile: null,
        age: null,
        sex: "",
        occupation: "",
        ocupacion_descriptor: "", // V15.8 NEAT-005
        factor_pal: null,          // V15.8 NEAT-005
        phone: "",
        emergencyContact: { name: "", kin: "", phone: "" },
        curp: "",
        nationality_type: "MX",
        passport_id: "",
        religion: "",
        marital_status: "",
        address: { zip_code: "", colony: "", street: "" }
    },
    demographics: {
        age: null,
        gender: "",
        curp: "",
        birthdate: ""
    },
    // Fases 1, 2, 4 (Legacy Compatibility)
    identificacion: {
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechanac: "",
        sexo: "",
        ocupacion: "",
        ocupacion_descriptor: "", // V15.8 NEAT-005
        factor_pal: null,          // V15.8 NEAT-005
        curp: "",
        nationality_type: "MX",
        passport_id: "",
        telefono: "",
        religion: ""
    },
    domicilio: {
        cp: "",
        colonia: "",
        calle: ""
    },
    evaluacionDietetica: {
        preferencias: { aversiones: "", favoritos: "" },
        r24h: [],
        ffq: {}
    },
    // Fases 4, 5, 6, 7, 13
    history: {
        family_raw_text: "",
        family_checklist_verified: false,
        family_structured: [],
        family_history: [],
        personal_raw_text: "",
        personal_checklist_verified: false,
        personal_structured: [],
        pathologies: [],
        surgical: [],
        medications: [],
        allergies: {
            food: [],
            drug: []
        },
        // Fase 8
        digestive_symptoms: [],
        digestive_frequency: "",
        digestive_health: {
            bloating: false,
            reflux: false,
            constipation: false,
            evacuations_per_day: null,
            bristol_scale: null
        },
        // Fase 13
        special_context: ""
    },
    // Fase 9
    physio: {
        is_pregnant: false,
        gestation_weeks: null,
        is_lactating: false,
        lactation_type: "",
        baby_age_months: null
    },
    // Fases 10, 11
    habits: {
        smoking: { is_smoker: null, type: null, quantity_text: "", risk_level: null },
        alcohol: { is_drinker: null, preferred_drink: null, frequency_days: null, units_per_session: null, calculated_weekly_calories: null },
        drugs: { has_usage: null, substance_name: "", frequency: "" },
        sleep: { hours: null, quality: "" },
        stress: ""
    },
    activity: {
        exercise: { has_scheduled_exercise: false, log: [] }
    },
    // Fases 12, 13, 14, 16
    nutrition: {
        cook_type: "",
        venue: "",
        preferences: { dislikes: [], favorites: [] },
        protocol: {}
    },
    logistics: {
        chronobiology: { timeline: [] }
    },
    // Fase 15
    advanced_supplementation: [],
    // Fases 12, 16, 17, 18
    vitals: {
        weight: null,
        height: null,
        blood_pressure: "",
        waist: null,
        hip: null,
        hr: null,
        spo2: null,
        temperature: null,
        rr: null,
        glucose: null
    },
    biochemical: {
        electret_scan_data: {}
    },
    scan_data: {
        electret_scanned: false
    },
    clinical_dossier: null,
    electret_scan_data: {},
    clinical_flags: [], // Acoplamiento estabilizado para alertas Fase 12
    // FASE 13 (Biométricos legacy Fase 6)
    peso: "",
    talla: "",
    imc: "",
    imcEstado: "",
    cintura: "",
    cadera: "",
    icc: "",
    iccRiesgo: "",
    signosVitales: {
        ta: "", spo2: "", fc: "", temp: "", fr: "", glucosa: ""
    },
    // Contexto Global (Tone of Voice Engine)
    session_context: {
        calculated_age: null,
        interaction_mode: "",
        system_prompt_addon: ""
    },
    // Fase 3 (Motivo de Consulta)
    clinical_context: {
        patient_quote: "",
        specific_ailment: "",
        alert_level: "NONE",
        emotional_anchor: "",
        detective_radiography: { chronology: "", suspicion: "" },
        goal_standard: "",
        isGoal: false,
        isPregnant: false,
        pain_zones: [],
        intensity: 0,
        ai_analysis: { detected_tags: [] }
    }
};


/**
 * useCortex - Motor de Lógica Conversacional T.I.L.O.
 * Maneja el estado de la entrevista clínica interactiva y sincroniza el Dashboard.
 */

export const analyzeClinicalMotive = async (freeText, telemetry, bodyMapZones = []) => {
    try {
        const isCloudStandalone = typeof window !== 'undefined' && 
            (window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) && 
            !import.meta.env.VITE_API_URL;

        if (!isCloudStandalone) {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            try {
                const response = await fetch(`${apiUrl}/api/cortex/analyzeMotive`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ freeText, telemetry, bodyMapZones }),
                    signal: controller.signal
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.reasoning) {
                        data.reasoning = data.reasoning.replace(/\*?\*?(freeText|telemetry|bodyMapZones)\*?\*?\s*:\s*/gi, '');
                    }
                    let alertLevel = data.redFlag ? "CRITICAL" : "NONE";
                    if (data.category === "ONCOLOGY") alertLevel = "CRITICAL";
                    else if (data.category === "SURGICAL" && alertLevel === "NONE") alertLevel = "WARNING";
                    else if (data.risk_level === "HIGH" || (data.detected_tags && data.detected_tags.includes("HIGH_VULNERABILITY"))) {
                        if (alertLevel === "NONE") alertLevel = "WARNING";
                    }
                    return {
                        category: data.category || "CLINICAL",
                        alert: alertLevel,
                        suspicion: data.primaryRoute,
                        isGoal: data.isGoal || false,
                        isPregnant: data.isPregnant || false,
                        primaryRoute: data.primaryRoute,
                        secondaryRoute: data.secondaryRoute,
                        reasoning: data.reasoning,
                        patientMessage: data.patientMessage,
                        redFlag: data.redFlag || false,
                        risk_level: data.risk_level || (data.redFlag ? "SEVERE" : "LOW"),
                        detected_tags: data.detected_tags || [],
                        motiveSynthesis: data.motiveSynthesis || "",
                        strategicGoals: data.strategicGoals || []
                    };
                }
            } catch (netErr) {
                // Servidor local no disponible: Fallback Standalone silencioso
            } finally {
                clearTimeout(timeoutId);
            }
        }

        return {
            category: "CLINICAL",
            alert: "NONE",
            suspicion: "Inferencia Semántica",
            isGoal: false,
            isPregnant: false,
            primaryRoute: "GOAL_EDUCATION",
            secondaryRoute: null,
            reasoning: freeText || "Evaluación inicial de motivo de consulta.",
            patientMessage: "Entendido. He analizado la información y he trazado una ruta clínica de evaluación para continuar.",
            redFlag: false,
            risk_level: "LOW",
            detected_tags: bodyMapZones || []
        };
    } catch (error) {
        return {
            error: true,
            category: "CLINICAL",
            alert: "NONE",
            suspicion: "Inferencia Semántica",
            isGoal: false,
            isPregnant: false,
            primaryRoute: "GOAL_EDUCATION",
            secondaryRoute: null,
            reasoning: freeText || "Evaluación inicial de motivo de consulta.",
            patientMessage: "Entendido. He analizado la información y he trazado una ruta clínica de evaluación para continuar.",
            redFlag: false,
            risk_level: "LOW",
            detected_tags: []
        };
    }
};

// 🛡️ REGLA 8 NOM-004: Normalización estricta de userId (0 / '0' / 'null' / 'undefined' => null)
// y vinculación institucional autorizada para Cita #21161 (Roberto Carlos Valdez Santana -> userId 32071)
const ASSIGNED_CITATION_USER_MAP = {
    '21161': '32071'
};

const normalizeValidCitationId = (val) => {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (!s || s === '0' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    return s;
};

const normalizeValidUserId = (uid, citationHint = null) => {
    if (uid !== null && uid !== undefined) {
        const s = String(uid).trim();
        if (s && s !== '0' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') {
            return s;
        }
    }
    const cleanCita = normalizeValidCitationId(citationHint);
    if (cleanCita && ASSIGNED_CITATION_USER_MAP[cleanCita]) {
        return ASSIGNED_CITATION_USER_MAP[cleanCita];
    }
    return null;
};

const resolveCanonicalCitationId = (pData, apiCtx) => {
    const candidates = [
        pData?.identificacion?.idCita,
        pData?.identificacion?.citaId,
        pData?.profile?.citaId,
        pData?.profile?.citationId,
        pData?.idCita,
        pData?.citaId,
        apiCtx?.citaId,
        apiCtx?.idCita
    ];
    for (const c of candidates) {
        const clean = normalizeValidCitationId(c);
        if (clean) return clean;
    }
    return null;
};

const extractPhaseNumber = (phaseStr) => {
    if (!phaseStr) return 1;
    const m = String(phaseStr).match(/PHASE_(\d+)/i);
    if (m) return parseInt(m[1], 10);
    return 1;
};

// 🛡️ PUENTE NO DESTRUCTIVO DE AUTO-RESCATE: tilo_session_data -> tilo_session_data_32071 / tilo_session_data_cita_{id}
const rescueAndMigrateFlatLocalStorageSession = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const rawFlat = window.localStorage.getItem('tilo_session_data');
        if (!rawFlat) return null;
        const flatParsed = JSON.parse(rawFlat);
        if (!flatParsed || typeof flatParsed !== 'object') return null;

        const pData = flatParsed.patientData || {};
        const apiCtx = flatParsed.apiContext || {};
        const combinedIdentityText = [
            pData?.profile?.name,
            pData?.identificacion?.nombre,
            apiCtx?.rawName
        ].filter(Boolean).join(' ');

        const isRobertoSession = /roberto\s+carlos\s+valdez\s+santana/i.test(combinedIdentityText);
        const snapCitation = resolveCanonicalCitationId(pData, apiCtx) || (isRobertoSession ? '21161' : null);

        if (!snapCitation) return null;

        const effectiveUid = normalizeValidUserId(
            pData?.profile?.usuarioId ?? pData?.identificacion?.usuarioId ?? pData?.usuarioId ?? apiCtx?.userId,
            snapCitation
        );

        const healedSession = {
            ...flatParsed,
            apiContext: {
                ...apiCtx,
                idCita: apiCtx.idCita || Number(snapCitation) || snapCitation,
                citaId: snapCitation,
                ...(effectiveUid ? { userId: effectiveUid } : { userId: null })
            },
            patientData: {
                ...pData,
                profile: {
                    ...(pData.profile || {}),
                    citaId: snapCitation,
                    citationId: snapCitation,
                    ...(effectiveUid ? { usuarioId: effectiveUid } : {})
                },
                identificacion: {
                    ...(pData.identificacion || {}),
                    idCita: snapCitation,
                    citaId: snapCitation,
                    ...(effectiveUid ? { usuarioId: effectiveUid } : {})
                }
            }
        };

        const citaStorageKey = `tilo_session_data_cita_${snapCitation}`;
        const existingCitaRaw = window.localStorage.getItem(citaStorageKey);
        let shouldWriteCitaKey = !existingCitaRaw;
        if (existingCitaRaw) {
            try {
                const existingCitaObj = JSON.parse(existingCitaRaw);
                const flatMsgCount = Array.isArray(healedSession.messages) ? healedSession.messages.length : 0;
                const existMsgCount = Array.isArray(existingCitaObj?.messages) ? existingCitaObj.messages.length : 0;
                if (flatMsgCount > existMsgCount) shouldWriteCitaKey = true;
            } catch (_) {
                shouldWriteCitaKey = true;
            }
        }
        if (shouldWriteCitaKey) {
            window.localStorage.setItem(citaStorageKey, JSON.stringify(healedSession));
        }

        if (effectiveUid) {
            const userStorageKey = `tilo_session_data_${effectiveUid}`;
            const existingUserRaw = window.localStorage.getItem(userStorageKey);
            let shouldWriteUserKey = !existingUserRaw;
            if (existingUserRaw) {
                try {
                    const existingUserObj = JSON.parse(existingUserRaw);
                    const flatMsgCount = Array.isArray(healedSession.messages) ? healedSession.messages.length : 0;
                    const existMsgCount = Array.isArray(existingUserObj?.messages) ? existingUserObj.messages.length : 0;
                    if (flatMsgCount > existMsgCount) shouldWriteUserKey = true;
                } catch (_) {
                    shouldWriteUserKey = true;
                }
            }
            if (shouldWriteUserKey) {
                window.localStorage.setItem(userStorageKey, JSON.stringify(healedSession));
            }
            window.localStorage.setItem('tilo_active_user_id', effectiveUid);
            window.localStorage.setItem('tilo_active_session_key', effectiveUid);
        } else {
            window.localStorage.setItem('tilo_active_session_key', `cita_${snapCitation}`);
            const staleActiveUid = window.localStorage.getItem('tilo_active_user_id');
            if (!normalizeValidUserId(staleActiveUid) || healedSession.currentPhase !== 'PHASE_0_AUTH') {
                window.localStorage.removeItem('tilo_active_user_id');
            }
        }

        // Purgar llave plana compartida tras migrar a almacenamiento particionado por userId/cita (Regla 8.2 NOM-004)
        window.localStorage.removeItem('tilo_session_data');

        return { citationId: snapCitation, userId: effectiveUid, healedSession };
    } catch (e) {
        console.warn("Rescue migration warning:", e);
        return null;
    }
};

export const useCortex = ({ isAuthenticated = false } = {}) => {
    const { validateCitation } = useCitationValidation();

    // Invariante de orden de Hooks React preservada (sin inyección de datos mock — Regla 8.3 NOM-004)
    useEffect(() => {}, []);

    // 0. LOCAL STORAGE RECOVERY FUNCTION (AISLADO POR userId O cita_${id} - NOM-004)
    const getSavedState = (key, initialValue) => {
        try {
            rescueAndMigrateFlatLocalStorageSession();
            const activeSessionKey = (typeof window !== 'undefined') ? window.localStorage.getItem('tilo_active_session_key') : null;
            const activeUid = (typeof window !== 'undefined') ? normalizeValidUserId(window.localStorage.getItem('tilo_active_user_id')) : null;
            const resolvedSuffix = (activeSessionKey && activeSessionKey !== '0' && activeSessionKey !== 'null' && activeSessionKey !== 'undefined')
                ? activeSessionKey
                : activeUid;
            const targetKey = resolvedSuffix ? `tilo_session_data_${resolvedSuffix}` : null;
            let item = (targetKey && typeof window !== 'undefined') ? window.localStorage.getItem(targetKey) : null;
            if (!item && activeUid && targetKey !== `tilo_session_data_${activeUid}` && typeof window !== 'undefined') {
                item = window.localStorage.getItem(`tilo_session_data_${activeUid}`);
            }
            if (item) {
                const parsed = JSON.parse(item);
                if (key === 'patientData' && parsed[key] !== undefined) {
                    let savedData = parsed[key];
                    if (savedData && typeof savedData === 'object') {
                        // Self-healing: Upgrade legacy scan_data properties without erasing objects
                        if (savedData.scan_data) {
                            if (savedData.scan_data.ocular_metrics && typeof savedData.scan_data.ocular_metrics.palidez_conjuntival === 'string') {
                                savedData.scan_data.ocular_metrics.palidez_conjuntival = {
                                    estado: savedData.scan_data.ocular_metrics.palidez_conjuntival,
                                    descripcion_clinica: "Mucosa tarsal conjuntival evaluada"
                                };
                            }
                        }

                        if (savedData.profile) {
                            if (savedData.profile.occupation && (savedData.profile.occupation.includes('sico') || savedData.profile.occupation.includes('Activo'))) {
                                savedData.profile.occupation = 'Físico Pesado (Muy Activo)';
                                savedData.profile.ocupacion_descriptor = 'Físico Pesado (Muy Activo)';
                            }
                            if (savedData.profile.religion && (savedData.profile.religion.includes('tlico') || savedData.profile.religion.includes('Cat'))) {
                                savedData.profile.religion = 'Católico';
                            }
                            if (savedData.profile.curp && savedData.profile.curp.startsWith('EXT-')) {
                                savedData.profile.nationality_type = 'FOREIGN';
                                if (!savedData.profile.passport_id) {
                                    savedData.profile.passport_id = savedData.profile.curp.replace('EXT-', '');
                                }
                            }

                            // V18.0: Self-healing for missing baby_age_months when age is 0
                            if (savedData.profile.age === 0 && savedData.profile.birthdate && (savedData.profile.baby_age_months === null || savedData.profile.baby_age_months === undefined)) {
                                const pParts = savedData.profile.birthdate.split('/');
                                if (pParts.length === 3) {
                                    const bDate = new Date(parseInt(pParts[2], 10), parseInt(pParts[1], 10) - 1, parseInt(pParts[0], 10));
                                    const today = new Date();
                                    let yDiff = today.getFullYear() - bDate.getFullYear();
                                    let mDiff = today.getMonth() - bDate.getMonth();
                                    if (today.getDate() < bDate.getDate()) {
                                        mDiff--;
                                    }
                                    if (mDiff < 0) {
                                        yDiff--;
                                        mDiff += 12;
                                    }
                                    savedData.profile.baby_age_months = (yDiff * 12) + mDiff;
                                }
                            }
                        }
                        if (savedData.identificacion) {
                            if (savedData.identificacion.ocupacion && (savedData.identificacion.ocupacion.includes('sico') || savedData.identificacion.ocupacion.includes('Activo'))) {
                                savedData.identificacion.ocupacion = 'Físico Pesado (Muy Activo)';
                                savedData.identificacion.ocupacion_descriptor = 'Físico Pesado (Muy Activo)';
                            }
                            if (savedData.identificacion.religion && (savedData.identificacion.religion.includes('tlico') || savedData.identificacion.religion.includes('Cat'))) {
                                savedData.identificacion.religion = 'Católico';
                            }
                            if (savedData.identificacion.curp && savedData.identificacion.curp.startsWith('EXT-')) {
                                savedData.identificacion.nationality_type = 'FOREIGN';
                                if (!savedData.identificacion.passport_id) {
                                    savedData.identificacion.passport_id = savedData.identificacion.curp.replace('EXT-', '');
                                }
                            }

                            // V18.0: Self-healing for missing baby_age_months when edad is 0
                            if (savedData.identificacion.edad === 0 && (savedData.identificacion.fechanac || (savedData.profile && savedData.profile.birthdate)) && (savedData.identificacion.baby_age_months === null || savedData.identificacion.baby_age_months === undefined)) {
                                const dateStr = savedData.identificacion.fechanac || savedData.profile.birthdate;
                                const pParts = dateStr.split('/');
                                if (pParts.length === 3) {
                                    const bDate = new Date(parseInt(pParts[2], 10), parseInt(pParts[1], 10) - 1, parseInt(pParts[0], 10));
                                    const today = new Date();
                                    let yDiff = today.getFullYear() - bDate.getFullYear();
                                    let mDiff = today.getMonth() - bDate.getMonth();
                                    if (today.getDate() < bDate.getDate()) {
                                        mDiff--;
                                    }
                                    if (mDiff < 0) {
                                        yDiff--;
                                        mDiff += 12;
                                    }
                                    savedData.identificacion.baby_age_months = (yDiff * 12) + mDiff;
                                }
                            }
                        }

                        // Deep merge for critical top-level structures to prevent undefined/null crashes
                        const base = (initialValue && typeof initialValue === 'object') ? initialValue : INITIAL_PATIENT_DATA;
                        return {
                            ...base,
                            ...savedData,
                            identificacion: { ...(base.identificacion || {}), ...(savedData.identificacion || {}) },
                            profile: { ...(base.profile || {}), ...(savedData.profile || {}) },
                            domicilio: { ...(base.domicilio || {}), ...(savedData.domicilio || {}) },
                            evaluacionDietetica: { ...(base.evaluacionDietetica || {}), ...(savedData.evaluacionDietetica || {}) },
                            history: { ...(base.history || {}), ...(savedData.history || {}) },
                            habits: { ...(base.habits || {}), ...(savedData.habits || {}) },
                            nutrition: { ...(base.nutrition || {}), ...(savedData.nutrition || {}) },
                            vitals: { ...(base.vitals || {}), ...(savedData.vitals || {}) },
                            clinical_context: { ...(base.clinical_context || {}), ...(savedData.clinical_context || {}) }
                        };
                    }
                }
                if (key === 'messages') {
                    let savedMessages = parsed[key];
                    if (Array.isArray(savedMessages)) {
                        if (savedMessages.length > 0) {
                            // SANITIZACIÓN AUTO-CURATIVA: Eliminar mensajes duplicados consecutivos del asistente
                            const uniqueMessages = [];
                            for (let i = 0; i < savedMessages.length; i++) {
                                if (i > 0 && 
                                    savedMessages[i] && 
                                    savedMessages[i].role === 'assistant' && 
                                    savedMessages[i-1] && 
                                    savedMessages[i-1].role === 'assistant' && 
                                    savedMessages[i].content === savedMessages[i-1].content) {
                                    console.log("✂️ Auto-healing duplicate assistant message removed:", savedMessages[i].content);
                                    continue;
                                }
                                uniqueMessages.push(savedMessages[i]);
                            }
                            savedMessages = uniqueMessages;

                            if (savedMessages[0] && savedMessages[0].role === 'assistant' && savedMessages[0].content && savedMessages[0].content.includes("Ecosistema de Transformación Inteligente y Logro Optimizado")) {
                                savedMessages[0].content = INITIAL_MESSAGES[0].content;
                            }
                            savedMessages.forEach(msg => {
                                if (msg && msg.content) {
                                    if (msg.content.includes("¿Es usted el paciente titular mencionado arriba?")) {
                                        msg.inputType = 'strict_select';
                                    }
                                    if (msg.content.includes("corresponde exactamente a su **Nombre de Pila completo**") || msg.content.includes("su **Apellido Paterno** correcto?")) {
                                        msg.inputType = 'strict_select';
                                    }
                                    if (msg.content.includes("¿Cuál es su **sexo biológico**?") || msg.content.includes("sexo biológico** de")) {
                                        msg.inputType = 'strict_select';
                                    }
                                    if (msg.content.includes("profesa alguna religión con restricciones dietéticas") || msg.content.includes("¿Qué **Religión** profesa")) {
                                        msg.inputType = 'strict_select';
                                    }
                                    if (msg.content.includes("¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?") || msg.content.includes("¿Presenta algún otro síntoma, molestia o detalle importante que debamos registrar?")) {
                                        const hasAlert = msg.content.includes("⚠️ **ALERTA DE SEGURIDAD**") || msg.content.includes("⚠️ **ALERTA DE SEGURIDAD**");
                                        msg.content = hasAlert
                                            ? "⚠️ **ALERTA DE SEGURIDAD**: He detectado un nivel de dolor severo en una zona sensible.\n\n---\n\n¿Presenta algún otro síntoma, molestia o detalle importante que debamos registrar?"
                                            : "Entendido.\n\n---\n\n¿Presenta algún otro síntoma, molestia o detalle importante que debamos registrar?";
                                        msg.inputType = 'strict_select';
                                        msg.options = [
                                            { label: '✅ Sí, agregar detalle', value: 'ADD_DETAIL_YES' },
                                            { label: '❌ No, continuar', value: 'ADD_DETAIL_NO' }
                                        ];
                                    }
                                    if (msg.role === 'assistant' && (
                                        msg.content.includes("número de teléfono") ||
                                        msg.content.includes("teléfono celular") ||
                                        msg.content.includes("Teléfono Correcto") ||
                                        msg.content.includes("Fallo de Formato Telefónico") ||
                                        msg.content.includes("Redundancia de Contacto Detectada") ||
                                        msg.content.includes("Contacto Inválido") ||
                                        msg.content.includes("El número debe tener exactamente 10 dígitos")
                                    )) {
                                        msg.inputType = 'tel';
                                    }

                                    // V8.8: Auto-sanitización de restricciones clínicas Fase 21 persistidas en localStorage
                                    if (msg.options && Array.isArray(msg.options)) {
                                        msg.options = msg.options.map(opt => {
                                            if (!opt) return opt;
                                            if (opt.value === 'FODMAPS' || (typeof opt.label === 'string' && opt.label.includes('FODMAP') && !opt.label.includes('Fermentables'))) {
                                                return { label: "Protocolo Bajo en Carbohidratos Fermentables (FODMAP)", value: "LOW_FODMAP" };
                                            }
                                            if (opt.value === 'SHELF' || (typeof opt.label === 'string' && opt.label.includes('Shelf Stable'))) {
                                                return { label: "Logística de No Perecederos", value: "SHELF_STABLE" };
                                            }
                                            return opt;
                                        });
                                    }
                                }
                            });
                        }
                        return savedMessages;
                    }
                    return initialValue;
                }
                return parsed[key] !== undefined ? parsed[key] : initialValue;
            }
        } catch (error) {
            console.warn("Failed to read 'tilo_session_data' from localStorage", error);
        }
        return initialValue;
    };

    // 1. ESTADO DE FASE (Maquina de Estados)
    const [currentPhase, setCurrentPhase] = useState(() => {
        const savedPhase = getSavedState('currentPhase', null);
        return savedPhase || INITIAL_CURRENT_PHASE;
    });

    // 2. ESTADO DE NAVEGACIÓN (Dashboard)
    const [activeTab, setActiveTab] = useState(() => {
        const savedTab = getSavedState('activeTab', null);
        return savedTab || INITIAL_ACTIVE_TAB;
    });

    // 3. ESTADO DEL CHAT
    const [messages, setMessages] = useState(() => {
        const saved = getSavedState('messages', null);
        if (Array.isArray(saved) && saved.length > 0) {
            return saved;
        }
        return INITIAL_MESSAGES;
    });

    // 4. ESTADO GLOBAL DEL PACIENTE (Data Lake)
    const [patientData, setPatientData] = useState(() => {
        const saved = getSavedState('patientData', INITIAL_PATIENT_DATA);
        if (saved) {
            return saved;
        }
        return JSON.parse(JSON.stringify(INITIAL_PATIENT_DATA));
    });

    // ESTADO TEMPORAL: Guardar payload del API
    const [apiContext, setApiContext] = useState(() => getSavedState('apiContext', {}) || {});

    // --- NEW: PHASE 3 NATIVE STATE ---
    const [fase3State, setFase3State] = useState(() => getSavedState('fase3State', {
        patient_quote: "",
        specific_ailment: "",
        alert_level: "NONE",
        emotional_anchor: "",
        detective_radiography: { chronology: "", suspicion: "" },
        goal_standard: "",
        isGoal: false,
        isPregnant: false
    }));

    // ESTADO DE SEGURIDAD: Intentos de Autenticación
    const [authAttempts, setAuthAttempts] = useState(() => getSavedState('authAttempts', 0));


    // 🛡️ RESCATE EN VIVO (HMR / RECARGA) + VOLCADO INMEDIATO A SQLITE BAJO CITA REAL Y userId ASIGNADO
    const hasSyncedRescueRef = useRef({ synced: false, verifiedHydration: false });
    useEffect(() => {
        const rescueInfo = rescueAndMigrateFlatLocalStorageSession();

        // Si en HMR la memoria estaba en PHASE_0_AUTH pero localStorage rescató una consulta activa, hidratar memoria
        if (currentPhase === 'PHASE_0_AUTH' && rescueInfo?.healedSession && rescueInfo.healedSession.currentPhase && rescueInfo.healedSession.currentPhase !== 'PHASE_0_AUTH') {
            const hs = rescueInfo.healedSession;
            if (hs.patientData) setPatientData(hs.patientData);
            if (hs.apiContext) setApiContext(hs.apiContext);
            if (Array.isArray(hs.messages) && hs.messages.length > 0) setMessages(hs.messages);
            if (hs.activeTab) setActiveTab(hs.activeTab);
            if (hs.fase3State) setFase3State(hs.fase3State);
            setCurrentPhase(hs.currentPhase);
            return;
        }

        const liveCitation = resolveCanonicalCitationId(patientData, apiContext);
        if (!liveCitation) return;

        const liveUid = normalizeValidUserId(
            patientData?.profile?.usuarioId ?? patientData?.identificacion?.usuarioId ?? patientData?.usuarioId ?? apiContext?.userId,
            liveCitation
        );

        // Sellar en memoria citaId / usuarioId si estaban vacíos o en 0 (ej. Cita #21161 -> userId 32071)
        const needsContextHeal = apiContext?.citaId !== liveCitation || (liveUid && String(apiContext?.userId || '') !== liveUid);
        if (needsContextHeal) {
            setApiContext(prev => ({
                ...(prev || {}),
                idCita: prev?.idCita || Number(liveCitation) || liveCitation,
                citaId: liveCitation,
                userId: liveUid || null
            }));
        }

        const needsPatientHeal =
            patientData?.profile?.citaId !== liveCitation ||
            patientData?.identificacion?.idCita !== liveCitation ||
            (liveUid && (patientData?.profile?.usuarioId !== liveUid || patientData?.identificacion?.usuarioId !== liveUid));

        if (needsPatientHeal) {
            setPatientData(prev => ({
                ...prev,
                profile: {
                    ...(prev?.profile || {}),
                    citaId: liveCitation,
                    citationId: liveCitation,
                    ...(liveUid ? { usuarioId: liveUid } : {})
                },
                identificacion: {
                    ...(prev?.identificacion || {}),
                    idCita: liveCitation,
                    citaId: liveCitation,
                    ...(liveUid ? { usuarioId: liveUid } : {})
                }
            }));
        }

        // Volcado inmediato de rescate hacia SQLite una vez que la sesión activa está identificada
        // 🛡️ SSoTT v2.8.2: Prohibido disparar rescate sobre estudios completados (is_completed), en Fase >= 20 o antes de verificar hidratación SQLite
        const rescuePhaseNum = extractPhaseNumber(currentPhase);
        const hasRescueBaseIdentity = Boolean(
            String(patientData?.profile?.first_name || '').trim() ||
            String(patientData?.profile?.name || '').trim() ||
            String(patientData?.identificacion?.nombre || '').trim()
        );
        if (
            isAuthenticated &&
            !hasSyncedRescueRef.current.synced &&
            hasSyncedRescueRef.current.verifiedHydration &&
            hasRescueBaseIdentity &&
            currentPhase &&
            currentPhase !== 'PHASE_0_AUTH' &&
            !Boolean(patientData?.is_completed) &&
            rescuePhaseNum < 20
        ) {
            hasSyncedRescueRef.current.synced = true;
            const isCloudStandalone = typeof window !== 'undefined' &&
                (window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) &&
                !import.meta.env.VITE_API_URL;

            if (!isCloudStandalone) {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const phaseNum = rescuePhaseNum;
                const safeMessages = Array.isArray(messages) ? messages.slice(-35) : [];
                const snapshotWithMeta = {
                    ...patientData,
                    profile: {
                        ...(patientData?.profile || {}),
                        citaId: liveCitation,
                        citationId: liveCitation,
                        ...(liveUid ? { usuarioId: liveUid } : {})
                    },
                    identificacion: {
                        ...(patientData?.identificacion || {}),
                        idCita: liveCitation,
                        citaId: liveCitation,
                        ...(liveUid ? { usuarioId: liveUid } : {})
                    },
                    _session_meta: {
                        currentPhase,
                        activeTab,
                        messages: safeMessages,
                        fase3State
                    }
                };

                fetch(`${apiUrl}/api/citations/${encodeURIComponent(liveCitation)}/progress`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phase: phaseNum,
                        block: currentPhase,
                        userId: liveUid,
                        patientData: snapshotWithMeta,
                        is_completed: false,
                        is_rescue: true
                    })
                }).then(() => {
                    console.log(`🛡️ [RESCATE NOM-004] Sesión sincronizada en SQLite: Cita #${liveCitation} | userId=${liveUid || 'NULL'} | Fase=${currentPhase}`);
                }).catch(err => {
                    console.warn("⚠️ Aviso en rescate inicial a SQLite:", err.message);
                });
            }
        }
    }, [isAuthenticated, currentPhase, patientData, apiContext, activeTab, messages, fase3State]);

    // --- AUTO-SAVE EFFECT (AISLADO POR userId O cita_${id} - NOM-004) ---
    useEffect(() => {
        try {
            const resolvedCita = resolveCanonicalCitationId(patientData, apiContext);
            const validUserId = normalizeValidUserId(
                patientData?.profile?.usuarioId ?? patientData?.identificacion?.usuarioId ?? patientData?.usuarioId ?? apiContext?.userId,
                resolvedCita
            );
            const sessionData = {
                currentPhase,
                activeTab,
                messages,
                patientData,
                apiContext,
                authAttempts,
                fase3State
            };
            if (typeof window !== 'undefined' && window.localStorage) {
                if (validUserId) {
                    window.localStorage.setItem(`tilo_session_data_${validUserId}`, JSON.stringify(sessionData));
                    window.localStorage.setItem('tilo_active_user_id', validUserId);
                    window.localStorage.setItem('tilo_active_session_key', validUserId);
                    if (resolvedCita) {
                        window.localStorage.setItem(`tilo_session_data_cita_${resolvedCita}`, JSON.stringify(sessionData));
                    }
                } else if (resolvedCita) {
                    window.localStorage.setItem(`tilo_session_data_cita_${resolvedCita}`, JSON.stringify(sessionData));
                    window.localStorage.setItem('tilo_active_session_key', `cita_${resolvedCita}`);
                    const prevActiveUid = window.localStorage.getItem('tilo_active_user_id');
                    if (!normalizeValidUserId(prevActiveUid)) {
                        window.localStorage.removeItem('tilo_active_user_id');
                    }
                }
                window.localStorage.removeItem('tilo_session_data');
            }
            console.log("💾 Cortex State Auto-Saved for key:", validUserId || (resolvedCita ? `cita_${resolvedCita}` : 'global'));
        } catch (e) {
            console.error("Failed to save session data to localStorage", e);
        }
    }, [currentPhase, activeTab, messages, patientData, apiContext, authAttempts, fase3State]);

    // 🛡️ NOM-004 AUTO-HYDRATION: Si la cita/usuario activo cuenta con expediente completado en SQLite y la sesión local está vacía, auto-cargar
    useEffect(() => {
        if (!isAuthenticated) return undefined;
        let isCancelled = false;
        const checkAndHydrateSession = async () => {
            const currentCita = resolveCanonicalCitationId(patientData, apiContext);
            const activeUid = (typeof window !== 'undefined') ? normalizeValidUserId(window.localStorage.getItem('tilo_active_user_id'), currentCita) : null;
            const queryTarget = currentCita || activeUid;

            // PROTECCIÓN CRÍTICA: Si ya hay una entrevista activa en curso en el navegador (Fases 1-18) CON identidad íntegra en RAM, NO sobrescribir el chat en vivo
            const localPhaseNum = extractPhaseNumber(currentPhase);
            const isPostSynthesisLocal =
                Boolean(patientData?.is_completed) ||
                Boolean(patientData?.clinical_dossier) ||
                localPhaseNum >= 19;
            const hasLocalBaseIdentity = Boolean(
                String(patientData?.profile?.first_name || '').trim() ||
                String(patientData?.profile?.name || '').trim() ||
                String(patientData?.identificacion?.nombre || '').trim()
            );
            const hasActiveLocalConsultation = currentPhase && currentPhase !== 'PHASE_0_AUTH' && Array.isArray(messages) && messages.length > 1;
            const mustVerifyInitialServerNonce = Boolean(queryTarget && !hasSyncedRescueRef.current.verifiedHydration && !isPostSynthesisLocal);
            if (hasActiveLocalConsultation && !isPostSynthesisLocal && hasLocalBaseIdentity && !mustVerifyInitialServerNonce) {
                hasSyncedRescueRef.current.verifiedHydration = true;
                return;
            }

            const hasVitals = Boolean(
                (patientData?.vitals?.weight && patientData?.vitals?.height) ||
                patientData?.clinical_dossier ||
                (patientData?.scan_data && Object.keys(patientData.scan_data).length > 2)
            );

            const strSnapshot = JSON.stringify(patientData || {});
            const hasCorruptedChars = strSnapshot.includes('\ufffd') || strSnapshot.includes('sico Pesado') || strSnapshot.includes('Catlico');
            const hasFase18 = Boolean(patientData?.scan_data?.electret_metrics && Object.keys(patientData.scan_data.electret_metrics).length > 0);
            const hasBirthdate = Boolean(patientData?.profile?.birthdate || patientData?.identificacion?.fechanac);
            const needsMidConsultationHeal = Boolean(queryTarget && hasActiveLocalConsultation && !isPostSynthesisLocal && !hasLocalBaseIdentity);
            const needsFreshServerDossier = Boolean(queryTarget && !hasSyncedRescueRef.current.verifiedHydration && isPostSynthesisLocal);
            const needsSync = Boolean(queryTarget && (mustVerifyInitialServerNonce || needsMidConsultationHeal || !hasVitals || !hasFase18 || !hasBirthdate || hasCorruptedChars || needsFreshServerDossier));

            if (!queryTarget) {
                hasSyncedRescueRef.current.verifiedHydration = true;
                return;
            }

            if (needsSync) {
                try {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                    const res = await fetch(`${apiUrl}/checkCitation?id=${encodeURIComponent(queryTarget)}`);
                    if (res.ok && !isCancelled) {
                        const json = await res.json();
                        if (json?.session_progress?.patient_data_snapshot) {
                            const lastPhase = Number(json.session_progress.last_active_phase || 0);
                            const isTrulyCompleted = Boolean(json.session_progress.is_completed) || lastPhase >= 21;
                            const isCompletedOrDossier = isTrulyCompleted || lastPhase >= 19;

                            let snapshot = null;
                            const rawSnap = json.session_progress.patient_data_snapshot;
                            if (typeof rawSnap === 'string') {
                                try {
                                    snapshot = JSON.parse(rawSnap);
                                } catch (e1) {
                                    try {
                                        snapshot = JSON.parse(rawSnap.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' '));
                                    } catch (e2) {
                                        console.error("Failed to parse snapshot in hydration:", e2);
                                    }
                                }
                            } else {
                                snapshot = rawSnap;
                            }

                            // 🛡️ PUENTE ATÓMICO SQLite -> localStorage ANTE REBOBINADO AUTORIZADO (_server_rewind_nonce)
                            const serverRewindNonce = snapshot?._server_rewind_nonce || null;
                            const localRewindNonce = patientData?._server_rewind_nonce || null;
                            if (snapshot && !isCompletedOrDossier && serverRewindNonce && serverRewindNonce !== localRewindNonce) {
                                try {
                                    const restoredPhase = snapshot?._session_meta?.currentPhase || json.session_progress.last_active_block || currentPhase;
                                    const restoredActiveTab = snapshot?._session_meta?.activeTab || (String(restoredPhase).includes('PHASE_11') ? 'lifestyle' : activeTab);
                                    const restoredMessages = Array.isArray(snapshot?._session_meta?.messages) && snapshot._session_meta.messages.length > 0
                                        ? snapshot._session_meta.messages
                                        : messages;
                                    const restoredFase3 = snapshot?._session_meta?.fase3State || fase3State;

                                    console.log("🔄 [SSoTT SERVER REWIND] Sincronizando estado limpio desde SQLite:", queryTarget, restoredPhase, serverRewindNonce);
                                    hasSyncedRescueRef.current.verifiedHydration = true;
                                    hasSyncedRescueRef.current.synced = true;

                                    if (typeof window !== 'undefined' && window.localStorage) {
                                        const cleanSessionPayload = JSON.stringify({
                                            currentPhase: restoredPhase,
                                            activeTab: restoredActiveTab,
                                            messages: restoredMessages,
                                            patientData: snapshot,
                                            apiContext,
                                            authAttempts,
                                            fase3State: restoredFase3
                                        });
                                        const validUid = normalizeValidUserId(
                                            snapshot?.profile?.usuarioId ?? snapshot?.identificacion?.usuarioId ?? activeUid,
                                            queryTarget
                                        );
                                        if (validUid) {
                                            window.localStorage.setItem(`tilo_session_data_${validUid}`, cleanSessionPayload);
                                        }
                                        window.localStorage.setItem(`tilo_session_data_cita_${queryTarget}`, cleanSessionPayload);
                                    }

                                    setPatientData(snapshot);
                                    if (restoredActiveTab && restoredActiveTab !== activeTab) {
                                        setActiveTab(restoredActiveTab);
                                    }
                                    if (restoredPhase && restoredPhase !== currentPhase) {
                                        setCurrentPhase(restoredPhase);
                                    }
                                    if (Array.isArray(restoredMessages) && restoredMessages.length > 0) {
                                        setMessages(restoredMessages);
                                    }
                                } catch (rewindErr) {
                                    console.error("⚠️ Error al aplicar rebobinado atómico desde SQLite:", rewindErr);
                                }
                                return;
                            }

                            // 🛡️ SUTA DE RESCATE DEFENSIVA EN VIVO (Fases 1-18 cuando RAM perdió identidad base)
                            if (snapshot && !isCompletedOrDossier && needsMidConsultationHeal) {
                                try {
                                    const safeDeepMerge = (serverObj, localObj) => {
                                        if (!serverObj || typeof serverObj !== 'object') return localObj;
                                        if (!localObj || typeof localObj !== 'object') return serverObj;
                                        const merged = { ...localObj, ...serverObj };
                                        for (const section of ['profile', 'demographics', 'identificacion', 'domicilio', 'evaluacionDietetica', 'history', 'pharmacology', 'familyTree', 'physio', 'habits', 'activity', 'nutrition', 'logistics', 'vitals', 'session_context', 'clinical_context']) {
                                            if (serverObj[section] && typeof serverObj[section] === 'object' && !Array.isArray(serverObj[section])) {
                                                const localSec = (localObj[section] && typeof localObj[section] === 'object' && !Array.isArray(localObj[section])) ? localObj[section] : {};
                                                const nextSec = { ...localSec };
                                                for (const [k, v] of Object.entries(serverObj[section])) {
                                                    const localVal = localSec[k];
                                                    const isLocalEmpty =
                                                        localVal === null ||
                                                        localVal === undefined ||
                                                        localVal === '' ||
                                                        localVal === 0 ||
                                                        (Array.isArray(localVal) && localVal.length === 0) ||
                                                        (typeof localVal === 'object' && !Array.isArray(localVal) && Object.keys(localVal).length === 0);
                                                    const isServerNonEmpty =
                                                        v !== null &&
                                                        v !== undefined &&
                                                        v !== '' &&
                                                        !(Array.isArray(v) && v.length === 0);
                                                    if (isLocalEmpty || isServerNonEmpty) {
                                                        nextSec[k] = v;
                                                    }
                                                }
                                                merged[section] = nextSec;
                                            }
                                        }
                                        return merged;
                                    };

                                    const healedPatientData = safeDeepMerge(snapshot, patientData);
                                    const restoredPhase = snapshot?._session_meta?.currentPhase || json.session_progress.last_active_block || currentPhase;
                                    const restoredMessages = Array.isArray(snapshot?._session_meta?.messages) && snapshot._session_meta.messages.length > 0
                                        ? snapshot._session_meta.messages
                                        : messages;

                                    console.log("🩹 [SSoTT DEEP-MERGE RESCUE] Restaurando expediente en vivo desde SQLite:", queryTarget, restoredPhase);
                                    hasSyncedRescueRef.current.verifiedHydration = true;
                                    setPatientData(healedPatientData);
                                    if (restoredPhase && restoredPhase !== currentPhase) {
                                        setCurrentPhase(restoredPhase);
                                    }
                                    if (Array.isArray(restoredMessages) && restoredMessages.length > 0) {
                                        setMessages(restoredMessages);
                                    }
                                } catch (mergeErr) {
                                    console.error("⚠️ Error en deepMerge defensivo de rescate:", mergeErr);
                                }
                                return;
                            }

                            // Solo reemplazar a vista diagnóstica cuando el expediente en SQLite ya alcanzó Fase 19+
                            if (!isCompletedOrDossier && hasActiveLocalConsultation) {
                                hasSyncedRescueRef.current.verifiedHydration = true;
                                return;
                            }

                            if (snapshot && isCompletedOrDossier && (snapshot.vitals || snapshot.scan_data || snapshot.clinical_dossier)) {
                                console.log("⚡ Auto-hidratando expediente SSoTT desde SQLite para cita/usuario:", queryTarget);
                                if (isTrulyCompleted) {
                                    snapshot.is_completed = true;
                                }
                                setPatientData(snapshot);
                                const targetPhase = isTrulyCompleted ? 'PHASE_21_CALENDARIO' : 'PHASE_20_PORTAPAPELES';
                                setCurrentPhase(targetPhase);
                                setActiveTab('diagnosis');

                                const pName = snapshot.identificacion?.nombreCompleto || snapshot.profile?.name || snapshot.identificacion?.nombre || "Paciente";
                                const uId = normalizeValidUserId(snapshot.profile?.usuarioId ?? json.session_progress.user_id ?? activeUid, currentCita);
                                const ageSnap = Number(snapshot?.identificacion?.edad ?? snapshot?.profile?.age ?? 30);
                                const isTutorSnap = Boolean((ageSnap > 0 && ageSnap < 13) || snapshot?.isLactante === true);

                                const hydratedMessages = [
                                    buildSessionRecoveryCardMessage({
                                        holderName: pName,
                                        userId: uId || '---',
                                        citationId: currentCita || json.session_progress.citation_id,
                                        phaseNum: lastPhase,
                                        isCompleted: isTrulyCompleted,
                                        isTutorMode: isTutorSnap,
                                        options: [
                                            { label: "Revisar Diagnóstico y Prescripción (Fase 20)", value: "GO_TO_PHASE_20", iconKey: "file_text" },
                                            { label: "Ver Calendario y Crononutrición (Fase 21)", value: "GO_TO_PHASE_21", iconKey: "calendar" },
                                            ...(!isTrulyCompleted
                                                ? [{ label: "Reiniciar Estudio desde Fase 0", value: "RESTART_FROM_PHASE_0", iconKey: "rotate_ccw" }]
                                                : [])
                                        ]
                                    })
                                ];

                                try {
                                    if (typeof window !== 'undefined' && window.localStorage) {
                                        const bundle = {
                                            patientData: snapshot,
                                            apiContext,
                                            currentPhase: targetPhase,
                                            activeTab: 'diagnosis',
                                            messages: hydratedMessages
                                        };
                                        if (uId) {
                                            window.localStorage.setItem('tilo_active_user_id', uId);
                                            window.localStorage.setItem('tilo_active_session_key', uId);
                                            window.localStorage.setItem(`tilo_session_data_${uId}`, JSON.stringify(bundle));
                                        }
                                        if (currentCita) {
                                            if (!uId) {
                                                window.localStorage.setItem('tilo_active_session_key', `cita_${currentCita}`);
                                            }
                                            window.localStorage.setItem(`tilo_session_data_cita_${currentCita}`, JSON.stringify(bundle));
                                        }
                                        window.localStorage.removeItem('tilo_session_data');
                                    }
                                } catch (lsErr) {
                                    console.warn("⚠️ Aviso al sincronizar localStorage en hidratación SSoTT:", lsErr);
                                }

                                setMessages(hydratedMessages);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Auto-hydration error:", e);
                } finally {
                    hasSyncedRescueRef.current.verifiedHydration = true;
                }
            } else {
                hasSyncedRescueRef.current.verifiedHydration = true;
            }
        };
        checkAndHydrateSession();
        return () => { isCancelled = true; };
    }, [isAuthenticated, patientData?.profile?.citaId, patientData?.profile?.name, apiContext?.citaId, apiContext?.idCita, 'v3.1.2-ssott-heal']);

    // Auto-focus tabs based on phase transitions (Interface Event Dispatcher)
    useEffect(() => {
        if (!currentPhase) return;
        const phase = currentPhase.toUpperCase();
        
        if (phase.startsWith('PHASE_0_') || phase.startsWith('PHASE_1_') || phase.startsWith('PHASE_2_') || phase === 'PHASE_1_SUMMARY_CONFIRM' || phase === 'PHASE_2_SUMMARY_CONFIRM') {
            setActiveTab('profile');
        } else if (
            phase.startsWith('PHASE_3_') || phase === 'PHASE_3_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_4_') || phase === 'PHASE_4_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_5_') || phase === 'PHASE_5_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_6_') || phase === 'PHASE_6_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_7_') || phase === 'PHASE_7_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_8_') || phase === 'PHASE_8_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_9_') || phase === 'PHASE_9_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_10_') || phase === 'PHASE_10_SUMMARY_CONFIRM'
        ) {
            setActiveTab('clinical_history');
        } else if (
            phase.startsWith('PHASE_11_') || phase === 'PHASE_11_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_12_') || phase === 'PHASE_12_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_13_') || phase === 'PHASE_13_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_14_') || phase === 'PHASE_14_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_15_') || phase === 'PHASE_15_SUMMARY_CONFIRM'
        ) {
            setActiveTab('lifestyle');
        } else if (
            phase.startsWith('PHASE_16_') || phase === 'PHASE_16_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_17_') || phase === 'PHASE_17_SUMMARY_CONFIRM'
        ) {
            setActiveTab('vitals');
        } else if (
            phase.startsWith('PHASE_18_') || phase === 'PHASE_18_SUMMARY_CONFIRM'
        ) {
            setActiveTab('lab');
        } else if (
            phase.startsWith('PHASE_19_') || phase === 'PHASE_19_SUMMARY_CONFIRM' ||
            phase.startsWith('PHASE_20_') || phase === 'PHASE_20_SUMMARY_CONFIRM'
        ) {
            setActiveTab('diagnosis');
        } else if (
            phase.startsWith('PHASE_21_') || phase === 'PHASE_21_SUMMARY_CONFIRM'
        ) {
            if (!patientData?.is_completed) {
                setActiveTab('schedule');
            }
        }
    }, [currentPhase, patientData?.is_completed]);

    // --- SESSION RESET FUNCTION ---
    const clearSession = async (citationId = null, options = {}) => {
        try {
            const activeCitation = resolveCanonicalCitationId(patientData, apiContext) || normalizeValidCitationId(citationId);
            const isCloudStandalone = typeof window !== 'undefined' && 
                (window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) && 
                !import.meta.env.VITE_API_URL;

            if (options?.resetInDb && activeCitation && !isCloudStandalone) {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const validUid = normalizeValidUserId(
                    patientData?.profile?.usuarioId ?? patientData?.identificacion?.usuarioId ?? apiContext?.userId,
                    activeCitation
                );
                try {
                    await fetch(`${apiUrl}/api/citations/${encodeURIComponent(activeCitation)}/progress`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phase: 0,
                            block: 'PHASE_0_AUTH',
                            userId: validUid,
                            patientData: {},
                            is_completed: false,
                            reset_study: true
                        })
                    });
                } catch (resetErr) {
                    console.warn('⚠️ Aviso al ejecutar reset_study voluntario en SQLite:', resetErr?.message || resetErr);
                }
            }

            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    Object.keys(window.localStorage).forEach(k => {
                        if (k.startsWith('tilo_session_data')) {
                            window.localStorage.removeItem(k);
                        }
                    });
                    window.localStorage.removeItem('tilo_active_user_id');
                    window.localStorage.removeItem('tilo_active_session_key');
                    window.localStorage.removeItem('ea_session');
                    window.localStorage.removeItem('ea_token');
                }
                if (typeof window !== 'undefined' && window.sessionStorage) {
                    window.sessionStorage.clear();
                }
            } catch (storageErr) {
                console.warn('⚠️ Aviso al limpiar localStorage/sessionStorage:', storageErr);
            }

            if (useClinicalGenome && useClinicalGenome.getState) {
                useClinicalGenome.getState().resetGenome();
            }
            hasSyncedRescueRef.current = { synced: false, verifiedHydration: false };
            setCurrentPhase(INITIAL_CURRENT_PHASE);
            setActiveTab(INITIAL_ACTIVE_TAB);
            setMessages(INITIAL_MESSAGES);
            setPatientData(JSON.parse(JSON.stringify(INITIAL_PATIENT_DATA)));
            setApiContext({});
            setFase3State({
                patient_quote: "",
                specific_ailment: "",
                alert_level: "NONE",
                emotional_anchor: "",
                detective_radiography: { chronology: "", suspicion: "" },
                goal_standard: "",
                isGoal: false,
                isPregnant: false
            });
            setAuthAttempts(0);
            console.log("♻️ Cortex Session & Clinical Genome Cleared to Default.");
        } catch (error) {
            console.error("Failed to clear session data", error);
        }
    };


    // --- MOTOR CORTEX: PROCESAMIENTO DE RESPUESTAS FASE 3 ---
    const analyzeWithNeuralCortex = async (text) => {
        try {
            const isCloudStandalone = typeof window !== 'undefined' && 
                (window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) && 
                !import.meta.env.VITE_API_URL;

            if (!isCloudStandalone) {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                
                // Construir telemetría para el LLM
                const telemetry = {
                    firstName: patientData.profile.first_name || '',
                    age: patientData.profile.age,
                    sex: patientData.profile.sex,
                    location: `${patientData.profile.address?.municipality || ''}, ${patientData.profile.address?.state || ''}`,
                    occupation: patientData.profile.occupation
                };
                
                const bodyMapZones = []; // En el futuro se llenará desde el UI del cuerpo

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                try {
                    const response = await fetch(`${apiUrl}/api/cortex/analyzeMotive`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            freeText: text,
                            telemetry,
                            bodyMapZones
                        }),
                        signal: controller.signal
                    });

                    if (response.ok) {
                        const data = await response.json();
                        
                        let alertLevel = data.redFlag ? "CRITICAL" : "NONE";
                        
                        // Escalar alertas de forma estructural si el motor IA detecta categorías de alto riesgo o vulnerabilidad conductual
                        if (data.category === "ONCOLOGY") alertLevel = "CRITICAL";
                        else if (data.category === "SURGICAL" && alertLevel === "NONE") alertLevel = "WARNING";
                        else if (data.risk_level === "HIGH" || (data.detected_tags && data.detected_tags.includes("HIGH_VULNERABILITY"))) {
                            if (alertLevel === "NONE") alertLevel = "WARNING";
                        }

                        return {
                            category: data.category || "CLINICAL",
                            alert: alertLevel,
                            suspicion: data.primaryRoute, // Usamos la ruta devuelta por IA como sospecha principal
                            isGoal: data.isGoal || false,
                            isPregnant: data.isPregnant || false,
                            primaryRoute: data.primaryRoute,
                            secondaryRoute: data.secondaryRoute,
                            reasoning: data.reasoning,
                            patientMessage: data.patientMessage,
                            redFlag: data.redFlag || false,
                            risk_level: data.risk_level || (data.redFlag ? "SEVERE" : "LOW"),
                            detected_tags: data.detected_tags || [],
                            motiveSynthesis: data.motiveSynthesis || "",
                            strategicGoals: data.strategicGoals || []
                        };
                    }
                } catch (netErr) {
                    // Servidor local no disponible: Fallback Standalone silencioso
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            // Si el backend no responde o no está disponible, retornar el objeto Standalone
            return {
                category: "CLINICAL",
                alert: "NONE",
                suspicion: "GOAL_EDUCATION",
                isGoal: true,
                isPregnant: false,
                primaryRoute: "GOAL_EDUCATION",
                secondaryRoute: null,
                reasoning: "Análisis preliminar completado en modo Standalone.",
                patientMessage: "Hemos registrado su motivo de consulta correctamente.",
                redFlag: false,
                risk_level: "LOW",
                detected_tags: []
            };

        } catch (error) {
            console.error("🔥 Error en Neural Cortex:", error);
            // Fallback robusto en caso de error
            return {
                error: true,
                category: "CLINICAL",
                alert: "NONE",
                suspicion: "GOAL_EDUCATION",
                isGoal: false,
                isPregnant: false,
                primaryRoute: "GOAL_EDUCATION",
                secondaryRoute: null,
                reasoning: "Error de conexión con el motor de IA. Se ha asignado la ruta clínica por defecto.",
                patientMessage: "Entendido. He analizado la información y he trazado una ruta de evaluación general para continuar.",
                redFlag: false,
                risk_level: "LOW",
                detected_tags: []
            };
        }
    };

    const triggerPhase1Summary = (updatedPatientData) => {
        const p = updatedPatientData.profile || {};
        const id = updatedPatientData.identificacion || {};
        const name = p.name || `${p.first_name || id.nombre || ''} ${p.last_name_pat || id.apellidoPaterno || ''} ${p.last_name_mat || id.apellidoMaterno || ''}`.trim();
        const tel = p.phone || updatedPatientData.cita?.phone || id.telefono || "";
        const curp = p.curp || id.curp || "";
        const sex = p.sex || id.sexo || "";
        const dob = p.birthdate || id.fechanac || `${p.dobDay || ''}/${p.dobMonth || ''}/${p.dobYear || ''}`;
        const rel = p.religion || id.religion || "";
        const occRaw = p.occupation || id.ocupacion || "";
        const occMapping = {
            'HOME_PARENTS': 'En casa (Cuidado materno/paterno)',
            'HOME_CAREGIVER': 'En casa (Familiar o Niñera)',
            'DAYCARE': 'Guardería / Estancia infantil',
            'KINDER': 'Kínder / Preescolar'
        };
        const occ = typeof occRaw === 'string' ? (occMapping[occRaw.toUpperCase()] || occRaw) : occRaw;

        const ptCtx = p.pediatric_profile || id.pediatric_profile;
        const showMarital = !(ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false);
        const marital = p.marital_status || id.estadoCivil || "";
        const occupationLabel = ptCtx?.ui_controls?.occupation_label || 'Ocupación';

        const summary = `Mapeo demográfico y sociocultural completado.\n\nPara dar cumplimiento a la NOM-004 y sellar formalmente este bloque del expediente clínico, por favor verifique la exactitud de los datos registrados:\n\n` +
            `- 👤 **Nombre:** ${name}\n` +
            `- 📅 **Fecha Nacimiento:** ${dob}\n` +
            `- ⚥ **Sexo:** ${sex}\n` +
            `- 💼 **${occupationLabel}:** ${toTitleCase(occ)}\n` +
            `- 🆔 **CURP:** ${curp}\n` +
            `- 📞 **Teléfono:** ${formatPhoneNumber(tel)}\n` +
            `- 🙏 **Religión:** ${toTitleCase(rel)}\n` +
            (showMarital ? `- 💍 **Estado Civil:** ${marital}\n\n` : '\n') +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'strict_select',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_1_SUMMARY_CONFIRM');
    };

    const triggerPhase2Summary = (updatedPatientData) => {
        const e = updatedPatientData.profile?.emergencyContact || updatedPatientData.emergencia || {};
        const summary = `Red de apoyo primario registrada en sistema.\n\nComo protocolo de seguridad clínica, le solicito que verifique la exactitud de los datos de contacto de emergencia:\n\n` +
            `- 👤 **Nombre:** ${e.name || e.nombre || ''}\n` +
            `- 🤝 **Parentesco:** ${e.kin || e.parentesco || ''}\n` +
            `- 📞 **Teléfono:** ${formatPhoneNumber(e.phone || e.telefono || '')}\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'strict_select',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_2_SUMMARY_CONFIRM');
    };

    const triggerPhase3Summary = (updatedFase3State) => {
        const motiveOptionsMap = {
            "GOAL_EDUCATION": "Aprender a Comer / Educación Nutricional",
            "GOAL_ADDICTIONS": "Adicciones y Sustancias",
            "GOAL_GERIATRICS": "Geriatría",
            "GOAL_ALLERGIES": "Alergias Graves",
            "GOAL_WEIGHT_LOSS": "Pérdida de Peso",
            "GOAL_BARIATRIC": "Bariátrica / Quirúrgico",
            "GOAL_MENOPAUSE": "Climaterio y Menopausia",
            "GOAL_CLINICAL": "Control Clínico",
            "GOAL_PALLIATIVE": "Cuidados Paliativos",
            "GOAL_DISABILITY": "Discapacidad y Rehabilitación",
            "GOAL_PREGNANCY": "Embarazo y Lactancia",
            "GOAL_MUSCLE": "Deporte / Rendimiento",
            "GOAL_ONCOLOGY": "Oncología Nutricional",
            "GOAL_PEDIATRICS": "Pediatría (Crecimiento y Desarrollo)",
            "GOAL_LONGEVITY": "Longevidad",
            "GOAL_MENTAL_HEALTH": "Salud Mental",
            "GOAL_RENAL": "Salud Renal",
            "GOAL_IMMUNE": "Inmunodeficiencias"
        };

        const rawRoute = updatedFase3State?.primaryRoute || updatedFase3State?.goal_standard || 'No especificado';
        const primaryRoute = motiveOptionsMap[rawRoute] || rawRoute;
        
        const reasoning = updatedFase3State?.gem_reasoning || updatedFase3State?.patient_quote || updatedFase3State?.specific_ailment || 'No especificado';

        const summary = `Perfecto. Hemos terminado la fase de Motivo de Consulta. Verifique que este resumen sea correcto:\n\n` +
            `- 🎯 **Objetivo Principal:** ${primaryRoute}\n` +
            `- 🗣️ **Motivo reportado:** ${reasoning}\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_3_SUMMARY_CONFIRM');
    };

    const triggerPhase4Summary = (updatedPatientData, overrideMessages = null) => {
        const h = updatedPatientData.familyTree?.antecedentes || [];
        const conditions = h.map(a => `${a.patologia || a.diagnostico || 'Condición no especificada'} (${a.familiar || a.parentesco || 'Familiar no especificado'})`);

        let heredoStr = conditions.length > 0 ? conditions.join(', ') : "Ninguna reportada";

        const summary = `Perfecto. Hemos terminado la fase de Antecedentes Heredofamiliares. Verifique que este resumen sea correcto:\n\n` +
            `- 🧬 **A. Heredofamiliares:** ${heredoStr}\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const baseMsgs = overrideMessages || prev || [];
            const lastMsg = baseMsgs[baseMsgs.length - 1];
            if (lastMsg && lastMsg.content === summary) return baseMsgs;
            return [...baseMsgs, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_4_SUMMARY_CONFIRM');
    };

    const triggerPhase5Summary = () => {
        const summary = `Perfecto. Hemos terminado la fase de Estilo de Vida y Personales. Verifique que este resumen sea correcto:\n\n` +
            `- 🩺 **A. Personales:** Guardados en expediente.\n` +
            `- 🏃‍♂️ **Estilo de Vida:** Registrado exitosamente.\n\n` +
            `¿Es correcta esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_5_SUMMARY_CONFIRM');
    };

    const triggerPhase6Summary = (updatedPatientData) => {
        const pData = updatedPatientData || patientData || {};
        const medications = stripNegatedSentinels(pData.history?.medications || pData.pharmacology?.medications || []);
        const supplements = stripNegatedSentinels(pData.history?.supplements || pData.pharmacology?.supplements || []);

        const medsLines = medications.length > 0
            ? medications.map(m => {
                const name = (m.name || '').trim();
                const dose = (m.dose_frequency || '').trim();
                const duration = (m.duration || '').trim();
                const parenContent = [dose, duration].filter(Boolean).join(' - ');
                return `- 💊 **Medicamento:** ${name}${parenContent ? ` (${parenContent})` : ''}`;
            }).join('\n')
            : "- 💊 **Medicamentos:** Ninguno declarado";

        const suppsLines = supplements.length > 0
            ? supplements.map(s => {
                const rawName = (s.name || '').trim();
                const name = /^33\s*plus®?$/i.test(rawName)
                    ? '🔴 33Plus®'
                    : /^34\s*plus®?$/i.test(rawName)
                        ? '🟢 34Plus®'
                        : rawName
                            .replace(/\b33\s*plus®?\b/gi, '33Plus®')
                            .replace(/\b34\s*plus®?\b/gi, '34Plus®');
                const freq = (s.frequency || '').trim();
                const duration = (s.duration || '').trim();
                const parenContent = [freq, duration].filter(Boolean).join(' - ');
                return `- 🌿 **Suplemento:** ${name}${parenContent ? ` (${parenContent})` : ''}`;
            }).join('\n')
            : "- 🌿 **Suplementos:** Ninguno declarado";

        const summary = `Para dar estricto cumplimiento legal a la **NOM-004** y sellar formalmente este bloque de su expediente clínico, se ha estructurado la síntesis de su farmacología y suplementación:\n\n` +
            `${medsLines}\n` +
            `${suppsLines}\n\n` +
            `Por favor, verifique si este resumen de su consumo activo es correcto. ¿Es correcta esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'strict_select',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_6_SUMMARY_CONFIRM');
    };

    const triggerPhase7Summary = (updatedPatientData) => {
        const food = stripNegatedSentinels(updatedPatientData?.history?.allergies?.food || []);
        const drug = stripNegatedSentinels(updatedPatientData?.history?.allergies?.drug || []);

        const foodStr = food.length > 0
            ? food.map(a => `- 🦐 **Alimentarias:** ${(a.agent || '').trim()} (${(a.reaction || '').trim()})`).join('\n')
            : "- 🦐 **Alimentarias:** Ninguna declarada";

        const drugStr = drug.length > 0
            ? drug.map(a => `- 💊 **Farmacológicas:** ${(a.agent || '').trim()} (${(a.reaction || '').trim()})`).join('\n')
            : "- 💊 **Farmacológicas:** Ninguna declarada";

        const summary = `He consolidado sus vulnerabilidades inmunológicas en nuestro núcleo de datos. Para dar estricto cumplimiento legal a la **NOM-004** y sellar formalmente este bloque, se ha estructurado la síntesis de sus alergias:\n\n` +
            `${foodStr}\n` +
            `${drugStr}\n\n` +
            `Por favor, verifique este reporte clínico de sensibilidades activas. ¿Es correcta y verídica toda esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'strict_select',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_7_SUMMARY_CONFIRM');
    };

    const triggerPhase8Summary = (updatedPatientData) => {
        const symptoms = stripNegatedSentinels(updatedPatientData?.history?.digestive_symptoms || []);
        const freq = symptoms.length > 0 ? (updatedPatientData?.history?.digestive_frequency || "Ocasional") : "Ninguna";

        const ptCtx = updatedPatientData?.profile?.pediatric_profile;
        const patientAge = updatedPatientData?.profile?.age !== undefined ? Number(updatedPatientData.profile.age) : (updatedPatientData?.identificacion?.edad !== undefined ? Number(updatedPatientData.identificacion.edad) : 30);
        const isMinor = (ptCtx && ptCtx.is_minor) || patientAge < 18;
        const minorFallback = resolvePatientSex(updatedPatientData).isFemale ? "la menor" : "el menor";
        const pName = updatedPatientData?.profile?.first_name || updatedPatientData?.profile?.name || updatedPatientData?.identificacion?.nombre || minorFallback;
        const cleanName = pName !== "NOM" ? pName.split(' ')[0] : minorFallback;

        let symptomsStr = "";
        if (symptoms.length > 0) {
            symptomsStr = `- 🦠 **Síntomas Digestivos:** ${symptoms.join(', ')}\n- ⏱️ **Frecuencia:** ${freq}`;
        } else {
            symptomsStr = `- 🦠 **Síntomas Digestivos:** Ninguno (Sin molestias digestivas en los últimos 30 días)`;
        }

        const summary = isMinor
            ? `He consolidado el perfil de la salud digestiva de **${cleanName}** en nuestro núcleo de datos. Para sellar formalmente este bloque, se ha estructurado la síntesis de la evaluación:\n\n` +
              `${symptomsStr}\n\n` +
              `Por favor, verifique este reporte. ¿Es correcta y verídica toda esta información?`
            : `He consolidado el perfil de su salud digestiva en nuestro núcleo de datos. Para sellar formalmente este bloque, se ha estructurado la síntesis de su evaluación:\n\n` +
              `${symptomsStr}\n\n` +
              `Por favor, verifique este reporte. ¿Es correcta y verídica toda esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'strict_select',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_8_SUMMARY_CONFIRM');
    };

    const triggerPhase9Summary = (updatedPatientData) => {
        const isPreg = updatedPatientData?.physio?.is_pregnant === true;
        const pregWeeks = updatedPatientData?.physio?.preg_weeks || 0;
        const isLact = updatedPatientData?.physio?.is_lactating === true;
        const lactType = updatedPatientData?.physio?.lactation_type || "N/A";
        const babyMonths = updatedPatientData?.physio?.baby_age_months || 0;
        const lastPeriod = updatedPatientData?.physio?.last_menstruation_period;

        const ptCtx = updatedPatientData?.profile?.pediatric_profile;
        const patientAge = updatedPatientData?.profile?.age !== undefined ? Number(updatedPatientData.profile.age) : (updatedPatientData?.identificacion?.edad !== undefined ? Number(updatedPatientData.identificacion.edad) : 30);
        const isMinor = (ptCtx && ptCtx.is_minor) || patientAge < 18;
        const minorFallback = resolvePatientSex(updatedPatientData).isFemale ? "la menor" : "el menor";
        const pName = updatedPatientData?.profile?.first_name || updatedPatientData?.profile?.name || updatedPatientData?.identificacion?.nombre || minorFallback;
        const cleanName = pName !== "NOM" ? pName.split(' ')[0] : minorFallback;

        let pregStr = isPreg ? `🤰 **Embarazo:** Sí (${pregWeeks} semanas)` : `🤰 **Embarazo:** No`;
        let lactStr = isLact ? `🍼 **Lactancia:** Sí (${lactType}, Bebé de ${babyMonths} meses)` : `🍼 **Lactancia:** No`;
        let periodStr = !isPreg ? `\n- 🩸 **Menstruación:** ${lastPeriod || 'No especificado'}` : '';

        const physioStr = `- ${pregStr}\n- ${lactStr}${periodStr}`;

        const summary = isMinor
            ? `He consolidado el perfil del estado fisiológico de **${cleanName}** en nuestro expediente digital. Para dar cumplimiento a los lineamientos de la **NOM-004**, se estructuran sus detalles biológicos:\n\n` +
              `---\n` +
              `${physioStr}\n` +
              `---\n\n` +
              `Por favor, verifique si este reporte de estado fisiológico es correcto. ¿Es correcta y verídica toda esta información?`
            : `He registrado la valoración de estado fisiológico y gestacional en su expediente clínico digital. Para dar cumplimiento a los lineamientos de la **NOM-004**, se estructuran sus detalles biológicos:\n\n` +
              `---\n` +
              `${physioStr}\n` +
              `---\n\n` +
              `Por favor, verifique si este reporte de estado fisiológico es correcto. ¿Es correcta y verídica toda esta información?`;

        setMessages(prev => {
            const safePrev = prev || [];
            const lastMsg = safePrev[safePrev.length - 1];
            if (lastMsg && lastMsg.content === summary) return safePrev;
            return [...safePrev, {
                role: 'assistant',
                content: summary,
                avatar: tiloImg,
                inputType: 'buttons',
                options: [
                    { label: '✅ Sí, es correcta', value: 'yes' },
                    { label: '❌ No, quiero corregir algo', value: 'no' }
                ]
            }];
        });
        setCurrentPhase('PHASE_9_SUMMARY_CONFIRM');
    };

    /**
     * CORE ENGINE: Procesa la entrada del usuario y determina el siguiente paso.
     * @param {string} input - Texto ingresado por el usuario
     * @param {boolean} isInternalCall - Flag para evitar eco doble cuando viene de botones programáticos
     */
    const processUserInput = (input, isInternalCall = false) => {
        const text = input.trim();
        if (!text) return;

        let displayText = text;
        try {
            const payload = JSON.parse(text);
            if (payload.identity_extraction && payload.identity_extraction.birth_entity) {
                displayText = payload.identity_extraction.birth_entity.full_name;
            }
        } catch {
            // Not a JSON payload, fallback to raw text
        }

        // 1. Agregar el mensaje del usuario al chat visual solo si no es interno
        if (!isInternalCall) {
            setMessages(prev => [...prev, { role: 'user', content: displayText }]);
        }

        // Navegación Directa de Expediente Recuperado
        if (text === 'GO_TO_PHASE_20') {
            if (!patientData?.is_completed) {
                setCurrentPhase('PHASE_20_PORTAPAPELES');
            }
            setActiveTab('diagnosis');
            return;
        }
        if (text === 'GO_TO_PHASE_21') {
            setCurrentPhase('PHASE_21_CALENDARIO');
            setActiveTab('schedule');
            return;
        }
        if (text === 'RESTART_FROM_PHASE_0') {
            if (patientData?.is_completed) {
                console.warn('🔒 [NOM-004] Bloqueado reinicio accidental sobre expediente sellado.');
                return;
            }
            clearSession(null, { resetInDb: true });
            return;
        }

        // 2. Máquina de Estados basada en `currentPhase`
        setTimeout(async () => {
            switch (currentPhase) {
                // =============== FASE 0: AUTENTICACIÓN ===============
                case 'PHASE_0_AUTH':
                    // Mock Authentication Logic
                    if (/^\d+$/.test(text)) {
                        const result = await validateCitation(text);
                        if (!result || !result.isValid) {
                            const newAttempts = authAttempts + 1;
                            setAuthAttempts(newAttempts);

                            if (newAttempts >= 3) {
                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: "⛔ **Cierre de Sesión Normativo.**\n\n---\n\nSe ha superado el número máximo de intentos permitidos. Para proteger la integridad de los datos de la red de pacientes, el acceso ha sido suspendido temporalmente.\n\nPor favor, acuda a recepción para validar su identidad presencialmente.",
                                    avatar: tiloImg,
                                    inputType: 'none'
                                }]);
                                return;
                            }

                            setMessages(prev => [...prev, {
                                role: "assistant",
                                content: `${result?.message || "⛔ **Fallo de Sincronización.**\n\n---\n\nNo fue posible establecer conexión con la Red Institucional."}\n\nLe quedan **${3 - newAttempts} intento(s)**. Por favor, verifique el número e intente nuevamente:`,
                                avatar: tiloImg,
                                inputType: 'number'
                            }]);
                            return;
                        }

                        // 🎯 ACCESO VALIDADO: ESTUDIO_PENDIENTE
                        const citaData = result.patientData;
                        const formattedInfo = cleanServerInfo(citaData.info);

                        let extractedName = citaData.name || citaData.paciente || "";
                        if (formattedInfo.patientName) {
                            if (extractedName) {
                                const firstWord = extractedName.trim().split(' ')[0].toLowerCase();
                                if (formattedInfo.patientName.toLowerCase().includes(firstWord)) {
                                    extractedName = formattedInfo.patientName;
                                }
                            } else {
                                extractedName = formattedInfo.patientName;
                            }
                        }

                        extractedName = extractedName.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
                        const activeCitationStr = normalizeValidCitationId(citaData.cita || citaData.idCita || citaData.folio || text) || String(text).trim();
                        const masterUserId = normalizeValidUserId(citaData.userId ?? result.session_progress?.user_id, activeCitationStr);

                        // 🛡️ DETECCIÓN Y RESTAURACIÓN DE EXPEDIENTE COMPLETADO O EN CURSO (NOM-004)
                        if (result.session_progress && result.session_progress.patient_data_snapshot) {
                            let savedPatientData = null;
                            const rawSnap = result.session_progress.patient_data_snapshot;
                            if (typeof rawSnap === 'string') {
                                try {
                                    savedPatientData = JSON.parse(rawSnap);
                                } catch (e1) {
                                    try {
                                        savedPatientData = JSON.parse(rawSnap.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' '));
                                    } catch (e2) {
                                        console.error("Error parsing saved snapshot:", e2);
                                    }
                                }
                            } else {
                                savedPatientData = rawSnap;
                            }

                            if (savedPatientData && (savedPatientData.vitals || savedPatientData.scan_data || savedPatientData.profile?.name || savedPatientData.identificacion?.nombre)) {
                                console.log("📂 Restaurando expediente clínico desde SQLite:", activeCitationStr);

                                const sessionMeta = savedPatientData._session_meta || null;
                                if (masterUserId) {
                                    if (!savedPatientData.profile) savedPatientData.profile = {};
                                    savedPatientData.profile.usuarioId = masterUserId;
                                    if (!savedPatientData.identificacion) savedPatientData.identificacion = {};
                                    savedPatientData.identificacion.usuarioId = masterUserId;
                                }
                                if (activeCitationStr) {
                                    if (!savedPatientData.profile) savedPatientData.profile = {};
                                    savedPatientData.profile.citaId = activeCitationStr;
                                    savedPatientData.profile.citationId = activeCitationStr;
                                    if (!savedPatientData.identificacion) savedPatientData.identificacion = {};
                                    savedPatientData.identificacion.idCita = activeCitationStr;
                                    savedPatientData.identificacion.citaId = activeCitationStr;
                                }

                                const lastPhaseNum = Number(result.session_progress.last_active_phase || 0);
                                const isTrulyCompleted = Boolean(result.session_progress.is_completed) || lastPhaseNum >= 21;
                                if (isTrulyCompleted) {
                                    savedPatientData.is_completed = true;
                                }
                                const isCompletedOrDossier = isTrulyCompleted || lastPhaseNum >= 19 || Boolean(savedPatientData.clinical_dossier);
                                const savedBlockPhase = result.session_progress.last_active_block;
                                const restoredPhase = isTrulyCompleted
                                    ? 'PHASE_21_CALENDARIO'
                                    : isCompletedOrDossier
                                        ? 'PHASE_20_PORTAPAPELES'
                                        : (sessionMeta?.currentPhase || (savedBlockPhase && String(savedBlockPhase).startsWith('PHASE_') ? savedBlockPhase : `PHASE_${lastPhaseNum || 1}`));
                                const restoredTab = isCompletedOrDossier ? 'diagnosis' : (sessionMeta?.activeTab || 'profile');

                                const nextApiCtx = {
                                    rawName: extractedName || savedPatientData.profile?.name,
                                    userId: masterUserId || null,
                                    idCita: citaData.idCita || activeCitationStr,
                                    citaId: activeCitationStr,
                                    sucursal: formattedInfo.sede
                                };
                                hasSyncedRescueRef.current.verifiedHydration = true;
                                setApiContext(nextApiCtx);
                                setPatientData(savedPatientData);

                                if (sessionMeta?.fase3State) {
                                    setFase3State(sessionMeta.fase3State);
                                }

                                const titularName = formatText(extractedName || savedPatientData.profile?.name);
                                setAuthAttempts(0);
                                setCurrentPhase(restoredPhase);
                                setActiveTab(restoredTab);

                                const ageRestored = Number(savedPatientData?.identificacion?.edad ?? savedPatientData?.profile?.age ?? 30);
                                const isTutorRestored = Boolean((ageRestored > 0 && ageRestored < 13) || savedPatientData?.isLactante === true);
                                const restoredMessages = (!isCompletedOrDossier && Array.isArray(sessionMeta?.messages) && sessionMeta.messages.length > 0)
                                    ? sessionMeta.messages
                                    : [
                                        buildSessionRecoveryCardMessage({
                                            holderName: titularName,
                                            userId: masterUserId || '---',
                                            citationId: activeCitationStr,
                                            phaseNum: lastPhaseNum,
                                            isCompleted: isTrulyCompleted,
                                            isTutorMode: isTutorRestored,
                                            options: isCompletedOrDossier ? [
                                                { label: "Revisar Diagnóstico y Prescripción (Fase 20)", value: "GO_TO_PHASE_20", iconKey: "file_text" },
                                                { label: "Ver Calendario y Crononutrición (Fase 21)", value: "GO_TO_PHASE_21", iconKey: "calendar" },
                                                ...(!isTrulyCompleted
                                                    ? [{ label: "Reiniciar Estudio desde Fase 0", value: "RESTART_FROM_PHASE_0", iconKey: "rotate_ccw" }]
                                                    : [])
                                            ] : undefined
                                        })
                                    ];

                                setMessages(restoredMessages);

                                try {
                                    if (typeof window !== 'undefined' && window.localStorage) {
                                        const bundle = {
                                            patientData: savedPatientData,
                                            apiContext: nextApiCtx,
                                            currentPhase: restoredPhase,
                                            activeTab: restoredTab,
                                            messages: restoredMessages
                                        };
                                        if (masterUserId) {
                                            window.localStorage.setItem('tilo_active_user_id', masterUserId);
                                            window.localStorage.setItem('tilo_active_session_key', masterUserId);
                                            window.localStorage.setItem(`tilo_session_data_${masterUserId}`, JSON.stringify(bundle));
                                        }
                                        if (activeCitationStr) {
                                            if (!masterUserId) {
                                                window.localStorage.setItem('tilo_active_session_key', `cita_${activeCitationStr}`);
                                            }
                                            window.localStorage.setItem(`tilo_session_data_cita_${activeCitationStr}`, JSON.stringify(bundle));
                                        }
                                        window.localStorage.removeItem('tilo_session_data');
                                    }
                                } catch (lsErr) {
                                    console.warn("⚠️ Aviso al persistir bundle restaurado en localStorage:", lsErr);
                                }
                                return;
                            }
                        }

                        setApiContext({
                            rawName: extractedName,
                            userId: masterUserId || null,
                            idCita: citaData.idCita || activeCitationStr,
                            citaId: activeCitationStr,
                            sucursal: formattedInfo.sede
                        });

                        const cleanPatientTemplate = JSON.parse(JSON.stringify(INITIAL_PATIENT_DATA));
                        setPatientData({
                            ...cleanPatientTemplate,
                            profile: {
                                ...cleanPatientTemplate.profile,
                                name: extractedName,
                                first_name: extractedName.split(' ')[0],
                                citaId: activeCitationStr,
                                citationId: activeCitationStr,
                                usuarioId: masterUserId || ""
                            },
                            identificacion: {
                                ...cleanPatientTemplate.identificacion,
                                nombre: extractedName.split(' ')[0],
                                idCita: activeCitationStr,
                                citaId: activeCitationStr,
                                usuarioId: masterUserId || ""
                            }
                        });

                        const titularName = formatText(extractedName);
                        setAuthAttempts(0);

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Validación de Credencial Exitosa.\n\n---\n\n👤 **Titular:** ${titularName}\n📍 **Sede:** ${formattedInfo.sede}\n📅 **Agenda:** ${formattedInfo.display}\n\nPara iniciar la recolección clínica bajo los estándares de confidencialidad y seguridad:\n**¿Es usted el paciente titular mencionado arriba?**`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ SÍ, SOY YO', value: 'yes' },
                                { label: '❌ NO, ES UN ERROR', value: 'no' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_0_IDENTITY_CHECK');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Para iniciar la integración clínica, es mandatorio autenticar su sesión.\n\n---\n\nPor favor, introduzca un **Número de Cita** válido (formato numérico) para conectar con la Red Institucional:",
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                    }
                    break;

                case 'PHASE_0_IDENTITY_CHECK':
                    if (text === 'yes') {
                        const firstName = apiContext?.extractedFirst || apiContext?.rawName?.split(' ')[0] || "Paciente";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Identidad del titular confirmada y vinculada con éxito a nuestra red institucional. Este proceso activa formalmente los protocolos de protección de su información clínica bajo los estándares de la **NOM-004**.\n\n---\n\n**${formatText(firstName)}**, para habilitar la estructura de su expediente digital y blindar el tratamiento de sus **Datos Personales Sensibles**, por favor **lea** y **acepte** nuestro **Aviso de Privacidad** institucional:`,
                            avatar: tiloImg,
                            inputType: 'none' // Espera al modal de privacidad
                        }]);
                        setCurrentPhase('PHASE_0_PRIVACY');
                    } else if (text === 'no') {
                        // Limpia memoria
                        setApiContext({});
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Desvinculando el registro precargado para garantizar la seguridad de identidad del titular oficial.\n\n---\n\nPor favor, introduzca nuevamente su **Número de Cita** correcto:",
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        setCurrentPhase('PHASE_0_AUTH');
                    }
                    break;

                case 'PHASE_0_PRIVACY': {
                    // This is triggered by App.jsx when the modal is accepted
                    // CHECKPOINT 1: Guardado Inicial
                    console.log("💾 CHECKPOINT 1: Fase 0 Completada. Progreso guardado.");

                    // Remove ghost commas from the initial payload to ensure all extracted parts are clean
                    const rawNameStr = (apiContext && typeof apiContext.rawName === 'string') ? apiContext.rawName.replace(/,/g, '').replace(/\s+/g, ' ').trim() : "Paciente";
                    const safeName = rawNameStr || "Paciente";

                    const partsTemp = safeName.split(' ');
                    // Heurística básica: si tiene 3 o más palabras, asumimos que los primeros (hasta n-2) son nombres y los últimos 2 son apellidos
                    let safeFirstName = "Paciente";
                    let safeLastNamePat = "";
                    let safeLastNameMat = "";

                    if (partsTemp.length >= 3) {
                        safeLastNameMat = partsTemp.pop();
                        safeLastNamePat = partsTemp.pop();
                        safeFirstName = partsTemp.join(' ');
                    } else if (partsTemp.length === 2) {
                        safeLastNamePat = partsTemp[1];
                        safeFirstName = partsTemp[0];
                    } else if (partsTemp.length === 1) {
                        safeFirstName = partsTemp[0];
                    }

                    // Guardamos los valores extraídos en el apiContext temporal extra para las siguientes fases
                    setApiContext(prev => ({
                        ...prev,
                        extractedFirst: formatText(safeFirstName),
                        extractedPat: formatText(safeLastNamePat),
                        extractedMat: formatText(safeLastNameMat)
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `La integridad de su expediente clínico bajo la NOM-004 depende de la precisión ortográfica de sus datos. Le recordamos que su cita es personal e intransferible, por lo que este proceso es exclusivo para el pulido de su identidad registrada.\n\n---\n\nPor favor, valide si **${formatText(safeFirstName)}** corresponde exactamente a su **Nombre de Pila completo** (verifique acentos, espacios o nombres omitidos en caso de ser compuesto):`,
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: [
                            { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                            { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
                        ]
                    }]);
                    setActiveTab('profile'); // Sync UI Dashboard
                    setCurrentPhase('PHASE_1_PROFILE_NAME_CONFIRM');
                    break;
                }

                // =============== FASE 1: PERFIL ===============
                case 'PHASE_1_PROFILE_NAME_CONFIRM':
                    if (text === 'yes') {
                        const cleanFirstName = (apiContext.extractedFirst || "").replace(/,/g, '').trim();
                        const activeCit = String(apiContext.citaId || apiContext.idCita || '');
                        setPatientData(prev => ({
                            ...prev,
                            // Usamos el valor extraido y formateado de la apiContext (limpio de comas fantasmas)
                            profile: { ...prev.profile, first_name: cleanFirstName, name: apiContext.rawName, citationId: activeCit },
                            identificacion: { ...prev.identificacion, nombre: cleanFirstName, idCita: activeCit, citaId: activeCit } // Legacy Support
                        }));

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `🗣️ **Modo de precisión ortográfica activado.** Para garantizar la coherencia biográfica de su expediente clínico bajo la **NOM-004**, es vital que su primer apellido coincida exactamente con su documentación oficial.\n\n---\n\n**${cleanFirstName}**, ¿es **${apiContext.extractedPat}** su **Apellido Paterno** correcto?`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba estrictamente su **Nombre(s) de Pila** (sin apellidos):",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_NAME_MANUAL');
                    }
                    break;

                case 'PHASE_1_PROFILE_NAME_MANUAL': {
                    const parsedName = formatText(text).replace(/,/g, '').trim();
                    // Identity Lock Fix: Check against extracted first name, or fallback to the full raw name
                    const isMatch = fuzzyMatch(text, apiContext.extractedFirst) || fuzzyMatch(text, apiContext.rawName);

                    if (!isMatch) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⛔ **Bloqueo de Integridad Biométrica.**\nLa divergencia entre el nombre ingresado y el registro primario excede el umbral normativo.\n\n---\n\nPara garantizar la trazabilidad de su expediente, por favor escriba su **Nombre(s) de Pila** exactamente como figura en su identificación oficial:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        // Stay in same phase to retry
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, first_name: parsedName, name: apiContext.rawName },
                        identificacion: { ...prev.identificacion, nombre: parsedName } // Legacy Support
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `🗣️ **Modo de precisión ortográfica activado.** Para garantizar la coherencia biográfica de su expediente clínico bajo la **NOM-004**, es vital que su primer apellido coincida exactamente con su documentación oficial.\n\n---\n\n**${parsedName}**, ¿es **${apiContext.extractedPat}** su **Apellido Paterno** correcto?`,
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: [
                            { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                            { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT');
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_PAT': {
                    let finalLastNamePat = "";

                    if (text === 'yes') {
                        finalLastNamePat = apiContext.extractedPat;
                    } else if (text === 'no') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido. Por favor **escriba** su **Apellido Paterno** con la grafía y acentos correctos:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_PAT_MANUAL');
                        return;
                    } else {
                        // RECHAZO DE TEXTO LIBRE
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⛔ **Interacción Restringida.**\nPor protocolos de integridad de la NOM-004, este campo requiere una validación exacta.\n\n---\n\nPor favor, utilice las opciones táctiles presentadas para confirmar la procedencia de su apellido.",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' }
                            ]
                        }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, last_name_pat: finalLastNamePat },
                        identificacion: { ...prev.identificacion, apellidoPaterno: finalLastNamePat } // Legacy Support
                    }));

                    const matSurname = apiContext.extractedMat || "";
                    const hasValidMatSurname = matSurname.trim().length > 0 && !matSurname.includes("*");

                    if (hasValidMatSurname) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `El protocolo requiere validar la estructura completa de su nombre. Si usted cuenta con un segundo apellido en sus documentos oficiales, debemos registrarlo.\n\n---\n\n¿Es **${matSurname}** su **Apellido Materno** correcto?`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' },
                                { label: '➖ NO USO APELLIDO MATERNO', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `El protocolo requiere validar la estructura completa de su nombre. El sistema no me muestra un segundo apellido en su registro inicial.\n\n---\n\nSi usted cuenta con un **Apellido Materno** oficial, por favor escríbalo a continuación:`,
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '➖ NO USO APELLIDO MATERNO', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_PAT_MANUAL': {
                    const parsedLastName = formatText(text);
                    // Identity Lock Fix: Check against extracted pat name, or fallback to the full raw name
                    const isMatch = fuzzyMatch(text, apiContext.extractedPat) || fuzzyMatch(text, apiContext.rawName);

                    if (!isMatch) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⛔ **Bloqueo de Identidad Oficial.**\nLa modificación de raíz de la titularidad vulnera los protocolos de seguridad. Este canal está habilitado exclusivamente para la corrección ortográfica de sus apellidos.\n\n---\n\nPor rigor clínico, escriba nuevamente su **Apellido Paterno** respetando la concordancia fonética del registro base:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, last_name_pat: parsedLastName },
                        identificacion: { ...prev.identificacion, apellidoPaterno: parsedLastName }
                    }));

                    const matSurname = apiContext.extractedMat || "";
                    const hasValidMatSurname = matSurname.trim().length > 0 && !matSurname.includes("*");

                    if (hasValidMatSurname) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `El protocolo requiere validar la estructura completa de su nombre. Si usted cuenta con un segundo apellido en sus documentos oficiales, debemos registrarlo.\n\n---\n\n¿Es **${matSurname}** su **Apellido Materno** correcto?`,
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ SÍ, ES CORRECTO', value: 'yes' },
                                { label: '⌨️ EDITAR ORTOGRAFÍA', value: 'no' },
                                { label: '➖ NO USO APELLIDO MATERNO', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `El protocolo requiere validar la estructura completa de su nombre. El sistema no me muestra un segundo apellido en su registro inicial.\n\n---\n\nSi usted cuenta con un **Apellido Materno** oficial, por favor escríbalo a continuación:`,
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '➖ NO USO APELLIDO MATERNO', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_MAT': {
                    let finalLastNameMat = "";

                    if (text === 'yes') {
                        finalLastNameMat = apiContext.extractedMat;
                    } else if (text === 'CONFIRM_MAT_NONE') {
                        setPatientData(prev => {
                            const newProfile = { ...prev.profile, last_name_mat: null };
                            newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat}`.trim().toUpperCase();

                            const newIdentificacion = {
                                ...prev.identificacion,
                                apellidoMaterno: null
                            };

                            return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                        });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ **Perfil biográfico estructurado y blindado** con éxito (Sin Apellido Materno). Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n---\n\n**${patientData.profile.first_name || 'Paciente'}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato numérico, por ejemplo: 12):`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);

                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        break;
                    } else if (text === 'no') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba su **Apellido Materno** correcto:",
                            avatar: tiloImg,
                            inputType: 'text',
                            options: [
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL');
                        return;
                    } else {
                        // RECHAZO DE TEXTO LIBRE
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⛔ **Interacción Restringida.**\nPor protocolos de integridad de la NOM-004, este campo requiere una validación exacta.\n\n---\n\nPor favor, utilice las opciones táctiles presentadas para confirmar la procedencia de su apellido materno.",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: '✅ Sí', value: 'yes' },
                                { label: '❌ No, corregir', value: 'no' },
                                { label: '➖ No uso Apellido Materno', value: 'CONFIRM_MAT_NONE' }
                            ]
                        }]);
                        return;
                    }

                    // Proceeding after confirmation
                    setPatientData(prev => {
                        const newProfile = { ...prev.profile, last_name_mat: finalLastNameMat };
                        newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat} ${newProfile.last_name_mat}`.trim();

                        const newIdentificacion = {
                            ...prev.identificacion,
                            apellidoMaterno: finalLastNameMat
                        };

                        return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                    });

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ **Perfil biográfico estructurado y blindado** con éxito. Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n---\n\n**${patientData.profile.first_name || 'Paciente'}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato numérico, por ejemplo: 12):`,
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);

                    setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                    break;
                }

                case 'PHASE_1_PROFILE_LAST_NAME_MAT_MANUAL': {
                    if (text === 'CONFIRM_MAT_NONE') {
                        // Bypassing maternal surname logic
                        setPatientData(prev => {
                            const newProfile = { ...prev.profile, last_name_mat: null };
                            newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat}`.trim().toUpperCase();

                            const newIdentificacion = {
                                ...prev.identificacion,
                                apellidoMaterno: null
                            };

                            return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                        });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ **Perfil biográfico estructurado y blindado** con éxito (Sin Apellido Materno). Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n---\n\n**${patientData.profile.first_name || 'Paciente'}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato numérico, por ejemplo: 12):`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);

                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        break;
                    }

                    const parsedLastNameMat = formatText(text);

                    // Solo actualizamos el nombre completo de forma estructurada
                    setPatientData(prev => {
                        const newProfile = { ...prev.profile, last_name_mat: parsedLastNameMat };
                        newProfile.name = `${newProfile.first_name} ${newProfile.last_name_pat} ${newProfile.last_name_mat}`.trim().toUpperCase();

                        const newIdentificacion = {
                            ...prev.identificacion,
                            apellidoMaterno: parsedLastNameMat
                        };

                        return { ...prev, profile: newProfile, identificacion: newIdentificacion };
                    });

                    // C. Siguiente pregunta de Tilo (Q4)
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ **Perfil biográfico estructurado y blindado** con éxito. Una vez fijada su identidad, el siguiente protocolo es la calibración de su **cronología biológica**, dato indispensable para el cálculo preciso de sus indicadores metabólicos y rangos de referencia clínica.\n\n---\n\n**${patientData.profile.first_name || 'Paciente'}**, por favor indique únicamente el **DÍA** de su nacimiento (utilice el formato numérico, por ejemplo: 12):`,
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);

                    // D. Avanzar estado
                    setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_DAY': {
                    const day = parseInt(text, 10);
                    if (isNaN(day) || day < 1 || day > 31) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Dato de Precisión Biológica Requerido.**\nEl valor ingresado no corresponde a un día de calendario válido.\n\n---\n\nPor favor ingrese el **DÍA** numérico exacto de su nacimiento (ej. 12):", avatar: tiloImg }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, dobDay: text.padStart(2, '0') }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "✅ **Dato fijado.**\n\n---\n\nPara continuar con su cronología biológica, por favor indique el **MES** de su nacimiento (ej. Mayo):",
                        avatar: tiloImg,
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_DOB_MONTH');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_MONTH': {
                    const rawMonth = text.trim().toLowerCase();
                    const months = {
                        'enero': '01', 'ene': '01', '01': '01', '1': '01',
                        'febrero': '02', 'feb': '02', '02': '02', '2': '02',
                        'marzo': '03', 'mar': '03', '03': '03', '3': '03',
                        'abril': '04', 'abr': '04', '04': '04', '4': '04',
                        'mayo': '05', 'may': '05', '05': '05', '5': '05',
                        'junio': '06', 'jun': '06', '06': '06', '6': '06',
                        'julio': '07', 'jul': '07', '07': '07', '7': '07',
                        'agosto': '08', 'ago': '08', '08': '08', '8': '08',
                        'septiembre': '09', 'sep': '09', '09': '09', '9': '09',
                        'octubre': '10', 'oct': '10', '10': '10',
                        'noviembre': '11', 'nov': '11', '11': '11',
                        'diciembre': '12', 'dic': '12', '12': '12'
                    };
                    const monthCode = months[rawMonth];
                    if (!monthCode) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Dato de Precisión Biológica Requerido.**\nEl sistema no logró clasificar la entrada.\n\n---\n\nPor favor, escriba el nombre completo del **MES** (ej: Enero) o su designación numérica exacta:", avatar: tiloImg }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, dobMonth: monthCode }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "✅ **Dato fijado.**\n\n---\n\nPara finalizar la calibración de su edad metabólica, por favor indique su **AÑO** de nacimiento a 4 dígitos (ej. 1990):",
                        avatar: tiloImg,
                        inputType: 'number'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_DOB_YEAR');
                    break;
                }

                case 'PHASE_1_PROFILE_DOB_YEAR': {
                    const year = parseInt(text, 10);
                    const currentYear = new Date().getFullYear();
                    if (isNaN(year) || year < 1920 || year > currentYear) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Dato de Precisión Biológica Requerido.**\nEl año ingresado presenta un desfase cronológico incongruente.\n\n---\n\nPor favor, indique su **AÑO** real de nacimiento a 4 dígitos (ej. 1990):", avatar: tiloImg }]);
                        return;
                    }

                    const dobDay = patientData.profile.dobDay;
                    const dobMonth = patientData.profile.dobMonth;
                    const d = parseInt(dobDay, 10);
                    const m = parseInt(dobMonth, 10);

                    const checkDate = new Date(year, m - 1, d);
                    if (checkDate.getFullYear() !== year || checkDate.getMonth() !== (m - 1) || checkDate.getDate() !== d) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Discrepancia de Calendario Detectada.**\nLa fecha biológica ingresada es matemáticamente inexistente. El protocolo de cronología se ha reiniciado por motivos de integridad de expediente.\n\n---\n\nPor favor, indique nuevamente el **DÍA** numérico de su nacimiento:", avatar: tiloImg, inputType: 'number' }]);
                        setCurrentPhase('PHASE_1_PROFILE_DOB_DAY');
                        return;
                    }

                    const fullDate = `${dobDay}/${dobMonth}/${year}`;
                    const today = new Date();
                    let age = today.getFullYear() - checkDate.getFullYear();
                    const mDiff = today.getMonth() - checkDate.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && today.getDate() < checkDate.getDate())) {
                        age--;
                    }

                    // Compute pediatric context
                    const pediatricContext = buildPediatricContext(fullDate);

                    // V18.0: Calculate baby_age_months for dashboard rendering
                    let baby_age_months = null;
                    if (age === 0) {
                        let yearsDiff = today.getFullYear() - checkDate.getFullYear();
                        let monthsDiff = today.getMonth() - checkDate.getMonth();
                        if (today.getDate() < checkDate.getDate()) {
                            monthsDiff--;
                        }
                        if (monthsDiff < 0) {
                            yearsDiff--;
                            monthsDiff += 12;
                        }
                        baby_age_months = (yearsDiff * 12) + monthsDiff;
                    }

                    // --- TONE OF VOICE ENGINE ---
                    // Asignación de Personalidad Dinámica al Motor (Cortex)
                    let interaction_mode = "ADULT_MODE";
                    let system_prompt_addon = "";
                    const preResolvedSex = resolvePatientSex(patientData);
                    const preIsFem = preResolvedSex.isFemale;
                    const firstName = patientData.profile.first_name || apiContext.extractedFirst || (preIsFem ? "la paciente" : "el paciente");

                    if (age < 12) {
                        interaction_mode = "PEDIATRIC_MODE";
                        system_prompt_addon = ` Persona menor de edad (${age} años, nombre: ${firstName}). El usuario interactuando con la pantalla es su representante o tutor legal. Dirígete al tutor de 'USTED' de forma respetuosa y refiérete a ${firstName} por su nombre en tercera persona. Prohibido usar barras o/a o paréntesis (a).`;
                    } else if (age >= 12 && age < 18) {
                        interaction_mode = "TEENAGER_MODE";
                        system_prompt_addon = ` Persona adolescente de ${age} años (${firstName}). Dirígete directamente de 'USTED' usando su nombre propio, con tono empático y autoridad clínica, concordando adjetivos con su sexo biológico sin barras o/a ni (a).`;
                    } else if (age >= 18 && age < 65) {
                        interaction_mode = "ADULT_MODE";
                        system_prompt_addon = ` Persona adulta de ${age} años (${firstName}). Dirígete directamente de 'USTED' usando su nombre propio, con tono profesional, empático y concordancia estricta de sexo biológico sin barras o/a ni (a).`;
                    } else {
                        interaction_mode = "GERIATRIC_MODE";
                        system_prompt_addon = ` Persona adulta mayor de ${age} años (${firstName}). Dirígete directamente de 'USTED' usando su nombre propio, con autoridad médica empática y concordancia estricta de sexo biológico sin barras o/a ni (a).`;
                    }

                    // Remove temporary variables to keep Data Lake clean
                    setPatientData(prev => {
                        const newProfile = {
                            ...prev.profile,
                            birthdate: fullDate,
                            age: age,
                            baby_age_months: baby_age_months,
                            pediatric_profile: pediatricContext
                        };
                        delete newProfile.dobDay;
                        delete newProfile.dobMonth;

                        const newIdentificacion = {
                            ...prev.identificacion,
                            fechanac: fullDate,
                            edad: age,
                            baby_age_months: baby_age_months
                        };

                        return {
                            ...prev,
                            profile: newProfile,
                            identificacion: newIdentificacion,
                            session_context: {
                                calculated_age: age,
                                interaction_mode: interaction_mode,
                                system_prompt_addon: system_prompt_addon
                            }
                        };
                    });


                    let sexMsg = "";
                    if (age < 18) {
                        sexMsg = `Perfil cronológico consolidado. El sistema ha detectado un usuario en etapa de crecimiento activo y ha habilitado el **Protocolo Pediátrico de Nutrición Celular** para optimizar su desarrollo metabólico.\n\nComo tutor responsable de la cuenta, iniciemos la evaluación biológica: ¿Cuál es el **sexo biológico** de **${firstName}**?`;
                    } else {
                        sexMsg = `Perfil cronológico consolidado. El sistema ha calibrado su edad cronológica base en **${age} años**.\n\nPara configurar su arquitectura biológica con precisión, iniciemos la evaluación: ¿Cuál es su **sexo biológico**?`;
                    }

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: sexMsg,
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: [
                            { label: "Masculino", value: "Masculino" },
                            { label: "Femenino", value: "Femenino" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_SEX');
                    break;
                }

                case 'PHASE_1_PROFILE_SEX': {
                    let sex = text;
                    if (['mujer', 'femenino', 'f', 'la paciente'].includes(sex.toLowerCase())) sex = "Femenino";
                    if (['hombre', 'masculino', 'm', 'el paciente', 'varon'].includes(sex.toLowerCase())) sex = "Masculino";

                    if (sex === "Masculino" || sex === "Femenino") {
                        const isFemale = sex === "Femenino";
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, sex: sex },
                            identificacion: { ...prev.identificacion, sexo: sex } // Sincronización Legacy
                        }));

                        const age = patientData.profile?.age || 0;
                        const pName = patientData.profile?.first_name || apiContext?.extractedFirst || (isFemale ? "la paciente" : "el paciente");
                        
                        let occupationPrompt = "";
                        let options = null;

                        if (age >= 0 && age <= 4) {
                            // Cohorte 1: Lactantes y Primera Infancia (0 a 4 años)
                            occupationPrompt = `Para calibrar el requerimiento calórico de crecimiento de **${pName}**, indique el entorno principal de cuidado ${isFemale ? 'de la menor' : 'del menor'}:`;
                            options = [
                                { label: "🏠 Cuidados en Casa", value: "casa" },
                                { label: "🏫 Guardería / Estancia Infantil", value: "guarderia" }
                            ];
                        } else if (age >= 5 && age <= 11) {
                            // Cohorte 2: Edad Escolar (5 a 11 años)
                            occupationPrompt = `Para registrar el contexto escolar y evaluar la demanda cognitiva de **${pName}**, por favor confirme su ocupación:`;
                            options = [
                                { label: "📚 Estudiante (Preescolar / Primaria)", value: "estudiante" }
                            ];
                        } else if (age >= 12 && age <= 17) {
                            // Cohorte 3: Adolescencia (12 a 17 años)
                            occupationPrompt = `Para registrar el contexto académico y estimar la demanda cognitiva diaria de **${pName}**: ¿Cuál es su ocupación actual?`;
                            options = [
                                { label: "🏫 Estudiante (Secundaria / Bachillerato)", value: "estudiante" },
                                { label: "💼 Trabajo Temprano / Oficio", value: "trabajo_temprano" }
                            ];
                        } else if (age >= 18 && age <= 64) {
                            // Cohorte 4: Edad Productiva (18 a 64 años)
                            occupationPrompt = `✅ **Identidad biológica** estructurada con éxito. Para perfilar el gasto energético base en su expediente clínico: ¿Cuál de las siguientes opciones describe mejor la biomecánica de su actividad diaria principal?`;
                            options = [
                                { label: "💻 Trabajo de Oficina / Escritorio", value: "oficina" },
                                { label: "🎓 Estudiante Universitario / Académico", value: "universitario" },
                                { label: "🚶 Trabajo de Pie / Mostrador / Docencia", value: "de_pie" },
                                { label: "🏠 Trabajo en Hogar / Cuidados", value: "hogar" },
                                { label: "🏗️ Trabajo Físico Pesado / Carga", value: "carga" }
                            ];
                        } else {
                            // Cohorte 5: Geriatría (65+ años)
                            occupationPrompt = `Identidad biológica confirmada.\n\nPara perfilar el gasto energético base en su expediente clínico: ¿Se encuentra actualmente **${isFemale ? 'jubilada' : 'jubilado'}**, **${isFemale ? 'pensionada' : 'pensionado'}** o mantiene alguna **ocupación activa**?`;
                            options = [
                                { label: isFemale ? "🌴 Jubilada / Pensionada" : "🌴 Jubilado / Pensionado", value: "jubilado" },
                                { label: "💼 Aún laborando", value: "activo" }
                            ];
                        }

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: occupationPrompt,
                            avatar: tiloImg,
                            inputType: options ? 'buttons' : 'text',
                            options: options || undefined
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_JOB');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Fallo de Integridad.**\n\n---\n\nEl dato proporcionado no es reconocido por el sistema. Por favor, seleccione una opción válida del menú para continuar con el protocolo.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_JOB': {
                    const age = patientData.profile?.age || 0;
                    const pName = patientData.profile?.first_name || apiContext?.extractedFirst || "el paciente";
                    const selection = text.toLowerCase().trim();
                    
                    let needsDrilldown = false;
                    let nextPrompt = "";
                    let nextOptions = null;
                    
                    if (age >= 0 && age <= 4) {
                        needsDrilldown = true;
                        setApiContext(prev => ({ ...prev, tempJobPrimary: selection }));
                        nextPrompt = `¿Cómo describiría el nivel de actividad motriz de **${pName}** actualmente?`;
                        nextOptions = [
                            { label: "🚼 Etapa de Cuna / Gateo", value: "cuna" },
                            { label: "🏃‍♂️ Caminador / Muy Activo", value: "caminador" }
                        ];
                    } else if (age >= 5 && age <= 11) {
                        needsDrilldown = true;
                        setApiContext(prev => ({ ...prev, tempJobPrimary: "estudiante" }));
                        nextPrompt = `Fuera del horario escolar, ¿cuál es el nivel de actividad física de **${pName}**?`;
                        nextOptions = [
                            { label: "⚽ Deporte formal / Juego activo diario", value: "deporte" },
                            { label: "🎮 Mayormente sedentario / Pantallas", value: "sedentario" }
                        ];
                    } else if (age >= 12 && age <= 17) {
                        if (selection === 'estudiante') {
                            needsDrilldown = true;
                            setApiContext(prev => ({ ...prev, tempJobPrimary: "estudiante" }));
                            nextPrompt = `¿Realiza **${pName}** alguna disciplina deportiva regular?`;
                            nextOptions = [
                                { label: "🏅 Atleta / Deporte Competitivo", value: "atleta" },
                                { label: "🏃 Actividad Recreativa (1-3 días)", value: "recreativo" },
                                { label: "🪑 Nivel Sedentario", value: "sedentario" }
                            ];
                        } else {
                            // Trabajo temprano / Oficio
                            const desc = "Trabajo Temprano / Oficio";
                            const pal = 1.37;
                            setPatientData(prev => ({
                                ...prev,
                                profile: { ...prev.profile, occupation: desc, ocupacion_descriptor: desc, factor_pal: pal },
                                identificacion: { ...prev.identificacion, ocupacion: desc, ocupacion_descriptor: desc, factor_pal: pal }
                            }));
                        }
                    } else if (age >= 18 && age <= 64) {
                        // Edad Productiva (18 a 64 años) - Guardado directo sin drill-down
                        let desc = "Oficina (Sedentario)";
                        let pal = 1.20;
                        if (selection === 'universitario') {
                            desc = "Estudiante Universitario (Sedentario)";
                            pal = 1.20;
                        } else if (selection === 'de_pie') {
                            desc = "De Pie (Ligeramente Activo)";
                            pal = 1.37;
                        } else if (selection === 'hogar') {
                            desc = "Hogar (Moderadamente Activo)";
                            pal = 1.55;
                        } else if (selection === 'carga') {
                            desc = "Físico Pesado (Muy Activo)";
                            pal = 1.72;
                        }
                        
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, occupation: desc, ocupacion_descriptor: desc, factor_pal: pal },
                            identificacion: { ...prev.identificacion, ocupacion: desc, ocupacion_descriptor: desc, factor_pal: pal }
                        }));
                    } else {
                        // Geriátrico (65+)
                        if (selection === 'jubilado') {
                            needsDrilldown = true;
                            setApiContext(prev => ({ ...prev, tempJobPrimary: "jubilado" }));
                            nextPrompt = `Para estimar su requerimiento calórico actual, ¿cómo describiría su movilidad en un día normal?`;
                            nextOptions = [
                                { label: "🚶 Independiente y Activo (Camino/Hago quehacer)", value: "activo" },
                                { label: "🪑 Mayormente Sedentario (Poco movimiento)", value: "sedentario" },
                                { label: "🛏️ Movilidad Reducida / Asistida", value: "reducida" }
                            ];
                        } else {
                            // Aún laborando
                            const desc = "Aún laborando (Activo)";
                            const pal = 1.37;
                            setPatientData(prev => ({
                                ...prev,
                                profile: { ...prev.profile, occupation: desc, ocupacion_descriptor: desc, factor_pal: pal },
                                identificacion: { ...prev.identificacion, ocupacion: desc, ocupacion_descriptor: desc, factor_pal: pal }
                            }));
                        }
                    }
 
                    if (needsDrilldown) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: nextPrompt,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: nextOptions
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_JOB_DRILLDOWN');
                    } else {
                        // Avanzar a CURP
                        const isMinor = age < 18;
                        const firstName = pName.split(' ')[0];
                        let curpPromptMsg = "";
                        if (isMinor) {
                            curpPromptMsg = `Mapeo sociocultural completado y encriptado. Para proceder con la apertura oficial del expediente pediátrico conforme a la normativa vigente de salud.\n\nPor favor, introduzca la **Clave Única de Registro de Población (CURP)** de **${firstName}** (si no la tiene a la mano, puede seleccionarla abajo).`;
                        } else {
                            curpPromptMsg = `Mapeo sociocultural completado y encriptado. Para proceder con la apertura oficial del expediente clínico conforme a la normativa vigente de salud.\n\nPor favor, introduzca su **Clave Única de Registro de Población (CURP)** (si no la tiene a la mano, puede seleccionarla abajo).`;
                        }
 
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: curpPromptMsg,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "Manual (Tipear)", value: "Manual" },
                                { label: "Búscala por mí (Asistencia)", value: "Buscala" },
                                { label: "Soy Extranjero", value: "Extranjero" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_GATE');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_JOB_DRILLDOWN': {
                    const age = patientData.profile?.age || 0;
                    const pName = patientData.profile?.first_name || apiContext?.extractedFirst || "el paciente";
                    const selection = text.toLowerCase().trim();
                    const primary = apiContext.tempJobPrimary;
                    
                    let finalDesc = "";
                    let finalPal = 1.20;
                    
                    if (age >= 0 && age <= 4) {
                        // Cohorte 1: Lactantes
                        const primText = primary === 'casa' ? "Cuidados en Casa" : "Guardería";
                        if (selection === 'cuna') {
                            finalDesc = `${primText} (Cuna / Gateo)`;
                            finalPal = primary === 'casa' ? 1.00 : 1.10;
                        } else {
                            finalDesc = `${primText} (Caminador / Activo)`;
                            finalPal = primary === 'casa' ? 1.20 : 1.25;
                        }
                    } else if (age >= 5 && age <= 11) {
                        // Cohorte 2: Escolar
                        if (selection === 'deporte') {
                            finalDesc = "Estudiante (Escolar) - Deporte formal";
                            finalPal = 1.55;
                        } else {
                            finalDesc = "Estudiante (Escolar) - Sedentario";
                            finalPal = 1.20;
                        }
                    } else if (age >= 12 && age <= 17) {
                        // Cohorte 3: Adolescente Estudiante
                        if (selection === 'atleta') {
                            finalDesc = "Estudiante (Secundaria) - Atleta Competitivo";
                            finalPal = 1.72;
                        } else if (selection === 'recreativo') {
                            finalDesc = "Estudiante (Secundaria) - Recreativo";
                            finalPal = 1.37;
                        } else {
                            finalDesc = "Estudiante (Secundaria) - Sedentario";
                            finalPal = 1.20;
                        }
                    } else if (age >= 65) {
                        // Cohorte 5: Geriátrico Jubilado (concordancia biológica NOM-004)
                        const isFemJob = resolvePatientSex(patientData).isFemale;
                        const jubLabel = isFemJob ? "Jubilada" : "Jubilado";
                        if (selection === 'activo') {
                            finalDesc = `${jubLabel} (Independiente y ${isFemJob ? 'Activa' : 'Activo'})`;
                            finalPal = 1.37;
                        } else if (selection === 'sedentario') {
                            finalDesc = `${jubLabel} (Mayormente ${isFemJob ? 'Sedentaria' : 'Sedentario'})`;
                            finalPal = 1.20;
                        } else {
                            finalDesc = `${jubLabel} (Movilidad Reducida / Asistida)`;
                            finalPal = 1.00;
                        }
                    }
                    
                    // Guardar los datos calculados
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, occupation: finalDesc, ocupacion_descriptor: finalDesc, factor_pal: finalPal },
                        identificacion: { ...prev.identificacion, ocupacion: finalDesc, ocupacion_descriptor: finalDesc, factor_pal: finalPal }
                    }));
                    
                    // Limpiar el tempJobPrimary de la memoria del contexto
                    setApiContext(prev => {
                        const copy = { ...prev };
                        delete copy.tempJobPrimary;
                        return copy;
                    });
                    
                    // Avanzar a CURP
                    const isMinor = age < 18;
                    const firstName = pName.split(' ')[0];
                    let curpPromptMsg = "";
                    if (isMinor) {
                        curpPromptMsg = `Mapeo sociocultural completado y encriptado. Para proceder con la apertura oficial del expediente pediátrico conforme a la normativa vigente de salud.\n\nPor favor, introduzca la **Clave Única de Registro de Población (CURP)** de **${firstName}** (si no la tiene a la mano, puede seleccionarla abajo).`;
                    } else {
                        curpPromptMsg = `Mapeo sociocultural completado y encriptado. Para proceder con la apertura oficial del expediente clínico conforme a la normativa vigente de salud.\n\nPor favor, introduzca su **Clave Única de Registro de Población (CURP)** (si no la tiene a la mano, puede seleccionarla abajo).`;
                    }
                    
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: curpPromptMsg,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "Manual (Tipear)", value: "Manual" },
                            { label: "Búscala por mí (Asistencia)", value: "Buscala" },
                            { label: "Soy Extranjero", value: "Extranjero" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_CURP_GATE');
                    break;
                }

                // Q9: CURP GATE (Trifurcation)
                case 'PHASE_1_PROFILE_CURP_GATE': {
                    const age = patientData.profile?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    
                    if (text === 'Manual') {
                        let msg = "";
                        if (isMinor) msg = `Sincronización automática declinada. Para asegurar la identificación legal del paciente pediátrico conforme a la **NOM-004**.\n\nPor favor, introduzca manualmente la **CURP** de **${firstName}** (18 caracteres alfanuméricos):`;
                        else msg = `Sincronización automática declinada. Para asegurar su identificación legal conforme a la normativa oficial de salud (**NOM-004**).\n\nPor favor, introduzca manualmente su **CURP** (18 caracteres alfanuméricos):`;
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, inputType: 'text' }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_MANUAL');
                    } else if (text === 'Extranjero') {
                        let msg = "";
                        if (isMinor) msg = `Protocolo de extranjería activado. Para asegurar la identificación legal internacional del paciente pediátrico en el sistema de salud.\n\nPor favor, introduzca el **ID de Pasaporte** o **Documento Oficial** del país de origen de **${firstName}**:`;
                        else msg = `Protocolo de extranjería activado. Para asegurar su identificación legal internacional en el sistema de salud.\n\nPor favor, introduzca su **ID de Pasaporte** o **Documento Oficial** de su país de origen:`;
                        
                        setPatientData(prev => ({
                            ...prev,
                            profile: {
                                ...prev.profile,
                                nationality_type: 'FOREIGN'
                            },
                            identificacion: {
                                ...prev.identificacion,
                                nationality_type: 'FOREIGN'
                            }
                        }));

                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, inputType: 'text' }]);
                        setCurrentPhase('PHASE_1_PROFILE_ID_EXTRANJERO');
                    } else if (text === 'Buscala') {
                        let msg = "";
                        if (isMinor) {
                            msg = `Motor Concierge activado para búsqueda oficial en RENAPO. Para localizar el registro y sincronizarlo con el expediente de **${firstName}**, es necesario identificar la entidad federativa de su origen.\n\nPor favor, seleccione en el listado inferior el Estado de la República en el que nació **${firstName}**.`;
                        } else {
                            msg = `Motor Concierge activado para búsqueda oficial en RENAPO. Para localizar su registro y sincronizarlo con su expediente clínico, es necesario identificar la entidad federativa de su origen.\n\nPor favor, seleccione en el listado inferior el Estado de la República en el que nació.`;
                        }
                        setMessages(prev => [...prev, { role: 'assistant', content: msg, avatar: tiloImg, inputType: 'StateSelector' }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_ASSIST');
                    } else {
                        // Trató de escribirla directo en el prompt de botones
                        const isCurp = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/.test(text.toUpperCase());
                        if (isCurp) {
                            setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: text.toUpperCase() } }));
                            
                            let phoneMsg = "";
                            if (isMinor) phoneMsg = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica del paciente.\n\nPor favor, indique el número de teléfono celular a 10 dígitos del tutor responsable de **${firstName}**:`;
                            else phoneMsg = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica.\n\nPor favor, indique su número de teléfono celular a 10 dígitos:`;

                            setMessages(prev => [...prev, { role: 'assistant', content: phoneMsg, avatar: tiloImg, inputType: 'tel' }]);
                            setCurrentPhase('PHASE_1_PROFILE_PHONE');
                        } else {
                            setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Fallo de Formato.**\n\n---\n\nEl dato no cumple con la estructura requerida. Por favor, elija una opción válida o verifique la captura.", avatar: tiloImg }]);
                        }
                    }
                    break;
                }


                case 'PHASE_1_PROFILE_CURP_ASSIST': {
                    let stateCode = '';
                    try {
                        const payload = JSON.parse(text);
                        if (payload.identity_extraction && payload.identity_extraction.birth_entity) {
                            stateCode = payload.identity_extraction.birth_entity.renapo_code;
                        }
                    } catch {
                        // ignore JSON error
                    }
                    if (!stateCode) {
                        stateCode = text.substring(0, 2).toUpperCase(); // Simplification: in a real app, mapping table is used
                    }

                    const p = patientData.profile;
                    const age = p?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (p?.first_name || p?.name || "el paciente").split(' ')[0];
                    const calculatedCurp = calculateCurp(p.first_name, p.last_name_pat, p.last_name_mat, p.birthdate, p.sex, stateCode);

                    setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: calculatedCurp } }));
                    
                    let curpMsg = "";
                    if (isMinor) {
                        curpMsg = `Análisis demográfico completado. El motor de integración ha proyectado la siguiente Clave Única de Registro de Población (CURP) para **${firstName}**:\n\n**${calculatedCurp}**\n\nPara garantizar la protección legal del expediente pediátrico: ¿Confirma que esta clave coincide exactamente con el documento oficial?`;
                    } else {
                        curpMsg = `Análisis demográfico completado. El motor de integración ha proyectado la siguiente Clave Única de Registro de Población (CURP) para su expediente:\n\n**${calculatedCurp}**\n\nPara garantizar la protección legal de su información clínica: ¿Confirma que esta clave coincide exactamente con su documento oficial?`;
                    }

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: curpMsg,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: '✅ Sí, es correcta', value: 'yes' },
                            { label: '❌ No, ingresar manualmente', value: 'no' }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_CURP_CONFIRM');
                    break;
                }

                case 'PHASE_1_PROFILE_CURP_CONFIRM': {
                    const age = patientData.profile?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    if (text === 'yes') {
                        let phoneMsg = "";
                        if (isMinor) phoneMsg = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica del paciente.\n\nPor favor, indique el número de teléfono celular a 10 dígitos del tutor responsable de **${firstName}**:`;
                        else phoneMsg = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica.\n\nPor favor, indique su número de teléfono celular a 10 dígitos:`;

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: phoneMsg,
                            avatar: tiloImg,
                            inputType: 'tel'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    } else {
                        // Limpiar la CURP autogenerada si fue rechazada
                        setPatientData(prev => ({ ...prev, profile: { ...prev.profile, curp: '' } }));
                        
                        let manualMsg = "";
                        if (isMinor) manualMsg = `Registro descartado. Para garantizar la precisión del expediente legal pediátrico bajo la **NOM-004**.\n\nPor favor, introduzca manualmente la **CURP exacta** de **${firstName}** (18 caracteres alfanuméricos):`;
                        else manualMsg = `Registro descartado. Para garantizar la precisión de su expediente legal bajo la **NOM-004**.\n\nPor favor, introduzca manualmente su **CURP exacta** (18 caracteres alfanuméricos):`;

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: manualMsg,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_CURP_MANUAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_CURP_MANUAL': {
                    const curpInput = text.trim().toUpperCase();
                    // Regex Oficial CURP
                    const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;

                    if (!curpRegex.test(curpInput)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Inconsistencia de Formato Legal.**\n\n---\n\nLa CURP introducida no cumple con la validación de 18 caracteres alfanuméricos establecida por RENAPO.\n\nPor favor, verifique el dato e intente capturarlo nuevamente:" }]);
                        return;
                    }

                    // V8.0: Validación cruzada de integridad usando fecha y sexo del perfil
                    const p = patientData.profile;
                    let calculatedBase = "";
                    if (p.first_name && p.last_name_pat && p.birthdate && p.sex) {
                        calculatedBase = calculateCurp(p.first_name, p.last_name_pat, p.last_name_mat, p.birthdate, p.sex, "XX");
                    }

                    if (calculatedBase && calculatedBase.length === 18) {
                        const expectedDateAndSex = calculatedBase.substring(4, 11);
                        const inputDateAndSex = curpInput.substring(4, 11);

                        if (expectedDateAndSex !== inputDateAndSex) {
                            setMessages((prev) => [...prev, { role: "assistant", content: `⛔ **Fallo de Integridad Biométrica.**\n\n---\n\nLa fecha de nacimiento o sexo detectados en la CURP introducida no coinciden con los datos biológicos registrados al inicio del protocolo.\n\nPara mantener la legalidad del expediente, verifique el dato e intente nuevamente:` }]);
                            return;
                        }
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, curp: curpInput }
                    }));

                    const age = p?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (p?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    let msgContentPhone = "";
                    if (isMinor) msgContentPhone = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica del paciente.\n\nPor favor, indique el número de teléfono celular a 10 dígitos del tutor responsable de **${firstName}**:`;
                    else msgContentPhone = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica.\n\nPor favor, indique su número de teléfono celular a 10 dígitos:`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContentPhone,
                        avatar: tiloImg,
                        inputType: 'tel'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    break;
                }

                case 'PHASE_1_PROFILE_ID_EXTRANJERO': {
                    const idInput = text.trim().toUpperCase();
                    if (idInput.length < 5) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Fallo de Validación Internacional.**\n\n---\n\nEl ID o Pasaporte debe tener al menos 5 caracteres para ser aceptado como identificador legal válido.\n\nPor favor, verifique el documento e intente nuevamente:", avatar: tiloImg }]);
                        return;
                    }

                    setPatientData(prev => ({
                        ...prev,
                        profile: {
                            ...prev.profile,
                            nationality_type: 'FOREIGN',
                            passport_id: idInput,
                            curp: `EXT-${idInput}`,
                            curpValidated: true
                        },
                        identificacion: {
                            ...prev.identificacion,
                            nationality_type: 'FOREIGN',
                            passport_id: idInput,
                            curp: `EXT-${idInput}`,
                            curpValidated: true
                        }
                    }));


                    const age = patientData.profile?.age || 0;
                    const isMinor = age < 18;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    
                    let msgContent = "";
                    if (isMinor) msgContent = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica del paciente.\n\nPor favor, indique el número de teléfono celular a 10 dígitos del tutor responsable de **${firstName}**:`;
                    else msgContent = `Identidad nacional sellada en expediente. Para habilitar el protocolo de notificaciones críticas y asegurar una vía de comunicación directa ante cualquier alerta clínica.\n\nPor favor, indique su número de teléfono celular a 10 dígitos:`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'tel'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_PHONE');
                    break;
                }

                case 'PHASE_1_PROFILE_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    if (!phoneRegex.test(text.replace(/\D/g, ''))) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⛔ **Formato de Contacto Inválido.**\n\n---\n\nEl sistema requiere exactamente 10 dígitos numéricos para establecer la vía de comunicación oficial.\n\nPor favor, verifique el número e intente nuevamente.", avatar: tiloImg, inputType: 'tel' }]);
                        return;
                    }
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, phone: text.replace(/\D/g, '') }
                    }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    const firstName = patientData.profile.first_name || patientData.identificacion?.nombres || "el paciente";
                    
                    const msgContent = (ptCtx && ptCtx.is_minor)
                        ? `Vía de comunicación asegurada para notificaciones críticas.\n\nEl entorno cultural impacta directamente la adherencia nutricional infantil. Para la integración del expediente clínico (NOM-004), ¿la familia de **${firstName}** profesa alguna religión con restricciones dietéticas?`
                        : `Vía de comunicación asegurada para notificaciones críticas.\n\nPara garantizar que su plan metabólico respete sus principios éticos o espirituales, ¿profesa alguna religión con restricciones dietéticas que debamos registrar en su expediente clínico (NOM-004)?`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'strict_select',
                        options: [
                            { label: "✅ Sí", value: "SI" },
                            { label: "❌ No / Ninguna", value: "NO_NINGUNA" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_RELIGION');
                    break;
                }

                case 'PHASE_1_PROFILE_RELIGION': {
                    const hasReligion = text === "SI" || text.toLowerCase() === "sí" || text.toLowerCase() === "si" || text === "✅ Sí";

                    const ptCtx = patientData.profile?.pediatric_profile;
                    const firstName = (patientData.profile?.first_name || patientData.identificacion?.nombre || "el paciente").split(' ')[0];
                    if (hasReligion) {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, has_religion: true }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: (ptCtx && ptCtx.is_minor) 
                                ? `Alineación de adecuación cultural registrada.\n\nPara calibrar con precisión el algoritmo nutricional y asegurar que el menú de **${firstName}** contemple rigurosamente cualquier restricción dietética asociada:\n\nPor favor, seleccione el marco de creencias correspondiente:` 
                                : `Alineación de adecuación cultural registrada.\n\nPara calibrar con precisión el algoritmo nutricional y asegurar que su menú contemple rigurosamente cualquier restricción dietética asociada:\n\nPor favor, seleccione el marco de creencias correspondiente:`,
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "Adventista", value: "Adventista" },
                                { label: "Budista", value: "Budista" },
                                { label: "Católico", value: "Católico" },
                                { label: "Cristiano", value: "Cristiano" },
                                { label: "Judío", value: "Judío" },
                                { label: "Mormón", value: "Mormón" },
                                { label: "Musulmán", value: "Musulmán" },
                                { label: "Otra", value: "Otra" },
                                { label: "Testigo de Jehová", value: "Testigo de Jehová" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_RELIGION_SPEC');
                    } else {
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, has_religion: false, religion: "Ninguna" }
                        }));

                        const ptCtx = patientData.profile.pediatric_profile;
                        if (ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false) {
                            const newData = {
                                ...patientData,
                                profile: { ...patientData.profile, has_religion: false, religion: "Ninguna", marital_status: ptCtx.ui_controls.auto_fill_marital }
                            };
                            setPatientData(newData);
                            triggerPhase1Summary(newData);
                        } else {
                            const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: (ptCtx && ptCtx.is_minor) ? `Alineación de adecuación cultural confirmada.\n\nPara cerrar el bloque de identificación legal pediátrica: ¿Cuál es el **Estado Civil** de **${patientData.profile?.first_name || "el paciente"}**?` : `Alineación de adecuación cultural confirmada.\n\nPara cerrar el bloque de identificación oficial en su expediente: ¿Cuál es su **Estado Civil** legal actual?`,
                                avatar: tiloImg,
                                options: [
                                    { label: getGenderedTerm('Soltero', sx), value: getGenderedTerm('Soltero', sx) },
                                    { label: getGenderedTerm('Casado', sx), value: getGenderedTerm('Casado', sx) },
                                    { label: "Unión Libre", value: "Unión Libre" },
                                    { label: getGenderedTerm('Divorciado', sx), value: getGenderedTerm('Divorciado', sx) },
                                    { label: getGenderedTerm('Viudo', sx), value: getGenderedTerm('Viudo', sx) }
                                ]
                            }]);
                            setCurrentPhase('PHASE_1_PROFILE_MARITAL');
                        }
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_RELIGION_SPEC': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, religion: formatText(text) }
                    }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    if (ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false) {
                        const newData = {
                            ...patientData,
                            profile: { ...patientData.profile, religion: formatText(text), marital_status: ptCtx.ui_controls.auto_fill_marital }
                        };
                        setPatientData(newData);
                        triggerPhase1Summary(newData);
                    } else {
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: (ptCtx && ptCtx.is_minor) ? `Restricción dietética registrada.\n\nPara cerrar el bloque de identificación legal pediátrica: ¿Cuál es el **Estado Civil** de **${patientData.profile?.first_name || "el paciente"}**?` : `Restricción dietética registrada.\n\nPara cerrar el bloque de identificación oficial en su expediente: ¿Cuál es su **Estado Civil** legal actual?`,
                            avatar: tiloImg,
                            options: [
                                { label: getGenderedTerm('Soltero', sx), value: getGenderedTerm('Soltero', sx) },
                                { label: getGenderedTerm('Casado', sx), value: getGenderedTerm('Casado', sx) },
                                { label: "Unión Libre", value: "Unión Libre" },
                                { label: getGenderedTerm('Divorciado', sx), value: getGenderedTerm('Divorciado', sx) },
                                { label: getGenderedTerm('Viudo', sx), value: getGenderedTerm('Viudo', sx) }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_MARITAL');
                    }
                    break;
                }

                case 'PHASE_1_PROFILE_MARITAL': {
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, marital_status: text }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_PROFILE_ZIPCODE': {
                    const zipInput = text.trim();
                    if (!/^\d{5}$/.test(zipInput)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Anomalía de formato detectada.\n\n---\n\nEl código debe contener exactamente 5 dígitos numéricos.\n\nPor favor, **verifique e ingrese** el Código Postal nuevamente:", avatar: tiloImg }]);
                        return;
                    }

                    // Tilo replies while thinking:
                    setMessages(prev => [...prev, { role: 'assistant', content: "Sincronizando base de datos postal...", avatar: tiloImg }]);

                    fetchZipData(zipInput)
                        .then(data => {
                            if (!data || !data.colonias || data.colonias.length === 0) {
                                throw new Error("No colonies found");
                            }

                            setPatientData(prev => ({
                                ...prev,
                                profile: {
                                    ...prev.profile,
                                    address: {
                                        ...prev.profile.address,
                                        zip_code: zipInput,
                                        municipality: data.municipio,
                                        state: data.estado,
                                        coordinates: data.coordinates || prev.profile?.address?.coordinates
                                    }
                                },
                                domicilio: {
                                    ...prev.domicilio,
                                    cp: zipInput,
                                    municipio: data.municipio, // Legacy support
                                    estado: data.estado,
                                    coordinates: data.coordinates || prev.domicilio?.coordinates
                                }
                            }));

                            setMessages(prev => {
                                const withoutThinking = prev.slice(0, prev.length - 1);
                                return [...withoutThinking, {
                                    role: 'assistant',
                                    content: `Mapeo geográfico exitoso (${data.municipio}, ${data.estado}).\n\n---\n\nPor favor, **seleccione** la colonia correspondiente para el registro oficial:`,
                                    inputType: 'strict_select',
                                    options: data.colonias.map(c => ({ label: c, value: c }))
                                }];
                            });
                            setCurrentPhase('PHASE_1_PROFILE_COLONY');
                        })
                        .catch(err => {
                            console.error("CP Lookup Error:", err);
                            setMessages(prev => {
                                const withoutThinking = prev.slice(0, prev.length - 1);
                                return [...withoutThinking, {
                                    role: 'assistant',
                                    content: (patientData.profile?.pediatric_profile?.is_minor) 
                                        ? `Discordancia geográfica en base de datos nacional.\n\nPor favor, **verifique e ingrese** el Código Postal de **${patientData.profile?.first_name || "paciente"}** nuevamente:` 
                                        : `Discordancia geográfica en base de datos nacional.\n\nPor favor, **verifique e ingrese** su Código Postal nuevamente:`,
                                    inputType: 'number'
                                }];
                            });
                            // No cambiamos la fase, nos quedamos en PHASE_1_PROFILE_ZIPCODE
                        });

                    return; // Retornamos para evitar fallthrough porque la consulta es asíncrona
                }

                case 'PHASE_1_PROFILE_STATE_MANUAL': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, state: formatText(text) } },
                        domicilio: { ...prev.domicilio, estado: formatText(text) }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (patientData.profile?.pediatric_profile?.is_minor) 
                            ? `Estado territorial registrado.\n\nPor favor, **indique** el Municipio o Delegación de residencia de **${patientData.profile?.first_name || "paciente"}**:` 
                            : `Estado territorial registrado.\n\nPor favor, **indique** su Municipio o Delegación de residencia:`,
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_MUNICIPALITY_MANUAL');
                    break;
                }

                case 'PHASE_1_PROFILE_MUNICIPALITY_MANUAL': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, municipality: formatText(text) } },
                        domicilio: { ...prev.domicilio, municipio: formatText(text) }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (patientData.profile?.pediatric_profile?.is_minor) 
                            ? `Demarcación municipal capturada.\n\nPor favor, **escriba** la Colonia o Asentamiento de residencia de **${patientData.profile?.first_name || "paciente"}**:` 
                            : `Demarcación municipal capturada.\n\nPor favor, **escriba** su Colonia o Asentamiento de residencia:`,
                        inputType: 'text'
                    }]);
                    // Redirect back to normal colony logic, which expects a text response and sets the colony, then asks for street
                    setCurrentPhase('PHASE_1_PROFILE_COLONY');
                    break;
                }

                case 'PHASE_1_PROFILE_COLONY': {
                    setPatientData(prev => ({
                        ...prev,
                        profile: { ...prev.profile, address: { ...prev.profile.address, colony: toTitleCase(text) } },
                        domicilio: { ...prev.domicilio, colonia: toTitleCase(text) }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (patientData.profile?.pediatric_profile?.is_minor) 
                            ? `Colonia registrada con éxito.\n\nPara finalizar el bloque demográfico, **escriba** la Calle y Número (exterior/interior) de la residencia de **${patientData.profile?.first_name || "paciente"}**:` 
                            : `Colonia registrada con éxito.\n\nPara finalizar el bloque demográfico, **escriba** su Calle y Número (exterior/interior):`,
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_1_PROFILE_STREET');
                    break;
                }

                case 'PHASE_1_PROFILE_STREET': {
                    const cleanStreet = toTitleCase(text);

                    // Validación explícita de Calle y Número 
                    // Permite letras, números y espacios (e.g. "morelos 13")
                    if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ0-9\s#\-.,]+$/.test(cleanStreet) || cleanStreet.length < 3) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Anomalía de formato detectada.\n\n---\n\nLa dirección debe contener al menos 3 caracteres (ej. Morelos 13).\n\nPor favor, **verifique e ingrese** la Calle y Número nuevamente:`,
                            avatar: tiloImg
                        }]);
                        return; // No avanza si falla la validación
                    }

                    // Tilo replies while thinking:
                    setMessages(prev => [...prev, { role: 'assistant', content: "Sincronizando coordenadas cartográficas...", avatar: tiloImg }]);

                    const fullAddressToSearch = `${cleanStreet}, ${patientData.domicilio?.colonia || ''}, ${patientData.domicilio?.cp || ''}, ${patientData.domicilio?.municipio || ''}, ${patientData.domicilio?.estado || ''}, México`;

                    // V37.6 Auto-Geocoding with Cartographic Validation Gate
                    try {
                        const geoResult = await fetchMexicanCoordinates({
                            calle: cleanStreet,
                            colonia: patientData.domicilio?.colonia || patientData.profile?.address?.colony || '',
                            municipio: patientData.domicilio?.municipio || patientData.profile?.address?.municipality || '',
                            estado: patientData.domicilio?.estado || patientData.profile?.address?.state || '',
                            cp: patientData.domicilio?.cp || patientData.profile?.address?.zip_code || ''
                        });
                        
                        const coords = { lat: geoResult.lat, lng: geoResult.lng };
                        const formattedAddress = (geoResult.formattedAddress || fullAddressToSearch).replace('Mexico', 'México');

                        setPatientData(prev => ({
                            ...prev,
                            profile: { 
                                ...prev.profile, 
                                address: { 
                                    ...prev.profile.address, 
                                    street: cleanStreet // Keep user input intact
                                } 
                            },
                            domicilio: { 
                                ...prev.domicilio, 
                                calle: cleanStreet, // Keep user input intact
                                direccion_capturada_usuario: fullAddressToSearch,
                                direccion_googlemaps: formattedAddress,
                                coordinates: coords,
                                addressStatus: 'VERIFIED'
                            }
                        }));
                        console.log("📍 [Córtex Geocoder] Coordenadas obtenidas y guardadas exitosamente:", coords);
                        
                        // GATE VALIDATION: Pide que el usuario lo verifique visualmente
                        const ptCtx = patientData.profile?.pediatric_profile;
                        const patientFirstName = patientData.profile?.first_name || 'Paciente';
                        const tutorName = ptCtx?.tutor_first_name ? ptCtx.tutor_first_name : 'Tutor';
                        const addressedName = ptCtx?.is_minor ? tutorName : patientFirstName;
                        
                        const patientAddressStr = `${cleanStreet}, Col. ${patientData.domicilio?.colonia || ''}, ${patientData.domicilio?.municipio || ''}, ${patientData.domicilio?.estado || ''}, CP: ${patientData.domicilio?.cp || ''}`;

                        setMessages(prev => {
                            const withoutThinking = prev.slice(0, prev.length - 1);
                            return [...withoutThinking, {
                                role: 'assistant',
                                content: `Ubicación cartográfica sincronizada. **${addressedName}**, he vinculado las coordenadas de su residencia al análisis de determinantes ambientales para ${ptCtx?.is_minor ? 'el expediente pediátrico' : 'su expediente clínico'}.\n\n---\n\nPara cumplir con la verificación geográfica de la **NOM-004**, revise el Domicilio Geográfico proyectado en el panel lateral por el sistema cartográfico:\n\n📍 **${patientAddressStr}**\n\n¿Confirma que la ubicación marcada y los datos extraídos son correctos?`,
                                avatar: tiloImg,
                                inputType: 'strict_select',
                                options: [
                                    { label: '✅ CONFIRMAR Y GUARDAR', value: 'MAP_VALID' },
                                    { label: '⚠️ CORREGIR DATOS', value: 'MAP_INVALID' }
                                ]
                            }];
                        });
                        setCurrentPhase('PHASE_1_MAP_VALIDATION');
                        return;

                    } catch (err) {
                        console.error("📍 [Córtex Geocoder] Fallo en Geocoding automático, fallback a validación manual:", err);
                        
                        // Fallback manual si Google falla
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, address: { ...prev.profile.address, street: cleanStreet } },
                            domicilio: { ...prev.domicilio, calle: cleanStreet, addressStatus: 'PENDING' }
                        }));
                        
                        setMessages(prev => {
                            const withoutThinking = prev.slice(0, prev.length - 1);
                            return [...withoutThinking, {
                                role: 'assistant',
                                content: "Sincronización cartográfica automática interrumpida. La resolución de coordenadas no ha alcanzado el margen de precisión clínica requerida.\n\n---\n\nPara garantizar la exactitud de su expediente bajo la **NOM-004**, por favor **valide manualmente la ubicación** arrastrando el marcador en el mapa o corrigiendo los datos del panel lateral.\n\n¿Confirma que ha completado la validación manual o prefiere reiniciar la captura de la calle?",
                                avatar: tiloImg,
                                inputType: 'strict_select',
                                options: [
                                    { label: '✅ Sí, ya lo revisé y está correcto', value: 'MAP_VALID' },
                                    { label: '⚠️ Corregir nuevamente', value: 'MAP_INVALID' }
                                ]
                            }];
                        });
                        setCurrentPhase('PHASE_1_MAP_VALIDATION');
                        return;
                    }
                }

                case 'PHASE_1_MAP_VALIDATION': {
                    const ptCtx = patientData.profile?.pediatric_profile;
                    const patientFirstName = patientData.profile?.first_name || 'Paciente';
                    const tutorName = ptCtx?.tutor_first_name ? ptCtx.tutor_first_name : 'Tutor';
                    const addressedName = ptCtx?.is_minor ? tutorName : patientFirstName;
                    
                    if (text === 'MAP_INVALID') {
                        // Resets address logic
                        setPatientData(prev => ({
                            ...prev,
                            profile: { ...prev.profile, address: {} },
                            domicilio: { ...prev.domicilio, cp: "", estado: "", municipio: "", colonia: "", calle: "", direccion_googlemaps: "", coordinates: null, addressStatus: 'PENDING' }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Entendido, **${addressedName}**.\n\n---\n\nReiniciando la captura cartográfica para garantizar precisión legal. Por favor, ingrese su **Código Postal** nuevamente:`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_ZIPCODE');
                        break;
                    }

                    // MAP_VALID
                    console.log("💾 CHECKPOINT 3: Domicilio Completado y Validado por Google Maps.");
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || 'el paciente';
                    const msgContent = isMinor
                        ? `Las coordenadas del domicilio de **${pName}** han sido verificadas y selladas en el expediente.\n\n---\n\nComo tutor responsable, para cumplir con los lineamientos de seguridad de la NOM-004, es obligatorio designar un tutor o contacto de emergencia legal para **${pName}**.\n\nPor favor, indique el **Nombre Completo** de esta persona:`
                        : `Las coordenadas de su Domicilio Geográfico han sido verificadas y selladas en su expediente.\n\n---\n\n**${addressedName}**, para cumplir con los lineamientos de seguridad de la NOM-004, es obligatorio registrar un contacto de emergencia.\n\nPor favor, indique el **Nombre Completo** de su contacto responsable:`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'text'
                    }]);
                    setCurrentPhase('PHASE_2_EMERGENCY_NAME');
                    break;
                }

                // =============== FASE 1: CICLO DE CORRECCIÓN ===============
                case 'PHASE_1_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        console.log("💾 CHECKPOINT 2: Fase 1 (NOM-004 Demographics) Identificación Validada.");
                        const ptCtx = patientData.profile.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        const pName = patientData.profile.first_name || 'paciente';
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: isMinor 
                                ? `Bloque demográfico sellado.\n\nLa ubicación geográfica es un determinante ambiental clave para el expediente clínico (NOM-004).\n\nPor favor, **indique** el Código Postal (5 dígitos) de la residencia de **${pName}**:` 
                                : `Bloque demográfico sellado.\n\nLa ubicación geográfica es un determinante ambiental clave para el expediente clínico (NOM-004).\n\nPor favor, **indique** su Código Postal (5 dígitos) actual:`,
                            avatar: tiloImg,
                            inputType: 'number'
                        }]);
                        setCurrentPhase('PHASE_1_PROFILE_ZIPCODE');
                    } else if (text === 'no') {
                        const p = patientData.profile || patientData.identificacion || {};
                        const ptCtx = p.pediatric_profile;
                        const showMarital = !(ptCtx && ptCtx.ui_controls && ptCtx.ui_controls.show_marital_status === false);
                        const occupationLabel = ptCtx?.ui_controls?.occupation_label || 'Ocupación';

                        const options = [];
                        options.push({ label: occupationLabel, value: 'OCCUPATION' });
                        options.push({ label: 'Teléfono', value: 'PHONE' });
                        options.push({ label: 'Religión', value: 'RELIGION' });
                        
                        if (showMarital) {
                            options.push({ label: 'Estado Civil', value: 'MARITAL' });
                        }
                        
                        options.push(
                                { label: '⚠️ Error en Identidad (Nombre, CURP, Sexo, Fecha)', value: 'INVALIDATE_IDENTITY' },
                                { label: 'Cancelar Corrección', value: 'CANCEL' }
                        );

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Qué dato necesita corregir?",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: options
                        }]);
                        setCurrentPhase('PHASE_1_CORRECTION_SELECT');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_1_CORRECTION_SELECT': {
                    if (text === 'CANCEL') {
                        triggerPhase1Summary(patientData);
                    } else if (text === 'INVALIDATE_IDENTITY') {
                        clearSession();
                        setMessages([{
                            role: 'assistant',
                            content: "⚠️ **Protocolo de Invalidación Activado**\n\nPara garantizar la integridad y validez legal de su expediente clínico bajo la NOM-004, cualquier inconsistencia en sus datos de identidad base requiere reiniciar el proceso.\n\n---\n\nSe ha forzado el cierre de la sesión de captura de forma preventiva. Por favor, inicie nuevamente para registrar sus datos oficiales correctos.",
                            avatar: tiloImg
                        }]);
                        break;
                    } else if (text === 'OCCUPATION') {
                        const ptCtx = patientData.profile?.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        const pName = patientData.profile?.first_name || (resolvePatientSex(patientData).isFemale ? 'la menor' : 'el menor');
                        const label = ptCtx?.ui_controls?.occupation_label || 'Ocupación';
                        const age = patientData.profile?.age || 0;
                        
                        let msg = "";
                        let options = null;
                        if (isMinor) {
                            if (ptCtx.category === 'ADOLESCENTE') {
                                msg = `Por favor, indique en qué grado o semestre de secundaria o preparatoria se encuentra **${pName}**:`;
                            } else if (ptCtx.category === 'ESCOLAR') {
                                msg = `Por favor, indique en qué grado cursa **${pName}** actualmente:`;
                            } else {
                                msg = `Por favor, indique si **${pName}** asiste a guardería o kínder actualmente:`;
                                options = [
                                    { label: "En casa (Cuidado materno/paterno)", value: "HOME_PARENTS" },
                                    { label: "En casa (Familiar o Niñera)", value: "HOME_CAREGIVER" },
                                    { label: "Guardería / Estancia infantil", value: "DAYCARE" }
                                ];
                                if (age >= 3) {
                                    options.push({ label: "Kínder / Preescolar", value: "KINDER" });
                                }
                            }
                        } else {
                            msg = `Por favor, indique su **${label}** principal actual:`;
                        }
                        
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msg,
                            avatar: tiloImg,
                            inputType: 'text',
                            options: options || undefined
                        }]);
                        setCurrentPhase('PHASE_1_CORRECT_OCCUPATION');
                    } else if (text === 'PHONE') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor, escriba su **Teléfono Correcto** a 10 dígitos:",
                            avatar: tiloImg,
                            inputType: 'tel'
                        }]);
                        setCurrentPhase('PHASE_1_CORRECT_PHONE');
                    } else if (text === 'RELIGION') {
                        const ptCtx = patientData.profile?.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: isMinor ? "¿Qué **Religión** profesan en su hogar?" : "¿Qué **Religión** profesa?",
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: "Adventista", value: "Adventista" },
                                { label: "Budista", value: "Budista" },
                                { label: "Católico", value: "Católico" },
                                { label: "Cristiano", value: "Cristiano" },
                                { label: "Judío", value: "Judío" },
                                { label: "Mormón", value: "Mormón" },
                                { label: "Musulmán", value: "Musulmán" },
                                { label: "Ninguna", value: "Ninguna" },
                                { label: "Otra", value: "Otra" },
                                { label: "Testigo de Jehová", value: "Testigo de Jehová" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_CORRECT_RELIGION');
                    } else if (text === 'MARITAL') {
                        const sx = patientData.profile?.sex || patientData.identificacion?.sexo || "";
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Cuál es su **Estado Civil** legal?",
                            avatar: tiloImg,
                            inputType: 'strict_select',
                            options: [
                                { label: getGenderedTerm('Soltero', sx), value: getGenderedTerm('Soltero', sx) },
                                { label: getGenderedTerm('Casado', sx), value: getGenderedTerm('Casado', sx) },
                                { label: "Unión Libre", value: "Unión Libre" },
                                { label: getGenderedTerm('Divorciado', sx), value: getGenderedTerm('Divorciado', sx) },
                                { label: getGenderedTerm('Viudo', sx), value: getGenderedTerm('Viudo', sx) }
                            ]
                        }]);
                        setCurrentPhase('PHASE_1_CORRECT_MARITAL');
                    }
                    break;
                }

                case 'PHASE_1_CORRECT_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    const cleanPhone = text.replace(/\D/g, '');
                    if (!phoneRegex.test(cleanPhone)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "El número debe tener exactamente 10 dígitos. Por favor intente nuevamente.", avatar: tiloImg, inputType: 'tel' }]);
                        return;
                    }
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, phone: cleanPhone }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_ADDRESS': {
                     const cleanAddr = formatText(text);
                     if(cleanAddr.length < 10) {
                          setMessages(prev => [...prev, { role: 'assistant', content: "Por favor, escriba el domicilio completo.", avatar: tiloImg }]);
                          return;
                     }
                     const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, address: { ...patientData.profile.address, street: cleanAddr, colony: "", zip_code: "", municipality: "", state: "" } },
                        domicilio: { ...patientData.domicilio, calle: cleanAddr, colonia: "", cp: "", municipio: "", estado: "" }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_SEX': {
                    const sx = (text === 'Masculino') ? 'Masculino' : 'Femenino';
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, sex: sx },
                        identificacion: { ...patientData.identificacion, sexo: sx }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_RELIGION': {
                    const rlg = formatText(text);
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, religion: rlg },
                        identificacion: { ...patientData.identificacion, religion: rlg }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_MARITAL': {
                    const mar = text;
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, civil_status: mar, marital_status: mar },
                        identificacion: { ...patientData.identificacion, estadoCivil: mar }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                case 'PHASE_1_CORRECT_OCCUPATION': {
                    const job = formatText(text);
                    const newData = {
                        ...patientData,
                        profile: { ...patientData.profile, occupation: job },
                        identificacion: { ...patientData.identificacion, ocupacion: job }
                    };
                    setPatientData(newData);
                    triggerPhase1Summary(newData);
                    break;
                }

                // =============== FASE 2: SEGURIDAD ===============
                case 'PHASE_2_EMERGENCY_NAME': {
                    const eName = formatText(text);
                    const inferredGender = inferGenderFromName(eName);

                    setPatientData(prev => ({
                        ...prev,
                        profile: {
                            ...prev.profile,
                            emergencyContact: {
                                ...prev.profile.emergencyContact,
                                name: eName,
                                inferred_sex: inferredGender
                            }
                        },
                        emergencia: {
                            ...prev.emergencia,
                            nombre: eName
                        }
                    }));

                    const age = patientData.profile.age || 0;
                    const patientFirstName = (patientData.identificacion.nombre || "Paciente").split(' ')[0];
                    let msgContent = "";

                    // Trifurcación de Edad - Texto Hablado (Párrafos de Poder)
                    if (age < 12) {
                        msgContent = `Entendido. Para establecer el vínculo legal en el expediente, ¿qué parentesco tiene **${eName}** con **${patientFirstName}**?`;
                    } else if (age >= 12 && age < 18) {
                        msgContent = `Entendido, **${patientFirstName}**. Para establecer el vínculo legal, ¿qué parentesco tiene **${eName}** con usted?`;
                    } else {
                        msgContent = `Entendido, **${patientFirstName}**. Para establecer el vínculo en su expediente, ¿qué parentesco tiene **${eName}** con usted?`;
                    }

                    // Dinámica de Botones (Cruce de Edad + Género + Estado Civil)
                    const maritalStatus = (patientData.profile?.marital_status || patientData.identificacion?.estadoCivil || "").toLowerCase();
                    const isSingle = maritalStatus.includes('solter') || maritalStatus === '';
                    
                    let kinshipOptions = [];
                    if (inferredGender === 'FEMALE') {
                        if (age < 12 || (age >= 12 && age < 18)) {
                            kinshipOptions = ['Madre', 'Abuela', 'Tía', 'Hermana Mayor', 'Otra Familiar'];
                        } else {
                            if (isSingle) {
                                kinshipOptions = ['Madre', 'Hermana', 'Amiga', 'Hija', 'Otra Familiar'];
                            } else {
                                kinshipOptions = ['Cónyuge', 'Madre', 'Hermana', 'Amiga', 'Hija', 'Otra Familiar'];
                            }
                        }
                    } else {
                        if (age < 12 || (age >= 12 && age < 18)) {
                            kinshipOptions = ['Padre', 'Abuelo', 'Tío', 'Hermano Mayor', 'Otro Familiar'];
                        } else {
                            if (isSingle) {
                                kinshipOptions = ['Padre', 'Hermano', 'Amigo', 'Hijo', 'Otro Familiar'];
                            } else {
                                kinshipOptions = ['Cónyuge', 'Padre', 'Hermano', 'Amigo', 'Hijo', 'Otro Familiar'];
                            }
                        }
                    }

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'KinshipSlider',
                        options: kinshipOptions.map(opt => ({ label: opt, value: opt }))
                    }]);

                    setCurrentPhase('PHASE_2_EMERGENCY_RELATION');
                    break;
                }

                case 'PHASE_2_EMERGENCY_RELATION': {
                    const eRelation = formatText(text);
                    setPatientData(prev => {
                        const isTutor = ['tutor', 'madre', 'padre'].includes(eRelation.toLowerCase());
                        const emergencyName = prev.profile?.emergencyContact?.name || "";
                        const tutorFirstName = isTutor && emergencyName ? emergencyName.split(' ')[0] : null;

                        const updatedProfile = {
                            ...prev.profile,
                            emergencyContact: { ...prev.profile.emergencyContact, kin: eRelation }
                        };

                        if (tutorFirstName && updatedProfile.pediatric_profile) {
                            updatedProfile.pediatric_profile.tutor_first_name = tutorFirstName;
                        }

                        return {
                            ...prev,
                            profile: updatedProfile,
                            emergencia: {
                                ...prev.emergencia,
                                parentesco: eRelation
                            }
                        };
                    });
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const msgContent = isMinor
                        ? `Vínculo registrado. Como protocolo de seguridad, requiero el **Teléfono a 10 dígitos** de esta persona para contacto inmediato:`
                        : `Vínculo registrado. Como protocolo de seguridad, requiero el **Número de Teléfono (10 dígitos)** de su contacto para emergencias:`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        inputType: 'tel'
                    }]);
                    setCurrentPhase('PHASE_2_EMERGENCY_PHONE');
                    break;
                }

                case 'PHASE_2_EMERGENCY_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    const cleanPhone = text.replace(/\D/g, '');

                    if (!phoneRegex.test(cleanPhone)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ **Fallo de Formato Telefónico**\n\n---\n\nEl sistema requiere exactamente 10 dígitos numéricos sin espacios ni guiones para validar el contacto de emergencia. Por favor, intente nuevamente:", avatar: tiloImg, inputType: 'tel' }]);
                        return;
                    }

                    // Duplication logic: For adults, emergency phone cannot match primary phone.
                    // For minors, bypass this restriction since the tutor's phone will often be the contact phone.
                    const curPtCtx = patientData.profile.pediatric_profile;
                    if (cleanPhone === patientData.profile.phone) {
                        if (!curPtCtx || !curPtCtx.is_minor) {
                            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ **Redundancia de Contacto Detectada**\n\n---\n\nPor protocolos de seguridad (NOM-004), el número de emergencia no puede ser idéntico a su número personal. Por favor, proporcione un número alternativo válido:", avatar: tiloImg, inputType: 'tel' }]);
                            return;
                        }
                    }

                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, phone: cleanPhone }
                        },
                        emergencia: {
                            ...patientData.emergencia,
                            telefono: cleanPhone
                        }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                // =============== FASE 2: CICLO DE CORRECCIÓN ===============
                case 'PHASE_2_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        console.log("💾 CHECKPOINT 3: Fase 2 (Security Contact) Completada y Validada.");
                        // TRANSITION TO FASE 3: MOTIVO DE CONSULTA
                        setActiveTab('profile'); // Update UI Context to Clinical History Tab
                        setCurrentPhase('PHASE_3_MOTIVO_CONSULTA');
                    } else if (text === 'no') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "⚠️ **Protocolo de Corrección de Seguridad**\n\n¿Qué dato del contacto de emergencia requiere ser ajustado?",
                            avatar: tiloImg,
                            inputType: 'buttons',
                            options: [
                                { label: 'Nombre', value: 'NAME' },
                                { label: 'Parentesco', value: 'RELATION' },
                                { label: 'Teléfono', value: 'PHONE' },
                                { label: 'Cancelar', value: 'CANCEL' }
                            ]
                        }]);
                        setCurrentPhase('PHASE_2_CORRECTION_SELECT');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_2_CORRECTION_SELECT': {
                    if (text === 'CANCEL') {
                        triggerPhase2Summary(patientData);
                    } else if (text === 'NAME') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por protocolo de integridad, proporcione el **Nombre Completo Correcto** de su contacto de emergencia:",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_2_CORRECT_NAME');
                    } else if (text === 'RELATION') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Para corregir el vínculo legal, indique el **Parentesco Correcto** (Ej. Madre, Hermano, Amigo):",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_2_CORRECT_RELATION');
                    } else if (text === 'PHONE') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por protocolo de seguridad, ingrese el **Teléfono Correcto** a 10 dígitos numéricos:",
                            avatar: tiloImg,
                            inputType: 'tel'
                        }]);
                        setCurrentPhase('PHASE_2_CORRECT_PHONE');
                    }
                    break;
                }

                case 'PHASE_2_CORRECT_NAME': {
                    const cleanName = formatText(text).replace(/,/g, '').trim();
                    const inferredGender = inferGenderFromName(cleanName);
                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, name: cleanName, inferred_sex: inferredGender }
                        },
                        emergencia: { ...patientData.emergencia, nombre: cleanName }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                case 'PHASE_2_CORRECT_RELATION': {
                    const cleanRel = formatText(text);
                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, kin: cleanRel }
                        },
                        emergencia: { ...patientData.emergencia, parentesco: cleanRel }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                case 'PHASE_2_CORRECT_PHONE': {
                    const phoneRegex = /^[0-9]{10}$/;
                    const cleanPhone = text.replace(/\D/g, '');
                    if (!phoneRegex.test(cleanPhone)) {
                        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ **Fallo de Formato Telefónico**\n\n---\n\nEl sistema requiere exactamente 10 dígitos numéricos para validar el contacto de emergencia. Por favor, intente nuevamente:", avatar: tiloImg, inputType: 'tel' }]);
                        return;
                    }
                    const newData = {
                        ...patientData,
                        profile: {
                            ...patientData.profile,
                            emergencyContact: { ...patientData.profile.emergencyContact, phone: cleanPhone }
                        },
                        emergencia: { ...patientData.emergencia, telefono: cleanPhone }
                    };
                    setPatientData(newData);
                    triggerPhase2Summary(newData);
                    break;
                }

                // =============== FASE 3: MOTIVO DE CONSULTA ===============
                case 'PHASE_3_OPEN_PROMPT': {
                    // Extract text for analysis
                    setFase3State(prev => ({ ...prev, patient_quote: text }));

                    const analysis = await analyzeWithNeuralCortex(text);
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || "Rosa";
                    const tName = ptCtx?.tutor_first_name || "Tutor";

                    setFase3State(prev => ({
                        ...prev,
                        alert_level: analysis.alert,
                        'detective_radiography.suspicion': analysis.suspicion,
                        clinical_category: analysis.category,
                        isGoal: analysis.isGoal,
                        isPregnant: analysis.isPregnant
                    }));

                    // Escudo Óptico de Crisis
                    if (analysis.alert === 'CRITICAL') {
                        const response = isMinor
                            ? `${tName}, lamento mucho leer esto. Entiendo que una noticia así genera mucha incertidumbre y preocupación. He marcado el caso de ${pName} como **Prioridad Médica Máxima**. Nuestro nutriólogo revisará esto con especial cuidado para diseñar un plan 100% seguro para ${pName}.\n\nAhora, imagine que logramos controlar este malestar y ${pName} recupera la tranquilidad. ¿Qué es lo primero que notará en su bienestar diario?`
                            : `${pName}, lamento mucho leer esto. Entiendo que una noticia así genera mucha incertidumbre y preocupación. He marcado su caso como **Prioridad Médica Máxima**. Su nutriólogo revisará esto con especial cuidado para diseñarle un plan 100% seguro.\n\nAhora, imagine que logramos controlar este malestar y usted recupera su tranquilidad. ¿Qué es lo primero que va a notar en su bienestar diario?`;
                        setFase3State(prev => ({ ...prev, specific_ailment: text }));

                        setMessages(prev => [...prev, { role: 'assistant', content: response, isCritical: true, avatar: tiloImg }]);
                        setCurrentPhase('PHASE_3_MIRACLE_QUESTION');
                        break;
                    }

                    // Flujo Normal
                    let response = isMinor 
                        ? `Entiendo. Manejar temas de tipo **${analysis.suspicion.toLowerCase()}** en pediatría requiere mucha precisión. ¿Desde hace cuánto tiempo nota estos cambios en la vitalidad de ${pName}?`
                        : `Entiendo. Manejar temas de tipo **${analysis.suspicion.toLowerCase()}** requiere mucha precisión. ¿Desde hace cuánto tiempo nota estos cambios en su vitalidad?`;

                    if (analysis.isGoal) response = isMinor ? `Iniciar una arquitectura de optimización para la condición física de ${pName} es el primer paso hacia su desarrollo biológico óptimo. ¿Desde hace cuánto tiempo tienen este objetivo en mente?` : `Iniciar una arquitectura de optimización para su condición física es el primer paso hacia su soberanía biológica. ¿Desde hace cuánto tiempo tiene este objetivo en mente?`;
                    if (analysis.isPregnant) response = `Felicidades por esta etapa, ${pName}. ¿Desde hace cuántas semanas inició este hermoso proceso para sincronizar su arquitectura?`;
                    else if (analysis.category === 'PEDIATRICS') response = `Entiendo perfectamente, ${tName}. En el desarrollo de ${pName}, cada detalle es vital. ¿Desde hace cuánto tiempo notan estas molestias?`;
                    else if (analysis.category === 'SURGICAL') response = isMinor ? `Entiendo perfectamente, ${tName}. Los temas de cirugía o afecciones específicas requieren un enfoque nutricional muy preciso para reducir la inflamación y preparar el cuerpo de ${pName}.\n\n¿Desde hace cuánto tiempo notan estos cambios?` : `Entiendo perfectamente, ${pName}. Los temas de cirugía o afecciones específicas requieren un enfoque nutricional muy preciso para reducir la inflamación y preparar su cuerpo.\n\n¿Desde hace cuánto tiempo nota estos cambios?`;

                    setMessages(prev => [...prev, { role: 'assistant', content: response, avatar: tiloImg }]);
                    setCurrentPhase('PHASE_3_DETECTIVE_PROBE');
                    break;
                }

                case 'PHASE_3_DETECTIVE_PROBE': {
                    const timeRegex = /\d|mes|año|semana|dia|siempre|hace|joven/i;
                    if (timeRegex.test(text)) {
                        setFase3State(prev => ({ ...prev, 'detective_radiography.chronology': text }));
                    }

                    const isPathology = fase3State.alert_level !== 'NONE';
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || "el paciente";
                    
                    let miracleMsg = "";
                    if (isPathology) {
                        miracleMsg = isMinor
                            ? `Gracias por la claridad. Ahora, imagine que logramos estabilizar la salud de ${pName} y recuperar la tranquilidad. ¿Qué es lo primero que van a notar en su bienestar diario?`
                            : `Gracias por la claridad. Ahora, imagine que logramos estabilizar su salud y recuperar su tranquilidad. ¿Qué es lo primero que va a notar en su bienestar diario?`;
                    } else {
                        miracleMsg = isMinor
                            ? `Perfecto. Imagine que logran este objetivo. ¿Qué es lo primero que ${pName} va a poder hacer que hoy le cuesta trabajo?`
                            : `Perfecto. Imagine que logramos este objetivo. ¿Qué es lo primero que va a poder hacer que hoy le cuesta trabajo?`;
                    }

                    setMessages(prev => [...prev, { role: 'assistant', content: miracleMsg, avatar: tiloImg }]);
                    setCurrentPhase('PHASE_3_MIRACLE_QUESTION');
                    break;
                }

                case 'PHASE_3_MIRACLE_QUESTION': {
                    setFase3State(prev => ({ ...prev, emotional_anchor: text }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Gracias por su confianza. He analizado su reporte y he determinado su enfoque ideal.",
                        avatar: tiloImg
                    }]);

                    // Determinación del Goal (Inference)
                    let inferredGoal = 'Bienestar / Aprender a comer';
                    if (fase3State.isPregnant) inferredGoal = 'Gestación y Maternidad';
                    else if (fase3State.isGoal) inferredGoal = 'Rendimiento y Bienestar';
                    else {
                        const level = fase3State.alert_level;
                        if (level === 'PRETERM') inferredGoal = 'Nutrición para el Desarrollo';
                        else if (level === 'NEURO') inferredGoal = 'Salud Neuromotriz y Seguridad';
                        else if (level !== 'NONE') inferredGoal = 'Controlar Enfermedad';
                    }

                    // UPDATE DASHBOARD STATE TO SHOW INFERENCE CARD
                    setFase3State(prev => ({ ...prev, inferred_goal: inferredGoal, showInferenceCard: true }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || 'el paciente';

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? `Basado en el reporte de ${pName}, he determinado que el enfoque prioritario es:\n\n**${inferredGoal}**\n\n¿Están de acuerdo?`
                            : `Basado en su reporte, he determinado que su enfoque prioritario es:\n\n**${inferredGoal}**\n\n¿Es correcto?`,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ Sí, es correcto", value: inferredGoal },
                            { label: "Preferiría elegir otro enfoque", value: "REJECT_INFERENCE" }
                        ]
                    }]);

                    setCurrentPhase('PHASE_3_INFERENCE_CONFIRM');
                    break;
                }

                case 'PHASE_3_INFERENCE_CONFIRM': {
                    // Esperando que el usuario haga click en los botones de "Sí, es correcto" o "Cambiar" generados por InputType
                    // En App.jsx hay lógica para los botones de inference_card. Asumiendo que mandan el string literal del approach:
                    if (text === 'REJECT_INFERENCE') {
                        const ptCtx = patientData.profile.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        const pName = patientData.profile.first_name || 'el paciente';

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: isMinor 
                                ? `¿Cuál considerarían que es el enfoque principal para ${pName}?`
                                : "¿Cuál consideraría usted que es su enfoque principal?",
                            avatar: tiloImg,
                            options: [
                                { label: "Controlar Enfermedad", value: "Controlar Enfermedad" },
                                { label: "Gestación y Maternidad", value: "Gestación y Maternidad" },
                                { label: "Rendimiento y Bienestar", value: "Rendimiento y Bienestar" },
                                { label: "Bienestar / Aprender a comer", value: "Bienestar / Aprender a comer" },
                                { label: "Nutrición Pediátrica", value: "Nutrición para el Desarrollo" }
                            ]
                        }]);
                        // Stay in same phase but next text will not trigger REJECT_INFERENCE
                        break;
                    }

                    // Aceptó o eligió otro
                    setFase3State(prev => ({ ...prev, goal_standard: text }));

                    // TRANSITION TO FASE 4: ANTECEDENTES HEREDOFAMILIARES
                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const pName = patientData.profile.first_name || 'el paciente';
                    const msgContent = isMinor
                        ? `Anotado. Mapa de prioridades establecido.\n\nPasemos a los Antecedentes Heredofamiliares.\n\n¿Los padres, abuelos o hermanos de ${pName} padecen alguna enfermedad crónica diagnosticada?`
                        : "Anotado. Mapa de prioridades establecido.\n\nPasemos a sus Antecedentes Heredofamiliares.\n\n¿Sus padres, abuelos o hermanos padecen alguna enfermedad crónica diagnosticada?";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ Objetivo registrado: **${text}**.\n\n` + msgContent,
                        avatar: tiloImg,
                        inputType: 'buttons',
                        options: [
                            { label: "✅ Sí", value: "SI_HEREDO" },
                            { label: "❌ No", value: "NO_HEREDO" }
                        ]
                    }]);
                    setActiveTab('profile');
                    setCurrentPhase('PHASE_4_HEREDO_CONFIRM');
                    break;
                }

                // =============== FASE 4: ANTECEDENTES HEREDOFAMILIARES ===============
                case 'PHASE_4_HEREDO_CONFIRM': {
                    if (text === 'SI_HEREDO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Entendido.\n\n---\n\nPor favor, descríbame ¿qué familiares padecen qué enfermedades? (Ej: Mi madre tiene hipertensión y mi abuelo materno diabetes).",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_4_HEREDO_START');
                    } else if (text === 'NO_HEREDO') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Comprendo.\n\n---\n\nAún así, para cumplir con la normativa clínica obligatoria, verifiquemos esta lista rápida. ¿Algún familiar directo padece alguna de estas?",
                            avatar: tiloImg,
                            options: [
                                { label: "Diabetes", value: "Diabetes" },
                                { label: "Hipertensión", value: "Hipertensión" },
                                { label: "Cáncer", value: "Cáncer" },
                                { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                                { label: "Otras", value: "Otras" },
                                { label: "Ninguna", value: "Ninguna" }
                            ]
                        }]);
                        setCurrentPhase('PHASE_4_SAFETY_GATE');
                    }
                    break;
                }

                case 'PHASE_4_HEREDO_START': {
                    const rawText = formatText(text);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            family_raw_text: rawText,
                            family_structured: prev.history?.family_structured || []
                        }
                    }));

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Para cumplir con la normativa clínica, ¿algún familiar directo padece alguna otra enfermedad de esta lista oficial?",
                        avatar: tiloImg,
                        options: [
                            { label: "Diabetes", value: "Diabetes" },
                            { label: "Hipertensión", value: "Hipertensión" },
                            { label: "Cáncer", value: "Cáncer" },
                            { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                            { label: "Otras", value: "Otras" },
                            { label: "Ninguna", value: "Ninguna" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_4_SAFETY_GATE');
                    break;
                }

                case 'PHASE_4_SAFETY_GATE': {
                    if (text === "Otras") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor escriba qué otra enfermedad y qué familiar la padece.",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_4_OTHER_SPECIFIC');
                    } else if (text === "Ninguna") {
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                family_checklist_verified: true
                            }
                        }));
                        // TRANSITION TO FASE 5: ANTECEDENTES PERSONALES PATOLOGICOS
                        const ptCtx = patientData.profile.pediatric_profile;
                        const isMinor = ptCtx?.is_minor;
                        const pName = patientData.profile.first_name || 'el paciente';
                        const msgContent = isMinor
                            ? `Anotado. Mapa de riesgos familiares actualizado.\n\nPasemos al historial clínico de ${pName}, ¿padece o ha padecido alguna enfermedad crónica diagnosticada? (Ej. Hipotiroidismo, Resistencia a la Insulina, etc.)`
                            : "Anotado. Mapa de riesgos familiares actualizado.\n\nPasemos a su historial personal, ¿usted padece o ha padecido alguna enfermedad crónica diagnosticada? (Ej. Hipotiroidismo, Resistencia a la Insulina, etc.)";

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msgContent,
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_5_PERSONAL_START');
                    } else {
                        // User selected a predefined pathology
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                family_structured: [
                                    ...(prev.history?.family_structured || []),
                                    { relative: 'UNKNOWN', condition: text, detail: text }
                                ]
                            }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Registrado: ${text}. ¿Algún familiar padece otra de la lista?`,
                            avatar: tiloImg,
                            options: [
                                { label: "Diabetes", value: "Diabetes" },
                                { label: "Hipertensión", value: "Hipertensión" },
                                { label: "Cáncer", value: "Cáncer" },
                                { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                                { label: "Otras", value: "Otras" },
                                { label: "Ninguna", value: "Ninguna" }
                            ]
                        }]);
                    }
                    break;
                }

                case 'PHASE_4_OTHER_SPECIFIC': {
                    const extraInfo = formatText(text);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            family_structured: [
                                ...(prev.history?.family_structured || []),
                                { relative: 'UNKNOWN', condition: 'OTHER', detail: extraInfo }
                            ]
                        }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Registrado: ${extraInfo}. ¿Algún familiar padece otra de la lista?`,
                        avatar: tiloImg,
                        options: [
                            { label: "Diabetes", value: "Diabetes" },
                            { label: "Hipertensión", value: "Hipertensión" },
                            { label: "Cáncer", value: "Cáncer" },
                            { label: "Enfermedades Cardíacas", value: "Enfermedades Cardíacas" },
                            { label: "Otras", value: "Otras" },
                            { label: "Ninguna", value: "Ninguna" }
                        ]
                    }]);
                    setCurrentPhase('PHASE_4_SAFETY_GATE');
                    break;
                }

                // =============== FASE 5: ANTECEDENTES PERSONALES PATOLÓGICOS (APP) ===============
                case 'PHASE_5_PERSONAL_START': {
                    const rawText = formatText(text);
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            personal_raw_text: rawText,
                            personal_structured: prev.history?.personal_structured || []
                        }
                    }));

                    const ptCtx = patientData.profile.pediatric_profile;
                    const isMinor = ptCtx?.is_minor;
                    const msgContent = isMinor
                        ? "Para asegurar que el expediente esté completo: Además de lo que ya mencionamos, ¿padece alguna otra condición de esta lista oficial?"
                        : "Para asegurar que su expediente esté completo: Además de lo que ya mencionamos, ¿padece alguna otra condición de esta lista oficial?";

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: msgContent,
                        avatar: tiloImg,
                        options: [
                            { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes (Tipo 1 o 2)" },
                            { label: "Hipertensión Arterial", value: "Hipertensión Arterial" },
                            { label: "Hipotiroidismo / Tiroides", value: "Hipotiroidismo / Tiroides" },
                            { label: "Dislipidemia", value: "Dislipidemia" },
                            { label: "SOP", value: "SOP" },
                            { label: "Gastritis / Colitis", value: "Gastritis / Colitis" },
                            { label: "Artritis", value: "Artritis" },
                            { label: "Otras", value: "Otras" },
                            { label: "Ninguna", value: "Ninguna" }
                        ]
                    }]);
                    setActiveTab('profile'); // Ensured UI consistency
                    setCurrentPhase('PHASE_5_SAFETY_GATE');
                    break;
                }

                case 'PHASE_5_SAFETY_GATE': {
                    const phase5Options = [
                        { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes (Tipo 1 o 2)" },
                        { label: "Hipertensión Arterial", value: "Hipertensión Arterial" },
                        { label: "Hipotiroidismo / Tiroides", value: "Hipotiroidismo / Tiroides" },
                        { label: "Dislipidemia", value: "Dislipidemia" },
                        { label: "SOP", value: "SOP" },
                        { label: "Gastritis / Colitis", value: "Gastritis / Colitis" },
                        { label: "Artritis", value: "Artritis" },
                        { label: "Otras", value: "Otras" },
                        { label: "Ninguna", value: "Ninguna" }
                    ];

                    if (text === "Otras") {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Por favor escriba qué otra enfermedad padece.",
                            avatar: tiloImg,
                            inputType: 'text'
                        }]);
                        setCurrentPhase('PHASE_5_OTHER_SPECIFIC');
                    } else if (text === "Ninguna") {
                        const newData = {
                            ...patientData,
                            history: {
                                ...patientData.history,
                                personal_checklist_verified: true
                            }
                        };
                        setPatientData(newData);
                        triggerPhase5Summary(newData, fase3State);
                    } else {
                        // User selected a predefined pathology
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...prev.history,
                                personal_structured: [
                                    ...(prev.history?.personal_structured || []),
                                    { condition_category: text, specific_condition: text, status: 'ACTIVE', source: 'CHECKLIST' }
                                ]
                            }
                        }));
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Registrado: ${text}. ¿Padece alguna otra condición de la lista?`,
                            avatar: tiloImg,
                            options: phase5Options
                        }]);
                    }
                    break;
                }

                case 'PHASE_5_OTHER_SPECIFIC': {
                    const extraInfo = formatText(text);
                    const phase5Options = [
                        { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes (Tipo 1 o 2)" },
                        { label: "Hipertensión Arterial", value: "Hipertensión Arterial" },
                        { label: "Hipotiroidismo / Tiroides", value: "Hipotiroidismo / Tiroides" },
                        { label: "Dislipidemia", value: "Dislipidemia" },
                        { label: "SOP", value: "SOP" },
                        { label: "Gastritis / Colitis", value: "Gastritis / Colitis" },
                        { label: "Artritis", value: "Artritis" },
                        { label: "Otras", value: "Otras" },
                        { label: "Ninguna", value: "Ninguna" }
                    ];

                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...prev.history,
                            personal_structured: [
                                ...(prev.history?.personal_structured || []),
                                { condition_category: 'OTHER', specific_condition: extraInfo, status: 'ACTIVE', source: 'CHECKLIST' }
                            ]
                        }
                    }));
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Registrado: ${extraInfo}. ¿Padece alguna otra condición de la lista?`,
                        avatar: tiloImg,
                        options: phase5Options
                    }]);
                    setCurrentPhase('PHASE_5_SAFETY_GATE');
                    break;
                }

                // =============== SUMMARY CONFIRMATIONS (PHASES 3 - 6) ===============
                case 'PHASE_3_SUMMARY_CONFIRM': {
                    if (text === 'yes' || text === 'CONFIRM_DATA') {
                        setCurrentPhase('PHASE_4_FAMILY_HISTORY');
                    } else if (text === 'no' || text === 'CORRECT_DATA') {
                        // Reset Motivo Consulta State
                        setFase3State({
                            patient_quote: "",
                            specific_ailment: "",
                            alert_level: "NONE",
                            emotional_anchor: "",
                            detective_radiography: { chronology: "", suspicion: "" },
                            goal_standard: "",
                            isGoal: false,
                            isPregnant: false
                        });

                        // Slice messages starting from the first Motivo Consulta greeting
                        setMessages(prev => {
                            const idx = prev.findIndex(msg => msg.role === 'assistant' && (msg.content.includes('Para diseñar el plan clínico') || msg.content.includes('Para comenzar a diseñar') || msg.content.includes('Ruta Primaria') || msg.content.includes('Motivo de Consulta')));
                            if (idx !== -1) {
                                return prev.slice(0, idx);
                            }
                            return prev.filter(m => !m.isAiAnalysisResult);
                        });

                        setCurrentPhase('PHASE_3_MOTIVO_CONSULTA');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_4_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setCurrentPhase('PHASE_5_PERSONAL_START');
                    } else if (text === 'no') {
                        // Reset AHF data in global data lake
                        setPatientData(prev => ({
                            ...prev,
                            familyTree: { antecedentes: [], alert_detected: false }
                        }));

                        // Slice messages starting from the first AHF greeting
                        setMessages(prev => {
                            const idx = prev.findIndex(msg => msg.role === 'assistant' && (msg.content.includes("mapa de salud de") || msg.content.includes("mapa de salud")));
                            if (idx !== -1) {
                                return prev.slice(0, idx);
                            }
                            return prev;
                        });

                        setCurrentPhase('PHASE_4_FAMILY_HISTORY');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_5_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setCurrentPhase('PHASE_6_PHARMACOLOGY');
                    } else if (text === 'no') {
                        // Reset personal history data to prevent duplicates
                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...(prev.history || {}),
                                personal_structured: [],
                                personal_raw_text: '',
                                personal_checklist_verified: false
                            }
                        }));

                        // Slice messages starting from the first Personal History greeting
                        setMessages(prev => {
                            const idx = prev.findIndex(msg => msg.role === 'assistant' && (msg.content.includes("expediente patológico") || msg.content.includes("perfil genómico")));
                            if (idx !== -1) {
                                return prev.slice(0, idx);
                            }
                            return prev;
                        });

                        setCurrentPhase('PHASE_5_PERSONAL_START');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_6_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setPatientData(prev => ({
                            ...prev,
                            pharmacology_edit_mode: false
                        }));
                        setCurrentPhase('PHASE_7_ALLERGIES');
                    } else if (text === 'no') {
                        // Activar edición granular por línea sin borrar medicamentos ni suplementos capturados
                        setPatientData(prev => ({
                            ...prev,
                            pharmacology_edit_mode: true
                        }));
                        setCurrentPhase('PHASE_6_PHARMACOLOGY');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_7_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setPatientData(prev => ({
                            ...prev,
                            allergies_edit_mode: false,
                            history: {
                                ...(prev.history || {}),
                                allergies_verified: true
                            }
                        }));
                        setCurrentPhase('PHASE_8_DIGESTIVE');
                    } else if (text === 'no') {
                        // Activar menú granular de corrección sin borrar alergias registradas
                        setPatientData(prev => ({
                            ...prev,
                            allergies_edit_mode: true,
                            history: {
                                ...(prev.history || {}),
                                allergies_verified: false
                            }
                        }));
                        setCurrentPhase('PHASE_7_ALLERGIES');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_8_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setPatientData(prev => {
                            const symptoms = stripNegatedSentinels(prev?.history?.digestive_symptoms || []);
                            const freq = symptoms.length > 0 ? (prev?.history?.digestive_frequency || "Ocasional") : "Ninguna";
                            let prof;
                            if (symptoms.length > 0) {
                                const phen = symptoms.some(s => String(s).toLowerCase().includes('estreñ')) ? 'CONSTIPATION' :
                                             symptoms.some(s => String(s).toLowerCase().includes('diarr')) ? 'DIARRHEA' :
                                             symptoms.some(s => String(s).toLowerCase().includes('inflam') || String(s).toLowerCase().includes('colit')) ? 'BLOATING' : 'MIXED';
                                prof = {
                                    has_issues: true,
                                    phenotype: phen,
                                    details: { symptoms: symptoms.join(', '), frequency: freq }
                                };
                            } else {
                                prof = {
                                    has_issues: false,
                                    phenotype: 'EUBIOSIS'
                                };
                            }
                            return {
                                ...prev,
                                digestive_edit_mode: false,
                                history: {
                                    ...(prev?.history || {}),
                                                                        digestive_symptoms: symptoms,
                                    digestive_frequency: freq,
                                    digestive_verified: true
                                },
                                digestive_profile: prof
                            };
                        });

                        const patientAge = patientData?.profile?.age !== undefined ? Number(patientData.profile.age) : (patientData?.identificacion?.edad !== undefined ? Number(patientData.identificacion.edad) : 30);
                        const isFemale = resolvePatientSex(patientData).isFemale;
                        const isGeriatric = patientAge >= 65;

                        if (patientAge < 12) {
                            setCurrentPhase('PHASE_11_ACTIVITY');
                        } else if (isFemale && !isGeriatric) {
                            setCurrentPhase('PHASE_9_PHYSIO');
                        } else {
                            setCurrentPhase('PHASE_10_HABITS');
                        }
                    } else if (text === 'no') {
                        // Activar menú granular de corrección sin borrar síntomas digestivos previos
                        setPatientData(prev => ({
                            ...prev,
                            digestive_edit_mode: true
                        }));
                        setCurrentPhase('PHASE_8_DIGESTIVE');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                case 'PHASE_9_SUMMARY_CONFIRM': {
                    if (text === 'yes') {
                        setPatientData(prev => ({
                            ...prev,
                            physio_edit_mode: false
                        }));
                        setCurrentPhase('PHASE_10_HABITS');
                    } else if (text === 'no') {
                        // Activar menú granular de corrección conservando el estado fisiológico capturado
                        setPatientData(prev => ({
                            ...prev,
                            physio_edit_mode: true,
                            physio: {
                                ...(prev.physio || {}),
                                ignorePhase3PreFill: true
                            }
                        }));
                        setCurrentPhase('PHASE_9_PHYSIO');
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: "Por favor use los botones para confirmar o corregir.", avatar: tiloImg }]);
                    }
                    break;
                }

                // =============== FASE 7: ALERGIAS (MIGRADO) ===============
                // La Fase 7 (Alergias Alimentarias y de Medicamentos) ha sido extraída
                // a su propio componente modular Fase7_Alergias.jsx

                // =============== FASE 8: SALUD DIGESTIVA (MIGRADO) ===============
                // Fase 8 extraída al componente Fase8_SaludDigestiva.jsx

                // =============== FASE 9: ESTADO FISIOLÓGICO (MIGRADO) ===============
                // Fase 9 extraída al componente Fase9_EstadoFisiologico.jsx



                // =============== FASE 10: HÁBITOS Y ESTILO DE VIDA (MIGRADO) ===============
                // Toda la Fase 10 (tabaco) y Fase 11 (alcohol, drogas, ejercicio, sueño) 
                // extraídas al componente Fase10_Habitos.jsx

                // ==========================================
                // FASE 12: NUTRICIÓN Y DIETA (Legacy Fase 5) - MIGRADO
                // Toda la lógica `PHASE_12_*` de aversiones, favoritos, R24H y FFQ
                // se ha pasado al componente independiente: Fase11_EvaluacionDietetica.jsx
                // ==========================================

                // ----------------------------------------------------------------------------------
                // FASE 13: BIOMÉTRICOS Y SIGNOS VITALES (LEGACY FASE 6)
                // ----------------------------------------------------------------------------------
                case 'PHASE_13_BIO_START': {
                    const cleaned = text.toLowerCase().trim();
                    if (cleaned === 'listo' || cleaned === 'lista') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Excelente. Se ha registrado su disposición.\n\n---\n\nHabilitando el acceso al Diagnóstico Integral y la toma de mediciones físicas.",
                            avatar: tiloImg
                        }]);
                        setCurrentPhase('PHASE_13_COMPLETE_HANDOFF');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Por favor, escriba **'Listo'** o **'Lista'** una vez que se encuentre en posición en el área de medición para continuar.`,
                            avatar: tiloImg
                        }]);
                    }
                    break;
                }

                case 'PHASE_14_R24H':
                case 'PHASE_15_FFQ':
                case 'PHASE_16_BIOMETRICS':
                case 'PHASE_17_VITALS':
                case 'PHASE_18_ELECTRET':
                case 'PHASE_19_DIAGNOSIS':
                case 'PHASE_20_PORTAPAPELES':
                case 'PHASE_21_CALENDARIO': {
                    // Estas fases son manejadas por sus respectivos componentes modulares de entrevista.
                    // Si la entrada llega aquí, solicitamos ingresar el dato correspondiente.
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Por favor, ingrese el valor requerido o seleccione una opción para continuar con la evaluación.",
                        avatar: tiloImg
                    }]);
                    break;
                }

                default:
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Lo siento, me he perdido en mis procesos mentales. ¿Podría repetir?",
                        avatar: tiloImg
                    }]);
                    break;
            }
        }, 500); // Pequeño retraso para dar sensación de "pensamiento"
    };

    return {
        currentPhase,
        messages,
        patientData,
        activeTab,
        processUserInput,
        setActiveTab,
        setPatientData, // Expose for MedicalDashboard direct edits
        setMessages,     // Expose for advanced UI manipulations (e.g. typing indicators)
        clearSession,
        setCurrentPhase,
        apiContext,       // <--- NEW EXPORT for Header & Persistence
        fase3State,
        setFase3State,
        triggerPhase1Summary,
        triggerPhase2Summary,
        triggerPhase3Summary,
        triggerPhase4Summary,
        triggerPhase5Summary,
        triggerPhase6Summary,
        triggerPhase7Summary,
        triggerPhase8Summary,
        triggerPhase9Summary
    };
};

export default useCortex;
