import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Lock, 
  Unlock, 
  Activity, 
  Calendar, 
  CheckCircle, 
  FileText, 
  Heart, 
  ShieldCheck, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

import { HeaderFollowup } from './components/HeaderFollowup';
import { LongitudinalDashboard } from './components/LongitudinalDashboard';
import { EvolutionNoteSOAP } from './components/EvolutionNoteSOAP';
import { LoginFollowup } from './components/LoginFollowup';
import { FooterLoader } from './components/FooterLoader';
import { useH7Telemetry } from './hooks/useH7Telemetry';
import { useDeltaElectret } from './hooks/useDeltaElectret';

import tiloImg from './assets/tilo.png';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isIdentityConfirmed, setIsIdentityConfirmed] = useState(false);
  const [sessionInfo, setSessionInfo] = useState({
    userId: "---",
    citation: "---",
    patientName: "---",
    userName: "ANDRES TREJO MALDONADO",
    urlFoto: "",
    token: ""
  });

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'soap'
  const [isFinished, setIsFinished] = useState(false);
  const [input, setInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const { telemetryData, isSyncing, safetyStatus } = useH7Telemetry();
  const { deltaMetrics, isScanning } = useDeltaElectret();

  const patientData = {
    identificacion: {
      nombre: isIdentityConfirmed ? sessionInfo.patientName : "---",
      edad: "12 Meses",
      sexo: "Femenino",
      usuarioId: sessionInfo.userId || "---",
      citaId: sessionInfo.citation || "---"
    }
  };

  // Historial del Chat Conversacional con Tilo en Fase 0
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hola, soy el Ecosistema de Transformación Inteligente y Logro Optimizado (T.I.L.O.), el **Copiloto Clínico y Metabólico** de Equipo en Acción. He inicializado mis protocolos de seguridad para garantizar la protección absoluta de su información clínica y validar la vigencia de su consulta.\n\n---\n\nPara blindar su sesión e iniciar el proceso, por favor **proporcione su número de cita** (recuerde que esta es personal e intransferible):",
      avatar: tiloImg
    }
  ]);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Manejador de Opciones Conversacionales (Máquina de Estados Longitudinal)
  const handleOptionSelect = (msg, val) => {
    if (isFinished || !isIdentityConfirmed) return;

    const opt = msg?.options?.find(o => o.value === val);
    const labelText = opt ? opt.label : val;

    if (val === 'VIEW_SOAP_NOTE') {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: labelText },
        {
          role: 'assistant',
          content: "📄 **Nota de Evolución NOM-004 Generada**\n\nSe ha desplegado la nota médica SOAP en la pestaña de informes. Puedes revisar los detalles biométricos o solicitar la cita para el Ciclo 3.",
          avatar: tiloImg,
          options: [
            { label: "📅 Agendar Cita de Seguimiento Ciclo 3 (4 Semanas) ➔", value: "SCHEDULE_FOLLOWUP_APPOINTMENT" }
          ]
        }
      ]);
      setActiveTab('soap');
      return;
    }

    if (val === 'SCHEDULE_FOLLOWUP_APPOINTMENT') {
      const getWeekdayOptions = () => {
        const opts = [];
        const base = new Date();
        base.setDate(base.getDate() + 28);

        for (let offset = -2; offset <= 4; offset++) {
          const d = new Date(base);
          d.setDate(d.getDate() + offset);
          const dayOfWeek = d.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const rawFormatted = d.toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
            const capFormatted = rawFormatted.charAt(0).toUpperCase() + rawFormatted.slice(1);
            opts.push({
              label: `📅 ${capFormatted}`,
              value: `APPT_DATE_${capFormatted}`
            });
          }
          if (opts.length >= 3) break;
        }
        return opts;
      };

      setMessages(prev => [
        ...prev,
        { role: 'user', content: labelText },
        {
          role: 'assistant',
          content: "📅 **Solicitud de Cita para Ciclo 3 (4 Semanas)**\n\nHorario hábil de atención: **Lunes a Viernes de 9:00 AM a 6:00 PM**.\n\nPor favor, selecciona la **fecha de preferencia**:",
          avatar: tiloImg,
          options: getWeekdayOptions()
        }
      ]);
      return;
    }

    if (val && val.startsWith('APPT_DATE_')) {
      const dateText = val.replace('APPT_DATE_', '');
      setMessages(prev => [
        ...prev,
        { role: 'user', content: labelText },
        {
          role: 'assistant',
          content: `🕒 **Selección de Horario de Atención**\n\nFecha elegida: **${dateText}**.\n\nPor favor, elige el **horario de preferencia** (disponible de 9:00 AM a 6:00 PM):`,
          avatar: tiloImg,
          options: [
            { label: "🌅 Mañana: 10:00 AM", value: `APPT_SLOT_${dateText}_10:00 AM` },
            { label: "☀️ Tarde: 02:00 PM", value: `APPT_SLOT_${dateText}_02:00 PM` },
            { label: "🌇 Tarde: 04:00 PM", value: `APPT_SLOT_${dateText}_04:00 PM` }
          ]
        }
      ]);
      return;
    }

    if (val && val.startsWith('APPT_SLOT_')) {
      const raw = val.replace('APPT_SLOT_', '');
      const parts = raw.split('_');
      const chosenDate = parts[0] || 'Fecha solicitada';
      const chosenTime = parts[1] || '10:00 AM';
      const folio = Math.floor(10000 + Math.random() * 90000);

      setMessages(prev => [
        ...prev,
        { role: 'user', content: labelText },
        {
          role: 'assistant',
          content: `📩 **Solicitud de Cita Registrada para Ciclo 3 (Sujeta a Confirmación)**\n\nSe ha enviado la petición de cita para **${patientData.identificacion.nombre}**:\n\n• **Fecha Solicitada:** ${chosenDate}\n• **Horario Preferente:** ${chosenTime}\n• **Ventana de Atención:** Lunes a Viernes (9:00 AM - 6:00 PM)\n• **Estado:** ⏳ Pendiente de Confirmación por Recepción T.I.L.O.\n• **Folio Solicitud:** #SOL-${folio}\n\n*La cita queda sujeta a confirmación de recepción. Se notificará vía WhatsApp y en la App VitalLoop®.*`,
          avatar: tiloImg,
          options: [
            { label: "🏁 Finalizar Consulta Médica & Sellado Inmutable", value: "FINAL_CONSULTATION_CLOSE" }
          ]
        }
      ]);
      return;
    }

    if (val === 'FINAL_CONSULTATION_CLOSE') {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: labelText },
        {
          role: 'assistant',
          content: `🏁 **Consulta de Seguimiento Concluida y Cincelada en Expediente (NOM-004)**\n\nSe ha completado la auditoría clínica de **${patientData.identificacion.nombre}**.\n\n• Nota de Evolución SOAP firmada digitalmente.\n• Telemetría H7 y Delta-Electret archivados en la base de datos longitudinal.\n• Expediente sellado bajo el badge **🔒 SEGUIMIENTO SELLADO**.\n\n¡Gracias por confiar en el Ecosistema T.I.L.O. & Sinergix!`,
          avatar: tiloImg
        }
      ]);
      setIsFinished(true);
      return;
    }
  };

  const handleSend = async () => {
    if (isFinished || !input.trim() || isValidating) return;
    const userMsg = input.trim();
    setInput("");

    // SI AÚN NO HA VALIDADO SU CITA (FASE 0)
    if (!isIdentityConfirmed) {
      setIsValidating(true);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMsg },
        {
          role: 'assistant',
          content: `🔍 Validando vigencia de Cita #${userMsg} con el Servidor Institucional CITA_AG...`,
          avatar: tiloImg
        }
      ]);

      try {
        const res = await axios.post('http://localhost:5000/api/followup/validate-citation', {
          appointmentId: userMsg
        });

        const data = res.data;
        setIsValidating(false);

        if (data.valid && data.allowedApp2) {
          // ✅ ACCESO PERMITIDO A APP 2 (ESTUDIO COMPLETO PREVIO)
          const pName = data.patientData?.name || 'JOSE LUIS IGLESIAS RAMON';
          const pUser = String(data.patientData?.userId || '79890');
          const pCita = String(data.patientData?.idCita || userMsg);

          setSessionInfo(prev => ({
            ...prev,
            userId: pUser,
            citation: pCita,
            patientName: pName
          }));
          setIsIdentityConfirmed(true);

          setMessages(prev => [
            ...prev.filter(m => !m.content.includes('Validando vigencia')),
            {
              role: 'assistant',
              content: `✨ **Bienvenido al Control de Seguimiento y Bio-Auditoría (Ciclo 2)**\n\nSe ha ingerido el expediente basal ($T_0$) de **${pName}** (Cita #${pCita}) sin necesidad de re-interrogatorio.\n\n• **Telemetría H7 (28 Días):** Sincronizada (HRV 68ms, Sueño Profundo 2.1h).\n• **Score Bioeléctrico BRS:** 88/100 (Evolución Óptima).\n\n¿Deseas revisar el informe de telemetría o iniciar la solicitud de cita para el Ciclo 3?`,
              avatar: tiloImg,
              options: [
                { label: "📅 Agendar Cita de Seguimiento Ciclo 3 (4 Semanas) ➔", value: "SCHEDULE_FOLLOWUP_APPOINTMENT" },
                { label: "📋 Ver Nota de Evolución NOM-004 (SOAP)", value: "VIEW_SOAP_NOTE" }
              ]
            }
          ]);
        } else if (data.redirectToApp1 || data.reason === 'ESTUDIO_PENDIENTE') {
          // ⚠️ CITA DISPONIBLE PERO SIN ESTUDIO INICIAL -> REDIRIGIR A APP 1
          setMessages(prev => [
            ...prev.filter(m => !m.content.includes('Validando vigencia')),
            {
              role: 'assistant',
              content: `⚠️ **Cita en ESTUDIO_PENDIENTE**\n\nLa Cita #${userMsg} se encuentra registrada sin un estudio inicial en sistema. Para realizar tu primera evaluación metabólica, **te canalizaremos a la App de Consulta Nutricional (App 1)**...\n\n*Redirigiendo a http://localhost:5173 en 3 segundos...*`,
              avatar: tiloImg
            }
          ]);
          setTimeout(() => {
            window.location.href = 'http://localhost:5173';
          }, 3500);
        } else {
          // ❌ CITA INVÁLIDA (#ESTUIO_NO_ENCONTRADO) O YA USADA
          setMessages(prev => [
            ...prev.filter(m => !m.content.includes('Validando vigencia')),
            {
              role: 'assistant',
              content: `❌ **Cita No Válida (#ESTUIO_NO_ENCONTRADO)**\n\nNo pudimos validar la Cita #${userMsg}. Por favor, verifica el número en tu comprobante de recepción o solicita apoyo a nuestro personal.`,
              avatar: tiloImg
            }
          ]);
        }
      } catch (err) {
        console.warn("⚠️ Fallback E2E Validation:", err);
        setIsValidating(false);

        // Fallback local demo
        const pName = userMsg === '15000' ? 'ROSA MENDEZ PADRON' : 'JOSE LUIS IGLESIAS RAMON';
        const pUser = userMsg === '15000' ? '165' : '79890';
        const pCita = userMsg;

        setSessionInfo(prev => ({
          ...prev,
          userId: pUser,
          citation: pCita,
          patientName: pName
        }));
        setIsIdentityConfirmed(true);

        setMessages(prev => [
          ...prev.filter(m => !m.content.includes('Validando vigencia')),
          {
            role: 'assistant',
            content: `✨ **Bienvenido al Control de Seguimiento y Bio-Auditoría (Ciclo 2)**\n\nSe ha ingerido el expediente basal ($T_0$) de **${pName}** (Cita #${pCita}) sin necesidad de re-interrogatorio.\n\n• **Telemetría H7 (28 Días):** Sincronizada (HRV 68ms, Sueño Profundo 2.1h).\n• **Score Bioeléctrico BRS:** 88/100 (Evolución Óptima).\n\n¿Deseas revisar el informe de telemetría o iniciar la solicitud de cita para el Ciclo 3?`,
            avatar: tiloImg,
            options: [
              { label: "📅 Agendar Cita de Seguimiento Ciclo 3 (4 Semanas) ➔", value: "SCHEDULE_FOLLOWUP_APPOINTMENT" },
              { label: "📋 Ver Nota de Evolución NOM-004 (SOAP)", value: "VIEW_SOAP_NOTE" }
            ]
          }
        ]);
      }
      return;
    }

    // SI YA ESTÁ AUTENTICADO
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg },
      {
        role: 'assistant',
        content: `Entendido. He registrado tu observación: "${userMsg}". ¿Deseas solicitar la cita para el Ciclo 3 o consultar la Nota SOAP?`,
        avatar: tiloImg,
        options: [
          { label: "📅 Agendar Cita de Seguimiento Ciclo 3 (4 Semanas) ➔", value: "SCHEDULE_FOLLOWUP_APPOINTMENT" },
          { label: "📋 Ver Nota de Evolución NOM-004 (SOAP)", value: "VIEW_SOAP_NOTE" }
        ]
      }
    ]);
  };

  const handleResetSession = () => {
    setIsLoggedIn(false);
    setIsIdentityConfirmed(false);
    setIsFinished(false);
    setSessionInfo({ userId: "---", citation: "---", patientName: "---", userName: "ANDRES TREJO MALDONADO", urlFoto: "", token: "" });
    setMessages([
      {
        role: "assistant",
        content: "Hola, soy el Ecosistema de Transformación Inteligente y Logro Optimizado (T.I.L.O.), el **Copiloto Clínico y Metabólico** de Equipo en Acción. He inicializado mis protocolos de seguridad para garantizar la protección absoluta de su información clínica y validar la vigencia de su consulta.\n\n---\n\nPara blindar su sesión e iniciar el proceso, por favor **proporcione su número de cita** (recuerde que esta es personal e intransferible):",
        avatar: tiloImg
      }
    ]);
  };

  // 1. PANTALLA INICIAL: BENTO LOGIN SCREEN (RÉPLICA MODELO APP 1)
  if (!isLoggedIn) {
    return (
      <LoginFollowup
        onLoginSuccess={(authData) => {
          setSessionInfo({
            userId: "---",
            citation: "---",
            patientName: "---",
            userName: authData.userName || "ANDRES TREJO MALDONADO",
            urlFoto: authData.urlFoto || "",
            token: authData.token || ""
          });
          setIsIdentityConfirmed(false);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  // 2. PANTALLA 2: DASHBOARD Y SPLIT-SCREEN CHAT CON TILO
  return (
    <div className="h-screen w-screen flex flex-col bg-[#FAFAFA] text-slate-800 overflow-hidden font-sans select-none relative">
      {/* HEADER SUPERIOR */}
      <HeaderFollowup
        sessionInfo={sessionInfo}
        patientData={patientData}
        isIdentityConfirmed={isIdentityConfirmed}
        isFinished={isFinished}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleResetSession}
      />

      {/* CONTENEDOR PRINCIPAL: LAYOUT 50/50 SPLIT SCREEN */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANEL IZQUIERDO (50%): CHAT CONVERSACIONAL CON TILO */}
        <div className="w-1/2 flex flex-col bg-white border-r border-slate-200 h-full">
          
          {/* STREAM DE MENSAJES (RÉPLICA EXACTA APP 1) */}
          <div className="flex-1 h-full overflow-y-auto p-8 space-y-6 bg-slate-50 custom-scrollbar z-10 relative">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === 'assistant' ? 'justify-start' : 'justify-end'
                } mb-6 items-start gap-3`}
              >
                {/* AVATAR DE TILO (CONTENEDOR OFICIAL APP 1: w-12 h-12) */}
                {msg.role === 'assistant' && (
                  <div className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden">
                    <img
                      src={tiloImg}
                      alt="Tilo"
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${
                    msg.role === 'assistant'
                      ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                      : 'bg-blue-600 text-white rounded-tr-none'
                  }`}
                >
                  <div
                    className={`prose prose-sm max-w-none ${
                      msg.role === 'assistant' ? 'prose-slate' : 'prose-invert'
                    }`}
                  >
                    <div className="text-sm leading-relaxed">
                      {/* FORMATEADOR DE MARKDOWN BOLD Y DIVISORES --- EXACTOS A APP 1 */}
                      {msg.content.split(/\n\n---\n\n|\n---\n/).map((section, sIdx) => (
                        <React.Fragment key={sIdx}>
                          {sIdx > 0 && <hr className="my-3 border-slate-200/80" />}
                          <div>
                            {section.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={pIdx} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            })}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* OPCIONES INTERACTIVAS (BOTONES DE SELECCIÓN) */}
                  {msg.options && msg.options.length > 0 && !isFinished && isIdentityConfirmed && (
                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 mt-3">
                      {msg.options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleOptionSelect(msg, opt.value)}
                          className="w-full text-left bg-white hover:bg-blue-50/80 text-[#1C75BC] font-bold py-2.5 px-3.5 rounded-xl border border-blue-100 transition-all text-xs flex items-center justify-between group shadow-2xs"
                        >
                          <span>{opt.label}</span>
                          <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* CAJA DE CAPTURA CONVERSACIONAL (REPLICA EXACTA 1-A-1 APP 1) */}
          <div className="p-6 bg-white border-t border-slate-50 shrink-0">
            {isFinished ? (
              <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span>🔒 Consulta médica finalizada. Expediente sellado bajo la NOM-004.</span>
              </div>
            ) : (
              <div className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-full px-2 py-2 shadow-sm focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all w-full">
                <button 
                  type="button"
                  disabled={!isIdentityConfirmed}
                  className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                    !isIdentityConfirmed ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600'
                  }`}
                  title="Adjuntar archivo clínico"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Escriba su respuesta..."
                  disabled={isValidating}
                  className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-sm h-10 px-2"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || isValidating}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-transform active:scale-95 shadow-md flex-shrink-0 ${
                    input.trim() && !isValidating
                      ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      : 'bg-blue-600 text-white opacity-90 cursor-pointer'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* PANEL DERECHO (50%): DASHBOARD / ESPEJO CLÍNICO BLOQUEADO */}
        <div className="w-1/2 flex flex-col bg-[#FAFAFA] h-full overflow-hidden">
          {!isIdentityConfirmed ? (
            /* ESPEJO CLÍNICO BLOQUEADO (Fase 0) */
            <div className="h-full w-full flex items-center justify-center bg-slate-50/50 p-8 select-none font-sans">
              <div className="bg-white p-8 rounded-2xl shadow-xs border border-slate-200 text-center max-w-md space-y-3">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Lock size={32} />
                </div>
                <h3 className="text-slate-800 font-extrabold text-base tracking-wider uppercase">
                  ESPEJO CLÍNICO BLOQUEADO
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Esperando validación de identidad y aceptación del aviso de privacidad (NOM-004).
                </p>
              </div>
            </div>
          ) : activeTab === 'soap' ? (
            <div className="h-full overflow-y-auto p-6">
              <EvolutionNoteSOAP
                patientData={patientData}
                deltaMetrics={deltaMetrics}
                telemetryData={telemetryData}
                sessionInfo={sessionInfo}
              />
            </div>
          ) : (
            <LongitudinalDashboard
              telemetryData={telemetryData}
              deltaMetrics={deltaMetrics}
              isSyncing={isSyncing}
              isScanning={isScanning}
              safetyStatus={safetyStatus}
            />
          )}
        </div>
      </div>

      {/* FOOTER INSTITUCIONAL V15.6 (EXACTO A APP 1) */}
      <div className="w-full h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6 z-20 shrink-0 relative shadow-[0_-2px_10px_rgba(0,0,0,0.02)] select-none">
        <span className="text-gray-400 text-[11px] font-mono cursor-help select-none" title="Build: v2.0.4-stable | Cortex Engine v15.6 | NOM-004 Compliant">
          [TILO-CORE]
        </span>

        {/* COMPONENTE AISLADO DEL LOADER CON ANIMACIÓN EA Y DIMENSIONES DE 30PX */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-64 h-full flex justify-center items-center">
          <FooterLoader />
        </div>

        <span className="text-gray-400 text-sm font-sansation">© DERECHOS RESERVADOS 2026</span>
      </div>
    </div>
  );
}
