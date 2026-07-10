import React from 'react';

const SessionHeader = ({ userId, cita, isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="flex items-center gap-6 animate-fade-in ml-auto mr-4">
            {/* ID USUARIO (Secondary) */}
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-none mb-1">ID USUARIO</span>
                <span className="text-sm font-bold text-gray-700 font-mono leading-none">{userId || '---'}</span>
            </div>

            {/* DIVIDER */}
            <div className="h-8 w-px bg-gray-200"></div>

            {/* REF CITA (Primary - High Visibility) */}
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-black text-blue-400 tracking-widest leading-none mb-1">REF. CITA</span>
                <span className="text-2xl font-black text-blue-600 font-mono leading-none tracking-tight">
                    {cita ? `#${cita}` : '---'}
                </span>
            </div>
        </div>
    );
};

export default SessionHeader;
