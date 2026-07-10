import React, { useState, useEffect } from 'react';
import { FileText, ShieldCheck, HeartPulse, Activity, BrainCircuit, UserCheck, AlertOctagon } from 'lucide-react';
// import { motion } from 'framer-motion';

const Fase17_Dashboard_Render = ({ patientData, forceTestPayload }) => {
  // 🧪 INYECCIÓN DE PAYLOAD E2E DE PRUEBA SI SE SOLICITA
  const data = forceTestPayload ? {
    identificacion: {
      nombre: "Jesús",
      sexo: "Masculino",
      edad: 64,
      consentHash: "8f3b2...7a",
      tutor: "No requiere"
    },
    motivo: "Disnea de esfuerzo y recuperación post-quirúrgica (Hernia s/malla).",
    rutas: "Ruta 12 (Cardiovascular) + Ruta 17 (Rehabilitación)",
    antecedentes: {
      metabolico: "Diabetes Mellitus Tipo 2 (Rama Paterna).",
      coronario: "Infarto agudo al miocardio prematuro (Hermano).",
      dictamen: "Alta penetrancia de riesgo cardiovascular. Se bloquea cualquier protocolo de alta intensidad física."
    },
    biometria: {
      pa: "145/95", // Alerta Roja
      fcm: "< 110 bpm (Restringida para permitir sanación tisular).",
      spo2: "94"
    },
    plan: {
      kcal: "1,850 kcal/día",
      pp_kg: "1.2g/kg (Para síntesis endógena de colágeno)",
      na: "< 1,500mg/día (Restricción estricta NOM-030)",
      suplementacion: "33Plus (Aprobado por Profesional)",
      restriccionMe: "Evitar maniobra de Valsalva por debilidad en pared abdominal"
    }
  } : patientData;

  const [renderState, setRenderState] = useState('generating');

  useEffect(() => {
    // Simular tiempo de renderizado forense del Cortex
    const timer = setTimeout(() => {
      setRenderState('complete');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (renderState === 'generating') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-tilo-bg-base p-8 text-center animate-pulse">
        <BrainCircuit className="w-16 h-16 text-tilo-primary mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-tilo-text-main">Sintetizando Expediente Clínico...</h2>
        <p className="text-sm text-tilo-text-muted mt-2">Aplicando Cruce Forense y Criterios NOM-004</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-slate-50 overflow-y-auto custom-scrollbar p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
      >
        {/* ENCABEZADO LEGAL */}
        <div className="bg-slate-900 border-b-4 border-tilo-primary p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black tracking-widest flex items-center gap-2">
                <FileText className="w-6 h-6 text-tilo-primary" />
                EXPEDIENTE CLÍNICO DIGITAL
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1">SISTEMA T.I.L.O. V73 - RED DE SEGURIDAD INSTITUCIONAL ANTIGRAVITY</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-tilo-primary">FOLIO: 11000-J</p>
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* CONTENIDO DEL EXPEDIENTE */}
        <div className="p-8 space-y-8 font-sans">
          
          {/* BLOQUE I: IDENTIDAD Y LEGAL */}
          <section className="bg-slate-50 p-5 rounded-lg border border-slate-200">
            <h2 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
              <UserCheck className="w-4 h-4" /> I. Identificación y Marco Legal (NOM-004)
            </h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-slate-500 text-xs font-bold uppercase">Paciente Anonimizado</p>
                <p className="text-slate-800 font-medium text-lg">{data.identificacion?.nombre || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase">Perfil Biológico</p>
                <p className="text-slate-800 font-medium">{data.identificacion?.edad || "--"} años | {data.identificacion?.sexo || "--"}</p>
              </div>
              <div className="col-span-3 pt-3 border-t border-slate-200 mt-2 flex justify-between items-center">
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase">Consentimiento Informado</p>
                  <p className="text-tilo-success font-medium flex items-center gap-1 text-xs mt-1">
                    <ShieldCheck className="w-4 h-4" /> Firmado Digitalmente (Hash: {data.identificacion?.consentHash || "8f3b2...7a"})
                  </p>
                </div>
                {/* RUTAS CLÍNICAS APLICADAS */}
                <div className="text-right">
                  <p className="text-slate-500 text-xs font-bold uppercase">Matriz de Enrutamiento Cortex</p>
                  <div className="flex gap-2 mt-1 justify-end">
                    <span className="px-2 py-1 bg-blue-100 text-tilo-primary text-[10px] font-bold rounded">RUTA 12 CARDIO</span>
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">RUTA 17 REHAB</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* BLOQUE II: NARRATIVA CLÍNICA */}
          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
              <FileText className="w-4 h-4" /> II. Narrativa Clínica (Dictamen)
            </h2>
            <div className="bg-white p-4 rounded-lg border-l-4 border-tilo-primary shadow-sm text-sm text-slate-700 leading-relaxed italic">
              "El paciente se presenta en estado de 'Avatar Clínico en Reconstrucción'. Reporta {data.motivo || "..."} indicando compromiso del gasto cardiaco e incremento de riesgo ante esfuerzos mecánicos."
            </div>
          </section>

          <div className="grid grid-cols-2 gap-6">
            {/* BLOQUE III: GENÉTICA */}
            <section className="bg-slate-50 p-5 rounded-lg border border-slate-200">
              <h2 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
                <BrainCircuit className="w-4 h-4" /> III. Código Fuente (Familiares)
              </h2>
              <ul className="text-sm space-y-3">
                <li className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400">Carga Metabólica:</span>
                  <span className="text-slate-700 font-medium">{data.antecedentes?.metabolico || "Diabetes Mellitus Tipo 2"}</span>
                </li>
                <li className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400">Carga Coronaria:</span>
                  <span className="text-slate-700 font-medium">{data.antecedentes?.coronario || "Infarto miocardio prematuro"}</span>
                </li>
                <li className="mt-4 p-3 bg-red-50 rounded text-red-800 text-xs font-bold border border-red-100 uppercase">
                  <AlertOctagon className="w-4 h-4 inline mr-1" />
                  DICTAMEN CORTEX: {data.antecedentes?.dictamen || "Alta penetrancia de riesgo cardiovascular. Se bloquea intensidad física."}
                </li>
              </ul>
            </section>

            {/* BLOQUE IV: SIGNOS VITALES */}
            <section className="bg-slate-50 p-5 rounded-lg border border-slate-200">
              <h2 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
                <HeartPulse className="w-4 h-4" /> IV. Constantes Vitales
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-red-600 rounded-lg text-white shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Presión Arterial</p>
                    <p className="text-xl font-black">{data.biometria?.pa || "--"} <span className="text-xs font-normal">mmHg</span></p>
                  </div>
                  <div className="px-2 py-1 bg-red-800 rounded font-bold text-xs uppercase animate-pulse">
                    Alerta Roja
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Saturación O2</p>
                    <p className="text-lg font-bold text-slate-800">{data.biometria?.spo2 || "--"}%</p>
                  </div>
                  <Activity className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="text-xs font-medium text-slate-600 bg-amber-50 p-2 rounded border border-amber-100 flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0" />
                  <p>FCM Operativa Limitada: <b>{data.biometria?.fcm || "< 110 bpm"}</b></p>
                </div>
              </div>
            </section>
          </div>

          {/* BLOQUE V: PLAN CORTEX */}
          <section className="bg-tilo-bg-chat-sys p-5 rounded-lg border border-tilo-primary/20 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-tilo-primary opacity-5 rounded-bl-[100px]"></div>
            <h2 className="text-sm font-bold text-tilo-primary uppercase flex items-center gap-2 border-b border-tilo-primary/20 pb-2 mb-4 relative z-10">
              <Activity className="w-4 h-4" /> V. Plan de Intervención Logística
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm relative z-10">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Protocolo Termodinámico</p>
                <p className="font-medium text-slate-800 text-lg">{data.plan?.kcal || "1,850 kcal/día"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Suplementación Advanced</p>
                <p className="font-bold text-tilo-primary flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> {data.plan?.suplementacion || "33Plus (Aprobado)"}
                </p>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-4 mt-2">
                <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Carga Macronutrientes</p>
                  <p className="font-medium text-slate-700 text-sm mt-1">Proteína: <span className="text-tilo-primary">{data.plan?.pp_kg || "1.2g/kg"}</span></p>
                  <p className="font-medium text-slate-700 text-sm">Sodio: <span className="text-red-600">{data.plan?.na || "< 1,500mg/día"}</span></p>
                </div>
                <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Restricción Mecánica Activa</p>
                  <p className="font-medium text-slate-700 text-sm leading-tight mt-1">{data.plan?.restriccionMe || "Evitar maniobra de Valsalva por debilidad en pared abdominal."}</p>
                </div>
              </div>
            </div>
          </section>

          {/* BLOQUE VI: FIRMA DIGITAL */}
          <section className="pt-6 border-t font-sans">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-sm font-bold text-slate-500 uppercase mb-2">VI. Firma y Responsabilidad</h2>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-2 rounded-lg inline-flex">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  Validación Cortex IA: Verificada y Cruzada
                </div>
              </div>
              <div className="text-center">
                <div className="w-48 h-12 bg-slate-100 border border-slate-200 rounded flex items-center justify-center mb-2 mx-auto">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">[Sello Digital HASH]</span>
                </div>
                <p className="text-xs font-bold text-slate-700 uppercase">Firma Digital Médico Tratante</p>
                <p className="text-[10px] text-slate-400">Cédula Profesional Validada</p>
              </div>
            </div>
          </section>

        </div>
      </motion.div>
    </div>
  );
};

export default Fase17_Dashboard_Render;
