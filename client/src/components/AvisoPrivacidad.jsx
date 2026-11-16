import React from 'react';
import LogoEABlanco from '../assets/LogoEABlanco.svg';

const AvisoPrivacidad = ({ onAccept, onClose }) => {
    return (
        <div className="w-full h-full bg-[#F8FAFC] dark:bg-[#0F172A] p-6 flex flex-col overflow-hidden">
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl w-full h-full flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* 1. ENCABEZADO FIJO */}
                <div className="flex items-center justify-between bg-[#F8FAFC] dark:bg-[#0F172A] p-6 rounded-t-2xl border-b border-slate-200 dark:border-slate-700 relative overflow-hidden shrink-0">
                    <div className="z-10 flex-1">
                        <h2 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] leading-tight">
                            Aviso de Privacidad
                        </h2>
                        <p className="text-sm font-medium text-[#334155] dark:text-[#CBD5E1] mt-1">
                            Cumplimiento Normativo NOM-004-SSA3-2012
                        </p>
                    </div>

                    <div className="flex items-center gap-3 z-10">
                        <div className="bg-[#1C75BC] p-2.5 rounded-xl shadow-sm flex items-center justify-center h-12 w-auto">
                            <img
                                src={LogoEABlanco}
                                alt="Equipo en Acción®"
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Cerrar Aviso de Privacidad"
                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-[#334155] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2 focus:outline-none cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 2. CONTENIDO CON SCROLL HABILITADO */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#F8FAFC]/60 dark:bg-[#0F172A]/40 relative">
                    <div className="space-y-6">
                        <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-4">
                            <h2 className="text-[#0F172A] dark:text-[#F8FAFC] text-lg font-bold uppercase tracking-wider">
                                AVISO DE PRIVACIDAD INTEGRAL
                            </h2>
                        </div>

                        <p className="text-[#334155] dark:text-[#CBD5E1] text-sm leading-relaxed text-justify">
                            De conformidad con lo dispuesto en la <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</span> y la normativa sanitaria vigente, <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Equipo en Acción®</span> pone a su disposición el presente Aviso de Privacidad.
                        </p>

                        <div className="space-y-3">
                            <h3 className="text-[#0F172A] dark:text-[#F8FAFC] text-sm font-bold border-l-4 border-[#1C75BC] pl-2">I. DATOS PERSONALES Y DATOS SENSIBLES</h3>
                            <p className="text-[#334155] dark:text-[#CBD5E1] text-sm leading-relaxed text-justify">
                                Se hace de su conocimiento que, para cumplir con las finalidades previstas en este aviso, serán recabados y tratados datos personales generales y <span className="font-bold text-[#B70E0C] dark:text-[#FCA5A5]">Datos Personales Sensibles</span>, incluyendo de manera enunciativa más no limitativa:
                            </p>
                            <ul className="list-disc list-inside text-[#334155] dark:text-[#CBD5E1] text-sm space-y-2 ml-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                <li><span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Estado de Salud:</span> Antecedentes heredofamiliares, patológicos, diagnóstico clínico y nutricional, medidas antropométricas y resultados de estudios de laboratorio.</li>
                                <li><span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Datos Biométricos y Fisonómicos:</span> Peso, talla, composición corporal.</li>
                                <li><span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Ideología y Creencias:</span> Información sobre creencias religiosas (exclusivamente para la adecuación cultural de planes alimenticios y cumplimiento de la NOM-004).</li>
                                <li><span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Estilo de Vida:</span> Hábitos alimenticios, de sueño y actividad física.</li>
                            </ul>
                            <p className="text-[#334155] dark:text-[#CBD5E1] text-sm leading-relaxed text-justify">
                                Nos comprometemos a que los mismos serán tratados bajo las más estrictas medidas de seguridad que garanticen su confidencialidad, conforme a lo establecido en la <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">NOM-004-SSA3-2012</span> (Del Expediente Clínico).
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[#0F172A] dark:text-[#F8FAFC] text-sm font-bold border-l-4 border-[#1C75BC] pl-2">II. FINALIDADES DEL TRATAMIENTO</h3>
                            <p className="text-[#334155] dark:text-[#CBD5E1] text-sm leading-relaxed text-justify">
                                Los datos personales que recabamos de usted serán utilizados para las siguientes finalidades primarias:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['Brindar atención nutricional y médica integral', 'Incorporación y actualización de su Expediente Clínico', 'Elaboración de planes de alimentación y prescripción de ejercicio', 'Identificación y seguridad del paciente'].map((item, idx) => (
                                    <span key={idx} className="bg-[#EEF7FF] dark:bg-slate-800 text-[#1C75BC] dark:text-[#93C5FD] text-xs font-semibold px-2.5 py-1 rounded border border-[#D6EBFF] dark:border-slate-700">{item}</span>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[#0F172A] dark:text-[#F8FAFC] text-sm font-bold border-l-4 border-[#1C75BC] pl-2">III. TRANSFERENCIA DE DATOS</h3>
                            <p className="text-[#0F172A] text-sm leading-relaxed text-justify bg-[#FFCC00]/25 dark:bg-[#FFCC00] p-3.5 rounded-lg border border-[#FFCC00]">
                                Sus datos personales pueden ser transferidos y tratados dentro del país por personas distintas a este responsable (profesionales de la salud, laboratorios, aseguradoras) exclusivamente para la atención médica integral. <span className="font-bold">Si usted no manifiesta su oposición, se entenderá que ha otorgado su consentimiento.</span>
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[#0F172A] dark:text-[#F8FAFC] text-sm font-bold border-l-4 border-[#1C75BC] pl-2">IV. MEDIOS PARA EJERCER DERECHOS ARCO</h3>
                            <p className="text-[#334155] dark:text-[#CBD5E1] text-sm leading-relaxed text-justify">
                                Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos. Para ejercer estos derechos, envíe un correo a: <a href="mailto:juridico@eeaglobal.net" className="text-[#1C75BC] dark:text-[#3894E0] font-bold underline">juridico@eeaglobal.net</a>.
                            </p>
                        </div>

                        <div className="space-y-3 pb-4">
                            <h3 className="text-[#0F172A] dark:text-[#F8FAFC] text-sm font-bold border-l-4 border-[#1C75BC] pl-2">V. CAMBIOS AL AVISO DE PRIVACIDAD</h3>
                            <p className="text-[#334155] dark:text-[#CBD5E1] text-sm leading-relaxed text-justify">
                                Nos comprometemos a mantenerlo informado sobre los cambios que pueda sufrir el presente aviso a través de nuestros canales oficiales.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. BOTÓN FIJO AL FINAL */}
                <div className="p-6 bg-white dark:bg-[#1E293B] border-t border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                        type="button"
                        onClick={onAccept}
                        className="min-h-[48px] w-full bg-[#1C75BC] hover:bg-[#155A92] text-white py-4 rounded-xl transition-all font-bold text-lg flex items-center justify-center gap-2 group shadow-md cursor-pointer"
                    >
                        Acepto Aviso de Privacidad
                        <span className="group-hover:translate-x-1 transition-transform">➜</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvisoPrivacidad;
