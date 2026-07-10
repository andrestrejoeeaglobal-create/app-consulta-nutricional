import React, { useEffect, useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react'; // Added alert icon
import { formatPhoneNumber } from '../utils/utils'; // V15.6 Format phone number
import { classifyLifeStage } from '../utils/ageClassifier';

// Helper for rendering fields (Defined outside to avoid re-creation on render)
const IdentityField = ({ label, value, fullWidth = false, isMono = false, hasDiscrepancy = false }) => {
    const isFilled = value && value !== "---" && value !== "";

    return (
        <div className={`flex flex-col ${fullWidth ? 'col-span-full' : ''} transition-all duration-500`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${hasDiscrepancy ? 'text-orange-500' : isFilled ? 'text-blue-500' : 'text-gray-300'}`}>
                {label} {hasDiscrepancy && <TriangleAlert className="inline w-3 h-3 ml-1 text-orange-500" />}
            </span>
            <div className={`
        text-sm pb-1 border-b 
        ${hasDiscrepancy ? 'border-orange-500 text-orange-700 bg-orange-50 px-2 rounded-md font-bold' :
                    isFilled ? 'border-gray-300 text-gray-800 font-bold' : 'border-gray-100 text-gray-300 font-normal'}
        ${isMono ? 'font-mono' : ''}
        ${isFilled && isMono && !hasDiscrepancy ? 'bg-gray-50 px-2 rounded-md' : ''}
        transition-colors duration-300
        relative
      `}>
                {isFilled ? (
                    <motion.span
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {value}
                    </motion.span>
                ) : (
                    "---"
                )}
            </div>
        </div>
    );
};

const VisualIdentityCard = ({ patientData }) => {
    const cardRef = useRef(null);
    const idData = patientData.identificacion || {};
    const profileData = patientData.profile || {};

    // Auto-scroll effect whenever data changes
    // Using specific fields in dependency array to avoid deep object comparison issues or unstable references
    useEffect(() => {
        if (cardRef.current) {
            // Scroll only if there is actual data content to avoid initial jump
            const hasData = [
                profileData.first_name || idData.nombre,
                profileData.last_name_pat || idData.apellidoPaterno,
                profileData.last_name_mat || idData.apellidoMaterno,
                profileData.birthdate || idData.fechanac,
                profileData.sex || idData.sexo,
                profileData.marital_status || idData.civil_status,
                profileData.occupation || idData.ocupacion,
                profileData.curp || idData.curp,
                profileData.phone || idData.telefono,
                profileData.religion || idData.religion
            ].some(val => val && val !== "");

            if (hasData) {
                cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }, [
        profileData.first_name, profileData.last_name_pat, profileData.last_name_mat,
        profileData.birthdate, profileData.sex, profileData.marital_status,
        profileData.occupation, profileData.curp, profileData.phone, profileData.religion,
        idData.nombre, idData.apellidoPaterno, idData.apellidoMaterno,
        idData.fechanac, idData.sexo, idData.civil_status,
        idData.ocupacion, idData.curp, idData.telefono, idData.religion
    ]);

    return (
        <div ref={cardRef} className="space-y-6">

            {/* NIVEL 1: IDENTIDAD NOMINAL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IdentityField label="Nombre(s)" value={profileData.first_name || idData.nombre} />
                <IdentityField label="Apellido Paterno" value={profileData.last_name_pat || idData.apellidoPaterno} />
                <IdentityField
                    label="Apellido Materno"
                    value={profileData.last_name_mat || idData.apellidoMaterno}
                    hasDiscrepancy={idData.discrepanciaMaterno}
                />
            </div>

            {/* NIVEL 2: BIOMETRÍA BÁSICA */}
            <div className="grid grid-cols-3 gap-4">
                <IdentityField label="Fecha Nacimiento" value={profileData.birthdate || idData.fechanac} />
                <IdentityField label="Edad" value={profileData.age !== undefined && profileData.age !== null ? (profileData.age === 0 ? `${profileData.baby_age_months ?? '--'} Meses` : `${profileData.age} Años`) : (idData.edad !== undefined && idData.edad !== null ? (idData.edad === 0 ? `${idData.baby_age_months ?? '--'} Meses` : `${idData.edad} Años`) : "")} />
                <IdentityField label="Sexo Biológico" value={profileData.sex || idData.sexo} />
            </div>

            {/* NIVEL 3: PERFIL SOCIAL */}
            <div className="grid grid-cols-2 gap-4">
                <IdentityField label="Estado Civil" value={profileData.marital_status || idData.civil_status} />
                <IdentityField label="Ocupación" value={profileData.occupation || idData.ocupacion} />
            </div>

            {/* NIVEL 4: IDENTIDAD LEGAL */}
            <div className="grid grid-cols-1">
                <IdentityField
                    label="CURP / Pasaporte"
                    value={profileData.curp || profileData.passport_id || idData.curp || idData.passport_id}
                    fullWidth={true}
                    isMono={true}
                />
            </div>

            {/* NIVEL 5: CONTACTO Y CULTURA */}
            <div className="grid grid-cols-2 gap-4">
                <IdentityField label="Teléfono Celular" value={formatPhoneNumber(profileData.phone || idData.telefono)} />
                <IdentityField label="Religión" value={profileData.religion || idData.religion} />
            </div>

        </div>
    );
};

export default VisualIdentityCard;
