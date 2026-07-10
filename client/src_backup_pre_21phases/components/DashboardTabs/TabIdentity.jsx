/* eslint-disable no-unused-vars */
import React from 'react';
import { User, Edit2, Search, AlertTriangle, AlertCircle, MapPin, FileText, Timer, Zap, Star, Activity, ShieldAlert, Heart, ChevronDown, HeartPulse, Droplets, Thermometer, Brain, Footprints, Baby, ShieldCheck } from 'lucide-react';

import { formatDateShort } from '../../utils/utils';
import { GamificationRings, StreakCard } from '../ui/GamificationRings';
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
        return (
            <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                    Fecha Nacimiento
                </label>
                <div className={`p-3 rounded-xl border min-h-[50px] flex items-center transition-all duration-300 ${isEditing ? 'bg-white border-blue-500 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-200'
                    }`}>
                    {isEditing ? (
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
                    {/* --- BENTO GRID: GAMIFICATION & RESUMEN (NEW) --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Gamification Rings Bento Box */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Activity size={16} /> Progreso Metabólico
                            </h3>
                            <GamificationRings gamificationState={patientData?.gamification} />
                        </div>

                        {/* Streaks Bento Box */}
                        <div className="lg:col-span-1 flex flex-col justify-center">
                            <StreakCard gamificationState={patientData?.gamification} />
                        </div>
                    </div>
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
                                    {/* HEADER CON BOTÓN DE EDICIÓN */}
                                    <div className="flex justify-between items-center mb-6 border-b border-blue-100 pb-3">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2 tracking-wider">
                                            <User size={16} /> Datos de Identificación
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => onTriggerEdit ? onTriggerEdit('identity') : onEditToggle()} // V3.5 Hook
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        >
                                            <Edit2 className="w-3 h-3" /> EDITAR
                                        </button>
                                    </div>

                                    {/* Fila 1: Nombres Desglosados */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {renderEditableField('Nombre(s)', 'first_name', '--', 'profile', false, 'dashboard-data-text')}
                                        {renderEditableField('Apellido Paterno', 'last_name_pat', '--', 'profile', false, 'dashboard-data-text')}
                                        {renderEditableField('Apellido Materno', 'last_name_mat', '--', 'profile', false, 'dashboard-data-text')}
                                    </div>

                                    {/* Fila 2: Fecha Nac | Edad | Sexo */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {renderDobField()}

                                        {/* Edad (Calculada) */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Edad</label>
                                            <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium border border-slate-200 min-h-[50px] flex items-center relative transition-all duration-300">
                                                {patientData?.profile?.age !== undefined && patientData?.profile?.age !== null 
                                                    ? (patientData.profile.age === 0 ? `${patientData.profile.baby_age_months ?? '--'} Meses` : `${patientData.profile.age} Años`) 
                                                    : '-- Años'}
                                            </div>
                                        </div>

                                        {renderEditableField('Sexo', 'sex', '--', 'profile')}
                                    </div>

                                    {/* Fila 3: Ocupación | CURP (span 2) */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {renderEditableField(patientData?.profile?.pediatric_profile?.ui_controls?.occupation_label || 'Ocupación', 'occupation', '--', 'profile')}

                                        {/* CURP vs PASAPORTE */}
                                        <div className="md:col-span-2 flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                {patientData?.profile?.nationality_type === 'FOREIGN' ? "PASAPORTE / ID" : "CURP"}
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
                                                                    <span className="text-gray-400 text-xs font-normal">(Extranjero)</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className={`p-3 rounded-xl border min-h-[50px] flex items-center flex-1 dashboard-data-code justify-between ${patientData?.profile?.curpValidated !== false ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-300'
                                                                }`}>
                                                                <span>
                                                                    {patientData?.profile?.curp || '--'}
                                                                </span>

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

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (onTriggerEdit) {
                                                    onTriggerEdit('address');
                                                } else {
                                                    alert("Error: Función de edición no conectada.");
                                                }
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                                        >
                                            <Edit2 className="w-3 h-3" /> EDITAR
                                        </button>
                                    </div>

                                    <div className="w-full mb-4">
                                        {renderEditableField('Código Postal', 'cp', '--', 'domicilio', false, 'dashboard-data-code')}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {renderEditableField('Estado', 'estado', '--', 'domicilio', false, 'dashboard-data-text')}
                                        {renderEditableField('Municipio / Alcaldía', 'municipio', '--', 'domicilio', false, 'dashboard-data-text')}
                                    </div>

                                    <div className="w-full mb-4">
                                        {renderEditableField('Colonia', 'colonia', '--', 'domicilio', false, 'dashboard-data-text')}
                                    </div>

                                    <div className="w-full">
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                                            Calle y Número Exterior / Interior
                                        </label>
                                        <AddressForm 
                                            zipCode={patientData?.domicilio?.cp}
                                            initialValue={patientData?.domicilio?.calle}
                                            isEditing={isEditing}
                                            onSave={(addressData) => {
                                                setPatientData(prev => ({
                                                    ...prev,
                                                    profile: {
                                                        ...prev.profile,
                                                        address: {
                                                            ...prev.profile.address,
                                                            street: addressData.fullAddress,
                                                            coordinates: addressData.coords
                                                        }
                                                    },
                                                    domicilio: {
                                                        ...prev.domicilio,
                                                        calle: addressData.fullAddress,
                                                        direccion_googlemaps: addressData.fullAddress,
                                                        coordinates: addressData.coords,
                                                        addressStatus: 'VERIFIED'
                                                    }
                                                }));
                                            }}
                                        />
                                        
                                        <div className="mt-4">
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                                                Confirmación Cartográfica
                                            </label>
                                            <AddressMap coordinates={patientData?.domicilio?.coordinates} />
                                        </div>
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
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (onTriggerEdit) onTriggerEdit('emergency');
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                                    >
                                        <Edit2 className="w-3 h-3" /> EDITAR
                                    </button>
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
