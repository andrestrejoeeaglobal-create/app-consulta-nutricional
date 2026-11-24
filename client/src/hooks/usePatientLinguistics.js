import { useClinicalGenome } from '../store/useClinicalGenome';
import { resolvePatientSex } from '../utils/genderConcordance';

const deriveAgeFromBirthdateOrCurp = (patientData) => {
    try {
        const rawDob = patientData?.profile?.birthdate || patientData?.identificacion?.fechanac || patientData?.demographics?.birthdate || "";
        if (typeof rawDob === 'string' && rawDob.trim()) {
            const clean = rawDob.trim();
            let bDate = null;
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
                const [dd, mm, yyyy] = clean.split('/').map(v => parseInt(v, 10));
                bDate = new Date(yyyy, mm - 1, dd);
            } else if (/^\d{4}-\d{1,2}-\d{1,2}/.test(clean)) {
                const [yyyy, mm, dd] = clean.slice(0, 10).split('-').map(v => parseInt(v, 10));
                bDate = new Date(yyyy, mm - 1, dd);
            }
            if (bDate && !isNaN(bDate.getTime())) {
                const today = new Date();
                let calc = today.getFullYear() - bDate.getFullYear();
                const mDiff = today.getMonth() - bDate.getMonth();
                if (mDiff < 0 || (mDiff === 0 && today.getDate() < bDate.getDate())) {
                    calc--;
                }
                if (calc >= 0 && calc <= 125) {
                    return { age: calc, hasBirthEvidence: true };
                }
            }
        }

        const rawCurp = String(patientData?.profile?.curp || patientData?.identificacion?.curp || patientData?.demographics?.curp || "").trim().toUpperCase();
        const curpMatch = rawCurp.match(/^[A-Z]{4}(\d{2})(\d{2})(\d{2})[HMX][A-Z]{5}([A-Z0-9])\d$/);
        if (curpMatch) {
            const yy = parseInt(curpMatch[1], 10);
            const mm = parseInt(curpMatch[2], 10);
            const dd = parseInt(curpMatch[3], 10);
            const homoclaveChar = curpMatch[4];
            const fullYear = /[0-9]/.test(homoclaveChar) ? (1900 + yy) : (2000 + yy);
            const bDate = new Date(fullYear, mm - 1, dd);
            if (!isNaN(bDate.getTime())) {
                const today = new Date();
                let calc = today.getFullYear() - bDate.getFullYear();
                const mDiff = today.getMonth() - bDate.getMonth();
                if (mDiff < 0 || (mDiff === 0 && today.getDate() < bDate.getDate())) {
                    calc--;
                }
                if (calc >= 0 && calc <= 125) {
                    return { age: calc, hasBirthEvidence: true };
                }
            }
        }
    } catch (_) {
        // Fallback seguro a modo adulto ("Usted Global")
    }
    return { age: null, hasBirthEvidence: false };
};

export const usePatientLinguistics = (patientData) => {
    const identityLock = useClinicalGenome(state => state.identityLock);

    const derived = deriveAgeFromBirthdateOrCurp(patientData);
    const hasExplicitInfantEvidence = Boolean(
        derived.hasBirthEvidence && derived.age === 0
    ) || Boolean(
        patientData?.profile?.pediatric_profile?.is_minor === true &&
        (patientData?.profile?.baby_age_months !== null && patientData?.profile?.baby_age_months !== undefined)
    );

    let resolvedNumericAge = null;
    const ageCandidates = [
        identityLock?.patientInfo?.age,
        patientData?.age,
        patientData?.edad,
        patientData?.identificacion?.edad,
        patientData?.profile?.age,
        patientData?.session_context?.calculated_age,
        patientData?.demographics?.age,
        patientData?.vitals?.age,
        patientData?.profile?.pediatric_profile?.age
    ];
    for (const val of ageCandidates) {
        if (val !== undefined && val !== null && val !== "" && typeof val !== "boolean") {
            const num = Number(val);
            if (Number.isFinite(num) && num >= 0 && num <= 125) {
                // Prohibido coercionar centinela 0 a lactante sin evidencia explícita de nacimiento < 1 año
                if (num === 0 && !hasExplicitInfantEvidence) {
                    continue;
                }
                resolvedNumericAge = num;
                break;
            }
        }
    }

    if (resolvedNumericAge === null && derived.age !== null) {
        resolvedNumericAge = derived.age;
    }

    const hasConfirmedAge = resolvedNumericAge !== null;
    const patientAge = hasConfirmedAge ? resolvedNumericAge : 30;

    const resolvedSex = resolvePatientSex(patientData, identityLock);
    const isFemale = resolvedSex.isFemale;
    const genderCode = resolvedSex.code;

    let patientSex = resolvedSex.code;
    if (identityLock?.patientInfo?.gender) {
        patientSex = identityLock.patientInfo.gender;
    } else if (patientData) {
        if (patientData.profile?.sex) patientSex = patientData.profile.sex;
        else if (patientData.profile?.gender) patientSex = patientData.profile.gender;
        else if (patientData.identificacion?.sexo) patientSex = patientData.identificacion.sexo;
    }

    const defaultPatientLabel = isFemale ? "la paciente" : "el paciente";
    let patientName = defaultPatientLabel;
    if (identityLock?.patientInfo?.name) {
        patientName = identityLock.patientInfo.name;
    } else if (patientData) {
        if (patientData.profile?.name) patientName = patientData.profile.name;
        else if (patientData.identificacion?.nombre) patientName = patientData.identificacion.nombre;
    }

    const cleanName = (patientName && patientName !== "NOM" && patientName !== "el paciente" && patientName !== "la paciente")
        ? patientName.split(' ')[0]
        : defaultPatientLabel;

    // Solo activar modos pediátricos/tutor cuando existe edad numérica explícita confirmada < 18
    const isLactante = hasConfirmedAge && patientAge < 2;
    const isPreescolar = hasConfirmedAge && patientAge >= 2 && patientAge < 6;
    const isEscolar = hasConfirmedAge && patientAge >= 6 && patientAge < 12;
    const isMinor = hasConfirmedAge && patientAge < 12;
    const isPediatrico = hasConfirmedAge && patientAge < 18;
    const isAdolescente = hasConfirmedAge && patientAge >= 12 && patientAge < 18;
    const isGeriatric = hasConfirmedAge && patientAge >= 65;

    let babyTerm = defaultPatientLabel;
    if (isLactante) babyTerm = "su bebé";
    else if (isMinor) babyTerm = isFemale ? "su hija" : "su hijo";

    let placeholder = isLactante 
        ? `Escriba el motivo principal para ${isFemale ? 'la bebé' : 'el bebé'} ${cleanName}...`
        : (isMinor ? `Escriba el motivo principal para ${cleanName}...` : "Describa brevemente su motivo...");

    return { 
        patientAge, 
        patientSex, 
        patientGender: patientSex,
        isFemale,
        genderCode,
        patientName: cleanName, 
        placeholder, 
        isMinor, 
        isPediatrico,
        isLactante,
        isPreescolar,
        isEscolar,
        isAdolescente,
        isGeriatric, 
        pName: cleanName,
        babyTerm
    };
};
