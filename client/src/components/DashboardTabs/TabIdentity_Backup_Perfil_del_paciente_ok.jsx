/* eslint-disable no-unused-vars */
import React from 'react';
import { User, Edit2, Search, AlertTriangle, AlertCircle, MapPin, FileText, Timer, Star, Activity, ShieldAlert, Heart, ChevronDown, HeartPulse, Droplets, Thermometer, Brain, Footprints, Baby, ShieldCheck, Check } from 'lucide-react';
import { formatDateShort } from '../../utils/utils';
import { AddressForm } from '../ui/AddressForm';
import { AddressMap } from '../ui/AddressMap';

export const TabIdentity = ({
    patientData,
    setPatientData,
    isEditing,
    onTriggerEdit,
    onEditToggle,
    renderEditableField,
    CardHeader,
    Accordion,
    openSections,
    toggleSection,
    currentStep,
    TAG_CONFIG
}) => {
    // Custom render for Date of Birth using the new short format
    const renderDobField = () => {
        const forceReadOnly = patientData?.profile?.curpValidated === true && patientData?.profile?.nationality_type !== 'FOREIGN';
        const activeField = isEditing && !forceReadOnly;

        return (
            <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                    Fecha Nacimiento
                </label>
                <div className={`p-3 rounded-xl border min-h-[50px] flex items-center transition-all duration-300 ${activeField ? 'bg-white border-blue-500 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-200'
                    }`}>
                    {activeField ? (
                        <input
                            type="text"
                            value={patientData?.profile?.birthdate || ''}
                            onChange={(e) => setPatientData(prev => ({
                                ...prev,
                                profile: { ...prev.profile, birthdate: e.target.value }
                            }))}
                            className="w-full bg-transparent outline-none text-slate-700 font-medium text-sm"
                            placeholder="DD/MM/YYYY"
                        />
                    ) : (
                        <span className="text-slate-700 font-medium dashboard-data-text">
                            {formatDateShort(patientData?.profile?.birthdate) || '--'}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* --- ACORDEÓN PADRE: PERFIL PACIENTE (NUEVO V15.5) --- */}
            <Accordion
                title="Perfil del Paciente"
                id="accordion-profile-parent"
                isOpen={openSections.parentProfile}
                onToggle={() => toggleSection('parentProfile')}
                variant="parent"
            >
                <div className="space-y-6">
                    {/* --- MÓDULO 1: DATOS DE IDENTIFICACIÓN (ACORDEÓN) --- */}
                    <div>
                        <Accordion
                            title="Datos de Identificación"
                            id="accordion-identity"
                            isOpen={openSections.childIdentity}
                            onToggle={() => toggleSection('childIdentity')}
                        >
                            <div className="space-y-6">
                                {/* TARJETA 1: DATOS DE IDENTIFICACIÓN */}
                                <div id="card-intro" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative">
                                    {/* HEADER CON BOTÓN DE EDICIÓN (Removido por PH1-TAB-UI-CLEANUP) */}
                                    <div className="flex justify-between items-center mb-6 border-b border-blue-100 pb-3">
                                        <h4 className={`text-sm font-bold uppercase flex items-center gap-2 tracking-wider ${patientData?.session_context?.demographic_sealed ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {patientData?.session_context?.demographic_sealed ? <ShieldCheck size={16} /> : <User size={16} />}
                                            {patientData?.session_context?.demographic_sealed ? 'BLOQUE DEMOGRÁFICO SELLADO' : 'Datos de Identificación'}
                                        </h4>
                                    </div>

                                    {/* Fila 1: Nombres Desglosados */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {renderEditableField('Nombre(s)', 'first_name', '--', 'profile', false, 'dashboard-data-text', patientData?.profile?.curpValidated === true && patientData?.profile?.nationality_type !== 'FOREIGN')}
                                        {renderEditableField('Apellido Paterno', 'last_name_pat', '--', 'profile', false, 'dashboard-data-text', patientData?.profile?.curpValidated === true && patientData?.profile?.nationality_type !== 'FOREIGN')}
                                        {renderEditableField('Apellido Materno', 'last_name_mat', '--', 'profile', false, 'dashboard-data-text', patientData?.profile?.curpValidated === true && patientData?.profile?.nationality_type !== 'FOREIGN')}
                                    </div>

                                    {/* Fila 2: Fecha Nac | Edad | Sexo */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {renderDobField()}

                                        {/* Edad (Calculada) */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Edad</label>
                                            <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium border border-slate-200 min-h-[50px] flex items-center relative transition-all duration-300">
                                                {(() => {
                                                    const ageY = patientData?.profile?.age;
                                                    if (ageY === undefined || ageY === null || isNaN(ageY)) return '-- Años';
                                                    if (ageY >= 2) return `${ageY} Años`;
                                                    
                                                    // Calculamos edad en días/meses a partir de la fecha de nacimiento real (YYYY-MM-DD o DD/MM/YYYY)
                                                    const bd = patientData?.profile?.birthdate;
                                                    if (!bd) return `${ageY} Años`;
                                                    
                                                    try {
                                                        let dateObj;
                                                        if (bd.includes('/')) {
                                                            const parts = bd.split('/');
                                                            dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                                                        } else {
                                                            dateObj = new Date(bd); // fallback
                                                        }
                                                        
                                                        // Usando 2026 como base "Actual" hardcodeada o fecha actual
                                                        const todayDate = new Date();
                                                        // Fallback to strict validation check year
                                                        const referenceYear = 2026;
                                                        const currentYear = todayDate.getFullYear();
                                                        const pivotDate = currentYear < referenceYear ? new Date(referenceYear, 1, 15) : todayDate; // Aproximación

                                                        const diffTime = Math.abs(pivotDate - dateObj);
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                                                        
                                                        if (diffDays <= 28) return `${diffDays} Días (Neonato)`;
                                                        if (diffDays < 365 * 2) {
                                                            const diffMonths = Math.floor(diffDays / 30.44);
                                                            return `${diffMonths} Meses (Lactante)`;
                                                        }
                                                        return `${ageY} Años`;
                                                    } catch (e) {
                                                        return `${ageY} Años`;
                                                    }
                                                })()}
                                            </div>
                                        </div>

                                        {renderEditableField('Sexo', 'sex', '--', 'profile', false, '', patientData?.profile?.curpValidated === true && patientData?.profile?.nationality_type !== 'FOREIGN')}
                                    </div>

                                    {/* Fila 3: Ocupación | CURP/PASAPORTE | Nacionalidad (si aplica) */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {(() => {
                                            const ageP = patientData?.profile?.age;
                                            let occLabel = 'Ocupación';
                                            if (ageP !== undefined) {
                                                if (ageP <= 2) occLabel = 'Entorno de Cuidado';
                                                else if (ageP >= 3 && ageP <= 17) occLabel = 'Escolaridad';
                                                else occLabel = 'Ocupación';
                                            }
                                            return renderEditableField(occLabel, 'occupation', '--', 'profile');
                                        })()}

                                        {/* CURP vs PASAPORTE */}
                                        <div className={`${patientData?.profile?.nationality_type === 'FOREIGN' ? 'md:col-span-1' : 'md:col-span-2'} flex flex-col gap-1`}>
                                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                {patientData?.profile?.nationality_type === 'FOREIGN' ? "PASAPORTE / DOCUMENTO DE IDENTIDAD" : "CURP"}
                                            </label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 relative transition-all duration-300">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            name={patientData?.profile?.nationality_type === 'FOREIGN' ? "passport_id" : "curp"}
                                                            value={patientData?.profile?.nationality_type === 'FOREIGN'
                                                                ? (patientData?.profile?.passport_id || '')
                                                                : (patientData?.profile?.curp || '')}
                                                            onChange={(e) => setPatientData(prev => ({
                                                                ...prev,
                                                                profile: {
                                                                    ...prev.profile,
                                                                    [patientData?.profile?.nationality_type === 'FOREIGN' ? 'passport_id' : 'curp']: e.target.value
                                                                }
                                                            }))}
                                                            className="w-full p-3 rounded-xl bg-white border-2 border-blue-100 text-slate-700 font-medium focus:border-blue-500 outline-none tracking-widest uppercase text-xs dashboard-data-code"
                                                        />
                                                    ) : (
                                                        patientData?.profile?.nationality_type === 'FOREIGN' ? (
                                                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex items-center justify-between">
                                                                <div className="text-gray-800 font-medium text-sm flex items-center gap-2">
                                                                    <span>{patientData?.profile?.passport_id || "---"}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className={`p-3 rounded-xl border min-h-[50px] flex items-center flex-1 dashboard-data-code justify-between transition-all duration-500 ${patientData?.profile?.curpValidated === true ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-100 shadow-sm text-emerald-800' : patientData?.profile?.curpValidated !== false ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-300'
                                                                }`}>
                                                                <span>
                                                                    {patientData?.profile?.curp || '--'}
                                                                </span>
                                                                {patientData?.profile?.curpValidated === true && (
                                                                    <div className="flex items-center gap-1 text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md text-[10px]">
                                                                        <Check size={12} strokeWidth={3} />
                                                                        <span className="font-bold">VALIDADO POR AUTORIDAD</span>
                                                                    </div>
                                                                )}

                                                                {/* V3.5: INDICADOR VISUAL CURP (Solo si es Nacional) */}
                                                                {patientData?.profile?.nationality_type !== 'FOREIGN' && patientData?.profile?.curp && (
                                                                    <span className="text-xs font-bold">
                                                                        {patientData?.profile?.curpValidated !== false ? (
                                                                            <span className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded">✅ Validada</span>
                                                                        ) : (
                                                                            <span className="text-amber-600 bg-amber-100 px-2 py-1 rounded flex items-center gap-1">
                                                                                <AlertTriangle size={12} /> Re-Verificar
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                                {/* Link solo para CURP */}
                                                {patientData?.profile?.nationality_type !== 'FOREIGN' && (
                                                    <a
                                                        href="https://www.gob.mx/curp/"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 p-3 rounded-xl flex items-center justify-center transition-colors"
                                                        title="Consultar CURP Oficial"
                                                    >
                                                        <Search size={18} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* NACIONALIDAD (Solo Extranjeros) */}
                                        {patientData?.profile?.nationality_type === 'FOREIGN' && (
                                            renderEditableField('Nacionalidad', 'nationality', 'Ej. Estadounidense', 'profile')
                                        )}
                                    </div>

                                    {/* Fila 4: Teléfono | Religión | Estado Civil */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {renderEditableField('Teléfono', 'phone', '--', 'profile', false, 'dashboard-data-code')}
                                        {renderEditableField('Religión', 'religion', '--', 'profile')}
                                        {patientData?.profile?.pediatric_profile?.ui_controls?.show_marital_status !== false &&
                                            renderEditableField('Estado Civil', 'marital_status', '--', 'profile')}
                                    </div>
                                </div>
                            </div>
                        </Accordion>
                    </div>

                    {/* --- MÓDULO 1.2: DOMICILIO GEOGRÁFICO (ACORDEÓN SEPARADO) --- */}
                    <div>
                        <Accordion
                            title="Domicilio Geográfico"
                            id="accordion-address"
                            isOpen={openSections.childAddress}
                            onToggle={() => toggleSection('childAddress')}
                        >
                            <div className="space-y-6">
                                {/* TARJETA 2: DOMICILIO */}
                                <div id="card-address" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 relative">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <MapPin className="w-4 h-4" /> Domicilio
                                        </h3>
                                    </div>

                                    <div className="w-full mb-4">
                                        {renderEditableField('Código Postal', 'cp', '--', 'domicilio', false, 'dashboard-data-code')}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {renderEditableField('Estado', 'estado', '--', 'domicilio', false, 'dashboard-data-text')}
                                        {renderEditableField('Municipio / Alcaldía', 'municipio', '--', 'domicilio', false, 'dashboard-data-text')}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-4">
                                        <div className="w-full pt-1">
                                            {renderEditableField('Colonia', 'colonia', '--', 'domicilio', false, 'dashboard-data-text')}
                                        </div>
                                        <div className="w-full">
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                                                Calle y Número Exterior / Interior
                                            </label>
                                            <AddressForm 
                                                zipCode={patientData?.domicilio?.cp}
                                                settlement={patientData?.domicilio?.colonia}
                                                initialValue={patientData?.domicilio?.calle}
                                                isEditing={isEditing}
                                                onSave={(addressData) => {
                                                    setPatientData(prev => ({
                                                        ...prev,
                                                        domicilio: {
                                                            ...prev.domicilio,
                                                            calle: addressData.fullAddress,
                                                            coordinates: addressData.coords,
                                                            addressStatus: 'VERIFIED'
                                                        }
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="w-full mt-2">
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                                            Confirmación Cartográfica
                                        </label>
                                        <AddressMap coordinates={patientData?.domicilio?.coordinates} />
                                    </div>
                                </div>
                            </div>
                        </Accordion>
                    </div>

                    {/* --- SECCIÓN 1.5: SEGURIDAD (Separated) --- */}
                    <div>
                        <Accordion
                            title="Seguridad y Contacto"
                            id="accordion-security"
                            isOpen={openSections.childSecurity}
                            onToggle={() => toggleSection('childSecurity')}
                        >
                            {/* TARJETA 3: CONTACTO DE EMERGENCIA */}
                            <div id="card-emergency" className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-rose-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>

                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-sm font-bold text-rose-500 uppercase tracking-wider flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> En Caso de Emergencia
                                    </h3>
                                </div>

                                <div className="relative z-10 space-y-4">
                                    <div className="w-full">
                                        {renderEditableField('Nombre Completo', 'nombre', '--', 'emergencia', false, 'dashboard-data-text')}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderEditableField('Parentesco', 'parentesco', '--', 'emergencia')}
                                        {renderEditableField('Teléfono de Contacto', 'telefono', '--', 'emergencia', false, 'dashboard-data-code')}
                                    </div>
                                </div>
                            </div>
                        </Accordion>
                    </div>

                    {/* La sección de Motivo de Consulta ha sido migrada a TabClinical.jsx */}
                </div>
            </Accordion>
        </div>
    );
};

export default TabIdentity;
