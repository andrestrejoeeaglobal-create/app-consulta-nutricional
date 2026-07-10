import React from 'react';

// Componente de Hexágono SVG nativo para máxima precisión y cero dependencias
const HexagonIcon = ({ color, className, style }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${color} ${className}`}
        style={style}
        aria-hidden="true"
    >
        {/* Path matemático de un hexágono perfecto */}
        <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
    </svg>
);

const HexagonIdentityBar = () => {
    // Configuración basada en UI_02_ESTRUCTURA_MARCO_PRINCIPAL
    // 5 Elementos | Centro Vertical | Laterales Horizontales
    const HEX_CONFIG = [
        {
            id: 1,
            color: 'text-[#B70E0C]', // Rojo Intenso
            rotate: 'rotate-90',     // Acostado
            pulse: 'animate-pulse delay-75'
        },
        {
            id: 2,
            color: 'text-[#F29FC5]', // Rosa Pastel
            rotate: 'rotate-90',     // Acostado
            pulse: 'animate-pulse delay-100'
        },
        {
            id: 3,
            color: 'text-[#1C75BC]', // AZUL CORPORATIVO (CENTRO)
            rotate: 'rotate-0',      // Vertical (De pie - Eje Central)
            scale: 'scale-125',      // Jerarquía visual mayor
            pulse: 'animate-pulse delay-150'
        },
        {
            id: 4,
            color: 'text-[#3AAA35]', // Verde Hoja
            rotate: 'rotate-90',     // Acostado
            pulse: 'animate-pulse delay-200'
        },
        {
            id: 5,
            color: 'text-[#FFCC00]', // Amarillo Oro
            rotate: 'rotate-90',     // Acostado
            pulse: 'animate-pulse delay-300'
        },
    ];

    return (
        <div className="w-full flex items-center justify-center gap-3 py-2 opacity-90 hover:opacity-100 transition-opacity duration-300">
            {HEX_CONFIG.map((hex) => (
                <div
                    key={hex.id}
                    className={`transform transition-all duration-500 hover:scale-110 ${hex.scale || ''}`}
                >
                    <HexagonIcon
                        color={hex.color}
                        className={`w-6 h-6 filter drop-shadow-sm ${hex.rotate} ${hex.pulse}`}
                    />
                </div>
            ))}
        </div>
    );
};

export default HexagonIdentityBar;
