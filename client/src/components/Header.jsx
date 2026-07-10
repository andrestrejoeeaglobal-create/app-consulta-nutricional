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

const Header = ({ sessionInfo, user, clearSession, showSessionInfo, activeTab, onTabChange, patientData, currentPhase, hardwareStatus }) => {
    const [showResetModal, setShowResetModal] = useState(false);
    
    // Lógica de Estado de Cita (Simulada/Derivada)
    // En V13.0 se manejan PENDIENTE, COMPLETADO, NO DISPONIBLE
    // Asumiremos lógica basada en si hay folio o status explícito en sessionInfo

    const getStatusUI = () => {
        if (patientData?.is_completed) {
            return {
                label: '✓ COMPLETADO',
                bg: 'bg-green-100',
                border: 'border-green-200',
                text: 'text-green-700 font-bold',
                icon: <CheckCircle className="w-4 h-4 text-green-600" />
            };
        }
        return {
            label: '🔒 PENDIENTE',
            bg: 'bg-slate-200',
            border: 'border-slate-300',
            text: 'text-slate-700 font-bold',
            icon: null
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
                        src={(user?.urlFoto && user.urlFoto !== "") ? user.urlFoto : "https://ui-avatars.com/api/?name=Andres+Trejo&background=0D8ABC&color=fff"}
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
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Paciente</span>
                            <span className="text-[18px] font-bold text-black tracking-tight truncate max-w-[250px]" title={sessionInfo?.patientName || '---'}>
                                {showSessionInfo && sessionInfo?.patientName ? sessionInfo.patientName : '---'}
                            </span>
                        </div>
                    </div>

                    {/* Session Data (Inline Text) */}
                    <div className="flex items-center gap-2 pl-6 text-sm font-mono tracking-wider">
                        <span className="text-slate-400 font-bold">USUARIO:</span>
                        <span className="text-black font-bold mr-2">
                            {showSessionInfo && sessionInfo?.userId ? sessionInfo.userId : '---'}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-400 font-bold ml-2">CITA:</span>
                        <span className={`font-extrabold ${showSessionInfo && (sessionInfo?.idCita || sessionInfo?.citation) ? 'text-blue-600' : 'text-black'}`}>
                            {showSessionInfo && (sessionInfo?.idCita || sessionInfo?.citation) ? (sessionInfo.idCita || sessionInfo.citation) : '---'}
                        </span>
                    </div>

                </div>

                {/* [B] MÓDULO DERECHO: Iconos & Estado */}
                <div className="flex items-center gap-8">

                    {/* Navegación Iconos (Siempre visible en Post-Login) */}
                    <nav className="flex items-center gap-1.5 mr-6 bg-slate-50 border border-slate-100 p-1.5 rounded-xl shadow-sm">
                        <NavItem icon={<User size={18} />} active={activeTab === 'profile'} onClick={() => onTabChange('profile')} title="Identidad y Perfil" />
                        <NavItem icon={<ClipboardList size={18} />} active={activeTab === 'clinical_history'} onClick={() => onTabChange('clinical_history')} title="Historia Clínica" />
                        <NavItem icon={<Utensils size={18} />} active={activeTab === 'lifestyle'} onClick={() => onTabChange('lifestyle')} title="Estilo de Vida y Nutrición" />
                        <NavItem icon={<Activity size={18} />} active={activeTab === 'vitals'} onClick={() => onTabChange('vitals')} title="Biometría y Vitales" />
                        <NavItem 
                            icon={<FlaskConical size={18} />} 
                            active={activeTab === 'lab' || currentPhase === 'PHASE_18_ELECTRET'} 
                            onClick={() => onTabChange('lab')} 
                            title="Bioquímicos y Escáner"
                            isElectretActive={currentPhase === 'PHASE_18_ELECTRET'}
                            hardwareStatus={hardwareStatus}
                        />
                        <NavItem icon={<FileText size={18} />} active={activeTab === 'diagnosis'} onClick={() => onTabChange('diagnosis')} title="Diagnóstico y Seguridad" />
                        <NavItem icon={<Calendar size={18} />} active={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} title="Calendario y Sprint" />
                    </nav>

                    {/* Insignia de Hardware Electret en Fase 18 */}
                    {currentPhase === 'PHASE_18_ELECTRET' && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] font-bold tracking-wider uppercase transition-all shadow-sm select-none ${
                            hardwareStatus === 'searching' 
                                ? 'bg-purple-50 border-purple-200 text-purple-700 animate-pulse' 
                                : hardwareStatus === 'connected' 
                                ? 'bg-purple-100 border-purple-300 text-purple-800' 
                                : hardwareStatus === 'scanning' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse'
                                : 'bg-green-50 border-green-200 text-green-700'
                        }`}>
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 @media-reduced-motion-stop ${
                                    hardwareStatus === 'complete' ? 'bg-green-400' : 'bg-purple-400'
                                }`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                    hardwareStatus === 'complete' ? 'bg-green-500' : 'bg-purple-500'
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
                        <h3 className="font-bold text-[22px] text-slate-800 mb-4 text-center tracking-tight">
                            Nueva Consulta
                        </h3>
                        <p className="text-slate-600 text-[15px] leading-relaxed mb-8 text-center">
                            Este sistema procesa datos sensibles de salud mediante <strong>Modelos Avanzados de Visión Artificial y Análisis Clínico Metabólico</strong>. Al continuar, confirmas la depuración de los datos no sellados del expediente actual (NOM-004).
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setShowResetModal(false);
                                    clearSession && clearSession();
                                }}
                                className="w-full py-3.5 text-[16px] font-bold text-white bg-[#1C75BC] hover:bg-[#155A92] rounded-xl transition-colors shadow-md flex justify-center items-center gap-2"
                            >
                                Iniciar Consulta ➔
                            </button>
                            <button
                                onClick={() => setShowResetModal(false)}
                                className="w-full py-3.5 text-[15px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-colors"
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
const NavItem = ({ icon, active, title, onClick, isElectretActive, hardwareStatus }) => (
    <button
        onClick={onClick}
        className={`
            flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 relative group
            ${active 
                ? (isElectretActive 
                    ? 'bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-100 scale-100' 
                    : 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 scale-100') 
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
        `}
        title={title}
    >
        <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>
        {/* Active Indicator */}
        {active && (
            <div className={`absolute -bottom-1 w-3/4 h-[3px] rounded-t-sm ${isElectretActive ? 'bg-purple-600' : 'bg-blue-600'}`} />
        )}
    </button>
);

export default Header;
