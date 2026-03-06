import React, { useState } from 'react';
import { Info } from 'lucide-react';
import maleMapFn from '../assets/source_male_painmap.jpg';
import femaleMapFn from '../assets/source_female_painmap.jpg';

/* 
  =========================================
  INTERACTIVE BODY MAP (HYBRID OVERLAY - V4.0)
  =========================================
  Strategy: Hybrid Image Map Overlay (Real Image + CSS Hotspots)
  Assets: source_male_painmap.jpg / source_female_painmap.jpg (Composite Views)
*/

// --- COORDINATE SYSTEMS (Percent-based Top/Left) ---
// Based on User's "Female Demo" Logic (Front ~24% Left, Back ~74% Left)
const ZONES_DB = {
    // --- MASCULINO (M_) ---
    // Posterior Views (Moved per request/consistency)
    M_HEAD: { label: 'Cabeza / Migraña', top: '5%', left: '74%', gender: 'MALE' },
    M_NECK: { label: 'Cuello / Cervicales', top: '14%', left: '74%', gender: 'MALE' },
    M_LUNGS_R: { label: 'Pulmón Derecho', top: '22%', left: '70%', gender: 'MALE' },
    M_LUNGS_L: { label: 'Pulmón Izquierdo', top: '22%', left: '78%', gender: 'MALE' },
    M_SHOULDERS: { label: 'Hombros', top: '20%', left: '74%', gender: 'MALE' }, // Already Back
    M_LOWER_BACK: { label: 'Espalda Baja', top: '38%', left: '74%', gender: 'MALE' },
    M_KIDNEY_R: { label: 'Riñón Derecho', top: '34%', left: '70%', gender: 'MALE' },
    M_KIDNEY_L: { label: 'Riñón Izquierdo', top: '34%', left: '78%', gender: 'MALE' },

    // Front Views
    M_CHEST: { label: 'Pecho / Pectoral', top: '22%', left: '24%', gender: 'MALE' },
    M_STOMACH: { label: 'Boca del Estómago', top: '30%', left: '24%', gender: 'MALE' },
    M_ABDOMEN_LOW: { label: 'Abdomen Bajo', top: '38%', left: '24%', gender: 'MALE' },

    // Lateral/Limbs (Split L/R)
    M_ELBOW_R: { label: 'Codo Derecho', top: '30%', left: '9%', gender: 'MALE' },
    M_ELBOW_L: { label: 'Codo Izquierdo', top: '30%', left: '39%', gender: 'MALE' },
    M_WRIST_R: { label: 'Muñeca Derecha', top: '42%', left: '9%', gender: 'MALE' },
    M_WRIST_L: { label: 'Muñeca Izquierda', top: '42%', left: '40%', gender: 'MALE' },
    M_HAND_R: { label: 'Mano Derecha', top: '46%', left: '8%', gender: 'MALE' },
    M_HAND_L: { label: 'Mano Izquierda', top: '46%', left: '41%', gender: 'MALE' },
    M_KNEE_R: { label: 'Rodilla Derecha', top: '65%', left: '19%', gender: 'MALE' },
    M_KNEE_L: { label: 'Rodilla Izquierda', top: '65%', left: '29%', gender: 'MALE' },
    M_LEG_R: { label: 'Pierna Derecha', top: '55%', left: '19%', gender: 'MALE' },
    M_LEG_L: { label: 'Pierna Izquierda', top: '55%', left: '29%', gender: 'MALE' },
    M_ANKLE_R: { label: 'Tobillo Derecho', top: '85%', left: '20%', gender: 'MALE' },
    M_ANKLE_L: { label: 'Tobillo Izquierdo', top: '85%', left: '28%', gender: 'MALE' },
    M_FOOT_R: { label: 'Pie Derecho', top: '90%', left: '19%', gender: 'MALE' },
    M_FOOT_L: { label: 'Pie Izquierdo', top: '90%', left: '29%', gender: 'MALE' },

    // --- MALE POINTS (Mapped for rendering) ---
    M_HEAD_PTS: [{ top: '5%', left: '74%' }],
    M_NECK_PTS: [{ top: '14%', left: '74%' }],
    M_LUNGS_R_PTS: [{ top: '22%', left: '70%' }],
    M_LUNGS_L_PTS: [{ top: '22%', left: '78%' }],
    M_SHOULDERS_PTS: [{ top: '20%', left: '65%' }, { top: '20%', left: '83%' }], // Expanded
    M_LOWER_BACK_PTS: [{ top: '38%', left: '74%' }],
    M_KIDNEY_R_PTS: [{ top: '34%', left: '70%' }],
    M_KIDNEY_L_PTS: [{ top: '34%', left: '78%' }],
    M_CHEST_PTS: [{ top: '22%', left: '24%' }],
    M_STOMACH_PTS: [{ top: '30%', left: '24%' }],
    M_ABDOMEN_LOW_PTS: [{ top: '38%', left: '24%' }],
    M_ELBOW_R_PTS: [{ top: '30%', left: '9%' }],
    M_ELBOW_L_PTS: [{ top: '30%', left: '39%' }],
    M_WRIST_R_PTS: [{ top: '42%', left: '9%' }],
    M_WRIST_L_PTS: [{ top: '42%', left: '40%' }],
    M_HAND_R_PTS: [{ top: '46%', left: '8%' }],
    M_HAND_L_PTS: [{ top: '46%', left: '41%' }],
    M_KNEE_R_PTS: [{ top: '65%', left: '19%' }],
    M_KNEE_L_PTS: [{ top: '65%', left: '29%' }],
    M_LEG_R_PTS: [{ top: '55%', left: '19%' }],
    M_LEG_L_PTS: [{ top: '55%', left: '29%' }],
    M_ANKLE_R_PTS: [{ top: '85%', left: '20%' }],
    M_ANKLE_L_PTS: [{ top: '85%', left: '28%' }],
    M_FOOT_R_PTS: [{ top: '90%', left: '19%' }],
    M_FOOT_L_PTS: [{ top: '90%', left: '29%' }],

    // --- FEMENINO (F_) ---
    // Posterior Views (Moved)
    F_HEAD: { label: 'Cabeza / Migraña', top: '5%', left: '74%', gender: 'FEMALE' },
    F_NECK: { label: 'Cuello / Tensión', top: '14%', left: '74%', gender: 'FEMALE' },
    F_UPPER_BACK: { label: 'Espalda Alta (Estrés)', top: '25%', left: '74%', gender: 'FEMALE' },
    F_LOWER_BACK: { label: 'Cintura / Lumbares', top: '38%', left: '74%', gender: 'FEMALE' },
    F_LUNG_R: { label: 'Pulmón Derecho', top: '22%', left: '70%', gender: 'FEMALE' },
    F_LUNG_L: { label: 'Pulmón Izquierdo', top: '22%', left: '78%', gender: 'FEMALE' },
    F_KIDNEY_R: { label: 'Riñón Derecho', top: '34%', left: '70%', gender: 'FEMALE' },
    F_KIDNEY_L: { label: 'Riñón Izquierdo', top: '34%', left: '78%', gender: 'FEMALE' },
    F_HIPS: { label: 'Caderas', top: '44%', left: '74%', gender: 'FEMALE' }, // Back view hip center

    // Front Views
    F_BREAST_R: { label: 'Seno Derecho', top: '27%', left: '17%', gender: 'FEMALE' }, // Right breast is visually left
    F_BREAST_L: { label: 'Seno Izquierdo', top: '27%', left: '33%', gender: 'FEMALE' }, // Left breast is visually right
    F_STOMACH_UP: { label: 'Boca del Estómago', top: '29%', left: '24%', gender: 'FEMALE' },
    F_STOMACH_LOW: { label: 'Vientre Bajo', top: '39%', left: '24%', gender: 'FEMALE' },
    F_OVARY_R: { label: 'Ovario Derecho', top: '48%', left: '20%', gender: 'FEMALE' },
    F_OVARY_L: { label: 'Ovario Izquierdo', top: '48%', left: '30%', gender: 'FEMALE' },

    // Lateral/Limbs (Split L/R)
    F_HAND_R: { label: 'Mano Derecha', top: '46%', left: '8%', gender: 'FEMALE' },
    F_HAND_L: { label: 'Mano Izquierda', top: '46%', left: '41%', gender: 'FEMALE' },
    F_KNEE_R: { label: 'Rodilla Derecha', top: '65%', left: '19%', gender: 'FEMALE' },
    F_KNEE_L: { label: 'Rodilla Izquierda', top: '65%', left: '29%', gender: 'FEMALE' },
    F_LEG_R: { label: 'Pierna Derecha', top: '55%', left: '19%', gender: 'FEMALE' },
    F_LEG_L: { label: 'Pierna Izquierda', top: '55%', left: '29%', gender: 'FEMALE' },
    F_FOOT_R: { label: 'Pie Derecho', top: '90%', left: '19%', gender: 'FEMALE' },
    F_FOOT_L: { label: 'Pie Izquierdo', top: '90%', left: '29%', gender: 'FEMALE' },

    // --- FEMALE POINTS ---
    F_HEAD_PTS: [{ top: '5%', left: '74%' }],
    F_NECK_PTS: [{ top: '14%', left: '74%' }],
    F_UPPER_BACK_PTS: [{ top: '25%', left: '74%' }],
    F_LOWER_BACK_PTS: [{ top: '38%', left: '74%' }],
    F_LUNG_R_PTS: [{ top: '22%', left: '70%' }],
    F_LUNG_L_PTS: [{ top: '22%', left: '78%' }],
    F_KIDNEY_R_PTS: [{ top: '34%', left: '70%' }],
    F_KIDNEY_L_PTS: [{ top: '34%', left: '78%' }],
    F_HIPS_PTS: [{ top: '44%', left: '74%' }],
    F_BREAST_R_PTS: [{ top: '27%', left: '17%' }],
    F_BREAST_L_PTS: [{ top: '27%', left: '33%' }],
    F_STOMACH_UP_PTS: [{ top: '29%', left: '24%' }],
    F_STOMACH_LOW_PTS: [{ top: '39%', left: '24%' }],
    F_OVARY_R_PTS: [{ top: '48%', left: '20%' }],
    F_OVARY_L_PTS: [{ top: '48%', left: '30%' }],
    F_HAND_R_PTS: [{ top: '46%', left: '8%' }],
    F_HAND_L_PTS: [{ top: '46%', left: '41%' }],
    F_KNEE_R_PTS: [{ top: '65%', left: '19%' }],
    F_KNEE_L_PTS: [{ top: '65%', left: '29%' }],
    F_LEG_R_PTS: [{ top: '55%', left: '19%' }],
    F_LEG_L_PTS: [{ top: '55%', left: '29%' }],
    F_FOOT_R_PTS: [{ top: '90%', left: '19%' }],
    F_FOOT_L_PTS: [{ top: '90%', left: '29%' }]
};

