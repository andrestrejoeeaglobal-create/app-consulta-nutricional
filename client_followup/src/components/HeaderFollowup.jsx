import React from 'react';
import logo from '../assets/logo.png';
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
  LogOut
} from 'lucide-react';

export const HeaderFollowup = ({
  sessionInfo = {},
  patientData = {},
  isIdentityConfirmed = false,
  isFinished = false,
  activeTab = 'dashboard',
  onTabChange = () => {},
  onLogout = () => {}
}) => {
  const patientName = isIdentityConfirmed 
    ? (patientData?.identificacion?.nombre || sessionInfo.patientName || 'ROSA MENDEZ PADRON')
    : '---';
  
  const userId = sessionInfo.userId || '---';
  const citation = sessionInfo.citation || '---';
  const phaseTag = isIdentityConfirmed ? 'PACIENTE [SEGUIMIENTO & BIO-AUDITORÍA]' : 'PACIENTE [FASE 0: AUTENTICACIÓN]';

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm font-sans select-none border-b border-slate-200">
      {/* 1. TOP BAR (48px) - Identidad Corporativa & Perfil */}
      <div className="h-[48px] border-b border-slate-200 flex items-center justify-between px-8 text-[13px] bg-white">
        {/* Sistema TILO */}
        <div className="font-medium text-slate-700 tracking-wide select-none">
          Ecosistema de <span className="font-bold text-[#1C75BC]">T</span>ransformación <span className="font-bold text-[#1C75BC]">I</span>nteligente y <span className="font-bold text-[#1C75BC]">L</span>ogro <span className="font-bold text-[#1C75BC]">O</span>ptimizado
        </div>

        {/* Perfil Profesional */}
        <div className="flex items-center gap-4">
          <span className="font-bold text-black uppercase text-[12px] tracking-wide hidden md:block">
            {sessionInfo?.profName || sessionInfo?.userName || 'ANDRES TREJO MALDONADO'}
          </span>

          <img
            src={
              sessionInfo?.urlFoto && sessionInfo.urlFoto.trim() !== ''
                ? sessionInfo.urlFoto
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    sessionInfo?.profName || sessionInfo?.userName || 'Andres Trejo'
                  )}&background=0D8ABC&color=fff`
            }
            alt={sessionInfo?.profName || 'Perfil'}
            className="h-8 w-8 rounded-full object-cover border border-slate-200"
          />

          {/* Botón Salir / Nueva Consulta */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 hover:text-slate-900 transition-colors border border-slate-200"
            title="Reiniciar Sesión a Fase 0"
          >
            <RefreshCw size={14} className="text-slate-500" />
            <span className="text-[11px] font-bold tracking-wide">NUEVA CONSULTA</span>
          </button>

          {/* Launcher Icon */}
          <button className="p-1.5 rounded text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer" title="Aplicaciones">
            <Grid3x3 size={18} />
          </button>
        </div>
      </div>

      {/* 2. NAVBAR (72px) - Contexto y Navegación */}
      <div className="h-[72px] flex items-center justify-between px-8 bg-white">
        {/* MÓDULO IZQUIERDO: Branding & Sesión */}
        <div className="flex items-center h-full">
          {/* Brand Block / Patient Info */}
          <div className="flex items-center gap-4 pr-6 border-r border-slate-200 h-10">
            <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
            <div className="flex flex-col leading-none justify-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{phaseTag}</span>
              <span className="text-[18px] font-bold text-black tracking-tight truncate max-w-[280px]" title={patientName}>
                {patientName}
              </span>
            </div>
          </div>

          {/* Session Data (Inline Text - Servidor Institucional) */}
          <div className="session-data flex items-center gap-4 pl-6 text-sm font-mono tracking-wider">
            <div className="data-group flex items-center gap-1.5">
              <span className="data-label text-[#6b7280] font-bold text-xs uppercase tracking-wider">USUARIO</span>
              <span id="header-userid" className="data-value text-[#374151] font-bold mr-2">
                {userId}
              </span>
            </div>
            
            <span className="text-slate-300">|</span>
            
            <div className="data-group flex items-center gap-1.5">
              <span className="data-label text-[#6b7280] font-bold text-xs uppercase tracking-wider">CITA</span>
              <span id="header-citaid" className="data-value highlight text-[#1a73e8] font-extrabold">
                {citation}
              </span>
            </div>
          </div>
        </div>

        {/* MÓDULO DERECHO: Iconos & Estado */}
        <div className="flex items-center gap-6">
          {/* Navegación Iconos */}
          <nav className={`flex items-center gap-1 bg-slate-50 border border-slate-100 p-1.5 rounded-xl shadow-xs transition-opacity ${
            !isIdentityConfirmed ? 'opacity-30 pointer-events-none' : ''
          }`}>
            <NavItem icon={<User size={18} />} active={activeTab === 'profile'} onClick={() => onTabChange('profile')} title="Identidad y Perfil" disabled={!isIdentityConfirmed} />
            <NavItem icon={<ClipboardList size={18} />} active={activeTab === 'clinical_history'} onClick={() => onTabChange('clinical_history')} title="Historia Clínica" disabled={!isIdentityConfirmed} />
            <NavItem icon={<Utensils size={18} />} active={activeTab === 'lifestyle'} onClick={() => onTabChange('lifestyle')} title="Estilo de Vida y Nutrición" disabled={!isIdentityConfirmed} />
            <NavItem icon={<Activity size={18} />} active={activeTab === 'vitals'} onClick={() => onTabChange('vitals')} title="Biometría y Vitales" disabled={!isIdentityConfirmed} />
            <NavItem icon={<FlaskConical size={18} />} active={activeTab === 'dashboard'} onClick={() => onTabChange('dashboard')} title="Bio-Auditoría (50/50)" disabled={!isIdentityConfirmed} />
            <NavItem icon={<FileText size={18} />} active={activeTab === 'soap'} onClick={() => onTabChange('soap')} title="Nota SOAP (NOM-004)" disabled={!isIdentityConfirmed} />
            <NavItem icon={<Calendar size={18} />} active={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} title="Calendario y Sprint" disabled={!isIdentityConfirmed} />
          </nav>

          {/* Status Badge */}
          <div>
            {!isIdentityConfirmed ? (
              <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-200 px-3.5 py-1.5 rounded-full text-amber-700 font-bold text-xs">
                <Unlock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>PENDIENTE</span>
              </div>
            ) : isFinished ? (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 px-3.5 py-1.5 rounded-full text-slate-700 font-bold text-xs">
                <Lock className="w-4 h-4 text-slate-600" />
                <span>SESIÓN CERRADA</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-3.5 py-1.5 rounded-full text-green-700 font-bold text-xs">
                <Unlock className="w-4 h-4 text-green-600 animate-pulse" />
                <span>SESIÓN ACTIVA</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// Componente Auxiliar para Iconos de Navegación (Réplica exacta de Header.jsx)
const NavItem = ({ icon, active, title, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 relative group
      ${disabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}
      ${active && !disabled
        ? 'bg-white text-blue-600 shadow-xs ring-1 ring-blue-100 scale-100' 
        : (disabled ? 'text-slate-300' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50')}
    `}
    title={title}
  >
    <div className={`transition-transform duration-200 ${active && !disabled ? 'scale-110' : (!disabled ? 'group-hover:scale-110' : '')}`}>
      {icon}
    </div>
    {/* Active Indicator */}
    {active && !disabled && (
      <div className="absolute -bottom-1 w-3/4 h-[3px] rounded-t-sm bg-blue-600" />
    )}
  </button>
);
