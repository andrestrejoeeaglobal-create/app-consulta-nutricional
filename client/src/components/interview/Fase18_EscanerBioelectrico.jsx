import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, 
    Info, 
    AlertTriangle, 
    Activity, 
    Zap, 
    Database,
    Camera,
    Upload,
    Eye,
    Sliders,
    X,
    ChevronRight,
    Sparkles,
    ShieldAlert,
    FileText,
    Trash2,
    Plus,
    Loader2,
    Clock,
    Flame,
    Heart,
    HeartPulse
} from 'lucide-react';
import tiloImg from '../../assets/tilo.png';

const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return "00:00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [
        h.toString().padStart(2, '0'),
        m.toString().padStart(2, '0'),
        s.toString().padStart(2, '0')
    ].join(':');
};

export default function Fase18_EscanerBioelectrico({
    messages,
    setMessages,
    registerInputHandler,
    patientData,
    setPatientData,
    setIsGlobalTyping,
    hardwareStatus,
    setHardwareStatus,
    onPhaseComplete
}) {
    const prefersReducedMotion = useReducedMotion();
    
    // Animaciones adaptadas a movimiento reducido
    const fadeVariants = {
        hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, y: prefersReducedMotion ? 0 : -10, transition: { duration: 0.2 } }
    };

    const pulseVariants = {
        animate: prefersReducedMotion ? { scale: 1, opacity: 0.7 } : {
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5],
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    const flattenToCoreVitals = (nestedData) => {
        if (!nestedData) return null;
        
        // Si ya es plano, devolver directamente
        if (nestedData.blood_viscosity && !nestedData.cardiovascular) {
            return nestedData;
        }
        
        const card = nestedData.cardiovascular || {};
        const gastro = nestedData.gastrointestinal || {};
        
        const vis = card.viscosidad_de_la_sangre || {};
        const peps = gastro.coeficiente_de_secrecion_de_pepsina || {};
        const col = card.cristal_de_colesterol || {};
        const peri = gastro.coeficiente_de_funcion_de_peristalsis_gastrica || {};
        
        return {
            blood_viscosity: {
                name: "Viscosidad Sanguínea",
                value: vis.status === 'NORMAL' ? "Normal" : "Alterado",
                raw_value: vis.value ? `${vis.value} cp` : "---",
                status: vis.status || "NORMAL",
                translation: vis.translation || (vis.status === 'NORMAL' ? "Homeostasis sanguínea óptima." : "Tendencia a hemoconcentración. Se sugiere optimizar la hidratación celular.")
            },
            pepsin_coefficient: {
                name: "Coeficiente de Pepsina",
                value: peps.status === 'NORMAL' ? "Normal" : "Bajo",
                raw_value: peps.value || "---",
                status: peps.status || "NORMAL",
                translation: peps.translation || (peps.status === 'NORMAL' ? "Capacidad de hidrólisis de pepsina gástrica conservada." : "Optimización enzimática y del pH gástrico requerida.")
            },
            cholesterol_crystals: {
                name: "Cristales de Colesterol",
                value: col.status === 'NORMAL' ? "Normal" : "Alterado",
                raw_value: col.value || "---",
                status: col.status || "NORMAL",
                translation: col.translation || (col.status === 'NORMAL' ? "Homeostasis de lípidos de membrana conservada." : "Presencia de cristales insolubles. Se sugiere regular grasas saturadas.")
            },
            gastric_peristalsis: {
                name: "Peristaltismo Gástrico",
                value: peri.status === 'NORMAL' ? "Normal" : "Alterado",
                raw_value: peri.value || "---",
                status: peri.status || "NORMAL",
                translation: peri.translation || (peri.status === 'NORMAL' ? "Motilidad gastrointestinal en rango fisiológico." : "Peristaltismo alterado. Se sugiere soporte digestivo mecánico o enzimático.")
            },
            phase_angle: {
                name: "Ángulo de Fase",
                value: "Fisiológico",
                raw_value: "6.2°",
                status: "NORMAL",
                translation: "Integridad de membrana y vitalidad celular óptima."
            },
            gsr_anomaly: {
                name: "Resistencia Bioeléctrica (GSR)",
                value: "Normal",
                raw_value: "520 kΩ",
                status: "NORMAL",
                translation: "Resistencia eléctrica de la piel y conductancia galvánica en rango basal."
            }
        };
    };

    // Helper para semáforo de resultados (doble codificación WCAG 2.2)
    const getMarkerBadgeInfo = (status) => {
        const s = status ? status.toUpperCase() : 'NORMAL';
        if (s === 'ANORMAL LEVE' || s === 'WARNING') {
            return {
                bg: 'bg-amber-50 text-amber-700 border-amber-200',
                icon: <AlertTriangle className="w-3 h-3 text-amber-600" />,
                label: 'Anormal Leve'
            };
        } else if (s === 'ANORMAL MODERADO') {
            return {
                bg: 'bg-orange-50 text-orange-700 border-orange-200',
                icon: <AlertTriangle className="w-3 h-3 text-orange-600" />,
                label: 'Anormal Moderado'
            };
        } else if (s === 'ANORMAL SEVERO' || s === 'CRITICAL' || s === 'SEVERE') {
            return {
                bg: 'bg-red-50 text-red-700 border-red-200',
                icon: <AlertTriangle className="w-3 h-3 text-red-600" />,
                label: 'Anormal Severo'
            };
        }
        return {
            bg: 'bg-green-50 text-green-700 border-green-200',
            icon: <CheckCircle2 className="w-3 h-3 text-green-600" />,
            label: 'Normal'
        };
    };

    // Tab activo: 'electret' | 'ocular' | 'lingual'
    const [activeTab, setActiveTab] = useState('electret');

    // Estado del modal de justificación fisiológica (Nivel 2)
    const [activeDetailMarker, setActiveDetailMarker] = useState(null);

    // ==========================================
    // 🔌 ESTADO 1: ESCÁNER ELECTRET (POLLING)
    // ==========================================
    const [electretState, setElectretState] = useState('searching');
    const [electretProgress, setElectretProgress] = useState(0);
    const [electretScanId, setElectretScanId] = useState(null);
    const [electretResults, setElectretResults] = useState(null);
    const [electretFullData, setElectretFullData] = useState(null);
    const [electretError, setElectretError] = useState('');
    const [isHardwareDetected, setIsHardwareDetected] = useState(false);
    const pollerRef = useRef(null);

    // ==========================================
    // 👁️ ESTADO 2: ESCÁNER OCULÓMICO (DEEP LEARNING)
    // ==========================================
    const [ocularState, setOcularState] = useState('idle'); // idle -> uploading -> processing -> complete -> error
    const [ocularImage, setOcularImage] = useState(null);
    const [ocularImagePreview, setOcularImagePreview] = useState(null);
    const [ocularResults, setOcularResults] = useState(null);
    const [ocularStylexVectors, setOcularStylexVectors] = useState(null);
    const [confounderAlerts, setConfounderAlerts] = useState([]);
    const [ocularError, setOcularError] = useState('');
    const ocularInputRef = useRef(null);

    // ==========================================
    // 👅 ESTADO 3: ESCÁNER LINGUAL (CTDS - DEEP LEARNING)
    // ==========================================
    const [lingualState, setLingualState] = useState('idle'); // idle -> uploading -> processing -> complete -> error
    const [lingualImage, setLingualImage] = useState(null);
    const [lingualImagePreview, setLingualImagePreview] = useState(null);
    const [lingualResults, setLingualResults] = useState(null);
    const [lingualStylexVectors, setLingualStylexVectors] = useState(null);
    const [lingualError, setLingualError] = useState('');
    const lingualInputRef = useRef(null);

    // ==========================================
    // 📂 ESTADO 4: ESTUDIOS EXTERNOS (OCR & VISION)
    // ==========================================
    const [externalState, setExternalState] = useState('idle'); // idle -> uploading -> processing -> complete -> error
    const [externalFiles, setExternalFiles] = useState([]);
    const [externalResults, setExternalResults] = useState(null);
    const [externalError, setExternalError] = useState('');
    const [newAllergen, setNewAllergen] = useState('');
    const externalInputRef = useRef(null);

    // ==========================================
    // 📸 ESTADO 5: EVIDENCIA VISUAL (VISIÓN ARTIFICIAL)
    // ==========================================
    const [visualState, setVisualState] = useState('idle'); // idle -> uploading -> processing -> complete -> error
    const [visualImages, setVisualImages] = useState([]);
    const [visualImagePreviews, setVisualImagePreviews] = useState([]);
    const [visualResults, setVisualResults] = useState(null);
    const [visualError, setVisualError] = useState('');
    const [visualSeverity, setVisualSeverity] = useState('LOW');
    const [visualFlags, setVisualFlags] = useState([]);
    const visualInputRef = useRef(null);

    // ==========================================
    // 💎 ESTADO 4: EXPLICABILIDAD STYLEX (MODAL)
    // ==========================================
    const [showStyleXModal, setShowStyleXModal] = useState(false);
    const [styleXMode, setStyleXMode] = useState('ocular'); // 'ocular' | 'lingual'
    const [styleXAttribute, setStyleXAttribute] = useState('conjunctival_pallor'); // 'conjunctival_pallor' | 'eyelid_margin_pallor' | 'espesor_saburra' | 'tono_cianotico'
    const [styleXIntensity, setStyleXIntensity] = useState(50); // Slider: 0 to 100

    // ==========================================
    // 📸 ESTADO 6: CONTROL DE CÁMARA WEB (WEBCAM)
    // ==========================================
    const [activeWebcamTab, setActiveWebcamTab] = useState(null); // 'ocular' | 'lingual' | 'visual' | null
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const hasStartedRef = useRef(false);

    // Variables demográficas y lingüísticas del paciente
    const pName = patientData?.identificacion?.nombre || patientData?.identificacion?.nombres || patientData?.identityLock?.patientInfo?.firstName || 'el paciente';
    const patientAge = patientData?.identificacion?.edad || patientData?.profile?.age || 30;
    const patientSex = patientData?.identificacion?.sexo || patientData?.profile?.gender || 'M';
    const patientRoute = patientData?.history?.primaryRoute || patientData?.route || 'standard';

    // Determinar la priorización clínica según ruta
    const getRouteInfo = () => {
        const routeLower = patientRoute.toLowerCase();
        if (patientAge >= 60 || routeLower === 'elderly' || routeLower === 'longevity' || routeLower === 'geriatric') {
            return {
                title: "Ruta de Longevidad / Adulto Mayor",
                desc: "Priorizando Masa Músculo-Esquelética y Ángulo de Fase para despistaje preventivo de sarcopenia metabólica.",
                badge: "Longevidad"
            };
        } else if (routeLower === 'disability') {
            return {
                title: "Ruta de Inclusión / Discapacidad",
                desc: "Focalizando análisis en Masa Magra Segmental para neutralizar sesgos diagnósticos por atrofias o asimetrías.",
                badge: "Discapacidad"
            };
        } else if (routeLower === 'oncological' || routeLower === 'oncology') {
            return {
                title: "Ruta Clínico-Oncológica",
                desc: "Monitoreo prioritario de Inflamación Celular (ECW/TBW) y Estrés Oxidativo. Calibración de hidratación clínica.",
                badge: "Oncológica"
            };
        }
        return {
            title: "Ruta Metabólica Estándar",
            desc: "Ponderación general de bioimpedancia celular, viscosidad hemática y digestión enzimática gástrica.",
            badge: "Metabólica"
        };
    };

    const routeInfo = getRouteInfo();

    // Sincronizar el estado del hardware con el Navbar (Header) de la app
    useEffect(() => {
        if (setHardwareStatus) {
            let activeStatus = 'searching';
            if (activeTab === 'electret') activeStatus = electretState;
            else if (activeTab === 'ocular') activeStatus = ocularState;
            else if (activeTab === 'lingual') activeStatus = lingualState;
            setHardwareStatus(activeStatus);
        }
    }, [activeTab, electretState, ocularState, lingualState, setHardwareStatus]);

    // Cleanup del interval al desmontar
    useEffect(() => {
        return () => {
            if (pollerRef.current) clearInterval(pollerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Apagar webcam al cambiar de pestaña
    useEffect(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setActiveWebcamTab(null);
    }, [activeTab]);

    // ==========================================
    // 🎨 RENDERIZADO DE MATERIALIDAD EN CANVAS (StylEx)
    // ==========================================
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        
        const srcImage = styleXMode === 'ocular'
            ? (ocularImagePreview || "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=600")
            : (lingualImagePreview || "https://images.unsplash.com/photo-1583082260069-8884a222f77e?q=80&w=600");

        img.src = srcImage;

        img.onload = () => {
            canvas.width = img.naturalWidth || 600;
            canvas.height = img.naturalHeight || 600;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (styleXMode === 'lingual') {
                if (styleXAttribute === 'espesor_saburra') {
                    const intensityVal = styleXIntensity;
                    if (intensityVal > 50) {
                        const opacity = ((intensityVal - 50) / 50) * 0.7;
                        ctx.save();
                        
                        const grad = ctx.createRadialGradient(
                            canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.1,
                            canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.4
                        );
                        grad.addColorStop(0, `rgba(244, 240, 219, ${opacity})`);
                        grad.addColorStop(0.7, `rgba(247, 245, 235, ${opacity * 0.4})`);
                        grad.addColorStop(1, 'rgba(247, 245, 235, 0)');

                        ctx.globalCompositeOperation = 'screen';
                        ctx.fillStyle = grad;
                        
                        if ('filter' in ctx) {
                            ctx.filter = 'blur(6px)';
                        }
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    } else {
                        const opacity = ((50 - intensityVal) / 50) * 0.35;
                        ctx.save();
                        
                        const grad = ctx.createRadialGradient(
                            canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.15,
                            canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.45
                        );
                        grad.addColorStop(0, `rgba(255, 77, 109, ${opacity})`);
                        grad.addColorStop(1, 'rgba(255, 77, 109, 0)');

                        ctx.globalCompositeOperation = 'color';
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    }
                } else if (styleXAttribute === 'tono_cianotico') {
                    const intensityVal = styleXIntensity;
                    if (intensityVal > 50) {
                        const opacity = ((intensityVal - 50) / 50) * 0.6;
                        ctx.save();
                        ctx.globalCompositeOperation = 'multiply';
                        ctx.fillStyle = `rgba(38, 42, 86, ${opacity})`;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    } else {
                        const opacity = ((50 - intensityVal) / 50) * 0.3;
                        ctx.save();
                        ctx.globalCompositeOperation = 'color';
                        ctx.fillStyle = `rgba(255, 63, 52, ${opacity})`;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    }
                }
            } else if (styleXMode === 'ocular') {
                if (styleXAttribute === 'conjunctival_pallor') {
                    const intensityVal = styleXIntensity;
                    if (intensityVal > 50) {
                        const opacity = ((intensityVal - 50) / 50) * 0.65;
                        ctx.save();
                        
                        const grad = ctx.createRadialGradient(
                            canvas.width * 0.5, canvas.height * 0.72, canvas.width * 0.05,
                            canvas.width * 0.5, canvas.height * 0.72, canvas.width * 0.28
                        );
                        grad.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
                        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                        
                        ctx.globalCompositeOperation = 'screen';
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    } else {
                        const opacity = ((50 - intensityVal) / 50) * 0.45;
                        ctx.save();
                        
                        const grad = ctx.createRadialGradient(
                            canvas.width * 0.5, canvas.height * 0.72, canvas.width * 0.05,
                            canvas.width * 0.5, canvas.height * 0.72, canvas.width * 0.28
                        );
                        grad.addColorStop(0, `rgba(235, 59, 90, ${opacity})`);
                        grad.addColorStop(1, 'rgba(235, 59, 90, 0)');
                        
                        ctx.globalCompositeOperation = 'overlay';
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    }
                } else if (styleXAttribute === 'eyelid_margin_pallor') {
                    const intensityVal = styleXIntensity;
                    if (intensityVal > 50) {
                        const opacity = ((intensityVal - 50) / 50) * 0.5;
                        ctx.save();
                        
                        const grad = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height * 0.65);
                        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
                        grad.addColorStop(0.5, `rgba(255, 255, 255, ${opacity})`);
                        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                        
                        ctx.globalCompositeOperation = 'screen';
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    } else {
                        const opacity = ((50 - intensityVal) / 50) * 0.35;
                        ctx.save();
                        
                        const grad = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height * 0.65);
                        grad.addColorStop(0, 'rgba(235, 59, 90, 0)');
                        grad.addColorStop(0.5, `rgba(235, 59, 90, ${opacity})`);
                        grad.addColorStop(1, 'rgba(235, 59, 90, 0)');
                        
                        ctx.globalCompositeOperation = 'overlay';
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    }
                }
            }
        };

        img.onerror = () => {
            canvas.width = 600;
            canvas.height = 600;
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ffffff";
            ctx.font = "20px font-sans, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Error al cargar imagen en Canvas", canvas.width / 2, canvas.height / 2);
        };

    }, [styleXMode, styleXAttribute, styleXIntensity, ocularImagePreview, lingualImagePreview]);

    // ==========================================
    // 📸 CONTROLADORES DE CÁMARA WEB (WEBCAM)
    // ==========================================
    const startWebcam = async (tab) => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const constraints = {
                video: {
                    facingMode: tab === 'lingual' ? 'user' : (isMobile ? { exact: 'environment' } : 'environment'),
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            setActiveWebcamTab(tab);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error("🔥 Error al acceder a la cámara:", err);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                setActiveWebcamTab(tab);
                setTimeout(() => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                }, 100);
            } catch (fallbackErr) {
                console.error("🔥 Error en fallback de cámara:", fallbackErr);
                alert("No se pudo acceder a la cámara web. Asegúrese de conceder los permisos e intentarlo de nuevo.");
            }
        }
    };

    const stopWebcam = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setActiveWebcamTab(null);
    };

    const capturePhoto = (tab) => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `${tab}_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                const previewUrl = URL.createObjectURL(blob);

                if (tab === 'ocular') {
                    if (ocularImagePreview && ocularImagePreview.startsWith('blob:')) {
                        URL.revokeObjectURL(ocularImagePreview);
                    }
                    setOcularImage(file);
                    setOcularImagePreview(previewUrl);
                    setOcularState('idle');
                } else if (tab === 'lingual') {
                    if (lingualImagePreview && lingualImagePreview.startsWith('blob:')) {
                        URL.revokeObjectURL(lingualImagePreview);
                    }
                    setLingualImage(file);
                    setLingualImagePreview(previewUrl);
                    setLingualState('idle');
                } else if (tab === 'visual') {
                    setVisualImages(prev => [...prev, file]);
                    setVisualImagePreviews(prev => [...prev, previewUrl]);
                    setVisualState('idle');
                }
            }
            stopWebcam();
        }, 'image/jpeg', 0.95);
    };

    // Restaurar estados guardados en caliente al montar
    useEffect(() => {
        if (patientData?.scan_data) {
            const sd = patientData.scan_data;
            if (sd.electret_metrics) {
                const metrics = sd.electret_metrics;
                if (metrics.cardiovascular) {
                    setElectretFullData(metrics);
                    setElectretResults(flattenToCoreVitals(metrics));
                } else {
                    setElectretResults(metrics);
                }
                setElectretState('complete');
            }
            if (sd.ocular_metrics) {
                setOcularResults(sd.ocular_metrics);
                setOcularState('complete');
            }
            if (sd.lingual_metrics) {
                setLingualResults(sd.lingual_metrics);
                setLingualState('complete');
            }
            if (sd.external_metrics) {
                setExternalResults(sd.external_metrics);
                setExternalState('complete');
            }
            if (sd.visual_metrics) {
                setVisualResults(sd.visual_metrics.findings);
                setVisualSeverity(sd.visual_metrics.severity || 'LOW');
                setVisualState('complete');
            }
        }
    }, [patientData]);

    // ==========================================================================
    // 🔌 CONTROLADORES - ESCÁNER ELECTRET
    // ==========================================================================
    useEffect(() => {
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;

        const initElectretSession = async () => {
            setElectretState('searching');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const weightVal = patientData?.vitals?.weight || 70;
            const heightVal = patientData?.vitals?.height || 170;
            const citationId = patientData?.idCita || patientData?.citaId || 1;

            try {
                const response = await fetch(`${apiUrl}/api/bio/scan/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: pName,
                        age: patientAge,
                        height: heightVal,
                        weight: weightVal,
                        clinicalRoute: patientRoute,
                        citationId: citationId
                    })
                });

                const data = await response.json();
                if (data.success) {
                    setElectretScanId(data.scanId);
                    setIsHardwareDetected(data.isHardwareDetected);
                    setTimeout(() => {
                        setElectretState('connected');
                    }, 1500);
                } else {
                    setElectretState('error');
                    setElectretError(data.message || "Error al enlazar interfaz del hardware.");
                }
            } catch (err) {
                console.error("🔥 Error al iniciar escaneo Electret:", err);
                setElectretState('error');
                setElectretError("No se pudo establecer conexión con el servidor Express.");
            }
        };

        initElectretSession();
    }, [pName, patientAge, patientData, patientRoute]);

    const handleStartElectretScan = () => {
        if (!electretScanId) return;

        setElectretState('scanning');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        pollerRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${apiUrl}/api/bio/scan/status?scanId=${electretScanId}`);
                const statusData = await res.json();

                if (statusData.success) {
                    setElectretProgress(statusData.progress);
                    
                    if (statusData.status !== electretState) {
                        setElectretState(statusData.status);
                    }

                    if (statusData.status === 'complete') {
                        clearInterval(pollerRef.current);
                        setElectretFullData(statusData.data);
                        const coreVitals = flattenToCoreVitals(statusData.data);
                        setElectretResults(coreVitals);
                        
                        // Sincronización silenciosa
                        syncAllBiomarkers(statusData.data, ocularResults, lingualResults, externalResults);
                    }
                } else {
                    clearInterval(pollerRef.current);
                    setElectretState('error');
                    setElectretError(statusData.message || "Error durante el escaneo Electret.");
                }
            } catch (err) {
                console.error("🔥 Error en polling de estatus:", err);
                clearInterval(pollerRef.current);
                setElectretState('error');
                setElectretError("Pérdida de enlace con el hardware.");
            }
        }, 1500);
    };

    // ==========================================================================
    // 👁️ CONTROLADORES - ESCÁNER OCULÓMICO (DEEP LEARNING)
    // ==========================================================================
    const handleOcularFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setOcularImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setOcularImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
            setOcularState('idle');
        }
    };

    const handleTriggerOcularFileInput = () => {
        if (ocularInputRef.current) ocularInputRef.current.click();
    };

    const handleStartOcularScan = async () => {
        if (!ocularImage) return;

        setOcularState('uploading');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        const formData = new FormData();
        formData.append('ocularImage', ocularImage);
        formData.append('age', patientAge);
        formData.append('clinicalRoute', patientRoute);

        try {
            setOcularState('processing');
            const response = await fetch(`${apiUrl}/api/bio/scan/ocular-scan`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                setOcularState('complete');
                setOcularResults(data.predictions);
                setOcularStylexVectors(data.stylex_vectors);
                setConfounderAlerts(data.confounder_alerts || []);

                // Sincronización silenciosa unificada
                syncAllBiomarkers(electretResults, data.predictions, lingualResults, externalResults);
            } else {
                setOcularState('error');
                setOcularError(data.message || "Error en el modelo del ojo.");
            }
        } catch (err) {
            console.error("🔥 Error en escaneo ocular:", err);
            setOcularState('error');
            setOcularError("Error de comunicación con el backend.");
        }
    };

    // ==========================================================================
    // 👅 CONTROLADORES - ESCÁNER LINGUAL (CTDS - DEEP LEARNING)
    // ==========================================================================
    const handleLingualFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLingualImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLingualImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
            setLingualState('idle');
        }
    };

    const handleTriggerLingualFileInput = () => {
        if (lingualInputRef.current) lingualInputRef.current.click();
    };

    const handleStartLingualScan = async () => {
        if (!lingualImage) return;

        setLingualState('uploading');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        const formData = new FormData();
        formData.append('lingualImage', lingualImage);
        formData.append('age', patientAge);
        formData.append('sex', patientSex);
        formData.append('clinicalRoute', patientRoute);

        try {
            setLingualState('processing');
            const response = await fetch(`${apiUrl}/api/bio/scan/lingual-scan`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                setLingualState('complete');
                setLingualResults(data.predictions);
                setLingualStylexVectors(data.stylex_vectors);

                // Sincronización silenciosa unificada
                syncAllBiomarkers(electretResults, ocularResults, data.predictions, externalResults);
            } else {
                setLingualState('error');
                setLingualError(data.message || "Error en el procesamiento del modelo lingual.");
            }
        } catch (err) {
            console.error("🔥 Error en escaneo lingual:", err);
            setLingualState('error');
            setLingualError("Error de comunicación con el backend lingual.");
        }
    };

    // ==========================================
    // 📸 HANDLERS: EVIDENCIA VISUAL (VISIÓN ARTIFICIAL)
    // ==========================================
    useEffect(() => {
        return () => {
            visualImagePreviews.forEach(url => {
                if (url.startsWith('blob:')) {
                    console.log("🧹 Liberando memoria: revokeObjectURL de previsualización visual:", url);
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [visualImagePreviews]);

    const handleTriggerVisualFileInput = () => {
        if (visualInputRef.current) visualInputRef.current.click();
    };

    const handleVisualFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newPreviews = files.map(file => URL.createObjectURL(file));

        setVisualImages(prev => [...prev, ...files]);
        setVisualImagePreviews(prev => [...prev, ...newPreviews]);
        setVisualState('idle');
        setVisualError('');
        setVisualResults(null);
    };

    const removeVisualImage = (index) => {
        setVisualImages(prev => {
            const copy = [...prev];
            copy.splice(index, 1);
            return copy;
        });
        setVisualImagePreviews(prev => {
            const copy = [...prev];
            const revokedUrl = copy.splice(index, 1)[0];
            if (revokedUrl && revokedUrl.startsWith('blob:')) {
                URL.revokeObjectURL(revokedUrl);
            }
            return copy;
        });
    };

    const translateClinicalFlag = (flag) => {
        if (!flag) return '';
        const map = {
            'CHRONIC_VENOUS_INSUFFICIENCY_DETECTED': 'Insuficiencia Venosa Crónica (CVI)',
            'VARICOSE_VEINS_HIGH_RISK': 'Venas Varicosas (Alto Riesgo)',
            'VENOUS_STASIS_DERMATITIS': 'Dermatitis por Estasis',
            'INFLAMMATORY_DERMATOSIS_SUSPECTED': 'Sospecha de Dermatosis Inflamatoria',
            'ERYTHEMA_DETECTED': 'Eritema Detectado',
            'PAPULAR_RASH_PRESENT': 'Erupción Papular Presente',
            'EDEMA_SUSPECTED': 'Sospecha de Edema',
            'ECZEMA_DETECTED': 'Eczema Detectado',
            'CELLULITIS_ALERT': 'Alerta de Celulitis (Infección Tisular)',
            'FUNGAL_INFECTION_SUSPECTED': 'Sospecha de Infección Fúngica',
            'ULCER_RISK_DETECTED': 'Riesgo de Úlcera Detectado',
            'HYPERPIGMENTATION_PRESENT': 'Hiperpigmentación Presente',
            'XEROSIS_DETECTED': 'Xerosis (Piel Seca Extrema)',
            'PETECHIAE_PRESENT': 'Petequias Presentes',
            'PURPURA_DETECTED': 'Púrpura Detectada'
        };
        if (map[flag]) return map[flag];

        return flag
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase())
            .replace('Detected', 'Detectado/a')
            .replace('Suspected', 'Sospecha de')
            .replace('Present', 'Presente')
            .replace('High Risk', 'Alto Riesgo')
            .replace('Alert', 'Alerta');
    };

    const handleStartVisualScan = async () => {
        if (visualImages.length === 0) return;

        setVisualState('uploading');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        try {
            setVisualState('processing');
            
            // Procesar todas las imágenes en paralelo
            const promises = visualImages.map(async (file) => {
                const formData = new FormData();
                formData.append('visualImage', file);
                
                const response = await fetch(`${apiUrl}/api/bio/scan/visual-scan`, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`Error en el servidor al procesar la imagen ${file.name}`);
                }
                
                return await response.json();
            });
            
            const results = await Promise.all(promises);
            const successfulResults = results.filter(r => r.success);
            
            if (successfulResults.length > 0) {
                // Combinar hallazgos
                const combinedFindings = successfulResults.map((r, idx) => {
                    return `[Imagen ${idx + 1}]:\n${r.findings}`;
                }).join('\n\n---\n\n');
                
                // Combinar banderas
                const allRawFlags = [];
                successfulResults.forEach(r => {
                    if (r.clinical_flags) {
                        allRawFlags.push(...r.clinical_flags);
                    }
                });
                const uniqueRawFlags = [...new Set(allRawFlags)];
                const mappedFlags = uniqueRawFlags.map(flag => {
                    const label = translateClinicalFlag(flag);
                    return { flag, label, checked: true };
                });
                
                // Determinar la severidad máxima
                const severityOrder = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3 };
                let maxSeverity = 'LOW';
                successfulResults.forEach(r => {
                    const sev = r.severity || 'LOW';
                    if (severityOrder[sev] > severityOrder[maxSeverity]) {
                        maxSeverity = sev;
                    }
                });
                
                setVisualState('complete');
                setVisualResults(combinedFindings);
                setVisualSeverity(maxSeverity);
                setVisualFlags(mappedFlags);
                
                // Sincronizar automáticamente en el Cortex
                syncAllBiomarkers(
                    electretResults,
                    ocularResults,
                    lingualResults,
                    externalResults,
                    {
                        findings: combinedFindings,
                        clinical_flags: uniqueRawFlags,
                        severity: maxSeverity
                    }
                );
            } else {
                setVisualState('error');
                setVisualError("No se pudo procesar ninguna de las imágenes cargadas.");
            }
        } catch (err) {
            console.error("🔥 Error en escaneo visual múltiple:", err);
            setVisualState('error');
            setVisualError(err.message || "Error de comunicación con el backend de visión.");
        }
    };

    const handleToggleVisualFlag = (index) => {
        setVisualFlags(prev => {
            const updated = [...prev];
            updated[index].checked = !updated[index].checked;
            return updated;
        });
    };

    const handleConfirmVisualEvidence = () => {
        const approvedFlags = visualFlags.filter(f => f.checked).map(f => f.flag);
        
        const finalVisualData = {
            findings: visualResults,
            clinical_flags: approvedFlags,
            severity: visualSeverity
        };

        syncAllBiomarkers(
            electretResults,
            ocularResults,
            lingualResults,
            externalResults,
            finalVisualData
        );
        console.log("💾 Evidencia visual confirmada por el médico:", finalVisualData);
    };

    // ==========================================================================
    // 💾 SINCRONIZACIÓN Y COMPLETADO (SQLite / CORTEX)
    // ==========================================================================
    const syncAllBiomarkers = async (electretData, ocularData, lingualData, externalData, visualData) => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const citationId = patientData?.idCita || patientData?.citaId || 1;

        try {
            await fetch(`${apiUrl}/api/bio/scan/sync-cortex`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    citationId,
                    electretBiomarkers: electretData,
                    ocularBiomarkers: ocularData,
                    lingualBiomarkers: lingualData,
                    externalMetrics: externalData,
                    visualMetrics: visualData
                })
            });
            console.log("💾 CORTEX SYNC: Sincronización silenciosa de la triada, externos y visión en SQLite.");
        } catch (err) {
            console.error("⚠️ Error en sincronización silenciosa unificada:", err);
        }
    };

    const handleSaveAndClose = () => {
        // Guardar la triada completa y externos en patientData
        if (setPatientData) {
            setPatientData(prev => {
                // Sincronizar alergias
                const currentAllergies = prev.safety?.allergies || [];
                const externalAllergies = externalResults?.allergies_detected || [];
                const updatedAllergies = Array.from(new Set([...currentAllergies, ...externalAllergies]));

                const currentFoodAllergies = prev.history?.allergies?.food || [];
                const newFoodAllergies = externalAllergies.map(a => ({
                    agent: a,
                    reaction: "Detectado en Estudio Externo / Prick Test",
                    status: "ACTIVE"
                }));
                const updatedFoodAllergies = [
                    ...currentFoodAllergies,
                    ...newFoodAllergies
                ].filter((v, i, a) => a.findIndex(t => t.agent.toLowerCase() === v.agent.toLowerCase()) === i);

                // Mapeo de labs a vitals
                let externalWeight = null;
                if (externalResults?.body_comp?.weight) {
                    externalWeight = parseFloat(externalResults.body_comp.weight);
                }
                let externalGlucose = null;
                if (externalResults?.labs?.glucose) {
                    const match = String(externalResults.labs.glucose).match(/\d+/);
                    if (match) externalGlucose = parseInt(match[0]);
                }

                const newWeight = externalWeight !== null ? externalWeight : (prev.vitals?.weight || null);
                const newGlucose = externalGlucose !== null ? externalGlucose : (prev.vitals?.glucose || null);
                
                let calculatedBmi = prev.vitals?.bmi || null;
                let calculatedBmiClass = prev.vitals?.bmi_class || "";
                if (newWeight && prev.vitals?.height) {
                    const heightMeters = prev.vitals.height / 100;
                    calculatedBmi = parseFloat((newWeight / (heightMeters * heightMeters)).toFixed(1));
                    if (calculatedBmi < 18.5) calculatedBmiClass = "Bajo Peso";
                    else if (calculatedBmi < 24.9) calculatedBmiClass = "Normopeso";
                    else if (calculatedBmi < 29.9) calculatedBmiClass = "Sobrepeso";
                    else calculatedBmiClass = "Obesidad";
                }

                // Sincronizar clinical_flags
                const currentFlags = prev.clinical_flags || [];
                const visualApprovedFlags = visualFlags.filter(f => f.checked).map(f => f.flag);
                const updatedClinicalFlags = Array.from(new Set([...currentFlags, ...visualApprovedFlags]));

                return {
                    ...prev,
                    clinical_flags: updatedClinicalFlags,
                    scan_data: {
                        electret_metrics: electretFullData || electretResults,
                        ocular_metrics: ocularResults,
                        lingual_metrics: lingualResults,
                        external_metrics: externalResults,
                        visual_metrics: visualResults ? {
                            findings: visualResults,
                            clinical_flags: visualApprovedFlags,
                            severity: visualSeverity
                        } : null
                    },
                    electret_scan_data: {
                        ...(prev.electret_scan_data || {}),
                        ...(electretFullData || electretResults),
                        ...ocularResults,
                        ...lingualResults
                    },
                    lifestyle: {
                        ...(prev.lifestyle || {}),
                        exercise_log: externalResults?.exercise_log || null
                    },
                    vitals: {
                        ...(prev.vitals || {}),
                        // Electret
                        blood_viscosity: electretResults?.blood_viscosity?.value,
                        pepsin_coefficient: electretResults?.pepsin_coefficient?.value,
                        phase_angle: electretResults?.phase_angle?.raw_value,
                        // Ocular
                        hemoglobin: ocularResults?.hemoglobin?.raw_value || externalResults?.labs?.hemoglobin || prev.vitals?.hemoglobin,
                        egfr: ocularResults?.egfr?.raw_value,
                        acr: ocularResults?.acr?.raw_value,
                        // Lingual
                        lingual_hepatic_stress: lingualResults?.hepatic_stress?.value,
                        lingual_glycemic_alteration: lingualResults?.glycemic_alteration?.value,
                        // Visual Evidence
                        visual_evidence_notes: visualResults,
                        visual_evidence_severity: visualSeverity,
                        // External
                        weight: newWeight,
                        glucose: newGlucose,
                        bmi: calculatedBmi,
                        bmi_class: calculatedBmiClass
                    },
                    signosVitales: {
                        ...(prev.signosVitales || {}),
                        glucosa: externalGlucose !== null ? externalGlucose.toString() + " mg/dL" : (prev.signosVitales?.glucosa || "")
                    },
                    safety: {
                        ...(prev.safety || {}),
                        allergies: updatedAllergies
                    },
                    history: {
                        ...(prev.history || {}),
                        allergies: {
                            ...(prev.history?.allergies || {}),
                            food: updatedFoodAllergies
                        }
                    }
                };
            });
        }

        // Agregar mensaje en el chat confirmando el cierre
        if (setMessages) {
            const listItems = [];
            if (electretResults) listItems.push("- 🔌 Bioimpedancia Electret registrada.");
            if (ocularResults) listItems.push("- 👁️ Análisis Oculómico (Deep Learning) registrado.");
            if (lingualResults) listItems.push("- 👅 Diagnóstico Computarizado de Lengua (CTDS) registrado.");
            if (externalResults) listItems.push("- 📂 Estudios Clínicos Externos registrados.");
            if (visualResults) listItems.push("- 📸 Evidencia Visual y Dermatológica registrada.");

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: `🧬 **Métricas de Bio-Integración y Estudios Externos selladas exitosamente.**\n\n${listItems.join('\n')}\n\nLos biomarcadores han sido acoplados a SQLite y están indexados de forma cruzada para el cerebro clínico (NOM-004). Transicionando a la Fase 19.`,
                    avatar: tiloImg
                }
            ]);
        }

        if (onPhaseComplete) {
            setTimeout(() => {
                onPhaseComplete('PHASE_19_DIAGNOSIS');
            }, 800);
        }
    };

    // ==========================================================================
    // 📂 CONTROLADORES - ESTUDIOS EXTERNOS (OCR & VISION)
    // ==========================================================================
    const handleExternalFileChange = (e) => {
        const selected = Array.from(e.target.files);
        if (selected.length > 0) {
            setExternalFiles(prev => [...prev, ...selected]);
            setExternalState('idle');
        }
    };

    const handleTriggerExternalFileInput = () => {
        if (externalInputRef.current) externalInputRef.current.click();
    };

    const removeFile = (indexToRemove) => {
        setExternalFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleExternalFieldChange = (category, field, value) => {
        setExternalResults(prev => ({
            ...prev,
            [category]: {
                ...(prev[category] || {}),
                [field]: value
            }
        }));
    };

    const removeAllergen = (indexToRemove) => {
        setExternalResults(prev => ({
            ...prev,
            allergies_detected: prev.allergies_detected.filter((_, idx) => idx !== indexToRemove)
        }));
    };

    const addAllergen = () => {
        if (newAllergen.trim()) {
            setExternalResults(prev => ({
                ...prev,
                allergies_detected: [...(prev.allergies_detected || []), newAllergen.trim()]
            }));
            setNewAllergen('');
        }
    };

    const handleStartExternalScan = async () => {
        if (externalFiles.length === 0) return;

        setExternalState('uploading');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        const formData = new FormData();
        externalFiles.forEach(file => {
            formData.append('externalDocs', file);
        });

        try {
            setExternalState('processing');
            const response = await fetch(`${apiUrl}/api/bio/scan/external-docs`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                setExternalState('complete');
                const metrics = data.external_metrics || {};
                metrics.exercise_log = metrics.exercise_log || {
                    duration: 0,
                    distance: 0,
                    calories: 0,
                    avg_hr: 0,
                    max_hr: 0
                };
                setExternalResults(metrics);

                // Sincronización silenciosa unificada
                syncAllBiomarkers(electretResults, ocularResults, lingualResults, metrics);
            } else {
                setExternalState('error');
                setExternalError(data.message || "Error en el procesamiento del modelo de documentos.");
            }
        } catch (err) {
            console.error("🔥 Error en escaneo de documentos externos:", err);
            setExternalState('error');
            setExternalError("Error de comunicación con el servidor Express.");
        }
    };

    const handleConfirmExternalGrid = () => {
        syncAllBiomarkers(electretResults, ocularResults, lingualResults, externalResults);
        alert("¡Datos de estudios externos sincronizados correctamente en base de datos!");
    };

    // ==========================================
    // 🛠️ MOCK FISIOLOGÍA - MODAL DETALLE
    // ==========================================
    const [activeDetailMarkerLocal, setActiveDetailMarkerLocal] = useState(null);

    // ==========================================
    // ⚙️ HELPERS VISUALES
    // ==========================================
    const getTabHighlightClass = (tabName) => {
        return activeTab === tabName 
            ? 'border-purple-600 text-purple-600' 
            : 'border-transparent text-slate-400 hover:text-slate-600';
    };
    // Determinar si el botón final de guardar se habilita
    const isSaveEnabled = electretResults !== null || ocularResults !== null || lingualResults !== null || externalResults !== null || visualResults !== null;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#FAFAFA] overflow-y-auto custom-scrollbar relative p-8">
            
            {/* Banner de Priorización Adaptativa por Ruta Clínica */}
            <div className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start gap-4 select-none">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 text-purple-600 border border-purple-100">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-[13px] uppercase tracking-wider">{routeInfo.title}</h4>
                        <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-100 uppercase tracking-widest">
                            {routeInfo.badge}
                        </span>
                    </div>
                    <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                        {routeInfo.desc}
                    </p>
                </div>
            </div>

            {/* Bocadillo de Chatbot Tilo Superior */}
            <div className="mb-8 flex gap-4 items-start select-none">
                <div className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden">
                    <img src={tiloImg} alt="Tilo" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative">
                    <div className="absolute top-5 -left-2 w-4 h-4 bg-white border-l border-b border-slate-200 rotate-45"></div>
                    <p className="text-[14px] text-slate-700 leading-relaxed font-sans relative z-10">
                        {activeTab === 'electret' ? (
                            electretState === 'searching' ? "Conectando con el Sensor Bioeléctrico a través del Agente Antigravity..." :
                            electretState === 'connected' ? "Enlace de hardware establecido. Por favor, sostenga el sensor metálico firmemente con su mano izquierda. Manténgase quieto y no hable durante el escaneo." :
                            electretState === 'scanning' ? `Adquiriendo telemetría de bioimpedancia en tiempo real (${electretProgress}%). Por favor mantenga la postura estática...` :
                            electretState === 'sanitizing_data' ? "Escaneo concluido. Filtrando el stream y aplicando blindaje clínico COFEPRIS en los marcadores de Electret..." :
                            electretState === 'complete' ? "Escaneo bioeléctrico finalizado con éxito. Los biomarcadores moleculares han sido inyectados al expediente. Proceda al análisis ocular/lingual o guarde el bloque." :
                            electretState === 'error' ? `⚠️ Error de hardware Electret: ${electretError}` : ""
                        ) : activeTab === 'ocular' ? (
                            ocularState === 'idle' ? (ocularImagePreview ? "Fotografía ocular cargada. Presione 'Iniciar Escaneo Ocular' para procesar el modelo de Deep Learning." : "Por favor capture o cargue una fotografía del ojo externo del paciente. Asegure una iluminación uniforme del globo ocular.") :
                            ocularState === 'uploading' ? "Subiendo archivo de imagen del ojo al servidor..." :
                            ocularState === 'processing' ? "Procesando imagen del ojo externo. La red neuronal está analizando la vasculatura conjuntival y microangiopatía palpebral..." :
                            ocularState === 'complete' ? "Análisis Oculómico completado con éxito. Se estimaron marcadores de hemoglobina y salud renal. Puede pulsar en 'Ver Razonamiento StylEx' para auditoría visual." :
                            ocularState === 'error' ? `⚠️ Error de escaneo oculómico: ${ocularError}` : ""
                        ) : activeTab === 'lingual' ? (
                            lingualState === 'idle' ? (lingualImagePreview ? "Fotografía lingual cargada. Presione 'Iniciar Escaneo Lingual' para procesar el modelo CTDS." : "Por favor capture una fotografía de la lengua del paciente. Asegure una correcta protrusión y enfoque en el dorso central.") :
                            lingualState === 'uploading' ? "Subiendo archivo de imagen lingual al servidor..." :
                            lingualState === 'processing' ? "Procesando imagen lingual (CTDS). Mapeando revestimiento de saburra y eritemas mediante redes convolucionales..." :
                            lingualState === 'complete' ? "Análisis Lingual completado con éxito. Se estimaron índices de congestión portal (Hígado Graso) y riesgo glucémico. Pulse en 'Ver Razonamiento StylEx' para auditoría visual." :
                            lingualState === 'error' ? `⚠️ Error de escaneo lingual: ${lingualError}` : ""
                        ) : activeTab === 'external' ? (
                            externalState === 'idle' ? (externalFiles.length > 0 ? "Documentos listos. Presione 'Iniciar Extracción Multimodal' para procesar con Gemini 3.1 Pro." : "Por favor arrastre o cargue los documentos clínicos del paciente (PDFs, imágenes de laboratorios, InBody o ECGs).") :
                            externalState === 'uploading' ? "Subiendo documentos clínicos al servidor..." :
                            externalState === 'processing' ? "Extracting Clinical Intelligence... Analizando biomarcadores, unidades y sensibilidades en los reportes..." :
                            externalState === 'complete' ? "Extracción clínica completada con éxito. Por favor revise el Bento Grid, edite cualquier valor incorrecto y confirme antes de sellar el bloque." :
                            externalState === 'error' ? `⚠️ Error de procesamiento: ${externalError}` : ""
                        ) : (
                            visualState === 'idle' ? (visualImagePreviews.length > 0 ? "Fotografías de evidencia cargadas. Presione 'Iniciar Escaneo Visual' para analizar los hallazgos morfológicos con IA." : "Por favor capture o cargue una o más fotografías de la afección vascular o dermatológica del paciente para su análisis pericial presencial.") :
                            visualState === 'uploading' ? "Subiendo fotografía de evidencia al servidor..." :
                            visualState === 'processing' ? "Removiendo metadatos EXIF y optimizando resolución... Consultando Copiloto de Visión Artificial para descripción morfológica..." :
                            visualState === 'complete' ? "Análisis de visión completado con éxito. Por favor revise la sugerencia del Copiloto, edite la descripción y confirme las banderas clínicas antes de guardar." :
                            visualState === 'error' ? `⚠️ Error de análisis visual: ${visualError}` : ""
                        )}                    </p>
                </div>
            </div>

            {/* ==========================================
                TABS DE NAVEGACIÓN (4 PESTAÑAS)
            ========================================== */}
            <div className="flex border-b border-slate-200 mb-8 select-none">
                <button
                    onClick={() => setActiveTab('electret')}
                    className={`flex-1 py-3.5 text-[12px] font-bold tracking-wider uppercase text-center border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${getTabHighlightClass('electret')}`}
                >
                    <Zap className="w-3.5 h-3.5" />
                    1. Electret
                </button>
                <button
                    onClick={() => setActiveTab('ocular')}
                    className={`flex-1 py-3.5 text-[12px] font-bold tracking-wider uppercase text-center border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${getTabHighlightClass('ocular')}`}
                >
                    <Eye className="w-3.5 h-3.5" />
                    2. Ocular (AI)
                </button>
                <button
                    onClick={() => setActiveTab('lingual')}
                    className={`flex-1 py-3.5 text-[12px] font-bold tracking-wider uppercase text-center border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${getTabHighlightClass('lingual')}`}
                >
                    <Database className="w-3.5 h-3.5" />
                    3. Lengua (CTDS)
                </button>
                <button
                    onClick={() => setActiveTab('external')}
                    className={`flex-1 py-3.5 text-[12px] font-bold tracking-wider uppercase text-center border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${getTabHighlightClass('external')}`}
                >
                    <Upload className="w-3.5 h-3.5" />
                    4. Estudios Externos
                </button>
                <button
                    onClick={() => setActiveTab('visual')}
                    className={`flex-1 py-3.5 text-[12px] font-bold tracking-wider uppercase text-center border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${getTabHighlightClass('visual')}`}
                >
                    <Camera className="w-3.5 h-3.5" />
                    5. Evidencia Visual (AI)
                </button>
            </div>

            {/* ==========================================
                CONTENIDO DINÁMICO TABS
            ========================================== */}
            <div className="flex-1 flex flex-col items-center">
                <AnimatePresence mode="wait">
                    
                    {/* TAB 1: ELECTRET */}
                    {activeTab === 'electret' && (
                        <motion.div key="electret-tab" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="w-full flex-1 flex flex-col justify-center items-center">
                            {electretState === 'searching' && (
                                <div className="flex flex-col items-center max-w-sm text-center">
                                    <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                                        <motion.div variants={pulseVariants} animate="animate" className="absolute inset-0 rounded-full bg-purple-105 bg-purple-50 border border-purple-100" />
                                        <Database className="w-8 h-8 text-purple-600 animate-pulse relative z-10" />
                                    </div>
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Buscando Hardware Electret...</h3>
                                    <p className="text-xs text-slate-450 text-slate-400">Enlazando canal con Electret.exe v4.6.0</p>
                                </div>
                            )}

                            {electretState === 'connected' && (
                                <div className="flex flex-col items-center max-w-md text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                                    <CheckCircle2 className="w-10 h-10 text-green-600 mb-6 animate-pulse" />
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Conexión con Electret Establecida</h3>
                                    <p className="text-xs text-slate-500 mb-8 leading-relaxed">
                                        {isHardwareDetected ? "Sensor USB detectado y listo." : "Entorno simulado listo. Inyección de paciente pre-cargada."}
                                    </p>
                                    <button onClick={handleStartElectretScan} className="px-8 py-3.5 bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-bold uppercase tracking-wider rounded-xl shadow-md cursor-pointer flex items-center gap-2">
                                        <Zap className="w-4 h-4 fill-white" />
                                        Iniciar Escaneo
                                    </button>
                                </div>
                            )}

                            {electretState === 'scanning' && (
                                <div className="flex flex-col items-center w-full max-w-md">
                                    <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
                                        <motion.div animate={{ rotate: prefersReducedMotion ? 0 : 360 }} transition={{ repeat: Infinity, duration: 6, ease: "linear" }} className="absolute inset-0 rounded-full border-4 border-dashed border-purple-500/30" />
                                        <Activity className="w-7 h-7 text-purple-600 relative z-10" />
                                    </div>
                                    <h3 className="text-md font-bold text-slate-800 mb-1">Escaneando Bioimpedancia</h3>
                                    <p className="text-xs font-mono text-purple-700 font-bold mb-6">PROGRESO: {electretProgress}%</p>
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 mb-2">
                                        <motion.div className="h-full bg-purple-600" initial={{ width: 0 }} animate={{ width: `${electretProgress}%` }} transition={{ duration: 0.3 }} />
                                    </div>
                                    <span className="text-[10px] text-slate-400">Mantenga las manos del paciente estables sobre los sensores.</span>
                                </div>
                            )}

                            {electretState === 'sanitizing_data' && (
                                <div className="flex flex-col items-center max-w-sm text-center">
                                    <Activity className="w-10 h-10 text-blue-600 mb-6 animate-pulse" />
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Saneando Datos...</h3>
                                    <p className="text-xs text-slate-450 text-slate-400">Filtrando el stream de datos según COFEPRIS y NOM-004.</p>
                                </div>
                            )}

                            {electretState === 'error' && (
                                <div className="flex flex-col items-center max-w-md text-center bg-white p-8 rounded-2xl border border-red-200 shadow-sm">
                                    <ShieldAlert className="w-10 h-10 text-red-600 mb-6" />
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Error de Enlace</h3>
                                    <p className="text-xs text-red-600 mb-8">{electretError}</p>
                                    <button onClick={() => { hasStartedRef.current = false; setElectretState('searching'); }} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg cursor-pointer text-xs font-bold">
                                        Reintentar
                                    </button>
                                </div>
                            )}

                            {electretState === 'complete' && electretResults && (
                                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(electretResults).map(([key, marker]) => {
                                        const badge = getMarkerBadgeInfo(marker.status);
                                        return (
                                            <div key={key} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-350 transition-all flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{marker.name}</span>
                                                        <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${badge.bg}`}>
                                                            {badge.icon}
                                                            {badge.label}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-baseline gap-2 mb-3">
                                                        <span className="text-xl font-bold text-slate-900">{marker.raw_value}</span>
                                                        <span className="text-xs text-slate-500">({marker.value})</span>
                                                    </div>
                                                    <p className="text-[12px] text-slate-650 text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                        {marker.translation}
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                                                    <button onClick={() => setActiveDetailMarkerLocal({ key, ...marker })} className="text-[10px] font-bold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-0.5 cursor-pointer">
                                                        Detalle Técnico <ChevronRight className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* TAB 2: OCULAR */}
                    {activeTab === 'ocular' && (
                        <motion.div key="ocular-tab" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="w-full flex-1 flex flex-col justify-center items-center">
                            {ocularState === 'idle' && (
                                <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center">
                                    <input type="file" ref={ocularInputRef} onChange={handleOcularFileChange} accept="image/*" capture="environment" className="hidden" />
                                    
                                    {activeWebcamTab === 'ocular' ? (
                                        <div className="relative w-full max-w-sm aspect-video mb-6 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-black">
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                            <div className="absolute bottom-4 inset-x-4 flex justify-center gap-3">
                                                <button onClick={() => capturePhoto('ocular')} className="px-4 py-2 bg-purple-600 hover:bg-purple-750 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 backdrop-blur-md bg-opacity-90">
                                                    <Zap className="w-3.5 h-3.5 fill-white" />
                                                    Capturar Foto
                                                </button>
                                                <button onClick={stopWebcam} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 backdrop-blur-md bg-opacity-90">
                                                    <X className="w-3.5 h-3.5" />
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : ocularImagePreview ? (
                                        <div className="relative w-full max-w-sm aspect-video mb-6 rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
                                            <img src={ocularImagePreview} alt="Ojo Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
                                                <button onClick={handleTriggerOcularFileInput} className="p-3 bg-white rounded-full text-slate-800 hover:bg-slate-100 transition-all cursor-pointer shadow-md" title="Subir Archivo">
                                                    <Upload className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => startWebcam('ocular')} className="p-3 bg-white rounded-full text-slate-800 hover:bg-slate-100 transition-all cursor-pointer shadow-md" title="Usar Cámara Web">
                                                    <Camera className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-sm aspect-video mb-6 flex flex-col gap-3">
                                            <div onClick={handleTriggerOcularFileInput} className="flex-1 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-100 hover:border-purple-450 hover:border-purple-400 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group">
                                                <Upload className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subir Foto de Ojo</span>
                                            </div>
                                            <button onClick={() => startWebcam('ocular')} className="py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs font-bold flex items-center justify-center gap-2">
                                                <Camera className="w-4 h-4 text-slate-600" />
                                                Usar Cámara Web
                                            </button>
                                        </div>
                                    )}
                                    
                                    <button disabled={!ocularImage || activeWebcamTab === 'ocular'} onClick={handleStartOcularScan} className={`px-8 py-3.5 font-bold tracking-wider uppercase text-[12px] rounded-xl flex items-center gap-2 transition-all shadow-md ${ocularImage && activeWebcamTab !== 'ocular' ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}`}>
                                        <Eye className="w-4 h-4" />
                                        Iniciar Escaneo Ocular
                                    </button>
                                </div>
                            )}

                            {ocularState === 'uploading' && (
                                <div className="flex flex-col items-center text-center">
                                    <Upload className="w-10 h-10 text-purple-600 mb-6 animate-bounce" />
                                    <h3 className="text-md font-bold text-slate-800">Cargando Ojo...</h3>
                                </div>
                            )}

                            {ocularState === 'processing' && (
                                <div className="flex flex-col items-center text-center">
                                    <Eye className="w-10 h-10 text-purple-600 mb-6 animate-spin" />
                                    <h3 className="text-md font-bold text-slate-800">Modelo Ocular Activo...</h3>
                                </div>
                            )}

                            {ocularState === 'error' && (
                                <div className="flex flex-col items-center max-w-md text-center bg-white p-8 rounded-2xl border border-red-200 shadow-sm">
                                    <ShieldAlert className="w-10 h-10 text-red-600 mb-6" />
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Error Ocular</h3>
                                    <p className="text-xs text-red-600 mb-8">{ocularError}</p>
                                    <button onClick={() => setOcularState('idle')} className="px-6 py-2 bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-lg cursor-pointer text-xs">
                                        Reintentar
                                    </button>
                                </div>
                            )}

                            {ocularState === 'complete' && ocularResults && (
                                <div className="w-full flex flex-col gap-6">
                                    
                                    {/* Alerta de Maquillaje/Delineador */}
                                    {confounderAlerts.map((alert, idx) => (
                                        <div key={idx} className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                                            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />
                                            <div>
                                                <h4 className="font-extrabold text-amber-800 text-[12px] uppercase tracking-wider">{alert.name}</h4>
                                                <p className="text-[12px] text-amber-700 mt-0.5 leading-relaxed font-semibold">{alert.risk}</p>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                        {Object.entries(ocularResults).map(([key, marker]) => {
                                            const badge = getMarkerBadgeInfo(marker.status);
                                            return (
                                                <div key={key} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{marker.name}</span>
                                                            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${badge.bg}`}>
                                                                {badge.icon}
                                                                {badge.label}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-baseline gap-2 mb-3">
                                                            <span className="text-xl font-bold text-slate-900">{marker.raw_value}</span>
                                                            <span className="text-xs text-slate-500">({marker.value})</span>
                                                        </div>
                                                        <p className="text-[12px] text-slate-650 text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                            {marker.translation}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Link a Explicabilidad StylEx Ocular */}
                                    <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 select-none">
                                        <div className="flex items-center gap-3">
                                            <Sliders className="w-5 h-5 text-purple-700" />
                                            <div>
                                                <h4 className="font-extrabold text-purple-900 text-[12.5px] uppercase tracking-wider">Auditoría Visual StylEx (Ojo)</h4>
                                                <p className="text-[11px] text-purple-650 text-purple-600 mt-0.5">Analizar descoloración conjuntival e influencia del fovea en prediabetes.</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setStyleXMode('ocular'); setStyleXAttribute('conjunctival_pallor'); setStyleXIntensity(50); setShowStyleXModal(true); }} className="px-6 py-2.5 bg-purple-600 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl cursor-pointer flex-shrink-0">
                                            Ver StylEx Ocular
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* TAB 3: LENGUA (CTDS) [NUEVO] */}
                    {activeTab === 'lingual' && (
                        <motion.div key="lingual-tab" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="w-full flex-1 flex flex-col justify-center items-center">
                            {lingualState === 'idle' && (
                                <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center">
                                    <input type="file" ref={lingualInputRef} onChange={handleLingualFileChange} accept="image/*" capture="user" className="hidden" />
                                    
                                    {activeWebcamTab === 'lingual' ? (
                                        <div className="relative w-full max-w-sm aspect-video mb-6 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-black">
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                                            <div className="absolute bottom-4 inset-x-4 flex justify-center gap-3">
                                                <button onClick={() => capturePhoto('lingual')} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 backdrop-blur-md bg-opacity-90">
                                                    <Zap className="w-3.5 h-3.5 fill-white" />
                                                    Capturar Foto
                                                </button>
                                                <button onClick={stopWebcam} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 backdrop-blur-md bg-opacity-90">
                                                    <X className="w-3.5 h-3.5" />
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : lingualImagePreview ? (
                                        <div className="relative w-full max-w-sm aspect-video mb-6 rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
                                            <img src={lingualImagePreview} alt="Lengua Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
                                                <button onClick={handleTriggerLingualFileInput} className="p-3 bg-white rounded-full text-slate-800 hover:bg-slate-100 transition-all cursor-pointer shadow-md" title="Subir Archivo">
                                                    <Upload className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => startWebcam('lingual')} className="p-3 bg-white rounded-full text-slate-800 hover:bg-slate-100 transition-all cursor-pointer shadow-md" title="Usar Cámara Web">
                                                    <Camera className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-sm aspect-video mb-6 flex flex-col gap-3">
                                            <div onClick={handleTriggerLingualFileInput} className="flex-1 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-100 hover:border-purple-400 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group">
                                                <Upload className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subir Foto de Lengua</span>
                                            </div>
                                            <button onClick={() => startWebcam('lingual')} className="py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs font-bold flex items-center justify-center gap-2">
                                                <Camera className="w-4 h-4 text-slate-600" />
                                                Usar Cámara Web
                                            </button>
                                        </div>
                                    )}
                                    
                                    <button disabled={!lingualImage || activeWebcamTab === 'lingual'} onClick={handleStartLingualScan} className={`px-8 py-3.5 font-bold tracking-wider uppercase text-[12px] rounded-xl flex items-center gap-2 transition-all shadow-md ${lingualImage && activeWebcamTab !== 'lingual' ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}`}>
                                        <Database className="w-4 h-4" />
                                        Iniciar Escaneo Lingual
                                    </button>
                                </div>
                            )}

                            {lingualState === 'uploading' && (
                                <div className="flex flex-col items-center text-center">
                                    <Upload className="w-10 h-10 text-purple-600 mb-6 animate-bounce" />
                                    <h3 className="text-md font-bold text-slate-800">Cargando Lengua...</h3>
                                </div>
                            )}

                            {lingualState === 'processing' && (
                                <div className="flex flex-col items-center text-center">
                                    <Activity className="w-10 h-10 text-purple-600 mb-6 animate-pulse" />
                                    <h3 className="text-md font-bold text-slate-800">Modelo CTDS Lingual Activo...</h3>
                                </div>
                            )}

                            {lingualState === 'error' && (
                                <div className="flex flex-col items-center max-w-md text-center bg-white p-8 rounded-2xl border border-red-200 shadow-sm">
                                    <ShieldAlert className="w-10 h-10 text-red-600 mb-6" />
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Error Lingual</h3>
                                    <p className="text-xs text-red-600 mb-8">{lingualError}</p>
                                    <button onClick={() => setLingualState('idle')} className="px-6 py-2 bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-lg cursor-pointer text-xs">
                                        Reintentar
                                    </button>
                                </div>
                            )}

                            {lingualState === 'complete' && lingualResults && (
                                <div className="w-full flex flex-col gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                        {Object.entries(lingualResults).map(([key, marker]) => {
                                            const badge = getMarkerBadgeInfo(marker.status);
                                            return (
                                                <div key={key} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{marker.name}</span>
                                                            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${badge.bg}`}>
                                                                {badge.icon}
                                                                {badge.label}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-baseline gap-2 mb-3">
                                                            <span className="text-xl font-bold text-slate-900">{marker.raw_value}</span>
                                                            <span className="text-xs text-slate-500">({marker.value})</span>
                                                        </div>
                                                        <p className="text-[12px] text-slate-650 text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                            {marker.translation}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Link a Explicabilidad StylEx Lingual */}
                                    <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 select-none">
                                        <div className="flex items-center gap-3">
                                            <Sliders className="w-5 h-5 text-purple-700" />
                                            <div>
                                                <h4 className="font-extrabold text-purple-900 text-[12.5px] uppercase tracking-wider">Auditoría Visual StylEx (Lengua)</h4>
                                                <p className="text-[11px] text-purple-650 text-purple-600 mt-0.5">Modificar espesor de saburra y ver variaciones de riesgo metabólico en caliente.</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setStyleXMode('lingual'); setStyleXAttribute('espesor_saburra'); setStyleXIntensity(50); setShowStyleXModal(true); }} className="px-6 py-2.5 bg-purple-600 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl cursor-pointer flex-shrink-0">
                                            Ver StylEx Lengua
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* TAB 4: ESTUDIOS EXTERNOS (OCR & VISION) [NUEVO] */}
                    {activeTab === 'external' && (
                        <motion.div key="external-tab" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="w-full flex-1 flex flex-col justify-center items-center">
                            {externalState === 'idle' && (
                                <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center">
                                    <input type="file" ref={externalInputRef} onChange={handleExternalFileChange} accept="image/*,application/pdf,.tcx,.gpx" multiple className="hidden" />
                                    
                                    <div 
                                        onClick={handleTriggerExternalFileInput} 
                                        className="w-full aspect-[21/9] bg-[#FAFAFA] border-2 border-dashed border-slate-300 rounded-2xl hover:bg-purple-50/10 hover:border-purple-500 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer group"
                                    >
                                        <Upload className="w-8 h-8 text-purple-650 text-purple-600 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider text-center px-4">Arrastrar o Cargar Documentos</span>
                                        <span className="text-[10px] text-slate-400 text-center px-8 leading-tight">Acepta PDFs, capturas de InBody/ECG/wearables, y archivos de ejercicio (.tcx, .gpx).</span>
                                    </div>

                                    {externalFiles.length > 0 && (
                                        <div className="w-full mt-6 border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                            {externalFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-[#FAFAFA]">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                        <span className="text-xs text-slate-700 truncate font-mono">{file.name}</span>
                                                    </div>
                                                    <button onClick={() => removeFile(idx)} className="p-1.5 text-slate-450 hover:text-red-650 hover:text-red-600 rounded-lg transition-colors cursor-pointer">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button 
                                        disabled={externalFiles.length === 0} 
                                        onClick={handleStartExternalScan} 
                                        className={`mt-6 px-8 py-3.5 font-bold tracking-wider uppercase text-[12px] rounded-xl flex items-center gap-2 transition-all shadow-md ${externalFiles.length > 0 ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-purple-650/10' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        Iniciar Extracción Multimodal
                                    </button>
                                </div>
                            )}

                            {externalState === 'uploading' && (
                                <div className="flex flex-col items-center text-center">
                                    <Loader2 className="w-10 h-10 text-purple-600 mb-6 animate-spin" />
                                    <h3 className="text-md font-bold text-slate-800">Cargando Documentos Clínicos...</h3>
                                </div>
                            )}

                            {externalState === 'processing' && (
                                <div className="flex flex-col items-center text-center">
                                    <Activity className="w-10 h-10 text-purple-650 text-purple-600 mb-6 animate-pulse" />
                                    <h3 className="text-md font-bold text-slate-800">Extracting Clinical Intelligence...</h3>
                                    <p className="text-xs text-slate-400 mt-2">La IA está analizando los biomarcadores, unidades y alergias.</p>
                                </div>
                            )}

                            {externalState === 'error' && (
                                <div className="flex flex-col items-center max-w-md text-center bg-white p-8 rounded-2xl border border-red-200 shadow-sm">
                                    <ShieldAlert className="w-10 h-10 text-red-600 mb-6" />
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Error de Procesamiento</h3>
                                    <p className="text-xs text-red-600 mb-8">{externalError}</p>
                                    <button onClick={() => setExternalState('idle')} className="px-6 py-2 bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-lg cursor-pointer text-xs">
                                        Reintentar
                                    </button>
                                </div>
                            )}

                            {externalState === 'complete' && externalResults && (
                                <div className="w-full flex flex-col gap-6">
                                    {/* Bento Grid editable de confirmación */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                        
                                        {/* Card 1: Composición Corporal */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 select-none">
                                                <Zap className="w-4 h-4 text-purple-600" />
                                                <h4 className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wider">1. Composición Corporal (InBody)</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Peso (kg)</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.body_comp?.weight || ''} 
                                                        onChange={(e) => handleExternalFieldChange('body_comp', 'weight', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Masa Músculo Esquelética (kg)</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.body_comp?.skeletal_muscle_mass || ''} 
                                                        onChange={(e) => handleExternalFieldChange('body_comp', 'skeletal_muscle_mass', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Porcentaje Grasa (%)</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.body_comp?.body_fat_percent || ''} 
                                                        onChange={(e) => handleExternalFieldChange('body_comp', 'body_fat_percent', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Agua Corporal (L)</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.body_comp?.total_body_water || ''} 
                                                        onChange={(e) => handleExternalFieldChange('body_comp', 'total_body_water', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 2: Química Sanguínea */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 select-none">
                                                <Activity className="w-4 h-4 text-purple-600" />
                                                <h4 className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wider">2. Química Sanguínea (Labs)</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Glucosa</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.labs?.glucose || ''} 
                                                        onChange={(e) => handleExternalFieldChange('labs', 'glucose', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Colesterol Total</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.labs?.cholesterol || ''} 
                                                        onChange={(e) => handleExternalFieldChange('labs', 'cholesterol', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Triglicéridos</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.labs?.triglycerides || ''} 
                                                        onChange={(e) => handleExternalFieldChange('labs', 'triglycerides', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Hemoglobina</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.labs?.hemoglobin || ''} 
                                                        onChange={(e) => handleExternalFieldChange('labs', 'hemoglobin', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">AST / TGO</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.labs?.ast_tgo || ''} 
                                                        onChange={(e) => handleExternalFieldChange('labs', 'ast_tgo', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">ALT / TGP</label>
                                                    <input 
                                                        type="text" 
                                                        value={externalResults.labs?.alt_tgp || ''} 
                                                        onChange={(e) => handleExternalFieldChange('labs', 'alt_tgp', e.target.value)} 
                                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 3: Imagenología y ECG */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-2">
                                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 select-none">
                                                <Eye className="w-4 h-4 text-purple-600" />
                                                <h4 className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wider">3. Diagnóstico / ECG / Imagenología</h4>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Hallazgos e Impresión Diagnóstica</label>
                                                <textarea 
                                                    rows="2" 
                                                    value={externalResults.imaging?.ecg || ''} 
                                                    onChange={(e) => handleExternalFieldChange('imaging', 'ecg', e.target.value)} 
                                                    className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-sans leading-relaxed resize-none" 
                                                />
                                            </div>
                                        </div>

                                        {/* Card 4: Alergias Detectadas */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-2">
                                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 select-none">
                                                <ShieldAlert className="w-4 h-4 text-purple-600" />
                                                <h4 className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wider">4. Alergias Detectadas (Inmunidad & Bloqueos)</h4>
                                            </div>
                                            
                                            {externalResults.allergies_detected && externalResults.allergies_detected.length > 0 ? (
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {externalResults.allergies_detected.map((allergen, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold">
                                                            <span>{allergen}</span>
                                                            <button onClick={() => removeAllergen(idx)} className="text-red-500 hover:text-red-800 text-xs font-extrabold cursor-pointer">×</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 mb-4 select-none">No se detectaron alérgenos clínicos en los reportes.</p>
                                            )}

                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Añadir alérgeno (ej. Penicilina)" 
                                                    value={newAllergen} 
                                                    onChange={(e) => setNewAllergen(e.target.value)} 
                                                    className="flex-1 bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500" 
                                                    onKeyDown={(e) => e.key === 'Enter' && addAllergen()}
                                                />
                                                <button onClick={addAllergen} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer">
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Añadir
                                                </button>
                                            </div>
                                        </div>

                                        {/* Card 5: Telemetría Wearable / Ejercicio [NUEVO] */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-2">
                                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 select-none">
                                                <Activity className="w-4 h-4 text-[#1C75BC]" />
                                                <h4 className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wider">5. Telemetría Wearable / Ejercicio</h4>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Duración (s)</label>
                                                    <div className="relative flex items-center">
                                                        <Clock className="w-3.5 h-3.5 text-[#1C75BC] absolute left-3" />
                                                        <input 
                                                            type="number" 
                                                            value={externalResults.exercise_log?.duration || 0} 
                                                            onChange={(e) => handleExternalFieldChange('exercise_log', 'duration', parseInt(e.target.value) || 0)} 
                                                            className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-slate-450 mt-1 block">
                                                        {formatDuration(externalResults.exercise_log?.duration || 0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Distancia (m)</label>
                                                    <div className="relative flex items-center">
                                                        <Activity className="w-3.5 h-3.5 text-[#1C75BC] absolute left-3" />
                                                        <input 
                                                            type="number" 
                                                            value={externalResults.exercise_log?.distance || 0} 
                                                            onChange={(e) => handleExternalFieldChange('exercise_log', 'distance', parseInt(e.target.value) || 0)} 
                                                            className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-slate-450 mt-1 block">
                                                        {((externalResults.exercise_log?.distance || 0) / 1000).toFixed(2)} km
                                                    </span>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Calorías (kcal)</label>
                                                    <div className="relative flex items-center">
                                                        <Flame className="w-3.5 h-3.5 text-[#1C75BC] absolute left-3" />
                                                        <input 
                                                            type="number" 
                                                            value={externalResults.exercise_log?.calories || 0} 
                                                            onChange={(e) => handleExternalFieldChange('exercise_log', 'calories', parseInt(e.target.value) || 0)} 
                                                            className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">FC Promedio (bpm)</label>
                                                    <div className="relative flex items-center">
                                                        <Heart className="w-3.5 h-3.5 text-[#1C75BC] absolute left-3" />
                                                        <input 
                                                            type="number" 
                                                            value={externalResults.exercise_log?.avg_hr || 0} 
                                                            onChange={(e) => handleExternalFieldChange('exercise_log', 'avg_hr', parseInt(e.target.value) || 0)} 
                                                            className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">FC Máxima (bpm)</label>
                                                    <div className="relative flex items-center">
                                                        <HeartPulse className="w-3.5 h-3.5 text-[#1C75BC] absolute left-3" />
                                                        <input 
                                                            type="number" 
                                                            value={externalResults.exercise_log?.max_hr || 0} 
                                                            onChange={(e) => handleExternalFieldChange('exercise_log', 'max_hr', parseInt(e.target.value) || 0)} 
                                                            className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-mono" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botón de Confirmación Bento */}
                                    <div className="flex justify-end mt-4">
                                        <button 
                                            onClick={handleConfirmExternalGrid} 
                                            className="px-6 py-2.5 bg-purple-650 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl cursor-pointer shadow-md"
                                        >
                                            Confirmar Métricas de Estudios
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* TAB 5: EVIDENCIA VISUAL (VISIÓN ARTIFICIAL) [NUEVO] */}
                    {activeTab === 'visual' && (
                        <motion.div key="visual-tab" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="w-full flex-1 flex flex-col justify-center items-center">
                            {visualState === 'idle' && (
                                <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center">
                                    <input type="file" ref={visualInputRef} onChange={handleVisualFileChange} accept="image/*" multiple className="hidden" />
                                    
                                    {activeWebcamTab === 'visual' ? (
                                        <div className="relative w-full max-w-sm aspect-video mb-6 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-black">
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                            <div className="absolute bottom-4 inset-x-4 flex justify-center gap-3">
                                                <button onClick={() => capturePhoto('visual')} className="px-4 py-2 bg-purple-600 hover:bg-purple-755 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 backdrop-blur-md bg-opacity-90">
                                                    <Zap className="w-3.5 h-3.5 fill-white" />
                                                    Capturar Foto
                                                </button>
                                                <button onClick={stopWebcam} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 backdrop-blur-md bg-opacity-90">
                                                    <X className="w-3.5 h-3.5" />
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full flex flex-col items-center">
                                            {visualImagePreviews.length > 0 ? (
                                                <div className="w-full flex flex-col items-center">
                                                    <div className="w-full mb-6">
                                                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 select-none">Fotos Seleccionadas / Capturadas ({visualImagePreviews.length})</label>
                                                        <div className="grid grid-cols-2 gap-3 max-h-52 overflow-y-auto p-1 border border-slate-150 rounded-xl">
                                                            {visualImagePreviews.map((url, index) => (
                                                                <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
                                                                    <img src={url} alt={`Evidencia ${index + 1}`} className="w-full h-full object-cover" />
                                                                    <button 
                                                                        onClick={() => removeVisualImage(index)}
                                                                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-650 hover:bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer bg-red-650 bg-red-600"
                                                                        title="Eliminar foto"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-white uppercase backdrop-blur-sm">
                                                                        #{index + 1}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-3 w-full mb-6 max-w-sm">
                                                        <button onClick={handleTriggerVisualFileInput} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs font-bold flex items-center justify-center gap-1.5">
                                                            <Upload className="w-3.5 h-3.5 text-slate-600" />
                                                            Subir más fotos
                                                        </button>
                                                        <button onClick={() => startWebcam('visual')} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs font-bold flex items-center justify-center gap-1.5">
                                                            <Camera className="w-3.5 h-3.5 text-slate-600" />
                                                            Capturar otra
                                                        </button>
                                                    </div>

                                                    <button 
                                                        onClick={handleStartVisualScan} 
                                                        className="px-8 py-3.5 font-bold tracking-wider uppercase text-[12px] bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer shadow-purple-650/10"
                                                    >
                                                        <Zap className="w-4 h-4" />
                                                        Iniciar Análisis de Visión
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-full max-w-sm aspect-video mb-6 flex flex-col gap-3">
                                                    <div onClick={handleTriggerVisualFileInput} className="flex-1 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-100 hover:border-purple-400 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group">
                                                        <Upload className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subir Evidencia Física</span>
                                                    </div>
                                                    <button onClick={() => startWebcam('visual')} className="py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs font-bold flex items-center justify-center gap-2">
                                                        <Camera className="w-4 h-4 text-slate-600" />
                                                        Usar Cámara Web
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {visualState === 'uploading' && (
                                <div className="flex flex-col items-center text-center">
                                    <Loader2 className="w-10 h-10 text-purple-600 mb-6 animate-spin" />
                                    <h3 className="text-md font-bold text-slate-800">Subiendo Fotografía Clínica...</h3>
                                </div>
                            )}

                            {visualState === 'processing' && (
                                <div className="flex flex-col items-center text-center">
                                    <Activity className="w-10 h-10 text-purple-650 text-purple-600 mb-6 animate-pulse" />
                                    <h3 className="text-md font-bold text-slate-800">Procesando con Copiloto de Visión...</h3>
                                    <p className="text-xs text-slate-400 mt-2">Removiendo metadatos EXIF y optimizando resolución de forma segura...</p>
                                </div>
                            )}

                            {visualState === 'error' && (
                                <div className="flex flex-col items-center max-w-md text-center bg-white p-8 rounded-2xl border border-red-200 shadow-sm">
                                    <ShieldAlert className="w-10 h-10 text-red-600 mb-6" />
                                    <h3 className="text-md font-bold text-slate-800 mb-2">Error de Análisis</h3>
                                    <p className="text-xs text-red-600 mb-8">{visualError}</p>
                                    <button onClick={() => setVisualState('idle')} className="px-6 py-2 bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-lg cursor-pointer text-xs">
                                        Reintentar
                                    </button>
                                </div>
                            )}

                            {visualState === 'complete' && visualResults && (
                                <div className="w-full flex flex-col gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                        {/* Columna Izquierda: Previsualización de la Imagen */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center">
                                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 w-full select-none">
                                                <Camera className="w-4 h-4 text-purple-600" />
                                                <h4 className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wider">Evidencia Capturada (Sanitizada)</h4>
                                            </div>
                                            <div className="flex-1 flex items-center justify-center min-h-[220px] w-full">
                                                {visualImagePreviews.length > 0 ? (
                                                    <div className={`grid gap-3 w-full ${visualImagePreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                                        {visualImagePreviews.map((url, index) => (
                                                            <div key={index} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                                                <img src={url} alt={`Evidencia sanitizada ${index + 1}`} className="w-full h-full object-cover" />
                                                                <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-white uppercase backdrop-blur-sm">
                                                                    Foto #{index + 1}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Sin imágenes cargadas.</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-450 mt-3 text-center">Datos biométricos sanitizados. Sin metadatos EXIF.</span>
                                        </div>

                                        {/* Columna Derecha: Reporte y Banderas */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                                    <div className="flex items-center gap-2 select-none">
                                                        <FileText className="w-4 h-4 text-purple-600" />
                                                        <h4 className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wider">Sugerencias del Copiloto</h4>
                                                    </div>
                                                    
                                                    <div className={`px-2.5 py-1 border rounded-full flex items-center gap-1.5 text-[10px] font-bold ${
                                                        visualSeverity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        (visualSeverity === 'HIGH' || visualSeverity === 'MEDIUM') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        'bg-green-50 text-green-700 border-green-200'
                                                    }`}>
                                                        <AlertTriangle className="w-3 h-3 animate-pulse" />
                                                        <span>Severidad: {
                                                            visualSeverity === 'CRITICAL' ? 'Crítica' :
                                                            visualSeverity === 'HIGH' ? 'Alta' :
                                                            visualSeverity === 'MEDIUM' ? 'Media' :
                                                            'Baja'
                                                        }</span>
                                                    </div>
                                                </div>

                                                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Hallazgos Morfológicos Objetivos (Editable)</label>
                                                <textarea 
                                                    rows="5" 
                                                    value={visualResults} 
                                                    onChange={(e) => setVisualResults(e.target.value)} 
                                                    className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 font-sans leading-relaxed resize-none font-mono" 
                                                />

                                                {visualFlags.length > 0 && (
                                                    <div className="mt-4">
                                                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Banderas Clínicas Recomendadas</label>
                                                        <div className="flex flex-col gap-2">
                                                            {visualFlags.map((item, idx) => (
                                                                <label key={idx} className="flex items-center gap-2 px-3 py-2 bg-[#FAFAFA] border border-slate-150 rounded-xl text-xs font-bold text-slate-700 cursor-pointer select-none">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={item.checked} 
                                                                        onChange={() => handleToggleVisualFlag(idx)}
                                                                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                                    />
                                                                    <span>{item.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex justify-end mt-6">
                                                <button 
                                                    onClick={handleConfirmVisualEvidence} 
                                                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-colors"
                                                >
                                                    Aprobar y Confirmar Evidencia
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Botón de Sellar Bloque Completo */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center select-none">
                <span className="text-[10px] text-slate-400 font-medium">
                    {electretResults ? "✓ Electret" : "🔌 Electret"} | {ocularResults ? "✓ Ojo" : "👁️ Ojo"} | {lingualResults ? "✓ Lengua" : "👅 Lengua"} | {externalResults ? "✓ Externo" : "📂 Externo"} | {visualResults ? "✓ Evidencia" : "📸 Evidencia"}
                </span>
                <button
                    disabled={!isSaveEnabled}
                    onClick={handleSaveAndClose}
                    className={`px-8 py-3.5 text-[12.5px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg ${
                        isSaveEnabled 
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20 cursor-pointer' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    }`}
                >
                    Sellar Mediciones y Proceder ➔
                </button>
            </div>

            {/* ==========================================================================
                💎 CAPA 2: MODAL DE FISIOLOGÍA LATERAL (DIVULGACIÓN PROGRESIVA NIVEL 2)
            ========================================================================== */}
            <AnimatePresence>
                {activeDetailMarkerLocal && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveDetailMarkerLocal(null)} className="absolute inset-0 bg-[#0a1428]/40 backdrop-blur-sm" />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative w-full max-w-md h-full bg-white/95 backdrop-blur-xl shadow-2xl border-l border-slate-200/50 p-8 flex flex-col justify-between z-10">
                            <div>
                                <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                                    <h3 className="font-bold text-slate-800 text-[14px] uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-purple-600" />
                                        Justificación Fisiológica
                                    </h3>
                                    <button onClick={() => setActiveDetailMarkerLocal(null)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all cursor-pointer">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">BIOMARCADOR</span>
                                        <h4 className="text-lg font-extrabold text-slate-900">{activeDetailMarkerLocal.name}</h4>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">VALOR OBTENIDO</span>
                                        <div className="text-xl font-mono font-extrabold text-purple-700">{activeDetailMarkerLocal.raw_value}</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Traducción de Blindaje (COFEPRIS)</span>
                                        <p className="text-[12px] text-slate-700 leading-relaxed font-semibold">
                                            "{activeDetailMarkerLocal.translation}"
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Fundamento Clínico</span>
                                        <p className="text-[12px] text-slate-500 leading-relaxed">
                                            {activeDetailMarkerLocal.key === 'blood_viscosity' && "La viscosidad hemática estima la fluidez de la sangre. Un nivel elevado sugiere tendencia a hemoconcentración o deshidratación eritrocitaria, justificando aportes de agua funcional."}
                                            {activeDetailMarkerLocal.key === 'pepsin_coefficient' && "El coeficiente de pepsina estima la capacidad de hidrólisis proteica estomacal. Valores bajos sugieren hipoclorhidria reactiva o declive de secreción ácida, sugiriendo betaina HCl u optimizadores enzimáticos."}
                                            {activeDetailMarkerLocal.key === 'cholesterol_crystals' && "Cristales insolubles de colesterol. Su presencia indica sobresaturación lipídica tisular y riesgo de peroxidación en membranas."}
                                            {activeDetailMarkerLocal.key === 'gastric_peristalsis' && "Tasa refleja de contracción estomacal. Normalidad asume digestión mecánica preservada."}
                                            {activeDetailMarkerLocal.key === 'phase_angle' && "Indicador de integridad celular global. Valores elevados son sinónimo de células turgentes y capacitancia de membrana sana; valores bajos se asocian con fragilidad y senescencia celular."}
                                            {activeDetailMarkerLocal.key === 'gsr_anomaly' && "La conductancia galvánica denota la actividad del sistema nervioso autónomo. Fluctuaciones anómalas en el espectro del GSR se asocian con hiperactividad del sistema nervioso simpático, denotando estrés crónico o desequilibrio en la hidratación transdérmica."}
                                            {activeDetailMarkerLocal.key === 'skeletal_muscle' && "Monitorea la masa proteica activa para descarte de fragilidad y sarcopenia."}
                                            {activeDetailMarkerLocal.key === 'segmental_lean_mass' && "Distribución de masa magra segmental para evaluar asimetrías de control motor."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setActiveDetailMarkerLocal(null)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 rounded-xl transition-colors cursor-pointer text-xs">
                                Cerrar Detalle
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ==========================================================================
                💎 CAPA 4: MODAL CONTRAFACTUAL STYLEX (EXPLICABILIDAD DE ALTA FIDELIDAD)
            ========================================================================== */}
            <AnimatePresence>
                {showStyleXModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 select-none">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStyleXModal(false)} className="absolute inset-0 bg-[#0a1428]/70 backdrop-blur-sm" />
                        
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col h-[85vh] z-10"
                        >
                            {/* Header del Modal */}
                            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <Sliders className="w-6 h-6 text-purple-600" />
                                    <div>
                                        <h3 className="font-extrabold text-[14px] text-slate-800 uppercase tracking-wider">
                                            Explicador Contrafactual StylEx (Generativo: {styleXMode === 'ocular' ? 'Ojo' : 'Lengua'})
                                        </h3>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Framework de reconstrucción visual de características clínicas en red neuronal
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowStyleXModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Contenido */}
                            <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">
                                
                                {/* Lado Izquierdo: Visualizador de Fotos */}
                                <div className="flex-1 flex flex-col justify-center items-center bg-slate-900 rounded-2xl p-6 relative overflow-hidden min-h-[300px]">
                                    
                                    {/* Contenedor del Ojo/Lengua (Simulando desaturación/saburra interactiva) */}
                                    <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-lg border border-white/10">
                                        
                                        {/* Canvas de Visualización Médica de Alta Fidelidad */}
                                        <canvas 
                                            ref={canvasRef} 
                                            className="w-full h-full object-cover"
                                        />

                                        {/* Mapa de Calor / Overlay de Hotspot de StylEx */}
                                        <div 
                                            className="absolute rounded-full border-2 border-dashed border-yellow-400/50 bg-yellow-400/10 pointer-events-none transition-all duration-300"
                                            style={
                                                styleXMode === 'ocular'
                                                    ? (styleXAttribute === 'conjunctival_pallor'
                                                        ? { top: '60%', left: '30%', width: '45%', height: '25%', opacity: styleXIntensity / 100 }
                                                        : { top: '30%', left: '20%', width: '60%', height: '20%', opacity: styleXIntensity / 100 })
                                                    : (styleXAttribute === 'espesor_saburra'
                                                        ? { top: '25%', left: '25%', width: '50%', height: '50%', opacity: styleXIntensity / 100 }
                                                        : { top: '40%', left: '20%', width: '60%', height: '30%', opacity: styleXIntensity / 100 })
                                            }
                                        />

                                        <span className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-[10px] text-white px-2.5 py-1 rounded-md font-mono tracking-widest uppercase">
                                            StylEx Simulación
                                        </span>
                                    </div>
                                </div>

                                {/* Lado Derecho: Controles y Ponderación */}
                                <div className="w-full lg:w-96 flex flex-col justify-between">
                                    <div className="space-y-6">
                                        
                                        {/* Selector de Atributo a Analizar */}
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Seleccionar Atributo Visual</span>
                                            <div className="flex flex-col gap-2">
                                                {styleXMode === 'ocular' && ocularStylexVectors && (
                                                    <>
                                                        <button onClick={() => setStyleXAttribute('conjunctival_pallor')} className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex justify-between items-center ${styleXAttribute === 'conjunctival_pallor' ? 'border-purple-600 bg-purple-50/50 text-purple-900 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                                                            <div>
                                                                <div className="text-[13px]">{ocularStylexVectors.conjunctival_pallor.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">Clasificador: Hemoglobina</div>
                                                            </div>
                                                            <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{(ocularStylexVectors.conjunctival_pallor.influence * 100).toFixed(0)}%</span>
                                                        </button>
                                                        <button onClick={() => setStyleXAttribute('eyelid_margin_pallor')} className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex justify-between items-center ${styleXAttribute === 'eyelid_margin_pallor' ? 'border-purple-600 bg-purple-50/50 text-purple-900 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                                                            <div>
                                                                <div className="text-[13px]">{ocularStylexVectors.eyelid_margin_pallor.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">Clasificador: Prediabetes (Glicación)</div>
                                                            </div>
                                                            <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{(ocularStylexVectors.eyelid_margin_pallor.influence * 100).toFixed(0)}%</span>
                                                        </button>
                                                    </>
                                                )}
                                                {styleXMode === 'lingual' && lingualStylexVectors && (
                                                    <>
                                                        <button onClick={() => setStyleXAttribute('espesor_saburra')} className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex justify-between items-center ${styleXAttribute === 'espesor_saburra' ? 'border-purple-600 bg-purple-50/50 text-purple-900 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                                                            <div>
                                                                <div className="text-[13px]">{lingualStylexVectors.espesor_saburra.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">Clasificador: Riesgo Glucémico / Estómago</div>
                                                            </div>
                                                            <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{(lingualStylexVectors.espesor_saburra.influence * 100).toFixed(0)}%</span>
                                                        </button>
                                                        <button onClick={() => setStyleXAttribute('tono_cianotico')} className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex justify-between items-center ${styleXAttribute === 'tono_cianotico' ? 'border-purple-600 bg-purple-50/50 text-purple-900 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                                                            <div>
                                                                <div className="text-[13px]">{lingualStylexVectors.tono_cianotico.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">Clasificador: Perfusión / Hígado</div>
                                                            </div>
                                                            <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{(lingualStylexVectors.tono_cianotico.influence * 100).toFixed(0)}%</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Descripción del Atributo */}
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mecanismo Visual</span>
                                            <p className="text-[11.5px] text-slate-600 leading-relaxed">
                                                {styleXMode === 'ocular' ? (
                                                    styleXAttribute === 'conjunctival_pallor' ? ocularStylexVectors.conjunctival_pallor.description : ocularStylexVectors.eyelid_margin_pallor.description
                                                ) : (
                                                    styleXAttribute === 'espesor_saburra' ? lingualStylexVectors.espesor_saburra.description : lingualStylexVectors.tono_cianotico.description
                                                )}
                                            </p>
                                        </div>

                                        {/* Slider Contrafactual */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-600">INTENSIDAD DEL ATRIBUTO</span>
                                                <span className="font-mono text-purple-700 font-extrabold uppercase">
                                                    {styleXIntensity === 50 ? "Original" : `${styleXIntensity}%`}
                                                </span>
                                            </div>
                                            <input 
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={styleXIntensity}
                                                onChange={(e) => setStyleXIntensity(parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                            />
                                            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                <span>Disminución (-50)</span>
                                                <span>Original (50)</span>
                                                <span>Aumento (+50)</span>
                                            </div>
                                        </div>

                                        {/* Estimación Sistémica Contrafactual Dinámica */}
                                        <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100/50">
                                            <span className="text-[9px] font-bold text-purple-500 uppercase tracking-widest block mb-1">Predicción Dinámica (Counterfactual)</span>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs text-purple-900 font-medium font-bold">
                                                    {styleXMode === 'ocular' ? (
                                                        styleXAttribute === 'conjunctival_pallor' ? "Hemoglobina Estimada:" : "HbA1c Proyectada:"
                                                    ) : (
                                                        styleXAttribute === 'espesor_saburra' ? "Riesgo Hepático (Saburra):" : "Riesgo Cardio/Perfusión:"
                                                    )}
                                                </span>
                                                <span className="text-lg font-mono font-extrabold text-purple-800 transition-all duration-200">
                                                    {styleXMode === 'ocular' ? (
                                                        styleXAttribute === 'conjunctival_pallor' 
                                                            ? `${(12.5 - (styleXIntensity / 100) * 3.4).toFixed(1)} g/dL` 
                                                            : `${(5.2 + (styleXIntensity / 100) * 1.8).toFixed(1)}%`
                                                    ) : (
                                                        styleXAttribute === 'espesor_saburra'
                                                            ? `${(22 + (styleXIntensity / 100) * 58).toFixed(0)}%`
                                                            : `${(15 + (styleXIntensity / 100) * 65).toFixed(0)}%`
                                                    )}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-purple-400 block mt-1 leading-tight font-semibold">
                                                {styleXMode === 'ocular' ? (
                                                    styleXAttribute === 'conjunctival_pallor' 
                                                        ? (styleXIntensity > 50 ? "⚠️ El incremento de palidez incrementa la probabilidad de Anemia." : "✓ Mayor rojez de mucosa descarta anemia.")
                                                        : (styleXIntensity > 50 ? "⚠️ Mayor palidez en borde palpebral sugiere riesgo prediabético." : "✓ Mucosa irrigada sugiere homeostasis de glucemia.")
                                                ) : (
                                                    styleXAttribute === 'espesor_saburra'
                                                        ? (styleXIntensity > 50 ? "⚠️ El aumento de espesor de saburra denota congestión metabólica y toxicidad." : "✓ Lengua limpia sugiere eubiosis y digestión óptima.")
                                                        : (styleXIntensity > 50 ? "⚠️ La cianosis (tono azulado) indica estasis de fluidos e insuficiencia de perfusión." : "✓ Tono sonrosado normal indica microcirculación sana.")
                                                )}
                                            </span>
                                        </div>

                                    </div>

                                    <button
                                        onClick={() => setShowStyleXModal(false)}
                                        className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 rounded-xl transition-all cursor-pointer text-xs"
                                    >
                                        Cerrar Visualizador StylEx
                                    </button>
                                </div>

                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
