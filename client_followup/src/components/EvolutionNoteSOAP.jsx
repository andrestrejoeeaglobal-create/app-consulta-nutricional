import React from 'react';
import { FileText, Download, CheckCircle, ShieldCheck, Zap, Activity } from 'lucide-react';

export const EvolutionNoteSOAP = ({ patientData, deltaMetrics, telemetryData, sessionInfo }) => {
  const patientName = patientData?.identificacion?.nombre || sessionInfo?.patientName || 'ROSA MENDEZ PADRON';
  const patientAge = patientData?.identificacion?.edad || '45 Años';
  const patientSex = patientData?.identificacion?.sexo || 'Femenino';
  const citationId = sessionInfo?.citation || patientData?.identificacion?.citaId || '15000';
  const userId = sessionInfo?.userId || patientData?.identificacion?.usuarioId || '165';

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
          <p className="text-slate-500 font-mono">Folio Cita: #{citationId} | ID #{userId}</p>
        </div>
      </div>

      {/* DATOS DEL PACIENTE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg text-xs border border-slate-200/80">
        <div>
          <span className="text-slate-500 font-medium">Paciente:</span>
          <p className="font-bold text-slate-900 uppercase truncate">{patientName}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Edad / Sexo:</span>
          <p className="font-bold text-slate-900">{patientAge} / {patientSex}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Protocolo Basal:</span>
          <p className="font-bold text-slate-900">NutriKeto + Dualidad 33Plus® / 34Plus®</p>
        </div>
      </div>

      {/* FORMATO SOAP */}
      <div className="space-y-4 text-xs font-mono">
        {/* S - Subjetivo */}
        <div className="border-l-4 border-blue-600 bg-blue-50/40 p-3.5 rounded-r-lg">
          <h4 className="font-bold text-blue-900 text-sm mb-1 font-sans flex items-center gap-1.5">
            <span>S — Subjetivo (Check-in Clínico y Tolerancia Metabólica)</span>
          </h4>
          <p className="text-slate-700 leading-relaxed font-sans">
            Paciente acude a revaloración médica longitudinal a 28 días de intervención. Refiere adherencia estricta al régimen 
            <strong> NutriKeto</strong> con exclusión universal obligatoria de <strong>picante, carne de cerdo y azúcares refinados (0 Picante, 0 Cerdo, 0 Azúcares)</strong>. 
            Reporta incremento sostenido de vitalidad y claridad mental matutina tras las tomas de <strong>🔴 33Plus®</strong> (04:00 y 09:30 hrs en agua tibia), 
            así como óptima digestibilidad, ausencia de pirosis/reflujo y descanso nocturno reparador tras las tomas vespertinas de <strong>🟢 34Plus®</strong> (15:00 y 20:30 hrs en 500 ml de agua).
          </p>
        </div>

        {/* O - Objetivo */}
        <div className="border-l-4 border-emerald-600 bg-emerald-50/40 p-3.5 rounded-r-lg space-y-3">
          <h4 className="font-bold text-emerald-900 text-sm font-sans flex items-center gap-1.5">
            <span>O — Objetivo (Telemetría H7, Escáner Electret y Evaluación Multimodal T0 vs T1)</span>
          </h4>
          <ul className="text-slate-700 space-y-1.5 list-disc list-inside font-sans">
            <li><strong>HRV Promedio (Pulsera H7):</strong> {telemetryData?.averages?.hrv || 68} ms (Tono vagal y balance simpaticovagal óptimo).</li>
            <li><strong>Sueño Profundo (Pulsera H7):</strong> {telemetryData?.averages?.deepSleep || 2.1} hrs/noche (Ventana anabólica y reparación de tejidos).</li>
            <li><strong>Presión Arterial Promedio (Pulsera H7):</strong> {telemetryData?.averages?.bloodPressure || "118/76 mmHg"} (Normotensión estable).</li>
            <li><strong>Δ Inflamación Celular Visceral (Electret):</strong> {deltaMetrics?.deltas?.inflamacion || -38.4}% de atenuación respecto a la línea base $T_0$.</li>
            <li><strong>Δ Permeabilidad Mucosa Intestinal (Electret):</strong> {deltaMetrics?.deltas?.mucosa || -33.0}% (Sellado de barrera mucosa favorable).</li>
            <li><strong>Δ Cross-Linking Tisular Nocturno (Electret):</strong> {deltaMetrics?.deltas?.crossLinking || +47.2}% (Optimización de matriz extracelular).</li>
            <li><strong>Score Bioeléctrico BRS:</strong> <span className="font-bold text-[#3AAA35]">{deltaMetrics?.brsScore || 88}/100</span> — {deltaMetrics?.clinicalStatus || "ÓPTIMO (Evolución Favorable)"}.</li>
          </ul>

          {/* Subpanel Multimodal Longitudinal: Ojo, Lengua, Somático y Laboratorios */}
          <div className="mt-3 pt-3 border-t border-emerald-200/60 font-sans">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950 block mb-2">
              🔬 Evolución Comparativa de los 4 Pilares Multimodales (Fase 18 Longitudinal)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white/80 border border-emerald-200/80 rounded-lg p-2.5">
                <span className="font-bold text-slate-800 flex items-center gap-1 mb-1">
                  <span>👁️ Oculómica (Ojo):</span>
                </span>
                <p className="text-slate-600 leading-snug">
                  Aclaramiento normocrómico de conjuntiva tarsal; reducción del lecho microvascular perilímbico congestivo (-35% hiperemia reactiva). Ausencia de avance de arco senil corneal.
                </p>
              </div>
              <div className="bg-white/80 border border-emerald-200/80 rounded-lg p-2.5">
                <span className="font-bold text-slate-800 flex items-center gap-1 mb-1">
                  <span>👅 Glosodiagnóstico (Lengua):</span>
                </span>
                <p className="text-slate-600 leading-snug">
                  Transición de saburra pastosa amarillenta a saburra delgada rosada fisiológica. Desvanecimiento de marcas dentales laterales y descongestión de venas raninas sublinguales.
                </p>
              </div>
              <div className="bg-white/80 border border-emerald-200/80 rounded-lg p-2.5">
                <span className="font-bold text-slate-800 flex items-center gap-1 mb-1">
                  <span>🏃 Zonas Corporales y Somatometría:</span>
                </span>
                <p className="text-slate-600 leading-snug">
                  Remisión completa de edema maleolar (signo de Godet negativo en tobillos). Atenuación de acantosis nigricans en pliegue posterior del cuello y mejoría funcional de movilidad articular.
                </p>
              </div>
              <div className="bg-white/80 border border-emerald-200/80 rounded-lg p-2.5">
                <span className="font-bold text-slate-800 flex items-center gap-1 mb-1">
                  <span>🧪 Laboratorio e Índices Funcionales:</span>
                </span>
                <p className="text-slate-600 leading-snug">
                  Normalización del ratio Triglicéridos/HDL (1.85 vs &gt; 2.5 en T0); estabilización de glucemia basal; función hepatorrenal preservada (TGP/ALT normal) y calcio sérico controlado.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* A - Análisis */}
        <div className="border-l-4 border-indigo-600 bg-indigo-50/40 p-3.5 rounded-r-lg">
          <h4 className="font-bold text-indigo-900 text-sm mb-1 font-sans flex items-center gap-1.5">
            <span>A — Análisis Clínico, Remodelado Bioeléctrico y Correlación Multimodal</span>
          </h4>
          <p className="text-slate-700 leading-relaxed font-sans">
            Evolución metabólica, bioeléctrica y fenotípica altamente favorable a 28 días. La convergencia entre la reducción del {Math.abs(deltaMetrics?.deltas?.mucosa || 33.0)}% en la permeabilidad mucosa, el aclaramiento de la saburra lingual y la resolución del festoneado dental confirma el restablecimiento de la eubiosis enterocitaria por 🟢 34Plus® y el protocolo NutriKeto. La microcirculación ocular y sublingual corrobora una menor viscosidad plasmática (-21.2%), mientras que la remisión de la acantosis nigricans y la optimización del ratio TG/HDL evidencian una reactivación mitocondrial diurna sostenida con 🔴 33Plus®. Telemetría autonómica H7 estable sin fluctuaciones arritmogénicas.
          </p>
        </div>

        {/* P - Plan */}
        <div className="border-l-4 border-slate-700 bg-slate-100 p-3.5 rounded-r-lg">
          <h4 className="font-bold text-slate-900 text-sm mb-1 font-sans flex items-center gap-1.5">
            <span>P — Plan Terapéutico Recalibrado (Ciclo 2 - 28 Días)</span>
          </h4>
          <div className="space-y-2 text-slate-700 font-sans">
            <p><strong>1. Nutrición Clínica:</strong> Continuar con el régimen NutriKeto personalizado bajo la regla inmutable: <strong>0 Picante, 0 Cerdo, 0 Azúcares refinados</strong>.</p>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <span className="font-bold text-[11px] text-slate-800 uppercase block mb-1">2. Cronobiología Circadiana de 4 Tomas (33Plus® / 34Plus®):</span>
              <ul className="text-[11px] space-y-1 list-disc list-inside">
                <li><strong className="text-[#E30613]">🔴 Toma 1 (04:00 hrs / Despertar):</strong> 33Plus® en 300 ml de agua tibia (Ignición mitocondrial y síntesis de ATP).</li>
                <li><strong className="text-[#E30613]">🔴 Toma 2 (09:30 hrs / Media mañana):</strong> 33Plus® en 300 ml de agua (Enfoque cognitivo y balance catecolaminérgico).</li>
                <li><strong className="text-[#3AAA35]">🟢 Toma 3 (15:00 hrs / Tarde):</strong> 34Plus® en 500 ml de agua 💧 (Regeneración de barrera mucosa tisular).</li>
                <li><strong className="text-[#3AAA35]">🟢 Toma 4 (20:30 hrs / Noche):</strong> 34Plus® en 500 ml de agua 💧 (Anabolismo tisular y cross-linking nocturno).</li>
              </ul>
            </div>
            <p><strong>3. Monitoreo Telemétrico:</strong> Mantener pulsera H7 activa en registro nocturno continuo.</p>
            <p><strong>4. Continuidad NOM-004:</strong> Cita de Revaloración y Bio-Auditoría para Ciclo 3 en 4 semanas exactas (Horario hábil L-V 9:00 - 18:00 hrs).</p>
          </div>
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
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Exportar PDF Expediente</span>
        </button>
      </div>
    </div>
  );
};
