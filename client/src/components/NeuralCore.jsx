import React from 'react';
// eslint-disable-next-line
import { motion } from 'framer-motion';

const NeuralCore = ({ isListening, isAnalyzing }) => {
    const particles = Array.from({ length: 40 });

    return (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
            <motion.div
                animate={{
                    scale: isListening ? [1, 1.2, 1] : 1,
                    rotate: 360,
                }}
                transition={{
                    scale: { duration: 0.5, repeat: isListening ? Infinity : 0 },
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" }
                }}
                className="relative w-64 h-64 flex items-center justify-center"
            >
                {/* Core Glow */}
                <div className={`absolute w-32 h-32 rounded-full blur-3xl transition-colors duration-500 ${isAnalyzing ? 'bg-indigo-500/30' :
                    isListening ? 'bg-cyan-400/40' : 'bg-cyan-500/20'
                    }`} />

                {/* Orbiting Particles */}
                {particles.map((_, i) => {
                    const randomDuration = (i % 5) + 2; // Deterministic duration based on index to avoid hydration mismatch
                    return (
                        <motion.div
                            key={i}
                            className={`absolute w-1 h-1 rounded-full ${isAnalyzing ? 'bg-indigo-400' : 'bg-cyan-400'
                                }`}
                            animate={{
                                x: Math.cos(i * (360 / particles.length)) * (100 + (isListening ? 20 : 0)),
                                y: Math.sin(i * (360 / particles.length)) * (100 + (isListening ? 20 : 0)),
                                opacity: [0.2, 0.8, 0.2],
                                scale: isListening ? [1, 1.5, 1] : 1,
                            }}
                            transition={{
                                duration: randomDuration,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    );
                })}

                {/* Central Node */}
                <motion.div
                    animate={isListening ? {
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 1, 0.5]
                    } : {}}
                    transition={{ duration: 0.3, repeat: Infinity }}
                    className={`w-4 h-4 rounded-full shadow-[0_0_20px_#06b6d4] ${isAnalyzing ? 'bg-indigo-400' : 'bg-cyan-400'
                        }`}
                />
            </motion.div>
        </div>
    );
};

export default NeuralCore;

