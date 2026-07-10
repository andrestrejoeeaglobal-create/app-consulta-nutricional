/* eslint-disable no-unused-vars */
import React from 'react';
import { User, Edit2, Search, AlertTriangle, AlertCircle, MapPin, FileText, Timer, Zap, Star, Activity, ShieldAlert, Heart, ChevronDown, HeartPulse, Droplets, Thermometer, Brain, Footprints, Baby, ShieldCheck } from 'lucide-react';

import { formatDateShort, toTitleCase } from '../../utils/utils';
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
                <label className="block text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider mb-1">
                    Fecha Nacimiento
                </label>
                <div className={`p-3 rounded-xl border min-h-[50px] flex items-center transition-all duration-300 ${isEditing ? 'bg-tilo-bg-panel border-tilo-primary ring-2 ring-tilo-primary/20' : 'bg-tilo-bg-base/40 border-tilo-border'
                    }`}>
                    {isEditing ? (
                        <input
                            type="text"
                            value={patientData?.profile?.birthdate || ''}
                            onChange={(e) => setPatientData(prev => ({
                                ...prev,
                                profile: { ...prev.profile, birthdate: e.target.value }
                            }))}
                            className="w-full bg-transparent outline-none text-tilo-text-main font-medium text-sm"
                            placeholder="DD/MM/YYYY"
                        />
                    ) : (
                        <span className="text-tilo-text-main font-medium dashboard-data-text">
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
                            <div id="card-intro" className="space-y-6">
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
                                        <label className="block text-xs font-bold text-tilo-text-muted uppercase mb-1">Edad</label>
                                        <div className="p-3 bg-tilo-bg-base/40 rounded-xl text-tilo-text-main font-medium border border-tilo-border min-h-[50px] flex items-center relative transition-all duration-300">
                                            {patientData?.profile?.age !== undefined && patientData?.profile?.age !== null && patientData?.profile?.birthdate
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
                                    {(() => {
                                        const isForeigner = patientData?.profile?.nationality_type === 'FOREIGN' || patientData?.profile?.curp?.startsWith('EXT-');
                                        return (
                                            <div className="md:col-span-2 flex flex-col gap-1">
                                                <label className="text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider">
                                                    {isForeigner ? "PASAPORTE / ID" : "CURP"}
                                                </label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 relative transition-all duration-300">
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                name={isForeigner ? "passport_id" : "curp"}
                                                                value={isForeigner
                                                                    ? (patientData?.profile?.passport_id || patientData?.profile?.curp?.replace('EXT-', '') || '')
                                                                    : (patientData?.profile?.curp || '')}
                                                                onChange={(e) => setPatientData(prev => ({
                                                                    ...prev,
                                                                    profile: {
                                                                        ...prev.profile,
                                                                        [isForeigner ? 'passport_id' : 'curp']: e.target.value
                                                                    }
                                                                }))}
                                                                className="w-full p-3 rounded-xl bg-tilo-bg-panel border-2 border-tilo-border text-tilo-text-main font-medium focus:border-tilo-primary outline-none tracking-widest uppercase text-xs dashboard-data-code"
                                                            />
                                                        ) : (
                                                            isForeigner ? (
                                                                <div className="bg-tilo-bg-base/40 p-2 rounded-lg border border-tilo-border flex items-center justify-between min-h-[50px] px-3">
                                                                    <div className="text-tilo-text-main font-medium text-sm flex items-center gap-2">
                                                                        <span>{patientData?.profile?.passport_id || patientData?.profile?.curp?.replace('EXT-', '') || "---"}</span>
                                                                        <span className="text-tilo-text-muted text-xs font-normal">(Extranjero)</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className={`p-3 rounded-xl border min-h-[50px] flex items-center flex-1 dashboard-data-code justify-between ${patientData?.profile?.curpValidated !== false ? 'bg-tilo-bg-base/40 border-tilo-border' : 'bg-tilo-warning/10 border-tilo-warning/30'
                                                                    }`}>
                                                                    <span>
                                                                        {patientData?.profile?.curp || '--'}
                                                                    </span>

                                                                    {/* V3.5: INDICADOR VISUAL CURP (Solo si es Nacional) */}
                                                                    {patientData?.profile?.curp && (
                                                                        <span className="text-xs font-bold">
                                                                            {patientData?.profile?.curpValidated !== false ? (
                                                                                <span className="text-tilo-success bg-tilo-success/10 px-2 py-1 rounded">✅ Validada</span>
                                                                            ) : (
                                                                                <span className="text-tilo-warning bg-tilo-warning/10 px-2 py-1 rounded flex items-center gap-1">
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
                                                    {!isForeigner && (
                                                        <a
                                                            href="https://www.gob.mx/curp/"
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="bg-tilo-success/10 hover:bg-tilo-success/20 text-tilo-success p-3 rounded-xl flex items-center justify-center transition-colors"
                                                            title="Consultar CURP Oficial"
                                                        >
                                                            <Search size={18} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Fila 4: Teléfono | Religión | Estado Civil */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    {renderEditableField('Teléfono', 'phone', '--', 'profile', false, 'dashboard-data-code')}
                                    {renderEditableField('Religión', 'religion', '--', 'profile')}
                                    {patientData?.profile?.pediatric_profile?.ui_controls?.show_marital_status !== false &&
                                        renderEditableField('Estado Civil', 'marital_status', '--', 'profile')}
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
                            <div id="card-address" className="space-y-6">
                                <div className="w-full mb-4">
                                    {renderEditableField('Código Postal', 'cp', '--', 'domicilio', false, 'dashboard-data-code')}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    {renderEditableField('Estado', 'estado', '--', 'domicilio', false, 'dashboard-data-text')}
                                    {renderEditableField('Municipio / Alcaldía', 'municipio', '--', 'domicilio', false, 'dashboard-data-text')}
                                </div>

                                <div className="w-full mb-4">
                                    {renderEditableField('Colonia', 'colonia', '--', 'domicilio', false, 'dashboard-data-text', toTitleCase(patientData?.domicilio?.colonia))}
                                </div>

                                <div className="w-full">
                                    <label className="block text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider mb-2">
                                        Calle y Número Exterior / Interior
                                    </label>
                                    <AddressForm 
                                        zipCode={patientData?.domicilio?.cp}
                                        initialValue={toTitleCase(patientData?.domicilio?.calle)}
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
                                        <label className="block text-[10px] uppercase font-bold text-tilo-text-muted tracking-wider mb-2">
                                            Confirmación Cartográfica
                                        </label>
                                        <AddressMap 
                                            coordinates={patientData?.domicilio?.coordinates}
                                            domicilio={patientData?.domicilio}
                                            setPatientData={setPatientData}
                                        />
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
                            {/* CONTACTO DE EMERGENCIA */}
                            <div id="card-emergency" className="space-y-4">
                                <div className="w-full">
                                    {renderEditableField('Nombre Completo', 'nombre', '--', 'emergencia', false, 'dashboard-data-text')}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderEditableField('Parentesco', 'parentesco', '--', 'emergencia')}
                                    {renderEditableField('Teléfono de Contacto', 'telefono', '--', 'emergencia', false, 'dashboard-data-code')}
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
