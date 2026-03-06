/* eslint-disable no-unused-vars */
import React from 'react';
import { motion } from 'framer-motion';

// Componente individual de Anillo de Progreso basado en Framer Motion
export const ProgressRing = ({
    radius,
    stroke,
    progress,
    color,
    icon,
    label,
    delay = 0
}) => {
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative flex items-center justify-center" style={{ width: radius * 2, height: radius * 2 }}>
                {/* Background Ring */}
                <svg
                    height={radius * 2}
                    width={radius * 2}
                    className="absolute inset-0 transform -rotate-90"
                >
                    <circle
                        stroke="#f1f5f9" // slate-100
                        fill="transparent"
                        strokeWidth={stroke}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />

                    {/* Animated Progress Ring */}
                    <motion.circle
                        stroke={color}
                        fill="transparent"
                        strokeWidth={stroke}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, delay, ease: "easeOut" }}
                        strokeLinecap="round"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                </svg>
                {/* Center Icon */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: delay + 0.5, type: 'spring' }}
                    className="absolute text-xl bg-white rounded-full p-1.5 shadow-sm border border-slate-50 z-10"
                >
                    {icon}
                </motion.div>
            </div>
            {/* Label and Percentage */}
            <div className="text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</div>
                <div className="text-sm font-black text-slate-700">{progress}%</div>
            </div>
        </div>
    );
};

// Contenedor Bento para los 3 anillos principales (Agua, Calorías, Sueño)
export const GamificationRings = ({ gamificationState }) => {
    if (!gamificationState || !gamificationState.rings) return null;

    return (
        <div className="flex justify-around items-center w-full py-4">
            <ProgressRing
                radius={45} stroke={6}
                progress={gamificationState.rings.calories?.progress_percentage || 0}
                color={gamificationState.rings.calories?.color_hex || '#34C759'}
                icon="🔥" label="Energía"
                delay={0}
            />
            <ProgressRing
                radius={45} stroke={6}
                progress={gamificationState.rings.water?.progress_percentage || 0}
                color={gamificationState.rings.water?.color_hex || '#00C7BE'}
                icon="💧" label="Hidratación"
                delay={0.2}
            />
            <ProgressRing
                radius={45} stroke={6}
                progress={gamificationState.rings.sleep?.progress_percentage || 0}
                color={gamificationState.rings.sleep?.color_hex || '#AF52DE'}
                icon="🌙" label="Descanso"
                delay={0.4}
            />
        </div>
    );
};

// Tarjeta de Racha Estilo Duolingo
export const StreakCard = ({ gamificationState }) => {
    if (!gamificationState) return null;

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4 bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-3xl border border-orange-100 shadow-sm"
        >
            <div className="bg-orange-500 text-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl shadow-lg shadow-orange-200 ring-4 ring-orange-100 font-prototype">
                🔥
            </div>
            <div>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-orange-600 font-prototype">{gamificationState.current_streak_days || 0}</span>
                    <span className="text-sm font-bold text-orange-400 uppercase tracking-widest">Días Seguidos</span>
                </div>
                <p className="text-xs text-orange-600/80 font-medium">{gamificationState.milestone_alert || "¡Mantén el ritmo vital!"}</p>
            </div>

            <div className="ml-auto text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Puntos XP</div>
                <div className="text-lg font-black text-emerald-500 font-prototype flex items-center justify-end gap-1">
                    +{gamificationState.xp_earned_today || 0} <span className="text-[10px] text-emerald-400">XP</span>
                </div>
            </div>
        </motion.div>
    );
};
