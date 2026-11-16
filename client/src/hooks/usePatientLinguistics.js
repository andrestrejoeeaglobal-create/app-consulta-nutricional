import { useClinicalGenome } from '../store/useClinicalGenome';
import { resolvePatientSex } from '../utils/genderConcordance';

export const usePatientLinguistics = (patientData) => {
    const identityLock = useClinicalGenome(state => state.identityLock);

    let patientAge = 30;
    const ageCandidates = [
        identityLock?.patientInfo?.age,
        patientData?.age,
        patientData?.edad,
        patientData?.identificacion?.edad,
        patientData?.profile?.age,
        patientData?.vitals?.age,
        patientData?.profile?.pediatric_profile?.age
    ];
    for (const val of ageCandidates) {
        if (val !== undefined && val !== null && val !== "") {
            const num = Number(val);
            if (!isNaN(num)) {
                patientAge = num;
                break;
            }
        }
    }

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

    const isLactante = patientAge < 2;
    const isPreescolar = patientAge >= 2 && patientAge < 6;
    const isEscolar = patientAge >= 6 && patientAge < 12;
    const isMinor = patientAge < 12;
    const isPediatrico = patientAge < 18;
    const isAdolescente = patientAge >= 12 && patientAge < 18;
    const isGeriatric = patientAge >= 65;

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
