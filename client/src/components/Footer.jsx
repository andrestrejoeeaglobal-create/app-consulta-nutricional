import React from 'react';
import HexagonIdentityBar from './ui/HexagonIdentityBar';

const Footer = () => {
    return (
        <footer className="w-full bg-white dark:bg-[#1E293B] border-t border-slate-200 dark:border-slate-700 py-4 px-6 mt-auto font-sans transition-colors">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-left order-2 md:order-1 select-none" aria-hidden="true" />

                <div className="flex-1 flex justify-center order-1 md:order-2">
                    <HexagonIdentityBar />
                </div>

                <div className="flex-1 text-right order-3">
                    <span className="text-[#334155] dark:text-[#CBD5E1] text-xs font-semibold tracking-wide">
                        © Equipo en Acción®. Todos los derechos reservados.
                    </span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
