import React, { useState } from 'react';
import logo from '../assets/logo.png';
import LogoEABlanco from '../assets/LogoEABlanco.svg';
import ThemeToggleButton from './ui/ThemeToggleButton';
import OfflineCloudBanner from './ui/OfflineCloudBanner';
import {
    Grid3x3,
    User,
    Utensils,
    Activity,
    FlaskConical,
    FileText,
    ClipboardList,
    Calendar,
    Lock,
    Unlock,
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
        'PHASE_18_ELECTRET': 'Fase 18: Escáner Bioeléctrico',
        'PHASE_19_DIAGNOSIS': 'Fase 19: Diagnóstico Integral'
    };
    if (phaseMap[phase]) return phaseMap[phase];
    return phase.replace(/^PHASE_/i, 'Fase ').replace(/_/g, ' ');
};

const Header = ({ sessionInfo, user, clearSession, showSessionInfo, activeTab, onTabChange, patientData, currentPhase, hardwareStatus, isIdentityConfirmed, interviewStep }) => {
    const [showResetModal, setShowResetModal] = useState(false);

    const getStatusUI = () => {
        const isSessionFinished = patientData?.is_completed || interviewStep === 'finished' || currentPhase === 'PHASE_17_DESPEDIDA';
        if (isSessionFinished) {
            return {
                label: 'SESIÓN CERRADA',
                bg: 'bg-slate-100 dark:bg-slate-800',
                border: 'border-slate-300 dark:border-slate-600',
                text: 'text-[#0F172A] dark:text-[#F8FAFC] font-bold',
                icon: <Lock className="w-4 h-4 text-[#334155] dark:text-[#CBD5E1]" strokeWidth={2} aria-hidden="true" />
            };
        }
        if (isIdentityConfirmed) {
            return {
                label: 'SESIÓN ACTIVA',
                bg: 'bg-green-50 dark:bg-emerald-950/60',
                border: 'border-[#3AAA35]/50',
                text: 'text-[#166534] dark:text-[#86EFAC] font-bold',
                icon: <Unlock className="w-4 h-4 text-[#3AAA35] motion-safe:animate-pulse" strokeWidth={2} aria-hidden="true" />
            };
        }
        return {
            label: 'PENDIENTE',
            bg: 'bg-[#FFCC00] dark:bg-[#FFCC00]',
            border: 'border-[#0F172A]/20',
            text: 'text-[#0F172A] font-extrabold',
            icon: <Lock className="w-4 h-4 text-[#0F172A]" strokeWidth={2} aria-hidden="true" />
        };
    };

    const statusUI = getStatusUI();

    return (
        <header className="sticky top-0 z-50 bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-slate-700 shadow-sm font-sans transition-colors">
            {/* Banner Persistente Offline-First NOM-004 */}
            <OfflineCloudBanner />

            {/* 1. TOP BAR - Identidad Corporativa & Perfil */}
            <div className="min-h-[56px] border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-8 py-1.5 text-[13px] bg-[#F8FAFC] dark:bg-[#0F172A]">
                <div className="font-medium text-[#334155] dark:text-[#CBD5E1] tracking-wide select-none">
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Equipo en Acción®</span> — Ecosistema de <span className="font-bold text-[#1C75BC] dark:text-[#3894E0]">T</span>ransformación <span className="font-bold text-[#1C75BC] dark:text-[#3894E0]">I</span>nteligente y <span className="font-bold text-[#1C75BC] dark:text-[#3894E0]">L</span>ogro <span className="font-bold text-[#1C75BC] dark:text-[#3894E0]">O</span>ptimizado
                </div>

                <div className="flex items-center gap-3">
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase text-[12px] tracking-wide hidden md:block">
                        {user?.name || 'PROFESIONAL DE LA SALUD'}
                    </span>

                    <img
                        src={(user?.urlFoto && user.urlFoto.trim() !== "") ? user.urlFoto : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Equipo en Accion')}&background=1C75BC&color=fff`}
                        alt="Perfil del profesional"
                        className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />

                    {/* Nueva Consulta Button (>= 44px touch target) */}
                    <button
                        type="button"
                        onClick={() => setShowResetModal(true)}
                        className="min-h-[44px] flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600 cursor-pointer"
                        title="Reiniciar Sesión a Fase 0"
                    >
                        <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
                        <span className="text-[11px] font-bold tracking-wide">NUEVA CONSULTA</span>
                    </button>

                    {/* Toggle de Tema Claro / Oscuro (48x48 px) */}
                    <ThemeToggleButton />

                    {/* Waffle Launcher (>= 44px touch target) */}
                    <button
                        type="button"
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-[#334155] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1C75BC] transition-colors cursor-pointer"
                        title="Aplicaciones"
                        aria-label="Menú de aplicaciones"
                    >
                        <Grid3x3 size={18} strokeWidth={2} />
                    </button>
                </div>
            </div>

            {/* 2. NAVBAR - Contexto Clínico y Navegación */}
            <div className="min-h-[72px] flex flex-wrap items-center justify-between gap-4 px-4 lg:px-8 py-2 bg-white dark:bg-[#1E293B]">
                {/* [A] MÓDULO IZQUIERDO: Branding Oficial & Sesión */}
                <div className="flex items-center flex-wrap gap-4">
                    <div className="flex items-center gap-4 pr-6 border-r border-slate-200 dark:border-slate-700 min-h-[44px]">
                        <img src={logo} alt="Equipo en Acción®" className="h-10 w-auto block dark:hidden" />
                        <div className="hidden dark:flex items-center justify-center bg-[#1C75BC] px-2.5 py-1.5 rounded-xl h-10">
                            <img src={LogoEABlanco} alt="Equipo en Acción®" className="h-7 w-auto object-contain" />
                        </div>
                        <div className="flex flex-col leading-none justify-center">
                            <span className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-widest mb-1">
                                Paciente [{formatPhaseName(currentPhase)}]
                            </span>
                            <span className="text-[18px] font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight truncate max-w-[260px]" title={sessionInfo?.patientName || '---'}>
                                {showSessionInfo && sessionInfo?.patientName ? sessionInfo.patientName : '---'}
                            </span>
                        </div>
                    </div>

                    {/* Session Data Tabular (100% tabular-nums y Contraste AAA) */}
                    <div className="session-data tabular-nums flex items-center gap-4 pl-2 text-sm font-mono tracking-wider">
                        <div className="data-group flex items-center gap-1.5">
                            <span className="data-label text-[#334155] dark:text-[#CBD5E1] font-bold text-xs uppercase tracking-wider">USUARIO</span>
                            <span id="header-userid" className="data-value tabular-nums text-[#0F172A] dark:text-[#F8FAFC] font-extrabold mr-2">
                                {showSessionInfo && sessionInfo?.userId ? sessionInfo.userId : '---'}
                            </span>
                        </div>

                        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>

                        <div className="data-group flex items-center gap-1.5">
                            <span className="data-label text-[#334155] dark:text-[#CBD5E1] font-bold text-xs uppercase tracking-wider">CITA</span>
                            <span id="header-citaid" className="data-value tabular-nums highlight text-[#1C75BC] dark:text-[#3894E0] font-extrabold">
                                {showSessionInfo && (sessionInfo?.idCita || sessionInfo?.citation) ? (sessionInfo.idCita || sessionInfo.citation) : '---'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* [B] MÓDULO DERECHO: Iconos & Estado */}
                <div className="flex items-center gap-4 lg:gap-6">
                    <nav className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 p-1.5 rounded-xl shadow-sm" aria-label="Secciones del expediente clínico">
                        <NavItem icon={<User size={18} strokeWidth={2} />} active={activeTab === 'profile'} onClick={() => onTabChange('profile')} title="Identidad y Perfil" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<ClipboardList size={18} strokeWidth={2} />} active={activeTab === 'clinical_history'} onClick={() => onTabChange('clinical_history')} title="Historia Clínica" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<Utensils size={18} strokeWidth={2} />} active={activeTab === 'lifestyle'} onClick={() => onTabChange('lifestyle')} title="Estilo de Vida y Nutrición" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<Activity size={18} strokeWidth={2} />} active={activeTab === 'vitals'} onClick={() => onTabChange('vitals')} title="Biometría y Vitales" disabled={!isIdentityConfirmed} />
                        <NavItem
                            icon={<FlaskConical size={18} strokeWidth={2} />}
                            active={activeTab === 'lab' || currentPhase === 'PHASE_18_ELECTRET'}
                            onClick={() => onTabChange('lab')}
                            title="Bioquímicos y Escáner"
                            isElectretActive={currentPhase === 'PHASE_18_ELECTRET'}
                            hardwareStatus={hardwareStatus}
                            disabled={!isIdentityConfirmed}
                        />
                        <NavItem icon={<FileText size={18} strokeWidth={2} />} active={activeTab === 'diagnosis'} onClick={() => onTabChange('diagnosis')} title="Diagnóstico y Seguridad" disabled={!isIdentityConfirmed} />
                        <NavItem icon={<Calendar size={18} strokeWidth={2} />} active={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} title="Calendario y Sprint" disabled={!isIdentityConfirmed} />
                    </nav>

                    {/* Insignia de Hardware Electret en Fase 18 */}
                    {currentPhase === 'PHASE_18_ELECTRET' && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] font-bold tracking-wider uppercase transition-all shadow-sm select-none ${
                            hardwareStatus === 'searching'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-800 motion-safe:animate-pulse'
                                : hardwareStatus === 'connected'
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-900'
                                : hardwareStatus === 'scanning'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-800 motion-safe:animate-pulse'
                                : 'bg-green-50 border-green-200 text-[#166534]'
                        }`}>
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                    hardwareStatus === 'complete' ? 'bg-green-400' : 'bg-indigo-400'
                                }`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                    hardwareStatus === 'complete' ? 'bg-[#3AAA35]' : 'bg-indigo-600'
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

                    {/* Status Pill (Triple Señal AAA) */}
                    <div className={`min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-full border ${statusUI.bg} ${statusUI.border} transition-colors shadow-sm`}>
                        {statusUI.icon}
                        <span className={`text-[12px] tracking-widest ${statusUI.text} font-sans`}>
                            {statusUI.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmación NOM-004 ("Usted Global") */}
            {showResetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl w-[90%] max-w-[440px] overflow-hidden animate-in zoom-in-95 p-8 border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col items-center mb-5">
                            <div className="w-12 h-12 rounded-full bg-[#FFCC00] border border-[#0F172A]/20 flex items-center justify-center mb-3">
                                <AlertTriangle className="w-6 h-6 text-[#0F172A]" strokeWidth={2} aria-hidden="true" />
                            </div>
                            <h3 className="font-bold text-[22px] text-[#0F172A] dark:text-[#F8FAFC] text-center tracking-tight">
                                Nueva Consulta
                            </h3>
                        </div>

                        <p className="text-[#334155] dark:text-[#CBD5E1] text-[15px] leading-relaxed mb-6 text-center">
                            Este sistema procesa datos sensibles de salud mediante <strong>Modelos Avanzados de Visión Artificial y Análisis Clínico Metabólico</strong>. Al continuar, usted confirma la depuración en memoria local de los datos no sellados de la sesión actual (NOM-004).
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowResetModal(false);
                                    clearSession && clearSession();
                                }}
                                className="min-h-[48px] w-full py-3.5 text-[16px] font-bold text-white bg-[#1C75BC] hover:bg-[#155A92] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1C75BC] rounded-xl transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer"
                            >
                                Iniciar Consulta ➔
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowResetModal(false)}
                                className="min-h-[48px] w-full py-3.5 text-[15px] font-bold text-[#334155] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white bg-[#F8FAFC] dark:bg-[#0F172A] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-center border border-slate-200 dark:border-slate-700"
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

const NavItem = ({ icon, active, title, onClick, isElectretActive, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className={`
            min-w-[44px] min-h-[44px] flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 relative group
            ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}
            ${active && !disabled
                ? (isElectretActive
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-700 scale-100'
                    : 'bg-white dark:bg-[#1E293B] text-[#1C75BC] dark:text-[#3894E0] shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 scale-100')
                : (disabled ? 'text-slate-400 dark:text-slate-600' : 'text-[#334155] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800')}
        `}
        title={disabled ? "Navegación bloqueada hasta validar identidad" : title}
    >
        <div className={`transition-transform duration-200 ${active && !disabled ? 'scale-110' : (!disabled ? 'group-hover:scale-110' : '')}`}>
            {icon}
        </div>
        {active && !disabled && (
            <div className={`absolute -bottom-1 w-3/4 h-[3px] rounded-t-sm ${isElectretActive ? 'bg-indigo-600' : 'bg-[#1C75BC]'}`} />
        )}
    </button>
);

export default Header;
