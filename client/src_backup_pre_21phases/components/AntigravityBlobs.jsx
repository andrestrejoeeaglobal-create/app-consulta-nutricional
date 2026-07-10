import React, { useEffect, useRef } from 'react';

// ADN Visual: Los colores corresponden exactamente a los hexágonos institucionales
const BLOB_DATA = [
    { color: 'rgba(183, 14, 12, 1)', phaseOffset: 0.0, x: 10, y: 20, size: 300 },   // Rojo
    { color: 'rgba(242, 159, 197, 1)', phaseOffset: 1.2, x: 70, y: 60, size: 400 }, // Rosa
    { color: 'rgba(28, 117, 188, 1)', phaseOffset: 2.4, x: 20, y: 80, size: 350 },  // Azul
    { color: 'rgba(58, 170, 53, 1)', phaseOffset: 3.6, x: 80, y: 20, size: 250 },   // Verde
    { color: 'rgba(255, 204, 0, 1)', phaseOffset: 4.8, x: 50, y: 50, size: 450 }    // Amarillo
];

/**
 * @param {Object} props
 * @param {string} props.systemState - Admite: 'basal', 'processing', 'alert'
 */
export const AntigravityBlobs = ({ systemState = 'basal' }) => {
    const blobRefs = useRef([]);
    const requestRef = useRef();

    // Referencia para leer el estado sin re-disparar el loop
    const stateRef = useRef(systemState);
    useEffect(() => {
        stateRef.current = systemState;
    }, [systemState]);

    // React-safe state variables (persists across renders)
    const simState = useRef({
        metabolism: 1.0,
        opacity: 0.04,
        phase: 0
    });

    const deltaTime = 0.016; // 60 FPS estables
    const floatRange = 20;

    // Diccionario Clínico de Ritmos (Metabolismo y Opacidad)
    const getTargetParameters = (state) => {
        switch (state) {
            case 'processing':
                return { metabolism: 4.5, opacity: 0.12 }; // Acelera y se hace más visible
            case 'alert':
                return { metabolism: 8.0, opacity: 0.25 }; // Rápido y muy visible
            case 'basal':
            default:
                return { metabolism: 1.0, opacity: 0.04 }; // Lento y casi imperceptible (Fase 0)
        }
    };

    useEffect(() => {
        const animate = () => {
            const targets = getTargetParameters(stateRef.current);
            const state = simState.current;

            // Interpolación Lineal (Lerp) para transiciones fisiológicas suaves
            state.metabolism += (targets.metabolism - state.metabolism) * 0.05;
            state.opacity += (targets.opacity - state.opacity) * 0.05;

            // Acumulamos el tiempo. Esta es la base de Antigravity para ondas perfectas.
            state.phase += deltaTime * state.metabolism;

            for (let i = 0; i < BLOB_DATA.length; i++) {
                if (blobRefs.current[i]) {
                    const data = BLOB_DATA[i];

                    // Ritmo respiratorio matemático
                    const rhythm = Math.sin(state.phase + data.phaseOffset);

                    const scale = 1 + (rhythm * 0.1);
                    const floatY = rhythm * floatRange;

                    // Mapeo directo a GPU (Hardware Acceleration)
                    blobRefs.current[i].style.transform = `translate3d(0, ${floatY}px, 0) scale(${scale})`;
                    blobRefs.current[i].style.opacity = state.opacity.toFixed(3);
                }
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    return (
        <div style={styles.container}>
            {BLOB_DATA.map((blob, index) => (
                <div
                    key={index}
                    ref={(el) => (blobRefs.current[index] = el)}
                    style={{
                        position: 'absolute',
                        borderRadius: '50%',
                        filter: 'blur(120px)', // Desenfocado masivo
                        transformOrigin: 'center center',
                        willChange: 'transform, opacity', // Aviso a la GPU
                        backgroundColor: blob.color,
                        width: `${blob.size}px`,
                        height: `${blob.size}px`,
                        left: `${blob.x}%`,
                        top: `${blob.y}%`,
                    }}
                />
            ))}
        </div>
    );
};

const styles = {
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: -2, // Estrictamente la capa más profunda
        pointerEvents: 'none',
    }
};
