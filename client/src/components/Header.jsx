import React from 'react';
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
    RefreshCw
} from 'lucide-react';

const Header = ({ sessionInfo, user, clearSession, showSessionInfo, activeTab, onTabChange }) => {
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
                        onClick={() => {
                            if (window.confirm("¿Estás seguro de iniciar una nueva consulta? Se perderá el progreso no guardado.")) {
                                clearSession && clearSession();
                            }
                        }}
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

                    {/* Brand Block */}
                    <div className="flex items-center gap-4 pr-6 border-r border-slate-200 h-10">
                        <img src={logo} alt="Logo" className="h-10 w-auto" />
                        <div className="flex flex-col leading-none justify-center">
                            <span className="text-[20px] font-bold text-black tracking-tight">Asistente Nutricional</span>
                            <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mt-0.5">MODO PROFESIONAL</span>
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
                        <NavItem icon={<User size={18} />} active={activeTab === 'profile'} onClick={() => onTabChange('profile')} title="Perfil" />
                        <NavItem icon={<Utensils size={18} />} active={activeTab === 'diet'} onClick={() => onTabChange('diet')} title="Nutrición" />
                        <NavItem icon={<Activity size={18} />} active={activeTab === 'vitals'} onClick={() => onTabChange('vitals')} title="Vitales" />
                        <NavItem icon={<FlaskConical size={18} />} active={activeTab === 'lab'} onClick={() => onTabChange('lab')} title="Laboratorio" />
                        <NavItem icon={<FileText size={18} />} active={activeTab === 'notes'} onClick={() => onTabChange('notes')} title="Reporte Integral" />
                        <NavItem icon={<ClipboardList size={18} />} active={activeTab === 'intervention'} onClick={() => onTabChange('intervention')} title="Plan de Acción" />
                        <NavItem icon={<Calendar size={18} />} active={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} title="Calendario" />
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