// Map IDs to their metadata (Label, Risk)
const ZONE_META = {
    // Male
    M_HEAD: { label: 'Cabeza / Migraña' },
    M_NECK: { label: 'Cuello / Cervicales' },
    M_SHOULDERS: { label: 'Hombros' },
    M_CHEST: { label: 'Pecho / Pectoral' },
    M_LUNGS_R: { label: 'Pulmón Derecho' },
    M_LUNGS_L: { label: 'Pulmón Izquierdo' },
    M_STOMACH: { label: 'Boca del Estómago' },
    M_ABDOMEN_LOW: { label: 'Abdomen Bajo' },
    M_LOWER_BACK: { label: 'Espalda Baja' },
    M_KIDNEY_R: { label: 'Riñón Derecho' },
    M_KIDNEY_L: { label: 'Riñón Izquierdo' },
    M_ELBOW_R: { label: 'Codo Derecho' },
    M_ELBOW_L: { label: 'Codo Izquierdo' },
    M_WRIST_R: { label: 'Muñeca Derecha' },
    M_WRIST_L: { label: 'Muñeca Izquierda' },
    M_HAND_R: { label: 'Mano Derecha' },
    M_HAND_L: { label: 'Mano Izquierda' },
    M_KNEE_R: { label: 'Rodilla Derecha' },
    M_KNEE_L: { label: 'Rodilla Izquierda' },
    M_LEG_R: { label: 'Pierna Derecha' },
    M_LEG_L: { label: 'Pierna Izquierda' },
    M_ANKLE_R: { label: 'Tobillo Derecho' },
    M_ANKLE_L: { label: 'Tobillo Izquierdo' },
    M_FOOT_R: { label: 'Pie Derecho' },
    M_FOOT_L: { label: 'Pie Izquierdo' },

    // Female
    F_HEAD: { label: 'Cabeza / Migraña' },
    F_NECK: { label: 'Cuello / Tensión' },
    F_UPPER_BACK: { label: 'Espalda Alta' },
    F_LUNG_R: { label: 'Pulmón Derecho' },
    F_LUNG_L: { label: 'Pulmón Izquierdo' },
    F_BREAST_R: { label: 'Seno Derecho' },
    F_BREAST_L: { label: 'Seno Izquierdo' },
    F_STOMACH_UP: { label: 'Boca del Estómago' },
    F_STOMACH_LOW: { label: 'Vientre Bajo' },
    F_OVARY_R: { label: 'Ovario Derecho' },
    F_OVARY_L: { label: 'Ovario Izquierdo' },
    F_HIPS: { label: 'Caderas' },
    F_LOWER_BACK: { label: 'Cintura / Lumbares' },
    F_KIDNEY_R: { label: 'Riñón Derecho' },
    F_KIDNEY_L: { label: 'Riñón Izquierdo' },
    F_HAND_R: { label: 'Mano Derecha' },
    F_HAND_L: { label: 'Mano Izquierda' },
    F_KNEE_R: { label: 'Rodilla Derecha' },
    F_KNEE_L: { label: 'Rodilla Izquierda' },
    F_LEG_R: { label: 'Pierna Derecha' },
    F_LEG_L: { label: 'Pierna Izquierda' },
    F_FOOT_R: { label: 'Pie Derecho' },
    F_FOOT_L: { label: 'Pie Izquierdo' }
};

