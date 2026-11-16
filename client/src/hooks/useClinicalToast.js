import { create } from 'zustand';

export const useClinicalToast = create((set) => ({
    toasts: [],
    showToast: ({ title, message, type = 'success', duration, sticky, icon = null, dedupeKey = null }) => {
        const id = Date.now() + Math.random().toString(36).slice(2, 7);
        const isSticky = typeof sticky === 'boolean'
            ? sticky
            : (type === 'error' || type === 'warning');
        const effectiveDuration = isSticky ? 0 : (typeof duration === 'number' ? duration : 3800);

        set((state) => ({
            toasts: [
                ...(dedupeKey ? state.toasts.filter((t) => t.dedupeKey !== dedupeKey) : state.toasts),
                { id, title, message, type, duration: effectiveDuration, sticky: isSticky, icon, dedupeKey }
            ]
        }));

        if (!isSticky && effectiveDuration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id)
                }));
            }, effectiveDuration);
        }
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    }
}));
