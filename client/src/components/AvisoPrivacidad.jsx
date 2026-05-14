import React from 'react';
import LogoEABlanco from '../assets/LogoEABlanco.svg';

const AvisoPrivacidad = ({ onAccept, onClose }) => {
    return (
        <div className="w-full h-full bg-slate-50 p-6 flex flex-col overflow-hidden">
            <div className="bg-white rounded-3xl shadow-xl w-full h-full flex flex-col overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* 1. ENCABEZADO FIJO (Actualizado) */}
                <div className="flex items-center justify-between bg-blue-600 p-6 rounded-t-2xl relative overflow-hidden shrink-0">

                    {/* IZQUIERDA: Títulos */}
                    <div className="z-10 flex-1">
                        <h2 className="text-2xl font-bold text-white leading-tight">
                            Aviso de Privacidad
                        </h2>
                        <p className="text-sm font-medium text-blue-100 mt-1">
                            Cumplimiento Normativo NOM-004-SSA3-2012
                        </p>
                    </div>

                    {/* DERECHA: Logo y Cerrar */}
                    <div className="flex items-center gap-3 z-10">

                        {/* LOGO EN TARJETA (Ahora siempre visible 'flex') */}
                        <div className="flex items-center justify-center bg-white/10 border border-white/20 rounded-xl p-2 shadow-lg backdrop-blur-md h-12 w-auto">
                            <img
                                src={LogoEABlanco}
                                alt="Equipo en Acción"
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        {/* BOTÓN CERRAR */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors ml-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* DECORACIÓN DE FONDO (Opcional) */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-50"></div>
                </div>

                {/* 2. CONTENIDO CON SCROLL HABILITADO */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50 relative">
                    <div className="space-y-6">
                        <div className="text-center border-b border-slate-200 pb-4">
                            <h2 className="text-slate-800 text-lg font-bold uppercase tracking-wider">
                                AVISO DE PRIVACIDAD INTEGRAL
                            </h2>
                        </div>

                        {/* Introducción */}
                        <p className="text-slate-600 text-sm leading-relaxed text-justify">
                            De conformidad con lo dispuesto en la <span className="font-bold">Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</span> y la normativa sanitaria vigente, <span className="font-bold text-slate-800">Equipo en Acción</span> pone a su disposición el presente Aviso de Privacidad.
                        </p>

                        {/* SECCIÓN I: DATOS PERSONALES Y SENSIBLES */}
                        <div className="space-y-3">
                            <h3 className="text-slate-800 text-sm font-bold border-l-4 border-blue-500 pl-2">I. DATOS PERSONALES Y DATOS SENSIBLES</h3>
                            <p className="text-slate-600 text-sm leading-relaxed text-justify">
                                Se hace de su conocimiento que, para cumplir con las finalidades previstas en este aviso, serán recabados y tratados datos personales generales y <span className="font-bold text-red-500">Datos Personales Sensibles</span>, incluyendo de manera enunciativa más no limitativa:
                            </p>
                            <ul className="list-disc list-inside text-slate-600 text-sm space-y-2 ml-2 bg-slate-100 p-4 rounded-xl border border-slate-200">
                                <li><span className="font-bold text-slate-700">Estado de Salud:</span> Antecedentes heredofamiliares, patológicos, diagnóstico clínico y nutricional, medidas antropométricas y resultados de estudios de laboratorio.</li>
                                <li><span className="font-bold text-slate-700">Datos Biométricos y Fisonómicos:</span> Peso, talla, composición corporal.</li>
                                <li><span className="font-bold text-slate-700">Ideología y Creencias:</span> Información sobre creencias religiosas (exclusivamente para la adecuación cultural de planes alimenticios y cumplimiento de la NOM-004).</li>
                                <li><span className="font-bold text-slate-700">Estilo de Vida:</span> Hábitos alimenticios, de sueño y actividad física.</li>
                            </ul>
                            <p className="text-slate-600 text-sm leading-relaxed text-justify">
                                Nos comprometemos a que los mismos serán tratados bajo las más estrictas medidas de seguridad que garanticen su confidencialidad, conforme a lo establecido en la <span className="font-bold">NOM-004-SSA3-2012</span> (Del Expediente Clínico).
                            </p>
                        </div>

                        {/* SECCIÓN II: FINALIDADES */}
                        <div className="space-y-3">
                            <h3 className="text-slate-800 text-sm font-bold border-l-4 border-blue-500 pl-2">II. FINALIDADES DEL TRATAMIENTO</h3>
                            <p className="text-slate-600 text-sm leading-relaxed text-justify">
                                Los datos personales que recabamos de usted serán utilizados para las siguientes finalidades primarias:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['Brindar atención nutricional y médica integral', 'Incorporación y actualización de su Expediente Clínico', 'Elaboración de planes de alimentación y prescripción de ejercicio', 'Identificación y seguridad del paciente'].map((item, idx) => (
                                    <span key={idx} className="bg-blue-50 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-100">{item}</span>
                                ))}
                            </div>
                        </div>

                        {/* SECCIÓN III: TRANSFERENCIA */}
                        <div className="space-y-3">
                            <h3 className="text-slate-800 text-sm font-bold border-l-4 border-blue-500 pl-2">III. TRANSFERENCIA DE DATOS</h3>
                            <p className="text-slate-600 text-sm leading-relaxed text-justify bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                Sus datos personales pueden ser transferidos y tratados dentro del país por personas distintas a este responsable (profesionales de la salud, laboratorios, aseguradoras) exclusivamente para la atención médica integral. <span className="font-bold">Si usted no manifiesta su oposición, se entenderá que ha otorgado su consentimiento.</span>
                            </p>
                        </div>

                        {/* SECCIÓN IV: DERECHOS ARCO */}
                        <div className="space-y-3">
                            <h3 className="text-slate-800 text-sm font-bold border-l-4 border-blue-500 pl-2">IV. MEDIOS PARA EJERCER DERECHOS ARCO</h3>
                            <p className="text-slate-600 text-sm leading-relaxed text-justify">
                                Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos. Para ejercer estos derechos, envíe un correo a: <a href="mailto:juridico@eeaglobal.net" className="text-blue-600 font-bold underline">juridico@eeaglobal.net</a>.
                            </p>
                        </div>

                        {/* SECCIÓN V: CAMBIOS */}
                        <div className="space-y-3 pb-4">
                            <h3 className="text-slate-800 text-sm font-bold border-l-4 border-blue-500 pl-2">V. CAMBIOS AL AVISO DE PRIVACIDAD</h3>
                            <p className="text-slate-600 text-sm leading-relaxed text-justify">
                                Nos comprometemos a mantenerlo informado sobre los cambios que pueda sufrir el presente aviso a través de nuestros canales oficiales.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. BOTÓN FIJO AL FINAL */}
                <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                    <button
                        type="button"
                        onClick={onAccept}
                        className="w-full bg-[#1a56ff] hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 group"
                    >
                        Acepto Aviso de Privacidad
                        <span className="text-2xl group-hover:translate-x-1 transition-transform">➜</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvisoPrivacidad;
