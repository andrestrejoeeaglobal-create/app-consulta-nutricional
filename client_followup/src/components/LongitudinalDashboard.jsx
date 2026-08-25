import React, { useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  Heart, 
  Moon, 
  Flame, 
  RefreshCw, 
  FileText, 
  Calendar, 
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export const LongitudinalDashboard = ({
  deltaMetrics,
  telemetryData,
  safetyStatus,
  patientData,
  onScheduleAppointment = () => {},
  isFinished = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState('overview');

  const brs = deltaMetrics?.brsScore || 88;
  const hrv = telemetryData?.averages?.hrv || 68;
  const sleep = telemetryData?.averages?.deepSleep || 2.1;
  const mets = telemetryData?.averages?.metsCalories || 345;
  const bp = telemetryData?.averages?.bloodPressure || "118/76 mmHg";

  return (
    <div className="h-full flex flex-col bg-slate-50 border-l border-slate-200 overflow-hidden font-sans">
      {/* BARRA DE NAVEGACIÓN MAESTRA DE 7 BLOQUES */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 shadow-xs">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeSubTab === 'overview' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>1. Delta BRS & Evolución</span>
        </button>

        <button
          onClick={() => setActiveSubTab('telemetry')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeSubTab === 'telemetry' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>2. Telemetría H7 (28 Días)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('electret')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeSubTab === 'electret' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>3. Bio-Escáner Electret</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recalibration')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeSubTab === 'recalibration' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>4. 33Plus® & 34Plus®</span>
        </button>

        <button
          onClick={() => setActiveSubTab('nutrition')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeSubTab === 'nutrition' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>5. Plan Nutricional</span>
        </button>

        <button
          onClick={() => setActiveSubTab('soap')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeSubTab === 'soap' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>6. Nota SOAP (NOM-004)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('appointment')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeSubTab === 'appointment' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>7. Cita Ciclo 3</span>
        </button>
      </div>

      {/* ALERTAS DE BIOSEGURIDAD SAFETYENGINE V2.0 */}
      {safetyStatus && !safetyStatus.isSafe && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-800 font-semibold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{safetyStatus.alerts[0] || "⚠️ Hard Stop Clínico Activado por SafetyEngine v2.0."}</span>
          </div>
          <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">CÓDIGO ROJO</span>
        </div>
      )}

      {/* CONTENIDO DEL DASHBOARD DE 7 BLOQUES */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* SUBTAB 1: EVOLUCIÓN GENERAL & DELTA BRS */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span>Bioelectric Recovery Score (BRS) — Sprint 28 Días</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Auditoría bioeléctrica computada por Delta-Electret Engine</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-emerald-600">{brs}/100</span>
                  <p className="text-[11px] text-emerald-700 font-semibold">EVOLUCIÓN ÓPTIMA</p>
                </div>
              </div>

              {/* BENTO GRID DE METRICAS DELTA */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 font-medium">Δ Inflamación Celular</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-bold text-slate-800">{deltaMetrics?.deltas?.inflamacion || -38.4}%</span>
                    <span className="text-xs font-bold text-emerald-600">↓ Reducción Favorable</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 font-medium">Δ Viscosidad Sanguínea</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-bold text-slate-800">{deltaMetrics?.deltas?.viscosidad || -21.1}%</span>
                    <span className="text-xs font-bold text-emerald-600">↓ Normalización</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '82%' }}></div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 font-medium">Δ Permeabilidad Mucosa Intestinal</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-bold text-slate-800">{deltaMetrics?.deltas?.mucosa || -33.0}%</span>
                    <span className="text-xs font-bold text-emerald-600">↓ Sellado de Barrera</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: '85%' }}></div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 font-medium">Δ Cross-Linking Nocturno</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-bold text-slate-800">+{deltaMetrics?.deltas?.crossLinking || 47.2}%</span>
                    <span className="text-xs font-bold text-emerald-600">↑ Anabolismo Tisular</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '90%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: TELEMETRÍA H7 */}
        {activeSubTab === 'telemetry' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
                <Heart className="w-5 h-5 text-rose-600" />
                <span>Telemetría H7 (Serie Temporal 28 Días - Veepoo BLE)</span>
              </h3>

              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-500 font-medium">HRV Promedio</p>
                  <p className="text-lg font-bold text-slate-800">{hrv} ms</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">Tono Vagal Normal</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <Moon className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-500 font-medium">Sueño Profundo</p>
                  <p className="text-lg font-bold text-slate-800">{sleep} hrs/noche</p>
                  <span className="text-[10px] text-indigo-600 font-semibold">Fase Anabólica</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <Flame className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-500 font-medium">Gasto Real (METs)</p>
                  <p className="text-lg font-bold text-slate-800">{mets} kcal/día</p>
                  <span className="text-[10px] text-amber-600 font-semibold">Actividad Moderada</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <Activity className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-500 font-medium">Presión Arterial</p>
                  <p className="text-lg font-bold text-slate-800">{bp}</p>
                  <span className="text-[10px] text-blue-600 font-semibold">Normotensión</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <p className="text-xs font-bold text-slate-700 mb-2">Resumen de Bioseguridad (JL7013A Stream)</p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sin registros de fibrilación auricular (AFib) en los 28 días.</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Temperatura corporal basal dentro del rango fisiológico normal.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: BIO-ESCÁNER ELECTRET */}
        {activeSubTab === 'electret' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>Re-Escaneo Bioeléctrico Electret (T0 Basal vs T1 Actual)</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-3">Parámetro Bioeléctrico</th>
                      <th className="p-3">Snapshot T0 (Basal)</th>
                      <th className="p-3">Snapshot T1 (28 Días)</th>
                      <th className="p-3">Variación (% Δ)</th>
                      <th className="p-3">Dictamen Fisiológico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Inflamación Celular Visceral</td>
                      <td className="p-3">68.4 %</td>
                      <td className="p-3 font-bold text-emerald-700">42.1 %</td>
                      <td className="p-3 font-bold text-emerald-600">-38.4 %</td>
                      <td className="p-3 text-emerald-700 font-medium">Desinflamación Favorable</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Viscosidad Micro-Vascular</td>
                      <td className="p-3">5.2 cP</td>
                      <td className="p-3 font-bold text-emerald-700">4.1 cP</td>
                      <td className="p-3 font-bold text-emerald-600">-21.1 %</td>
                      <td className="p-3 text-emerald-700 font-medium">Fluidez Sanguínea Normalizada</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Permeabilidad de Mucosa Intestinal</td>
                      <td className="p-3">72.1 %</td>
                      <td className="p-3 font-bold text-blue-700">48.3 %</td>
                      <td className="p-3 font-bold text-blue-600">-33.0 %</td>
                      <td className="p-3 text-blue-700 font-medium">Recuperación de Barrera Mucosa</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Cross-Linking Proteico Nocturno</td>
                      <td className="p-3">54.0 %</td>
                      <td className="p-3 font-bold text-emerald-700">79.5 %</td>
                      <td className="p-3 font-bold text-emerald-600">+47.2 %</td>
                      <td className="p-3 text-emerald-700 font-medium">Anabolismo Tisular Elevado</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: RECALIBRACIÓN 33PLUS & 34PLUS */}
        {activeSubTab === 'recalibration' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
                <Flame className="w-5 h-5 text-[#E30613]" />
                <span>Recalibración Dinámica de Formulación Celular</span>
              </h3>

              <div className="grid grid-cols-2 gap-6">
                {/* CARD 33PLUS */}
                <div className="border border-rose-200 bg-rose-50/50 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-[#E30613] text-white px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider">33Plus® Ignición</span>
                    <span className="text-xs font-bold text-rose-700">Ajuste de Mantención</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Basado en HRV de 68ms y gasto calórico de 345 kcal/día, se mantiene la posología de <strong>L-Teanina (100mg)</strong> y <strong>CoQ10 (50mg)</strong> en toma matutina para sostener el enfoque cognitivo sin sobre-estimulación.
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-rose-100 text-xs">
                    <p className="font-bold text-rose-900">Dosis Ajustada 28 Días:</p>
                    <p className="text-slate-700 mt-0.5">• 1 Cápsula Matutina con Desayuno.</p>
                  </div>
                </div>

                {/* CARD 34PLUS */}
                <div className="border border-emerald-200 bg-emerald-50/50 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-[#3AAA35] text-white px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider">34Plus® Tisular</span>
                    <span className="text-xs font-bold text-emerald-700">Refuerzo Anabólico</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Debido a la excelente recuperación de permeabilidad mucosa (-33.0%) y 2.1h de sueño profundo, se ajusta la posología nocturna con <strong>Inulina de Agave (3g)</strong>, <strong>Cromo Picolinato (200mcg)</strong> y <strong>Spirulina orgánica</strong>.
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-emerald-100 text-xs">
                    <p className="font-bold text-emerald-900">Dosis Ajustada 28 Días:</p>
                    <p className="text-slate-700 mt-0.5">• 1 Medida Nocturna 30 min antes de dormir.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 5: PLAN NUTRICIONAL */}
        {activeSubTab === 'nutrition' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-[#1C75BC]" />
                <span>Reajuste Nutricional (Sprint 28 Días — Pediátrico / Adulto)</span>
              </h3>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-xs space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-700">TDEE Recalibrado:</span>
                  <span className="font-bold text-slate-900">950 kcal/día</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-700">Grasas Saludables (35%):</span>
                  <span className="font-bold text-emerald-700">~332.5 kcal (Aguacate, Aceite de Oliva)</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-700">Carbohidratos Complejos (50%):</span>
                  <span className="font-bold text-blue-700">~475.0 kcal (Tubérculos, Frutas Frescas)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Proteínas Tisulares (15%):</span>
                  <span className="font-bold text-slate-900">~142.5 kcal (~13g netas)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 6: NOTA SOAP */}
        {activeSubTab === 'soap' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-slate-700" />
                <span>Nota de Evolución Médica SOAP (NOM-004-SSA3-2012)</span>
              </h3>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-xs space-y-3 font-mono">
                <div>
                  <strong className="text-blue-700">S (Subjetivo):</strong>
                  <p className="text-slate-700 mt-1">Lactante de 12 meses acude a consulta de seguimiento de 28 días acompañada de su madre. Refiere excelente tolerancia alimentaria, sin datos de reflujo ni cólicos. Sueño continuo de 9 a 10 horas nocturnas.</p>
                </div>
                <div>
                  <strong className="text-blue-700">O (Objetivo):</strong>
                  <p className="text-slate-700 mt-1">HRV promedio: 68 ms. Sueño profundo: 2.1 h/noche. Presión arterial: 118/76 mmHg. Δ Inflamación Celular: -38.4%. Δ Permeabilidad Mucosa: -33.0%. Score BRS: 88/100 (Óptimo).</p>
                </div>
                <div>
                  <strong className="text-blue-700">A (Análisis):</strong>
                  <p className="text-slate-700 mt-1">Evolución metabólica y celular altamente favorable. Adecuada integridad de la barrera intestinal e hidratación micro-vascular sostenida.</p>
                </div>
                <div>
                  <strong className="text-blue-700">P (Plan):</strong>
                  <p className="text-slate-700 mt-1">Continuar con la estructuración dietética de 950 kcal/día, 35% grasas de alta calidad, mantención de 33Plus® matutino y 34Plus® nocturno. Solicitud de cita para Ciclo 3 en 4 semanas.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 7: CITA CICLO 3 & SELLADO */}
        {activeSubTab === 'appointment' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-[#1C75BC]" />
                <span>Solicitud de Cita de Seguimiento — Ciclo 3 (4 Semanas)</span>
              </h3>

              {isFinished ? (
                <div className="bg-slate-100 border border-slate-300 p-4 rounded-xl text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="font-bold text-slate-900 text-sm">🔒 Cita Registrada y Sesión Sellada (NOM-004)</p>
                  <p className="text-xs text-slate-600 mt-1">La solicitud para el Ciclo 3 se ha enviado a recepción y el expediente longitudinal ha sido congelado.</p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs space-y-3">
                  <p className="text-slate-700 font-medium">Horario de atención clínica: <strong>Lunes a Viernes de 9:00 AM a 6:00 PM</strong>.</p>
                  <button
                    onClick={onScheduleAppointment}
                    className="w-full bg-[#1C75BC] hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>📅 Iniciar Solicitud de Cita Ciclo 3 en Chat ➔</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