const BodyHotspot = ({ id, top, left, label, isSelected, onClick }) => {
    return (
        <div
            className={`hotspot ${isSelected ? 'active' : ''}`}
            style={{ top, left }}
            onClick={() => onClick(id)}
        >
            <span className="tooltip">{label}</span>
        </div>
    );
};

const VisualBodyMap = ({ gender = 'MALE', onComplete }) => {
    const [selectedZones, setSelectedZones] = useState([]);
    const [intensity, setIntensity] = useState(0); // 0-10 Scale

    const currentGender = gender === 'Femenino' ? 'FEMALE' : (gender === 'FEMALE' ? 'FEMALE' : 'MALE');
    const bgImage = currentGender === 'FEMALE' ? femaleMapFn : maleMapFn;

    const toggleZone = (zoneId) => {
        setSelectedZones(prev =>
            prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId]
        );
    };

    // Helper: Determine Slider Color based on Intensity
    const getSliderColor = (val) => {
        if (val <= 3) return 'bg-blue-500';
        if (val <= 6) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-6 items-start">

            {/* INJECTED STYLES (Scoped) */}
            <style>{`
                .pain-map-wrapper {
                    position: relative;
                    width: 100%;
                    max-width: 400px; /* REDUCED SIZE (10%) */
                    margin: 0 auto;
                    border-radius: 12px;
                    overflow: visible; /* FIX: Allow tooltips to overflow */
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    background-color: #fff;
                }
                .anatomy-base {
                    width: 100%;
                    display: block;
                    height: auto;
                    border-radius: 12px; /* Apply radius to image since wrapper overflows */
                }
                .hotspot {
                    position: absolute;
                    width: 24px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.4);
                    border: 2px solid #3498db;
                    border-radius: 50%;
                    cursor: pointer;
                    transform: translate(-50%, -50%);
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    z-index: 10;
                }
                .hotspot::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    border-radius: 50%;
                    border: 2px solid #3498db;
                    opacity: 0;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
                .hotspot:hover, .hotspot.active {
                    background: #3498db;
                    box-shadow: 0 0 15px rgba(52, 152, 219, 0.6);
                    transform: translate(-50%, -50%) scale(1.2);
                    z-index: 20; /* Elevate on hover */
                }
                .hotspot .tooltip {
                    visibility: hidden;
                    background-color: #2c3e50;
                    color: #fff;
                    text-align: center;
                    padding: 6px 12px;
                    border-radius: 6px;
                    position: absolute;
                    bottom: 140%;
                    left: 50%;
                    transform: translateX(-50%);
                    white-space: nowrap;
                    font-size: 12px;
                    font-weight: 600;
                    font-family: 'Segoe UI', sans-serif;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    opacity: 0;
                    transition: opacity 0.3s, transform 0.3s;
                    pointer-events: none;
                    z-index: 30;
                }
                .hotspot .tooltip::after {
                    content: "";
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    margin-left: -5px;
                    border-width: 5px;
                    border-style: solid;
                    border-color: #2c3e50 transparent transparent transparent;
                }
                .hotspot:hover .tooltip {
                    visibility: visible;
                    opacity: 1;
                    transform: translateX(-50%) translateY(-5px);
                }
                /* Rotated Text for Slider */
                .rotated-text {
                    writing-mode: vertical-rl;
                    transform: rotate(180deg);
                }
            `}</style>

            {/* MAIN MAP CONTAINER */}
            <div className="flex-1 w-full pl-8 md:pl-0"> {/* Add Left Padding for Tooltip space on mobile */}
                <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2">
                        Mapa Corporal
                    </h3>
                    <p className="text-xs text-slate-500">Toque los puntos para marcar dolor.</p>
                </div>

                <div className="pain-map-wrapper">
                    <img src={bgImage} className="anatomy-base" alt="Mapa Corporal" />

                    {/* OVERLAY LABELS (SPANISH) - Covering English Text */}
                    <div className="absolute top-[2%] left-[25%] transform -translate-x-1/2 bg-white px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wider z-0">
                        Vista Anterior
                    </div>
                    <div className="absolute top-[2%] left-[75%] transform -translate-x-1/2 bg-white px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wider z-0">
                        Vista Posterior
                    </div>

                    {/* Render Hotspots */}
                    {Object.keys(ZONE_META).map(zoneKey => {
                        // Check if this zone belongs to current Gender Schema
                        if (zoneKey.startsWith(currentGender === 'MALE' ? 'M_' : 'F_')) {
                            // Get Points Set
                            const pointsKey = `${zoneKey}_PTS`;
                            const points = ZONES_DB[pointsKey];
                            const meta = ZONE_META[zoneKey];

                            if (points) {
                                return points.map((pt, idx) => (
                                    <BodyHotspot
                                        key={`${zoneKey}-${idx}`}
                                        id={zoneKey}
                                        top={pt.top}
                                        left={pt.left}
                                        label={meta.label}
                                        isSelected={selectedZones.includes(zoneKey)}
                                        onClick={toggleZone}
                                    />
                                ));
                            }
                        }
                        return null;
                    })}
                </div>
            </div>

            {/* SIDEBAR: INTENSITY SLIDER + ACTIONS */}
            <div className="w-full md:w-32 flex flex-col items-center gap-6">
                {/* INTENSITY SLIDER */}
                <div className="w-full md:w-24 flex flex-col items-center justify-between py-6 bg-slate-50 rounded-2xl border border-slate-100 h-[400px]">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 rotated-text md:writing-mode-vertical-rl">Intensidad</span>

                    <div className="relative flex-1 w-6 bg-gradient-to-t from-blue-100 via-yellow-100 to-red-100 rounded-full border border-slate-200 mx-auto">
                        {/* Fill Level */}
                        <div
                            className={`absolute bottom-0 w-full rounded-b-full transition-all duration-300 ${getSliderColor(intensity)} opacity-20`}
                            style={{ height: `${intensity * 10}%`, borderRadius: intensity === 10 ? '999px' : '0 0 999px 999px' }}
                        ></div>

                        <input
                            type="range"
                            min="0"
                            max="10"
                            step="1"
                            value={intensity}
                            onChange={(e) => setIntensity(parseInt(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
                        />

                        {/* Thumb */}
                        <div
                            className="absolute left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white border-2 border-slate-300 rounded-full shadow-md pointer-events-none transition-all duration-150"
                            style={{ bottom: `calc(${intensity * 10}% - 12px)` }}
                        >
                            <div className={`w-2 h-2 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${getSliderColor(intensity)}`}></div>
                        </div>
                    </div>

                    <div className={`text-2xl font-bold mt-4 ${intensity >= 8 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
                        {intensity}
                    </div>
                </div>

                {/* ACTION BUTTON */}
                <div className="w-full">
                    <div className="text-center text-[10px] text-slate-400 mb-2">
                        {selectedZones.length} zonas seleccionadas
                    </div>
                    <button
                        onClick={() => onComplete({ zones: selectedZones, intensity })}
                        className={`w-full py-3 rounded-xl text-sm font-bold shadow-md transition-all transform active:scale-95
                            ${selectedZones.length > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        disabled={selectedZones.length === 0}
                    >
                        Continuar
                    </button>
                </div>
            </div>

        </div>
    );
};

export default VisualBodyMap;
