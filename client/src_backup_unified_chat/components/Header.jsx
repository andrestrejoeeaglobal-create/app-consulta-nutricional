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

const Header = ({ sessionInfo, user, clearSession, showSessionInfo, activeTab, onTabChange }) => {
    const [showResetModal, setShowResetModal] = useState(false);
    
    // Lógica de Estado de Cita (Simulada/Derivada)
    // En V13.0 se manejan PENDIENTE, COMPLETADO, NO DISPONIBLE
    // Asumiremos lógica basada en si hay folio o status explícito en sessionInfo

    const getStatusUI = () => {
        // En estado post-login la píldora siempre es gris neutral
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
                <div className="font-medium text-slate-700 tracking-wide">
                    Sistema de <span className="font-bold text-blue-700">T</span>ransformación <span className="font-bold text-blue-700">I</span>nteligente y <span className="font-bold text-blue-700">L</span>ogro <span className="font-bold text-blue-700">O</span>ptimizado
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
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors border border-blue-100"
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
                        <NavItem icon={<Calendar size={18} />} active={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} title="Calendario" />
                        <NavItem icon={<FlaskConical size={18} />} active={activeTab === 'lab'} onClick={() => onTabChange('lab')} title="Laboratorio" />
                        <NavItem icon={<Utensils size={18} />} active={activeTab === 'diet'} onClick={() => onTabChange('diet')} title="Nutrición" />
                        <NavItem icon={<User size={18} />} active={activeTab === 'profile'} onClick={() => onTabChange('profile')} title="Perfil" />
                        <NavItem icon={<ClipboardList size={18} />} active={activeTab === 'intervention'} onClick={() => onTabChange('intervention')} title="Plan de Acción" />
                        <NavItem icon={<FileText size={18} />} active={activeTab === 'notes'} onClick={() => onTabChange('notes')} title="Reporte Integral" />
                        <NavItem icon={<Activity size={18} />} active={activeTab === 'vitals'} onClick={() => onTabChange('vitals')} title="Vitales" />
                    </nav>

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
                            Este sistema procesa datos sensibles de salud mediante <strong>Inteligencia Artificial Bio-Cuántica</strong>. Al continuar, confirmas la depuración de los datos no sellados del expediente actual (NOM-004).
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setShowResetModal(false);
                                    clearSession && clearSession();
                                }}
                                className="w-full py-3.5 text-[16px] font-bold text-white bg-[#1c4ed8] hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-600/20 flex justify-center items-center gap-2"
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
const NavItem = ({ icon, active, title, onClick }) => (
    <button
        onClick={onClick}
        className={`
            flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 relative group
            ${active ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 scale-100' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
        `}
        title={title}
    >
        <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>
        {/* Active Indicator */}
        {active && (
            <div className="absolute -bottom-1 w-3/4 h-[3px] bg-blue-600 rounded-t-sm" />
        )}
    </button>
);

export default Header;
