import { useClinicalGenome } from '../store/useClinicalGenome';

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

    let patientSex = 'M';
    if (identityLock?.patientInfo?.gender) {
        patientSex = identityLock.patientInfo.gender;
    } else if (patientData) {
        if (patientData.profile?.sex) patientSex = patientData.profile.sex;
        else if (patientData.profile?.gender) patientSex = patientData.profile.gender;
        else if (patientData.identificacion?.sexo) patientSex = patientData.identificacion.sexo;
    }

    let patientName = "el paciente";
    if (identityLock?.patientInfo?.name) {
        patientName = identityLock.patientInfo.name;
    } else if (patientData) {
        if (patientData.profile?.name) patientName = patientData.profile.name;
        else if (patientData.identificacion?.nombre) patientName = patientData.identificacion.nombre;
    }

    const cleanName = patientName !== "NOM" ? patientName.split(' ')[0] : "el paciente";

    const isLactante = patientAge < 2;
    const isPreescolar = patientAge >= 2 && patientAge < 6;
    const isEscolar = patientAge >= 6 && patientAge < 12;
    const isMinor = patientAge < 12;
    const isPediatrico = patientAge < 18;
    const isAdolescente = patientAge >= 12 && patientAge < 18;
    const isGeriatric = patientAge >= 65;

    let babyTerm = "el paciente";
    if (isLactante) babyTerm = "su bebé";
    else if (isMinor) babyTerm = "su hijo/a";

    let placeholder = isLactante 
        ? `Escriba el motivo principal para el bebé ${cleanName}...`
        : (isMinor ? `Escriba el motivo principal para ${cleanName}...` : "Describa brevemente su motivo...");

    return { 
        patientAge, 
        patientSex, 
        patientGender: patientSex, 
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
