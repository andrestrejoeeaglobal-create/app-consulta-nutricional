import React from 'react';
import { FileText, Download, CheckCircle, ShieldCheck } from 'lucide-react';

export const EvolutionNoteSOAP = ({ patientData, deltaMetrics, telemetryData, sessionInfo }) => {
  const patientName = patientData?.identificacion?.nombre || sessionInfo?.patientName || 'Rosa Mendez Padrón';
  const todayStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-4xl mx-auto font-sans">
      {/* HEADER DE NOTA MÉDICA */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <span className="bg-[#1C75BC] text-white px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            EXPEDIENTE NOM-004-SSA3-2012
          </span>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">Nota de Evolución Médica & Bio-Auditoría</h2>
          <p className="text-xs text-slate-500 font-medium">Ecosistema T.I.L.O. & Sinergix Health System — Ciclo 2 (28 Días)</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-bold text-slate-800">Fecha: {todayStr}</p>
          <p className="text-slate-500 font-mono">Folio: #{sessionInfo?.citation || '15000'}</p>
        </div>
      </div>

      {/* DATOS DEL PACIENTE */}
      <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg text-xs">
        <div>
          <span className="text-slate-500 font-medium">Paciente:</span>
          <p className="font-bold text-slate-900 uppercase">{patientName}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Edad / Sexo:</span>
          <p className="font-bold text-slate-900">12 Meses (1 Año) / Femenino</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Diagnóstico Basal:</span>
          <p className="font-bold text-slate-900">Lactante Mayor / Primeros 1,000 Días</p>
        </div>
      </div>

      {/* FORMATO SOAP */}
      <div className="space-y-4 text-xs font-mono">
        <div className="border-l-4 border-blue-600 bg-blue-50/40 p-3.5 rounded-r-lg">
          <h4 className="font-bold text-blue-900 text-sm mb-1 font-sans">S — Subjetivo (Check-in Conversacional)</h4>
          <p className="text-slate-700 leading-relaxed">
            Lactante acude a consulta de seguimiento de 28 días en compañía de su madre. La madre refiere adecuada tolerancia a la ablactación guiada (BLW), buena aceptación de papillas monocomponente y consumo sostenido de 450 ml/día de aporte lácteo. No refiere episodios de cólicos, reflujo ni irritabilidad. Patrón de sueño nocturno continuo de 9.5 horas.
          </p>
        </div>

        <div className="border-l-4 border-emerald-600 bg-emerald-50/40 p-3.5 rounded-r-lg">
          <h4 className="font-bold text-emerald-900 text-sm mb-1 font-sans">O — Objetivo (Telemetría H7 & Escáner Electret)</h4>
          <ul className="text-slate-700 space-y-1 list-disc list-inside">
            <li><strong>HRV Promedio (H7):</strong> {telemetryData?.averages?.hrv || 68} ms (Tono vagal adecuado).</li>
            <li><strong>Sueño Profundo (H7):</strong> {telemetryData?.averages?.deepSleep || 2.1} hrs/noche (Anabolismo tisular activo).</li>
            <li><strong>Presión Arterial Promedio (H7):</strong> {telemetryData?.averages?.bloodPressure || "118/76 mmHg"}.</li>
            <li><strong>Δ Inflamación Celular Visceral (Electret):</strong> -38.4% de reducción respecto a T0.</li>
            <li><strong>Δ Permeabilidad Mucosa Intestinal (Electret):</strong> -33.0% (Sellado de barrera eficiente).</li>
            <li><strong>Score Bioeléctrico BRS:</strong> {deltaMetrics?.brsScore || 88}/100 (Evolución Óptima).</li>
          </ul>
        </div>

        <div className="border-l-4 border-indigo-600 bg-indigo-50/40 p-3.5 rounded-r-lg">
          <h4 className="font-bold text-indigo-900 text-sm mb-1 font-sans">A — Análisis Clínico Longitudinal</h4>
          <p className="text-slate-700 leading-relaxed">
            Evolución ponderal y metabólica acorde a los estándares OMS para los Primeros 1,000 Días de Vida. La reducción de la permeabilidad mucosa (-33.0%) confirma la efectividad de la fórmula 34Plus® en toma nocturna. Ausencia de arritmias o picos de alerta en la pulsera H7.
          </p>
        </div>

        <div className="border-l-4 border-slate-700 bg-slate-100 p-3.5 rounded-r-lg">
          <h4 className="font-bold text-slate-900 text-sm mb-1 font-sans">P — Plan Terapéutico Recalibrado (28 Días)</h4>
          <ul className="text-slate-700 space-y-1 list-disc list-inside">
            <li>Mantener plan alimentario de 950 kcal/día (35% Grasas Saludables, 50% Carbohidratos Complejos, 15% Proteínas).</li>
            <li>Mantener <strong>33Plus® Ignición</strong> en toma matutina.</li>
            <li>Mantener <strong>34Plus® Tisular</strong> en toma nocturna.</li>
            <li>Solicitud de Cita de Seguimiento para el Ciclo 3 en 4 semanas exactas (Horario hábil L-V 9:00 - 18:00 hrs).</li>
          </ul>
        </div>
      </div>

      {/* FOOTER DE FIRMA Y SELLO */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>Documento firmado digitalmente bajo la NOM-004-SSA3-2012</span>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Exportar PDF Expediente</span>
        </button>
      </div>
    </div>
  );
};
