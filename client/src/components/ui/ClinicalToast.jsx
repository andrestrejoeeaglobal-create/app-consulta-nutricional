import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, ClipboardCheck, X } from 'lucide-react';
import { useClinicalToast } from '../../hooks/useClinicalToast';

const TYPE_CONFIG = {
    success: {
        bg: 'bg-white dark:bg-slate-900 border-emerald-500/40 shadow-emerald-950/5',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
        icon: CheckCircle2,
        defaultTitle: 'Operación Exitosa'
    },
    warning: {
        bg: 'bg-white dark:bg-slate-900 border-amber-500/40 shadow-amber-950/5',
        iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
        icon: AlertTriangle,
        defaultTitle: 'Advertencia Clínica'
    },
    error: {
        bg: 'bg-white dark:bg-slate-900 border-red-500/40 shadow-red-950/5',
        iconBg: 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
        badgeBg: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300',
        icon: XCircle,
        defaultTitle: 'Alerta de Seguridad'
    },
    info: {
        bg: 'bg-white dark:bg-slate-900 border-blue-500/40 shadow-blue-950/5',
        iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        badgeBg: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300',
        icon: Info,
        defaultTitle: 'Notificación del Sistema'
    }
};

export function ClinicalToastContainer() {
    const { toasts, removeToast } = useClinicalToast();

    return (
        <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
            <AnimatePresence>
                {toasts.map((toast) => {
                    const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;
                    const IconComponent = toast.icon === 'clipboard' ? ClipboardCheck : config.icon;

                    return (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 50, scale: 0.9 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className={`pointer-events-auto p-4 rounded-2xl border shadow-lg backdrop-blur-md flex items-start gap-3.5 ${config.bg}`}
                        >
                            <div className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${config.iconBg}`}>
                                <IconComponent className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                                        {toast.title || config.defaultTitle}
                                    </h4>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium mt-1">
                                    {toast.message}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => removeToast(toast.id)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                                aria-label="Cerrar notificación"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

export default ClinicalToastContainer;
