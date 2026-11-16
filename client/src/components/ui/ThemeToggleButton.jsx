import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';
    try {
        return localStorage.getItem('ea-theme') === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
};

export const ThemeToggleButton = ({ className = '' }) => {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
    }, [theme]);

    useEffect(() => {
        const handleExternalChange = (event) => {
            const next = event?.detail?.theme || getInitialTheme();
            setTheme(next);
        };
        window.addEventListener('ea-theme-change', handleExternalChange);
        window.addEventListener('storage', handleExternalChange);
        return () => {
            window.removeEventListener('ea-theme-change', handleExternalChange);
            window.removeEventListener('storage', handleExternalChange);
        };
    }, []);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        try {
            localStorage.setItem('ea-theme', next);
        } catch {
            // Ignorar bloqueo de almacenamiento privado
        }
        document.documentElement.classList.toggle('dark', next === 'dark');
        setTheme(next);
        window.dispatchEvent(new CustomEvent('ea-theme-change', { detail: { theme: next } }));
    };

    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className={`w-12 h-12 min-w-[48px] min-h-[48px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ${className}`}
        >
            {isDark ? (
                <Sun className="w-5 h-5 text-[#FFCC00]" strokeWidth={2} aria-hidden="true" />
            ) : (
                <Moon className="w-5 h-5 text-[#1C75BC]" strokeWidth={2} aria-hidden="true" />
            )}
        </button>
    );
};

export default ThemeToggleButton;
