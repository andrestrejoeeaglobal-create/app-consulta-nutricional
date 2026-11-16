import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, ClipboardCheck, X } from 'lucide-react';
import { useClinicalToast } from '../../hooks/useClinicalToast';

const TYPE_CONFIG = {
    success: {
        bg: 'bg-white dark:bg-[#1E293B] border-[#3AAA35]/60',
        iconBg: 'bg-[#3AAA35]/10 text-[#166534] dark:text-[#86EFAC] border-[#3AAA35]/40',
        badge: 'VALIDADO',
        badgeStyle: 'bg-[#3AAA35] text-white',
        icon: CheckCircle2,
        defaultTitle: 'Operación Exitosa'
    },
    warning: {
        bg: 'bg-white dark:bg-[#1E293B] border-[#FFCC00]',
        iconBg: 'bg-[#FFCC00] text-[#0F172A] border-[#0F172A]/20',
        badge: 'PREVENCIÓN',
        badgeStyle: 'bg-[#FFCC00] text-[#0F172A]',
        icon: AlertTriangle,
        defaultTitle: 'Advertencia Clínica'
    },
    error: {
        bg: 'bg-white dark:bg-[#1E293B] border-[#B70E0C]',
        iconBg: 'bg-[#B70E0C]/10 text-[#B70E0C] dark:text-[#FCA5A5] border-[#B70E0C]/40',
        badge: 'ACCIÓN REQUERIDA',
        badgeStyle: 'bg-[#B70E0C] text-white',
        icon: XCircle,
        defaultTitle: 'Alerta de Seguridad'
    },
    info: {
        bg: 'bg-white dark:bg-[#1E293B] border-[#1C75BC]/60',
        iconBg: 'bg-[#1C75BC]/10 text-[#1C75BC] dark:text-[#93C5FD] border-[#1C75BC]/40',
        badge: 'AVISO',
        badgeStyle: 'bg-[#1C75BC] text-white',
        icon: Info,
        defaultTitle: 'Notificación del Sistema'
    }
};

export function ClinicalToastContainer() {
    const { toasts, removeToast } = useClinicalToast();

    return (
        <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
            <AnimatePresence>
                {toasts.map((toast) => {
                    const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;
                    const IconComponent = toast.icon === 'clipboard' ? ClipboardCheck : config.icon;

                    return (
                        <motion.div
                            key={toast.id}
                            role={toast.sticky ? 'alertdialog' : 'status'}
                            aria-live={toast.sticky ? 'assertive' : 'polite'}
                            initial={{ opacity: 0, y: -16, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 40, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className={`pointer-events-auto p-4 rounded-2xl border-2 shadow-xl backdrop-blur-md flex flex-col gap-3 ${config.bg}`}
                        >
                            <div className="flex items-start gap-3.5">
                                <div className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${config.iconBg}`}>
                                    <IconComponent className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
                                </div>

                                <div className="flex-1 min-w-0 pr-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${config.badgeStyle}`}>
                                            {config.badge}
                                        </span>
                                        <h4 className="text-xs font-extrabold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
                                            {toast.title || config.defaultTitle}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium mt-1.5">
                                        {toast.message}
                                    </p>
                                </div>

                                {!toast.sticky && (
                                    <button
                                        type="button"
                                        onClick={() => removeToast(toast.id)}
                                        className="min-w-[44px] min-h-[44px] -mt-1 -mr-1 inline-flex items-center justify-center text-[#334155] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                                        aria-label="Cerrar notificación"
                                    >
                                        <X className="w-4 h-4" strokeWidth={2} />
                                    </button>
                                )}
                            </div>

                            {toast.sticky && (
                                <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => removeToast(toast.id)}
                                        className="min-h-[44px] min-w-[112px] px-4 py-2 rounded-xl bg-[#1C75BC] hover:bg-[#155A92] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

export default ClinicalToastContainer;
