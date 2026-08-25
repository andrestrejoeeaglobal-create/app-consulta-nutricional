import { create } from 'zustand';

export const useClinicalToast = create((set) => ({
    toasts: [],
    showToast: ({ title, message, type = 'success', duration = 3500, icon = null }) => {
        const id = Date.now() + Math.random().toString(36).substr(2, 5);
        set((state) => ({
            toasts: [...state.toasts, { id, title, message, type, duration, icon }]
        }));

        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id)
                }));
            }, duration);
        }
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    }
}));
