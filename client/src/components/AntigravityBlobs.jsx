import React, { useEffect, useRef } from 'react';

// ADN Visual: Colores correspondientes a los 5 hexágonos institucionales (v2.0.2)
const BLOB_DATA = [
    { color: 'rgba(183, 14, 12, 1)', phaseOffset: 0.0, x: 10, y: 20, size: 300 },   // Rojo #B70E0C
    { color: 'rgba(242, 159, 197, 1)', phaseOffset: 1.2, x: 70, y: 60, size: 400 }, // Rosa #F29FC5
    { color: 'rgba(28, 117, 188, 1)', phaseOffset: 2.4, x: 20, y: 80, size: 350 },  // Azul #1C75BC
    { color: 'rgba(58, 170, 53, 1)', phaseOffset: 3.6, x: 80, y: 20, size: 250 },   // Verde #3AAA35
    { color: 'rgba(255, 204, 0, 1)', phaseOffset: 4.8, x: 50, y: 50, size: 450 }    // Amarillo #FFCC00
];

/**
 * @param {Object} props
 * @param {string} props.systemState - Admite: 'basal', 'processing', 'alert'
 */
export const AntigravityBlobs = ({ systemState = 'basal' }) => {
    const blobRefs = useRef([]);
    const requestRef = useRef(null);
    const stateRef = useRef(systemState);

    useEffect(() => {
        stateRef.current = systemState;
    }, [systemState]);

    const simState = useRef({
        metabolism: 1.0,
        opacity: 0.04,
        phase: 0
    });

    const deltaTime = 0.016;
    const floatRange = 20;

    const getTargetParameters = (state) => {
        switch (state) {
            case 'processing':
                return { metabolism: 4.5, opacity: 0.12 };
            case 'alert':
                return { metabolism: 8.0, opacity: 0.22 };
            case 'basal':
            default:
                return { metabolism: 1.0, opacity: 0.04 };
        }
    };

    useEffect(() => {
        const mediaQuery = typeof window !== 'undefined' && window.matchMedia
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;

        const applyStaticBasal = () => {
            for (let i = 0; i < BLOB_DATA.length; i++) {
                if (blobRefs.current[i]) {
                    blobRefs.current[i].style.transform = 'translate3d(0, 0, 0) scale(1)';
                    blobRefs.current[i].style.opacity = '0.04';
                }
            }
        };

        const stopLoop = () => {
            if (requestRef.current !== null) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = null;
            }
        };

        const shouldPause = () => {
            const reduced = Boolean(mediaQuery && mediaQuery.matches);
            const hidden = typeof document !== 'undefined' && document.hidden;
            return reduced || hidden;
        };

        const animate = () => {
            if (shouldPause()) {
                stopLoop();
                applyStaticBasal();
                return;
            }

            const targets = getTargetParameters(stateRef.current);
            const state = simState.current;

            state.metabolism += (targets.metabolism - state.metabolism) * 0.05;
            state.opacity += (targets.opacity - state.opacity) * 0.05;
            state.phase += deltaTime * state.metabolism;

            for (let i = 0; i < BLOB_DATA.length; i++) {
                if (blobRefs.current[i]) {
                    const data = BLOB_DATA[i];
                    const rhythm = Math.sin(state.phase + data.phaseOffset);
                    const scale = 1 + (rhythm * 0.1);
                    const floatY = rhythm * floatRange;

                    blobRefs.current[i].style.transform = `translate3d(0, ${floatY}px, 0) scale(${scale})`;
                    blobRefs.current[i].style.opacity = state.opacity.toFixed(3);
                }
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        const handleLifecycleChange = () => {
            if (shouldPause()) {
                stopLoop();
                applyStaticBasal();
            } else if (requestRef.current === null) {
                requestRef.current = requestAnimationFrame(animate);
            }
        };

        handleLifecycleChange();

        document.addEventListener('visibilitychange', handleLifecycleChange);
        if (mediaQuery && mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleLifecycleChange);
        }

        return () => {
            stopLoop();
            document.removeEventListener('visibilitychange', handleLifecycleChange);
            if (mediaQuery && mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleLifecycleChange);
            }
        };
    }, []);

    return (
        <div style={styles.container} aria-hidden="true">
            {BLOB_DATA.map((blob, index) => (
                <div
                    key={index}
                    ref={(el) => (blobRefs.current[index] = el)}
                    style={{
                        position: 'absolute',
                        borderRadius: '50%',
                        filter: 'blur(120px)',
                        transformOrigin: 'center center',
                        willChange: 'transform, opacity',
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
        zIndex: -2,
        pointerEvents: 'none',
    }
};
