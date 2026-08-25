import React, { useState } from 'react';
import logo from '../assets/logo.png'; // Confirmar ruta
import {
    Grid3x3,
    User,
    Utensils,
    Activity,
    FlaskConical,
    FileText,
    ClipboardList,
    Calendar,
    Stethoscope,
    Clipboard as PrescriptionBoard,
    Lock,
    Unlock,
    CheckCircle,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';

const formatPhaseName = (phase) => {
    if (!phase) return '---';
    const phaseMap = {
        'PHASE_0_AUTH': 'Fase 0: Autenticación',
        'PHASE_0_IDENTITY_CHECK': 'Fase 0: Validación de Identidad',
        'PHASE_0_PRIVACY': 'Fase 0: Aviso de Privacidad',
        'PHASE_1_PROFILE_NAME_CONFIRM': 'Fase 1: Confirmación de Nombre',
        'PHASE_1_PROFILE_LAST_NAME_PAT': 'Fase 1: Apellido Paterno',
        'PHASE_1_PROFILE_LAST_NAME_MAT': 'Fase 1: Apellido Materno',
        'PHASE_1_PROFILE_NAME_MANUAL': 'Fase 1: Edición Ortográfica',
        'PHASE_2_SECURITY': 'Fase 2: Contacto de Emergencia',
        'PHASE_3_MOTIVO_CONSULTA': 'Fase 3: Motivo de Consulta',
        'PHASE_3_OPEN_PROMPT': 'Fase 3: Motivo de Consulta',
        'PHASE_3_DETECTIVE_PROBE': 'Fase 3: Indagación Clínica',
        'PHASE_3_MIRACLE_QUESTION': 'Fase 3: Pregunta de Milagro',
        'PHASE_3_INFERENCE_CONFIRM': 'Fase 3: Confirmación de Diagnóstico',
        'PHASE_3_SUMMARY_CONFIRM': 'Fase 3: Resumen de Motivo',
        'PHASE_4_AHF': 'Fase 4: Antecedentes Familiares',
        'PHASE_5_APP': 'Fase 5: Patología Personal',
        'PHASE_6_FARMACO': 'Fase 6: Farmacología',
        'PHASE_7_ALERGIAS': 'Fase 7: Alergias y Sensibilidades',
        'PHASE_8_DIGESTIVO': 'Fase 8: Salud Digestiva',
        'PHASE_9_FISIOLOGICO': 'Fase 9: Estado Fisiológico',
        'PHASE_10_HABITOS': 'Fase 10: Hábitos de Consumo',
        'PHASE_11_ACTIVITY': 'Fase 11: Actividad y Sueño',
        'PHASE_12_LOGISTICA': 'Fase 12: Logística y Entorno',
        'PHASE_13_PREFERENCIAS': 'Fase 13: Preferencias Alimentarias',
        'PHASE_14_CRONONUTRICION': 'Fase 14: Crononutrición',
        'PHASE_15_FFQ': 'Fase 15: Frecuencia de Consumo',
        'PHASE_16_BIOMETRIA': 'Fase 16: Biometría General',
        'PHASE_17_VITALES': 'Fase 17: Signos Vitales',
        'PHASE_18_ESCANER': 'Fase 18: Escáner Bioeléctrico',
        'PHASE_19_DIAGNOSIS': 'Fase 19: Diagnóstico Integral'
    };
    if (phaseMap[phase]) return phaseMap[phase];
    return phase.replace(/^PHASE_/i, 'Fase ').replace(/_/g, ' ');
};

const Header = ({ sessionInfo, user, clearSession, showSessionInfo, activeTab, onTabChange, patientData, currentPhase, hardwareStatus, isIdentityConfirmed, interviewStep }) => {
    const [showResetModal, setShowResetModal] = useState(false);
    
    // Lógica de Estado de Cita (Simulada/Derivada)
    // En V13.0 se manejan PENDIENTE, COMPLETADO, NO DISPONIBLE
    // Asumiremos lógica basada en si hay folio o status explícito en sessionInfo

    const getStatusUI = () => {
        const isSessionFinished = patientData?.is_completed || interviewStep === 'finished' || currentPhase === 'PHASE_17_DESPEDIDA';
        if (isSessionFinished) {
            return {
                label: 'SESIÓN CERRADA',
                bg: 'bg-slate-100',
                border: 'border-slate-300',
                text: 'text-slate-700 font-bold',
                icon: <Lock className="w-4 h-4 text-slate-600" />
            };
        }
        if (isIdentityConfirmed) {
            return {
                label: 'SESIÓN ACTIVA',
                bg: 'bg-green-50',
                border: 'border-green-200',
                text: 'text-green-700 font-bold',
                icon: <Unlock className="w-4 h-4 text-green-600 animate-pulse" />
            };
        }
        return {
            label: 'PENDIENTE',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-700 font-bold',
            icon: <Lock className="w-4 h-4 text-amber-600" />
        };
    };

    const statusUI = getStatusUI();

    return (
        <header className="sticky top-0 z-50 bg-white shadow-sm font-sans">

            {/* ========================================================================
                1. TOP BAR (48px) - Identidad Corporativa & Perfil
            ======================================================================== */}
            <div className="h-[48px] border-b border-slate-200 flex items-center justify-between px-8 text-[13px] bg-white">

                {/* Sistema TILO */}
                <div className="font-medium text-slate-700 tracking-wide select-none">
                    Ecosistema de <span className="font-bold text-[#1C75BC]">T</span>ransformación <span className="font-bold text-[#1C75BC]">I</span>nteligente y <span className="font-bold text-[#1C75BC]">L</span>ogro <span className="font-bold text-[#1C75BC]">O</span>ptimizado
                </div>

                {/* Perfil Profesional */}
                <div className="flex items-center gap-4">
                    <span className="font-bold text-black uppercase text-[12px] tracking-wide hidden md:block">
                        {user?.name || 'ANDRES TREJO MALDONADO'}
                    </span>

                    <img
                        src={(user?.urlFoto && user.urlFoto.trim() !== "") ? user.urlFoto : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Andres Trejo')}&background=0D8ABC&color=fff`}
                        alt="Perfil"
                        className="h-8 w-8 rounded-full object-cover border border-slate-200"
                    />

                    {/* Nueva Consulta Button */}
                    <button
                        onClick={() => setShowResetModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 hover:text-slate-900 transition-colors border border-slate-200"
                        title="Reiniciar Sesión a Fase 0"
                    >
                        <RefreshCw size={14} className="animate-spin-hover" />
                        <span className="text-[11px] font-bold tracking-wide">NUEVA CONSULTA</span>
                    </button>

                    {/* Waffle Launcher */}
                    <button className="p-1.5 rounded text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer" title="Aplicaciones">
                        <Grid3x3 size={18} />
                    </button>
                </div>
            </div>

            {/* ========================================================================
                2. NAVBAR (72px) - Contexto y Navegación
            ======================================================================== */}
            <div className="h-[72px] flex items-center justify-between px-8 bg-white">

                {/* [A] MÓDULO IZQUIERDO: Branding & Sesión */}
                <div className="flex items-center h-full">

                    {/* Brand Block / Patient Info */}
                    <div className="flex items-center gap-4 pr-6 border-r border-slate-200 h-10">
                        <img src={logo} alt="Logo" className="h-10 w-auto" />
                        <div className="flex flex-col leading-none justify-center">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Paciente [{formatPhaseName(currentPhase)}]</span>
                            <span className="text-[18px] font-bold text-black tracking-tight truncate max-w-[250px]" title={sessionInfo?.patientName || '---'}>
                                {showSessionInfo && sessionInfo?.patientName ? sessionInfo.patientName : '---'}
                            </span>
                        </div>
                    </div>

                    {/* Session Data (Inline Text - Servidor Institucional) */}
                    <div className="session-data flex items-center gap-4 pl-6 text-sm font-mono tracking-wider">
                        <div className="data-group flex items-center gap-1.5">
                            <span className="data-label text-[#6b7280] font-bold text-xs uppercase tracking-wider">USUARIO</span>
                            <span id="header-userid" className="data-value text-[#374151] font-bold mr-2">
                                {showSessionInfo && sessionInfo?.userId ? sessionInfo.userId : '---'}
                            </span>
                        </div>

                        <span className="text-slate-300">|</span>

                        <div className="data-group flex items-center gap-1.5">
                            <span className="data-label text-[#6b7280] font-bold text-xs uppercase tracking-wider">CITA</span>
                            <span id="header-citaid" className="data-value highlight text-[#1a73e8] font-extrabold">
                                {showSessionInfo && (sessionInfo?.idCita || sessionInfo?.citation) ? (sessionInfo.idCita || sessionInfo.citation) : '---'}
                            </span>
                        </div>
                    </div>

                </div>

                {/* [B] MÓDULO DERECHO: Iconos & Estado */}
                <div className="flex items-center gap-8">

                    {/* Navegación Iconos (Siempre visible en Post-Login) */}
                    <nav className="flex items-center gap-1.5 mr-6 bg-slate-50 border border-slate-100 p-1.5 rounded-xl shadow-sm">
                        <NavItem icon={<User size={18} />} active={activeTab === 'profile'} onClick={() => onTabChange('profile')} title="Identidad y Perfil" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<ClipboardList size={18} />} active={activeTab === 'clinical_history'} onClick={() => onTabChange('clinical_history')} title="Historia Clínica" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<Utensils size={18} />} active={activeTab === 'lifestyle'} onClick={() => onTabChange('lifestyle')} title="Estilo de Vida y Nutrición" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<Activity size={18} />} active={activeTab === 'vitals'} onClick={() => onTabChange('vitals')} title="Biometría y Vitales" disabled={!isIdentityConfirmed} />
                        <NavItem 
                            icon={<FlaskConical size={18} />} 
                            active={activeTab === 'lab' || currentPhase === 'PHASE_18_ELECTRET'} 
                            onClick={() => onTabChange('lab')} 
                            title="Bioquímicos y Escáner"
                            isElectretActive={currentPhase === 'PHASE_18_ELECTRET'}
                            hardwareStatus={hardwareStatus}
                            disabled={!isIdentityConfirmed}
                        />
                        <NavItem icon={<FileText size={18} />} active={activeTab === 'diagnosis'} onClick={() => onTabChange('diagnosis')} title="Diagnóstico y Seguridad" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<Calendar size={18} />} active={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} title="Calendario y Sprint" disabled={!isIdentityConfirmed} />
                    </nav>

                    {/* Insignia de Hardware Electret en Fase 18 */}
                    {currentPhase === 'PHASE_18_ELECTRET' && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] font-bold tracking-wider uppercase transition-all shadow-sm select-none ${
                            hardwareStatus === 'searching' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse' 
                                : hardwareStatus === 'connected' 
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-800' 
                                : hardwareStatus === 'scanning' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse'
                                : 'bg-green-50 border-green-200 text-green-700'
                        }`}>
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 @media-reduced-motion-stop ${
                                    hardwareStatus === 'complete' ? 'bg-green-400' : 'bg-indigo-400'
                                }`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                    hardwareStatus === 'complete' ? 'bg-green-500' : 'bg-indigo-500'
                                }`}></span>
                            </span>
                            {hardwareStatus === 'searching' && "🔍 BUSCANDO SENSOR..."}
                            {hardwareStatus === 'connected' && "✅ SENSOR ENLAZADO"}
                            {hardwareStatus === 'scanning' && "⚡ ESCANEANDO..."}
                            {hardwareStatus === 'sanitizing_data' && "🛡️ REGULACIÓN COFEPRIS..."}
                            {hardwareStatus === 'complete' && "✓ ESCANEO SELLADO"}
                            {hardwareStatus === 'error' && "⚠️ ERROR HARDWARE"}
                        </div>
                    )}

                    {/* Status Pill */}
                    <div className={`flex items-center gap-2 px-5 py-2 rounded-full border ${statusUI.bg} ${statusUI.border} transition-colors shadow-sm`}>
                        {statusUI.icon}
                        <span className={`text-[12px] tracking-widest ${statusUI.text} font-prototype`}>
                            {statusUI.label}
                        </span>
                    </div>

                </div>

            </div>

            {/* Modal de Confirmación NOM-004 */}
            {showResetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a1428]/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-[420px] overflow-hidden animate-in zoom-in-95 p-8 border border-white/10">
                        {/* Cabecera con Doble Codificación de Seguridad */}
                        <div className="flex flex-col items-center mb-5">
                            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
                                <AlertTriangle className="w-6 h-6 text-amber-600" aria-hidden="true" />
                            </div>
                            <h3 className="font-bold text-[22px] text-slate-800 text-center tracking-tight">
                                Nueva Consulta
                            </h3>
                        </div>

                        <p className="text-slate-600 text-[15px] leading-relaxed mb-6 text-center">
                            Este sistema procesa datos sensibles de salud mediante <strong>Modelos Avanzados de Visión Artificial y Análisis Clínico Metabólico</strong>. Al continuar, confirmas la depuración de los datos no sellados del expediente actual (NOM-004).
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setShowResetModal(false);
                                    clearSession && clearSession();
                                }}
                                className="w-full py-3.5 text-[16px] font-bold text-white bg-[#1C75BC] hover:bg-[#114B79] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1C75BC] rounded-xl transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer"
                            >
                                Iniciar Consulta ➔
                            </button>
                            <button
                                onClick={() => setShowResetModal(false)}
                                className="w-full py-3.5 text-[15px] font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-center"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </header>
    );
};

// Componente Auxiliar para Iconos de Navegación
const NavItem = ({ icon, active, title, onClick, isElectretActive, hardwareStatus, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
            flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 relative group
            ${disabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}
            ${active && !disabled
                ? (isElectretActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100 scale-100' 
                    : 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 scale-100') 
                : (disabled ? 'text-slate-300' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50')}
        `}
        title={disabled ? "Navegación bloqueada hasta validar identidad" : title}
    >
        <div className={`transition-transform duration-200 ${active && !disabled ? 'scale-110' : (!disabled ? 'group-hover:scale-110' : '')}`}>
            {icon}
        </div>
        {/* Active Indicator */}
        {active && !disabled && (
            <div className={`absolute -bottom-1 w-3/4 h-[3px] rounded-t-sm ${isElectretActive ? 'bg-indigo-600' : 'bg-blue-600'}`} />
        )}
    </button>
);

export default Header;
