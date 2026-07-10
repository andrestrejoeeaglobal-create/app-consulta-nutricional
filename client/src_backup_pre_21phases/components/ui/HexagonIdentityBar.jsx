import React from 'react';

const HEX_PATH = "M441.5 39.8C432.9 25.1 417.1 16 400 16H176c-17.1 0-32.9 9.1-41.5 23.8l-112 192c-8.7 14.9-8.7 33.4 0 48.4l112 192c8.6 14.7 24.4 23.8 41.5 23.8h224c17.1 0 32.9-9.1 41.5-23.8l112-192c8.7-14.9 8.7-33.4 0-48.4l-112-192z";

const HEXAGON_CONFIG = [
    { id: 1, color: '#B70E0C', rotation: 180, delay: '0s' },   // Rojo
    { id: 2, color: '#F29FC5', rotation: 180, delay: '0.2s' }, // Rosa
    { id: 3, color: '#1C75BC', rotation: 90, delay: '0.4s' }, // Azul (Centro)
    { id: 4, color: '#3AAA35', rotation: 180, delay: '0.6s' }, // Verde
    { id: 5, color: '#FFCC00', rotation: 180, delay: '0.8s' }, // Amarillo
];

export const HexagonIdentityBar = () => {
    return (
        <div className="flex justify-center items-center gap-2">
            {HEXAGON_CONFIG.map((hex) => (
                <svg
                    key={hex.id}
                    width="30"
                    height="30"
                    viewBox="0 0 576 512"
                    xmlns="http://www.w3.org/2000/svg"
                    className="animate-bounce" // Simula el movimiento del loader original
                    style={{
                        transform: `rotate(${hex.rotation}deg)`,
                        animationDelay: hex.delay,
                        animationDuration: '2s',
                        filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.1))'
                    }}
                    aria-hidden="true"
                >
                    <path fill={hex.color} d={HEX_PATH} />
                </svg>
            ))}
        </div>
    );
};

export default HexagonIdentityBar;
