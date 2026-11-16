import React, { useState, useEffect } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { getOutboxStatus, drainCitationOutbox } from '../../utils/syncOutboxQueue';

export const OfflineCloudBanner = () => {
    const [status, setStatus] = useState(getOutboxStatus);

    useEffect(() => {
        const handleUpdate = (event) => {
            setStatus(event?.detail || getOutboxStatus());
        };
        const handleNetwork = () => {
            setStatus(getOutboxStatus());
        };

        window.addEventListener('tilo-outbox-status', handleUpdate);
        window.addEventListener('online', handleNetwork);
        window.addEventListener('offline', handleNetwork);

        return () => {
            window.removeEventListener('tilo-outbox-status', handleUpdate);
            window.removeEventListener('online', handleNetwork);
            window.removeEventListener('offline', handleNetwork);
        };
    }, []);

    if (status.online && status.pendingCount === 0) {
        return null;
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className="w-full bg-[#0F172A] text-[#F8FAFC] border-b-2 border-[#FFCC00] px-6 py-2.5 flex items-center justify-between gap-4 text-xs font-medium z-50"
        >
            <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#FFCC00] text-[#0F172A] font-extrabold uppercase tracking-wider text-[11px]">
                    <CloudOff className="w-4 h-4 mr-1.5 text-[#0F172A]" strokeWidth={2} aria-hidden="true" />
                    {status.online ? 'Sincronizando Cola Local' : 'Modo Sin Conexión Activo'}
                </span>
                <span className="text-[#F8FAFC]">
                    {status.online
                        ? 'Conexión restablecida. Enviando avances resguardados localmente al expediente NOM-004.'
                        : 'Su progreso clínico se resguarda localmente y se sincronizará en orden FIFO al recuperar la red.'}
                </span>
            </div>

            <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="text-[#CBD5E1] font-semibold">
                    Pendientes: <strong className="text-[#FFCC00]">{status.pendingCount}</strong>
                </span>
                {status.online && status.pendingCount > 0 && (
                    <button
                        type="button"
                        onClick={() => drainCitationOutbox()}
                        className="min-h-[36px] px-3 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-slate-600 text-[#F8FAFC] inline-flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${status.isProcessing ? 'animate-spin motion-reduce:animate-none' : ''}`} strokeWidth={2} />
                        Reintentar
                    </button>
                )}
            </div>
        </div>
    );
};

export default OfflineCloudBanner;
