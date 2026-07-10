import React from 'react';
import HexagonIdentityBar from './ui/HexagonIdentityBar';

const Footer = () => {
    return (
        <footer className="w-full bg-slate-50 border-t border-slate-200 py-6 px-6 mt-auto font-sansation">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

                {/* Información Izquierda */}
                <div className="flex-1 text-left order-2 md:order-1">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest font-prototype">
                        Versión 5.0
                    </span>
                </div>

                {/* Identidad Central (5 Hexágonos Animados) */}
                <div className="flex-1 flex justify-center order-1 md:order-2">
                    <HexagonIdentityBar />
                </div>

                {/* Información Derecha */}
                <div className="flex-1 text-right order-3">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest font-prototype">
                        © CLÍNICA {new Date().getFullYear()}
                    </span>
                </div>

            </div>
        </footer>
    );
};

export default Footer;
