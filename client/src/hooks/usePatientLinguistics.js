import { useClinicalGenome } from '../store/useClinicalGenome';

export const usePatientLinguistics = (patientData) => {
    const identityLock = useClinicalGenome(state => state.identityLock);

    let patientAge = 30;
    if (identityLock?.patientInfo?.age !== undefined && identityLock?.patientInfo?.age !== null) {
        patientAge = Number(identityLock.patientInfo.age);
    } else if (patientData) {
        if (patientData.profile?.age !== undefined && patientData.profile?.age !== null) patientAge = Number(patientData.profile.age);
        else if (patientData.identificacion?.edad !== undefined && patientData.identificacion?.edad !== null) patientAge = Number(patientData.identificacion.edad);
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

    // Para efectos lingüísticos en las plantillas de chat, consideramos "isMinor" 
    // a los pacientes menores de 12 años (pediátricos). Para adolescentes (12-17),
    // el protocolo de comunicación exige el tratamiento directo de "Usted" 
    // (soberanía biológica), comportándose igual que los adultos en el diálogo.
    const isMinor = patientAge < 12;
    const isGeriatric = patientAge >= 65;
    const cleanName = patientName !== "NOM" ? patientName.split(' ')[0] : "el paciente";
    
    let placeholder = isMinor 
        ? `Escriba el motivo principal para ${cleanName}...`
        : "Describa brevemente su motivo...";

    return { patientAge, patientSex, patientGender: patientSex, patientName: cleanName, placeholder, isMinor, isGeriatric, pName: cleanName };
};
