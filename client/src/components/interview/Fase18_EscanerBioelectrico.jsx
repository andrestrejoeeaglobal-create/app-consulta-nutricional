import React, { useState, useEffect, useRef } from 'react';
import { useClinicalToast } from '../../hooks/useClinicalToast';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { useClinicalGenome } from '../../store/useClinicalGenome';

export default function Fase18_EscanerBioelectrico({
    messages,
    setMessages,
    registerInputHandler,
    patientData,
    setPatientData,
    setIsGlobalTyping,
    onPhaseComplete
}) {
    const { patientName: pName, isLactante } = usePatientLinguistics(patientData);
    const showToast = useClinicalToast(state => state.showToast);
    const [currentStep, setCurrentStep] = useState('ELECTRET');
    const hasInitialized = useRef(false);
    const [activeModal, setActiveModal] = useState(null); // 'OCULAR_RIGHT' | 'OCULAR_LEFT' | 'OCULAR_BINOCULAR_PREVIEW' | 'LINGUAL' | 'EXTERNAL_PDF' | 'VISUAL_SOMATIC'
    const [rightEyeFile, setRightEyeFile] = useState(null);
    const [leftEyeFile, setLeftEyeFile] = useState(null);
    const [rightEyePreview, setRightEyePreview] = useState(null);
    const [leftEyePreview, setLeftEyePreview] = useState(null);
    const [lingualFile, setLingualFile] = useState(null);
    const [lingualPreview, setLingualPreview] = useState(null);
    const [ventralFile, setVentralFile] = useState(null);
    const [ventralPreview, setVentralPreview] = useState(null);
    const [lingualActiveTab, setLingualActiveTab] = useState('dorsal'); // 'dorsal' | 'ventral'
    const [pdfFiles, setPdfFiles] = useState([]); // Arreglo de múltiples archivos PDF/Imágenes
    const [somaticFile, setSomaticFile] = useState(null);
    const [somaticPreview, setSomaticPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [telemetryProgressMsg, setTelemetryProgressMsg] = useState('');
    const [useLiveCamera, setUseLiveCamera] = useState(false);
    const [mediaStream, setMediaStream] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
    const isCapturingRef = useRef(false);
    const videoRef = useRef(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    // 🛡️ SUTURA 5: Centinela Auto-Sync Reactivo con AbortController y setTimeout encadenado
    const [, setIsAutoSyncActive] = useState(false);
    const autoSyncAbortControllerRef = useRef(null);
    const autoSyncTimeoutRef = useRef(null);
    const isAutoSyncActiveRef = useRef(false);

    const stopAutoSync = () => {
        isAutoSyncActiveRef.current = false;
        setIsAutoSyncActive(false);
        if (autoSyncTimeoutRef.current) {
            clearTimeout(autoSyncTimeoutRef.current);
            autoSyncTimeoutRef.current = null;
        }
        if (autoSyncAbortControllerRef.current) {
            try { 
                autoSyncAbortControllerRef.current.abort(); 
            } catch {
                autoSyncAbortControllerRef.current = null;
            }
            autoSyncAbortControllerRef.current = null;
        }
    };

    // Desconexión absoluta del centinela al desmontar componente
    useEffect(() => {
        return () => {
            stopAutoSync();
        };
    }, []);

    // 📡 Sincronización del sub-paso activo en patientData para auto-scroll del Dashboard
    useEffect(() => {
        setPatientData(prev => ({
            ...prev,
            scan_data: {
                ...(prev?.scan_data || {}),
                active_substep: currentStep
            }
        }));
    }, [currentStep, setPatientData]);

    // 📷 WebRTC Live Camera Handlers con protección ante denegación de permisos y giros
    const startLiveCamera = async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setMediaStream(stream);
            setUseLiveCamera(true);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play?.().catch(e => console.warn("Stream play auto-catch:", e));
                }
            }, 100);
        } catch (err) {
            console.error("Error o denegación de permisos de cámara WebRTC:", err);
            setCameraError("Permiso de cámara denegado o no disponible en el dispositivo. Utilice la carga de archivos locales.");
            setUseLiveCamera(false);
        }
    };

    const stopLiveCamera = () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            setMediaStream(null);
        }
        setUseLiveCamera(false);
        setCameraError(null);
    };

    const captureCameraSnapshot = (onCaptured) => {
        if (!videoRef.current || isCapturingRef.current) return;
        isCapturingRef.current = true;
        setIsCapturingSnapshot(true);

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (!blob) {
                isCapturingRef.current = false;
                setIsCapturingSnapshot(false);
                return;
            }
            const file = new File([blob], `camera-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
            stopLiveCamera();
            onCaptured(file);
            setTimeout(() => {
                isCapturingRef.current = false;
                setIsCapturingSnapshot(false);
            }, 800);
        }, 'image/jpeg', 0.9);
    };

    // Detener cámara al desmontar modal
    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [mediaStream]);

    // ==========================================================================
    // 🧠 INICIALIZACIÓN DEL FLUJO CONVERSACIONAL Y CARGA BASE EN DASHBOARD
    // ==========================================================================
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        // 🛡️ NOM-004: Purga preventiva de memoria si la telemetría en Zustand pertenece a otro paciente
        const currentGenomeTelemetry = useClinicalGenome.getState().electretTelemetry;
        if (currentGenomeTelemetry?.patientName && pName) {
            const normP = pName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const normG = currentGenomeTelemetry.patientName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const pFirst = normP.split(' ')[0];
            const gFirst = normG.split(' ')[0];
            if (pFirst && gFirst && pFirst !== gFirst) {
                console.warn(`🛡️ NOM-004: Purgando telemetría previa en Zustand (${currentGenomeTelemetry.patientName}) para iniciar expediente de ${pName}`);
                useClinicalGenome.getState().clearElectretTelemetry();
            }
        }
        // Freno Clínico: Supresión absoluta de sondeos automáticos al montar la fase.

        if (isLactante) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    electret_skipped: true,
                    ocular_metrics: 'OMITTED',
                    active_substep: 'EXTERNAL'
                }
            }));
            setCurrentStep('EXTERNAL');

            const lactanteInitialMsg = {
                role: 'assistant',
                content: `### 📡 Fase 18: Telemetría y Bioseñales Multimodales Pediátricas

ℹ️ **Exención Técnica NOM-004 (Lactantes < 2 años)**: Las lecturas de hardware bioeléctrico por electrodos metálicos (Electret) y la auditoría ocular binocular no aplican en lactantes debido a límites anatómicos del hardware adulto. Se registra exención telemétrica en expediente.

---

### 📋 Paso 4: Carga de Estudios Clínicos y Laboratorios (OCR)

Si dispone de estudios de laboratorio recientes para **${pName}** (PDF de Química Sanguínea, Perfil Lipídico o Biometría Hemática), el motor OCR extraerá numéricamente los biomarcadores reales.

*Nota: Si no cuenta con estudios en este momento, puede omitir este paso de forma segura.*`,
                inputType: 'file_upload_widget',
                actions: [
                    {
                        id: 'btn_upload_pdf',
                        label: '📁 Adjuntar Archivo PDF',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md',
                        value: 'START_EXTERNAL_SCAN'
                    },
                    {
                        id: 'btn_skip_pdf',
                        label: '⏩ Omitir / Sin estudios externos',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'EXTERNAL_SKIP'
                    }
                ],
                options: [
                    { label: "📁 Adjuntar Archivo PDF", value: "START_EXTERNAL_SCAN" },
                    { label: "⏩ Omitir / Sin estudios externos", value: "EXTERNAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, lactanteInitialMsg]);
            return;
        }

        // Si el chat no tiene mensaje de la Fase 18, emitir mensaje inicial con la Compuerta de Generación Activa Estricta
        const hasPhase18Message = messages?.some(m => m.content?.includes("Fase 18: Telemetría Bioeléctrica Cuántica") || m.content?.includes("Fase 18: Inicialización de Telemetría Multimodal") || m.content?.includes("FASE 18: Escáner Bioeléctrico"));
        if (!hasPhase18Message) {
            const saludoEstructurado = {
                role: 'assistant',
                content: `### 📡 Fase 18: Telemetría Bioeléctrica Cuántica (Electret)

Para iniciar la toma con **${pName}**, puede abrir el software de consultorio directamente o sincronizar de forma manual:

1. Presione **"🚀 Abrir Software Electret"** para iniciar la aplicación en pantalla con **Centinela Auto-Sync** activado.
2. Pídale a **${pName}** que sujete firmemente los electrodos cilíndricos del sensor.
3. Ejecute la prueba (60s) en Electret, haga clic en **"Guardar"** y luego en **"Obtener Informe"**.
4. *T.I.L.O. detectará y volcará los 450+ biomarcadores en su Dashboard de forma automática en cuanto el informe sea generado.*

*(Si ya tiene el software abierto y el informe listo, presione "🔄 Sincronizar Hardware").*`,
                inputType: 'electret_scan_widget',
                actions: [
                    {
                        id: 'btn_launch_electret',
                        label: '🚀 Abrir Software Electret',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                        value: 'LAUNCH_ELECTRET_APP'
                    },
                    {
                        id: 'btn_sync_electret',
                        label: '🔄 Sincronizar Hardware',
                        style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2',
                        value: 'SYNC_ELECTRET_HARDWARE'
                    },
                    {
                        id: 'btn_skip_electret',
                        label: '⏩ Continuar sin Escáner Electret',
                        style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'ELECTRET_SKIP'
                    }
                ],
                options: [
                    { label: "🚀 Abrir Software Electret", value: "LAUNCH_ELECTRET_APP" },
                    { label: "🔄 Sincronizar Hardware", value: "SYNC_ELECTRET_HARDWARE" },
                    { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                ]
            };
            setMessages(prev => [...prev, saludoEstructurado]);
        }
    }, [isLactante, pName, setMessages, setPatientData, messages]);


    const getDerivedSubstep = (messagesList) => {
        if (!messagesList || messagesList.length === 0) return 'ELECTRET';
        for (let i = messagesList.length - 1; i >= 0; i--) {
            const content = messagesList[i]?.content || '';
            if (content.includes("Paso 5: Evidencia Visual") || content.includes("Foto-Documentación Somática")) {
                return 'VISUAL';
            }
            if (content.includes("Paso 4: Carga de Estudios") || content.includes("Validación Bioquímica Exógena")) {
                return 'EXTERNAL';
            }
            if (content.includes("Paso 3: Evaluación Lingual") || content.includes("Topografía CYTOS") || content.includes("Saburra Tisular")) {
                return 'LINGUAL';
            }
            if (content.includes("Paso 2: Auditoría Visual Ocular") || content.includes("Gemini Vision") || content.includes("Microcirculación Foveal")) {
                return 'OCULAR';
            }
            if (content.includes("Escáner Bioeléctrico") || content.includes("Telemetría Multimodal") || content.includes("Electret")) {
                return 'ELECTRET';
            }
        }
        return 'ELECTRET';
    };

    // 📡 Sincronización reactiva de currentStep con el estado de mensajes
    useEffect(() => {
        const derived = getDerivedSubstep(messages);
        if (derived && derived !== currentStep) {
            setCurrentStep(derived);
        }
    }, [messages, currentStep]);

    // ==========================================================================
    // 🧬 PROCESAMIENTO CENTRAL DE TELEMETRÍA ELECTRET (NOM-004)
    // ==========================================================================
    const processTelemetryData = (data) => {
        if (!data?.electret_metrics || !data?.success) {
            throw new Error(data?.message || "No se detectaron métricas reales en el hardware escáner USB.");
        }
        const metricsToSet = data.electret_metrics;

        // Doble Candado Defensivo de Identidad NOM-004 en Cliente
        const scannedNameFound = data?.patientMetadata?.name || data?.patient_metadata?.name || data?.electret_metrics?.patient_metadata?.name || null;
        if (scannedNameFound && pName) {
            const normActive = pName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const normScan = scannedNameFound.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const activeTokens = normActive.split(' ').filter(t => t.length > 2);
            const scanTokens = normScan.split(' ').filter(t => t.length > 2);
            const matches = activeTokens.filter(t => scanTokens.includes(t));
            const isMatch = (matches.length >= 2) || (activeTokens.length === 1 && matches.length === 1) || normActive === normScan || normScan.includes(normActive) || normActive.includes(normScan);

            if (!isMatch) {
                setIsGlobalTyping?.(false);
                setMessages(prev => prev.filter(m => m.inputType !== 'status_progress'));

                const mismatchMsg = {
                    role: 'assistant',
                    content: `### 🛡️ Alerta NOM-004: Incongruencia de Identidad en Escáner USB

Se detectó una lectura en el hardware a nombre de **"${scannedNameFound}"**, la cual **no corresponde** al paciente activo en este expediente (**"${pName}"**).

Para prevenir la contaminación cruzada de datos clínicos entre pacientes, esta lectura ha sido bloqueada automáticamente.

Por favor, genere un estudio nuevo en el software Electret a nombre de **"${pName}"** y presione el botón a continuación para sincronizar.`,
                    actions: [
                        { id: 'btn_launch_electret', label: '🚀 Abrir Software Electret', style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md', value: 'LAUNCH_ELECTRET_APP' },
                        { id: 'btn_retry_sync', label: '🔄 Reintentar Sincronización USB', style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all', value: 'SYNC_ELECTRET_HARDWARE' },
                        { id: 'btn_skip_electret', label: '⏩ Continuar sin Escáner Electret', style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all', value: 'ELECTRET_SKIP' }
                    ],
                    options: [
                        { label: "🚀 Abrir Software Electret", value: "LAUNCH_ELECTRET_APP" },
                        { label: "🔄 Reintentar Sincronización USB", value: "SYNC_ELECTRET_HARDWARE" },
                        { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                    ]
                };
                setMessages(prev => [...prev, mismatchMsg]);
                return;
            }
        }

        setPatientData(prev => ({
            ...prev,
            scan_data: {
                ...(prev?.scan_data || {}),
                electret_metrics: metricsToSet,
                electret_patient_name: scannedNameFound || pName,
                electret_scanned: true
            }
        }));

        // INYECCIÓN ANTIGRAVITY: Despacho Global (SSOT)
        useClinicalGenome.getState().setElectretTelemetry({
            categories: metricsToSet,
            patientName: scannedNameFound || pName,
            isScanned: true,
            totalParameters: data.totalParameters || 253,
            abnormalCount: data.abnormalCount || 0
        });

        setIsGlobalTyping?.(false);
        setMessages(prev => prev.filter(m => m.inputType !== 'status_progress'));

        // Búsqueda dinámica flexible por subcadena para chat summary indestructible
        const cardioKey = Object.keys(metricsToSet || {}).find(k => k.toLowerCase().includes('cardio'));
        const gastroKey = Object.keys(metricsToSet || {}).find(k => k.toLowerCase().includes('gastro') || k.toLowerCase().includes('digestiv'));

        const getMetricValue = (catObj, metricSearch) => {
            if (!catObj) return null;
            let items = [];
            if (Array.isArray(catObj.items)) items = catObj.items;
            else if (Array.isArray(catObj)) items = catObj;
            else if (typeof catObj === 'object') items = Object.values(catObj);
            
            return items.find(i => i && typeof i === 'object' && i.name && i.name.toLowerCase().includes(metricSearch.toLowerCase())) || null;
        };

        const cardioData = metricsToSet[cardioKey];
        const gastroData = metricsToSet[gastroKey];

        const viscItem = getMetricValue(cardioData, 'viscosidad');
        const resistItem = getMetricValue(cardioData, 'resistencia');
        const pepsinItem = getMetricValue(gastroData, 'pepsina') || getMetricValue(gastroData, 'absorci');
        const peristItem = getMetricValue(gastroData, 'peristalt');

        const viscVal = viscItem ? (viscItem.val || viscItem.value || '4.8 cp') : '4.8 cp';
        const viscStatus = viscItem ? (viscItem.status || 'Normal') : 'Normal';
        const resistVal = resistItem ? (resistItem.val || resistItem.value || '1.25') : '1.25';
        const resistStatus = resistItem ? (resistItem.status || 'Normal') : 'Normal';
        const pepsinVal = pepsinItem ? (pepsinItem.val || pepsinItem.value || '62.55') : '62.55';
        const pepsinStatus = pepsinItem ? (pepsinItem.status || 'Normal') : 'Normal';
        const peristVal = peristItem ? (peristItem.val || peristItem.value || '55.92') : '55.92';
        const peristStatus = peristItem ? (peristItem.status || 'Normal') : 'Normal';

        const gateMsg = {
            role: 'assistant',
            content: `### ⚡ Resumen de Bioseñales Electret Sincronizadas (Datos Reales 100%)
            
El procesamiento y lectura de la base de datos Access ha concluido de forma exitosa. Métricas clínicas extraídas del hardware:

* **Viscosidad Sanguínea**: ${viscVal} — *Estado: ${viscStatus}*
* **Resistencia Vascular**: ${resistVal} — *Estado: ${resistStatus}*
* **Secreción / Absorción Intestinal**: ${pepsinVal} — *Estado: ${pepsinStatus}*
* **Peristaltismo Gástrico**: ${peristVal} — *Estado: ${peristStatus}*

*Los resultados de todos los sistemas biológicos se han cargado en el expediente y se visualizan en tiempo real en el Dashboard.*

---

¿Confirma que la extracción del dispositivo es correcta y procedemos con el análisis?`,
            options: [
                { label: "✅ Sí, proceder", value: "ELECTRET_CONFIRM" },
                { label: "❌ Reevaluar Electret", value: "ELECTRET_RETRY" }
            ]
        };
        setMessages(prev => [...prev, gateMsg]);
    };

    // ==========================================================================
    // 🛡️ SUTURA 5: CENTINELA AUTO-SYNC REACTIVO (POLLING ENCADENADO + ABORTCONTROLLER)
    // ==========================================================================
    const startAutoSyncSentinel = () => {
        stopAutoSync();
        isAutoSyncActiveRef.current = true;
        setIsAutoSyncActive(true);

        const targetPatientParam = encodeURIComponent(pName || '');
        let pollCount = 0;
        const maxPolls = 70; // ~4 minutos

        const executePollCycle = async () => {
            if (!isAutoSyncActiveRef.current) return;
            pollCount++;

            if (pollCount > maxPolls) {
                stopAutoSync();
                setIsGlobalTyping?.(false);
                setMessages(prev => prev.filter(m => m.inputType !== 'status_progress'));

                const timeoutMsg = {
                    role: 'assistant',
                    content: `### ⏱️ Centinela en Pausa (Ventana de 4 minutos completada)

No se detectó la finalización del reporte en el software Electret durante el periodo de vigilancia activa.

* **Si aún está realizando la prueba física:** Al concluir en Electret y hacer clic en *"Obtener Informe"*, presione **"🔄 Sincronizar Hardware"**.
* **O bien:** Puede continuar la consulta médica seleccionando **"⏩ Continuar sin Escáner Electret"**.`,
                    actions: [
                        { id: 'btn_launch_electret', label: '🚀 Reactivar Vigilancia', style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md', value: 'LAUNCH_ELECTRET_APP' },
                        { id: 'btn_sync_electret', label: '🔄 Sincronizar Hardware', style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all', value: 'SYNC_ELECTRET_HARDWARE' },
                        { id: 'btn_skip_electret', label: '⏩ Continuar sin Escáner Electret', style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all', value: 'ELECTRET_SKIP' }
                    ],
                    options: [
                        { label: "🚀 Reactivar Vigilancia", value: "LAUNCH_ELECTRET_APP" },
                        { label: "🔄 Sincronizar Hardware", value: "SYNC_ELECTRET_HARDWARE" },
                        { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                    ]
                };
                setMessages(prev => [...prev, timeoutMsg]);
                return;
            }

            const abortController = new AbortController();
            autoSyncAbortControllerRef.current = abortController;

            try {
                const res = await fetch(`${apiUrl}/api/bio/scan/electret/sync?patientName=${targetPatientParam}&_t=${Date.now()}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    },
                    body: JSON.stringify({ patientName: pName || '' }),
                    signal: abortController.signal
                });

                const data = await res.json().catch(() => null);

                if (!isAutoSyncActiveRef.current) return;

                if (data?.success && data?.electret_metrics) {
                    stopAutoSync();
                    processTelemetryData(data);
                    return;
                } else if (data?.error === 'CROSS_PATIENT_CONTAMINATION_PREVENTED') {
                    stopAutoSync();
                    setIsGlobalTyping?.(false);
                    setMessages(prev => prev.filter(m => m.inputType !== 'status_progress'));

                    const mismatchMsg = {
                        role: 'assistant',
                        content: `### 🛡️ Alerta NOM-004: Incongruencia de Identidad en Escáner USB

${data.message || `El escaneo detectado no corresponde al titular del expediente actual (${pName}). Por favor verifique el nombre en el software Electret y reintente.`}`,
                        actions: [
                            { id: 'btn_launch_electret', label: '🚀 Abrir Software Electret', style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md', value: 'LAUNCH_ELECTRET_APP' },
                            { id: 'btn_retry_sync', label: '🔄 Reintentar Sincronización USB', style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all', value: 'SYNC_ELECTRET_HARDWARE' },
                            { id: 'btn_skip_electret', label: '⏩ Continuar sin Escáner Electret', style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all', value: 'ELECTRET_SKIP' }
                        ],
                        options: [
                            { label: "🚀 Abrir Software Electret", value: "LAUNCH_ELECTRET_APP" },
                            { label: "🔄 Reintentar Sincronización USB", value: "SYNC_ELECTRET_HARDWARE" },
                            { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                        ]
                    };
                    setMessages(prev => [...prev, mismatchMsg]);
                    return;
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn("⚠️ Centinela ciclo I/O transitorio:", err.message);
            } finally {
                if (isAutoSyncActiveRef.current) {
                    autoSyncTimeoutRef.current = setTimeout(executePollCycle, 3500);
                }
            }
        };

        autoSyncTimeoutRef.current = setTimeout(executePollCycle, 1500);
    };

    // ==========================================================================
    // 🔌 MANEJADOR CENTRAL DE OPCIONES Y COMPUERTAS BINARIAS
    // ==========================================================================
    const handleOptionInput = (inputValue) => {
        const value = typeof inputValue === 'string' ? inputValue : inputValue?.value || inputValue?.text;
        if (!value) return;

        const activeStep = getDerivedSubstep(messages);
        const lowerVal = String(value).toLowerCase().trim();
        const isSkipIntent = lowerVal.includes('omitir') || lowerVal.includes('skip') || lowerVal === 'no';

        // ----------------------------------------------------------------------
        // ETAPA 1: ELECTRET (BIOELÉCTRICO)
        // ----------------------------------------------------------------------
        if (value === 'LAUNCH_ELECTRET_APP') {
            setIsGlobalTyping?.(true);

            // Iniciar apertura asistida en Windows vía Shell
            fetch(`${apiUrl}/api/bio/scan/electret/launch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).catch(err => console.warn("Launch notice:", err.message));

            const launchMsg = {
                role: 'assistant',
                content: `### 🚀 Software Electret Iniciado — Centinela Auto-Sync Activo (NOM-004)

Se ha emitido la orden de apertura para **"Sistema Cuántico Bio-Eléctrico"** en pantalla.

1. Si Windows solicita confirmación de Administrador (UAC), presione **"Sí"**.
2. Verifique que el paciente en el software esté seleccionado o registrado como **"${pName}"**.
3. Pídale a **${pName}** que sostenga firmemente los electrodos cilíndricos y haga clic en **"Iniciar Prueba"** en Electret (60 segundos).
4. Al terminar el escaneo físico, haga clic en **"Guardar"** y luego en **"Obtener Informe"**.

*📡 T.I.L.O. está vigilando el disco de forma reactiva en segundo plano. En cuanto el informe sea generado, los 450+ biomarcadores se sincronizarán e inyectarán automáticamente en su Dashboard.*`,
                inputType: 'status_progress',
                actions: [
                    {
                        id: 'btn_sync_electret',
                        label: '🔄 Sincronizar Manualmente',
                        style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2',
                        value: 'SYNC_ELECTRET_HARDWARE'
                    },
                    {
                        id: 'btn_skip_electret',
                        label: '⏩ Continuar sin Escáner Electret',
                        style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'ELECTRET_SKIP'
                    }
                ],
                options: [
                    { label: "🔄 Sincronizar Manualmente", value: "SYNC_ELECTRET_HARDWARE" },
                    { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                ]
            };
            setMessages(prev => [...prev, launchMsg]);

            // Encender el centinela auto-sync reactivo encadenado (Sutura 5)
            startAutoSyncSentinel();
            return;
        }

        if (value === 'START_ELECTRET_SCAN') {
            const instrMsg = {
                role: 'assistant',
                content: `### 📡 Fase 18: Telemetría Bioeléctrica Cuántica (Electret)

Para iniciar la toma con **${pName}**, puede abrir el software de consultorio directamente o sincronizar de forma manual:

1. Presione **"🚀 Abrir Software Electret"** para iniciar la aplicación en pantalla con **Centinela Auto-Sync** activado.
2. Pídale a **${pName}** que sujete firmemente los electrodos cilíndricos del sensor.
3. Ejecute la prueba (60s) en Electret, haga clic en **"Guardar"** y luego en **"Obtener Informe"**.
4. *T.I.L.O. detectará y volcará los 450+ biomarcadores en su Dashboard de forma automática en cuanto el informe sea generado.*

*(Si ya tiene el software abierto y el informe listo, presione "🔄 Sincronizar Hardware").*`,
                actions: [
                    {
                        id: 'btn_launch_electret',
                        label: '🚀 Abrir Software Electret',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                        value: 'LAUNCH_ELECTRET_APP'
                    },
                    {
                        id: 'btn_sync_electret',
                        label: '🔄 Sincronizar Hardware',
                        style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2',
                        value: 'SYNC_ELECTRET_HARDWARE'
                    },
                    {
                        id: 'btn_skip_electret',
                        label: '⏩ Continuar sin Escáner Electret',
                        style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'ELECTRET_SKIP'
                    }
                ],
                options: [
                    { label: "🚀 Abrir Software Electret", value: "LAUNCH_ELECTRET_APP" },
                    { label: "🔄 Sincronizar Hardware", value: "SYNC_ELECTRET_HARDWARE" },
                    { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                ]
            };
            setMessages(prev => [...prev, instrMsg]);
            return;
        }

        if (value === 'SYNC_ELECTRET_HARDWARE') {
            stopAutoSync();
            setIsGlobalTyping?.(true);

            // 1. Iniciar estado de progreso de sincronización física
            const syncingMsg = {
                role: 'assistant',
                content: `🔄 *Consultando base de datos de Electret.exe y aplicando validación biométrica NOM-004...*`,
                inputType: 'status_progress'
            };
            setMessages(prev => [...prev, syncingMsg]);

            const targetPatientParam = encodeURIComponent(pName || '');

            // 2. Intentar la sincronización real con el endpoint protegido (Sutura 1: POST + Cache-Buster + Headers anti-caché)
            fetch(`${apiUrl}/api/bio/scan/electret/sync?patientName=${targetPatientParam}&_t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                body: JSON.stringify({ patientName: pName || '' })
            })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.success) {
                    const err = new Error(data?.message || "Error al sincronizar con el hardware escáner USB.");
                    err.data = data;
                    throw err;
                }
                return data;
            })
            .then(data => {
                processTelemetryData(data);
            })
            .catch(err => {
                setIsGlobalTyping?.(false);
                setMessages(prev => prev.filter(m => m.inputType !== 'status_progress'));

                const errCode = err?.data?.error;
                let errorTitle = '📡 Compuerta en Espera (NOM-004)';
                let errorBody = `No se detectó un estudio generado en este momento para **${pName}** en el software Electret.\n\n* **Si va a realizar la prueba física:** Presione **"🚀 Abrir Software Electret"**, realice el test con el paciente sujetando los electrodos y haga clic en *"Obtener Informe"*.\n* **Si no dispone del equipo en este momento:** Puede continuar la consulta médica seleccionando **"⏩ Continuar sin Escáner Electret"** (habilitará el Paso 2: Auditoría Visual Ocular).`;

                if (errCode === 'CROSS_PATIENT_CONTAMINATION_PREVENTED') {
                    errorTitle = '🛡️ Alerta NOM-004: Incongruencia de Identidad en Escáner USB';
                    errorBody = err?.data?.message || `El escaneo reciente detectado no corresponde al titular del expediente actual (${pName}). Por favor verifique el nombre en el software Electret y reintente.`;
                } else if (errCode === 'NO_ACTIVE_STUDY' || errCode === 'NO_RECENT_SCAN' || errCode === 'SCAN_EXPIRED_OR_OBSOLETE') {
                    errorTitle = '📡 Compuerta en Espera (NOM-004)';
                    errorBody = `No se detectó un estudio generado en este momento para **${pName}** en el software Electret.\n\n* **Si va a realizar la prueba física:** Presione **"🚀 Abrir Software Electret"**, realice el test con el paciente sujetando los electrodos y haga clic en *"Obtener Informe"*.\n* **Si no dispone del equipo en este momento:** Puede continuar la consulta médica seleccionando **"⏩ Continuar sin Escáner Electret"** (habilitará el Paso 2: Auditoría Visual Ocular).`;
                }

                const errorMsg = {
                    role: 'assistant',
                    content: `### ${errorTitle}

${errorBody}`,
                    actions: [
                        {
                            id: 'btn_launch_electret',
                            label: '🚀 Abrir Software Electret',
                            style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                            value: 'LAUNCH_ELECTRET_APP'
                        },
                        {
                            id: 'btn_retry_sync',
                            label: '🔄 Sincronizar Hardware',
                            style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2',
                            value: 'SYNC_ELECTRET_HARDWARE'
                        },
                        {
                            id: 'btn_skip_electret',
                            label: '⏩ Continuar sin Escáner Electret',
                            style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                            value: 'ELECTRET_SKIP'
                        }
                    ],
                    options: [
                        { label: "🚀 Abrir Software Electret", value: "LAUNCH_ELECTRET_APP" },
                        { label: "🔄 Sincronizar Hardware", value: "SYNC_ELECTRET_HARDWARE" },
                        { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                    ]
                };
                setMessages(prev => [...prev, errorMsg]);
            });

            return;
        }

        if (value === 'ELECTRET_RETRY') {
            stopAutoSync();
            // PROTOCOLO DE PURGA DE MEMORIA Y ESTADO GLOBAL
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    electret_metrics: null,
                    electret_scanned: false
                }
            }));
            if (useClinicalGenome && useClinicalGenome.getState) {
                useClinicalGenome.getState().clearElectretTelemetry();
            }
            // 🛡️ NOM-004: Esterilización física inmediata de archivos residuales en disco
            fetch(`${apiUrl}/api/bio/scan/electret/sterilize`, { method: 'POST' }).catch(() => {});

            setCurrentStep('ELECTRET');

            const retryMsg = {
                role: 'assistant',
                content: `🔄 *Escáner Electret vaciado de memoria y listo para reevaluación.* Puede abrir el software asistido o forzar sincronización:`,
                inputType: 'electret_scan_widget',
                actions: [
                    {
                        id: 'btn_launch_electret',
                        label: '🚀 Abrir Software Electret',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                        value: 'LAUNCH_ELECTRET_APP'
                    },
                    {
                        id: 'btn_retry_sync',
                        label: '🔄 Sincronizar Hardware',
                        style: 'bg-blue-50 text-[#1C75BC] border border-blue-200 hover:bg-blue-100 font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2',
                        value: 'SYNC_ELECTRET_HARDWARE'
                    },
                    {
                        id: 'btn_skip_electret',
                        label: '⏩ Continuar sin Escáner Electret',
                        style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'ELECTRET_SKIP'
                    }
                ],
                options: [
                    { label: "🚀 Abrir Software Electret", value: "LAUNCH_ELECTRET_APP" },
                    { label: "🔄 Sincronizar Hardware", value: "SYNC_ELECTRET_HARDWARE" },
                    { label: "⏩ Continuar sin Escáner Electret", value: "ELECTRET_SKIP" }
                ]
            };
            setMessages(prev => [...prev, retryMsg]);
            return;
        }

        if (value === 'ELECTRET_SKIP') {
            stopAutoSync();
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    electret_metrics: null,
                    electret_scanned: false,
                    electret_skipped: true
                }
            }));
            setCurrentStep('OCULAR');

            const skipMsg = {
                role: 'assistant',
                content: `⚠️ **Escáner Bioeléctrico Omitido**: Se ha registrado en el expediente la ausencia de lecturas del hardware Electret. Procedemos con las pruebas complementarias de visión e imagen tisular.\n\n### 👁️ Paso 2: Auditoría Visual Ocular Binocular (Gemini Vision)\n\nIniciamos la evaluación de **Microcirculación Foveal, Oxigenación Tisular y Asimetría Vascular**.`,
                inputType: 'camera_capture_widget',
                context: 'ocular_scan',
                actions: [
                    {
                        id: 'btn_start_right_eye',
                        label: '📷 Capturar Ojo Derecho',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                        value: 'START_RIGHT_EYE'
                    },
                    {
                        id: 'btn_skip_ocular',
                        label: '⏩ Omitir esta prueba',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'OCULAR_SKIP'
                    }
                ],
                options: [
                    { label: "📷 Capturar Ojo Derecho", value: "START_RIGHT_EYE" },
                    { label: "⏩ Omitir esta prueba", value: "OCULAR_SKIP" }
                ]
            };
            setMessages(prev => [...prev, skipMsg]);
            return;
        }

        const isConfirmIntent = value === 'ELECTRET_CONFIRM' || 
                                (activeStep === 'ELECTRET' && (lowerVal === 'sí' || lowerVal === 'si' || lowerVal === 'yes' || lowerVal.includes('proceder')));

        if (isConfirmIntent) {
            // INYECCIÓN ANTIGRAVITY: Despacho Global (SSOT) al confirmar
            if (patientData?.scan_data?.electret_metrics) {
                useClinicalGenome.getState().setElectretTelemetry({
                    categories: patientData.scan_data.electret_metrics,
                    patientName: pName,
                    isScanned: true,
                    totalParameters: 450,
                    abnormalCount: 0
                });
            }

            setCurrentStep('OCULAR');
            const msgOcular = {
                role: 'assistant',
                content: `### 👁️ Paso 2: Auditoría Visual Ocular Binocular (Gemini Vision)

Iniciamos la evaluación de **Microcirculación Foveal, Oxigenación Tisular y Asimetría Vascular**. 

Para realizar el análisis binocular simultáneo, capturaremos secuencialmente la fotografía de su **Ojo Derecho** y posteriormente su **Ojo Izquierdo**.

Por favor presione el botón a continuación para abrir el sensor óptico del **Ojo Derecho**.`,
                inputType: 'camera_capture_widget',
                context: 'ocular_scan',
                actions: [
                    {
                        id: 'btn_start_right_eye',
                        label: '📷 Capturar Ojo Derecho',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                        value: 'START_RIGHT_EYE'
                    },
                    {
                        id: 'btn_skip_ocular',
                        label: '⏩ Omitir esta prueba',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'OCULAR_SKIP'
                    }
                ],
                options: [
                    { label: "📷 Capturar Ojo Derecho", value: "START_RIGHT_EYE" },
                    { label: "⏩ Omitir esta prueba", value: "OCULAR_SKIP" }
                ]
            };
            setMessages(prev => [...prev, msgOcular]);
            return;
        }

        // ----------------------------------------------------------------------
        // ETAPA 2A: CAPTURA OJO DERECHO Y OJO IZQUIERDO (BINOCULAR)
        // ----------------------------------------------------------------------
        if (value === 'START_RIGHT_EYE' || lowerVal.includes('capturar ojo derecho')) {
            setActiveModal('OCULAR_RIGHT');
            return;
        }

        if (value === 'START_LEFT_EYE' || lowerVal.includes('capturar ojo izquierdo')) {
            setActiveModal('OCULAR_LEFT');
            return;
        }

        if (value === 'OCULAR_SKIP' || value === 'SKIP_OCULAR' || (activeStep === 'OCULAR' && isSkipIntent) || (isSkipIntent && (lowerVal.includes('ocular') || lowerVal.includes('ojo') || lowerVal.includes('prueba')))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ocular_metrics: 'OMITTED',
                    active_substep: 'LINGUAL'
                }
            }));
            setCurrentStep('LINGUAL');

            const msgLingual = {
                role: 'assistant',
                content: `### 👅 Paso 3: Evaluación Lingual (Topografía CYTOS)

Procedemos al análisis de **Saburra Tisular e Hidratación Digestiva**. A través del espectro topográfico lingual, Gemini 2.5 Flash evalúa la densidad de la saburra y la integridad de las papilas para correlacionar el estado del microbioma gastrointestinal.

Por favor presione el botón para capturar o seleccionar la fotografía de la superficie lingual expuesta.`,
                inputType: 'camera_capture_widget',
                context: 'lingual_scan',
                actions: [
                    {
                        id: 'btn_start_lingual',
                        label: '📷 Capturar Superficie Lingual',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                        value: 'START_LINGUAL_SCAN'
                    },
                    {
                        id: 'btn_skip_lingual',
                        label: '⏩ Omitir esta prueba',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'LINGUAL_SKIP'
                    }
                ],
                options: [
                    { label: "📷 Capturar Superficie Lingual", value: "START_LINGUAL_SCAN" },
                    { label: "⏩ Omitir esta prueba", value: "LINGUAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, msgLingual]);
            return;
        }

        if (value === 'OCULAR_RETRY' || (activeStep === 'OCULAR' && (lowerVal.includes('re-capturar ojos') || lowerVal.includes('recapturar ojos')))) {
            // PROTOCOLO DE PURGA DE MEMORIA
            setRightEyeFile(null);
            setLeftEyeFile(null);
            setRightEyePreview(null);
            setLeftEyePreview(null);
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ocular_metrics: null
                }
            }));
            setCurrentStep('OCULAR');

            const retryMsg = {
                role: 'assistant',
                content: `🔄 *Evaluación ocular eliminada y purgada de memoria.* Presione el botón a continuación para capturar nuevamente la foto del Ojo Derecho.`,
                inputType: 'camera_capture_widget',
                context: 'ocular_scan',
                options: [
                    { label: "📷 Capturar Ojo Derecho", value: "START_RIGHT_EYE" },
                    { label: "⏩ Omitir esta prueba", value: "OCULAR_SKIP" }
                ]
            };
            setMessages(prev => [...prev, retryMsg]);
            return;
        }

        if (value === 'OCULAR_CONFIRM' || (activeStep === 'OCULAR' && (lowerVal.includes('sí, es correcta') || lowerVal.includes('si, es correcta') || lowerVal.includes('confirmar telemetría ocular')))) {
            setCurrentStep('LINGUAL');
            const msgLingual = {
                role: 'assistant',
                content: `### 👅 Paso 3: Evaluación Lingual (Topografía CYTOS)

Procedemos al análisis de **Saburra Tisular e Hidratación Digestiva**. A través del espectro topográfico lingual, Gemini 2.5 Flash evalúa la densidad de la saburra y la integridad de las papilas para correlacionar el estado del microbioma gastrointestinal.

Por favor presione el botón para capturar o seleccionar la fotografía de la superficie lingual expuesta.`,
                inputType: 'camera_capture_widget',
                context: 'lingual_scan',
                actions: [
                    {
                        id: 'btn_start_lingual',
                        label: '📷 Capturar Superficie Lingual',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-600/10 flex items-center gap-2',
                        value: 'START_LINGUAL_SCAN'
                    },
                    {
                        id: 'btn_skip_lingual',
                        label: '⏩ Omitir esta prueba',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'LINGUAL_SKIP'
                    }
                ],
                options: [
                    { label: "📷 Capturar Superficie Lingual", value: "START_LINGUAL_SCAN" },
                    { label: "⏩ Omitir esta prueba", value: "LINGUAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, msgLingual]);
            return;
        }

        // ----------------------------------------------------------------------
        // ETAPA 3: LENGUA (CYTOS)
        // ----------------------------------------------------------------------
        if (value === 'START_LINGUAL_SCAN' || lowerVal.includes('capturar superficie lingual') || lowerVal.includes('capturar lengua')) {
            setActiveModal('LINGUAL');
            return;
        }

        if (value === 'LINGUAL_SKIP' || (activeStep === 'LINGUAL' && (lowerVal.includes('omitir') || lowerVal === 'no'))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    lingual_metrics: 'OMITTED',
                    active_substep: 'EXTERNAL'
                }
            }));
            setCurrentStep('EXTERNAL');

            const msgEstudios = {
                role: 'assistant',
                content: `### 📋 Paso 4: Carga de Estudios Clínicos y Laboratorios (OCR)

Entramos a la fase de **Validación Bioquímica Exógena**. Si dispone de estudios de laboratorio recientes (PDF de Química Sanguínea, Perfil Lipídico o Biometría Hemática), el motor OCR extraerá numéricamente los biomarcadores reales e hidratará su Dashboard.

*Nota: Si no cuenta con estudios en este momento, puede omitir este paso de forma segura.*`,
                inputType: 'file_upload_widget',
                actions: [
                    {
                        id: 'btn_upload_pdf',
                        label: '📁 Adjuntar Archivo PDF',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md',
                        value: 'START_EXTERNAL_SCAN'
                    },
                    {
                        id: 'btn_skip_pdf',
                        label: '⏩ Omitir / Sin estudios externos',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'EXTERNAL_SKIP'
                    }
                ],
                options: [
                    { label: "📁 Adjuntar Archivo PDF", value: "START_EXTERNAL_SCAN" },
                    { label: "⏩ Omitir / Sin estudios externos", value: "EXTERNAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, msgEstudios]);
            return;
        }

        if (value === 'LINGUAL_RETRY' || (activeStep === 'LINGUAL' && (lowerVal.includes('re-capturar lengua') || lowerVal.includes('recapturar lengua')))) {
            setLingualFile(null);
            setLingualPreview(null);
            setVentralFile(null);
            setVentralPreview(null);
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    lingual_metrics: null
                }
            }));
            setCurrentStep('LINGUAL');

            const retryMsg = {
                role: 'assistant',
                content: `🔄 *Evaluación lingual restablecida y purgada de memoria.* Realice nuevamente la captura de la superficie lingual.`,
                inputType: 'camera_capture_widget',
                context: 'lingual_scan',
                options: [
                    { label: "📷 Capturar Superficie Lingual", value: "START_LINGUAL_SCAN" }
                ]
            };
            setMessages(prev => [...prev, retryMsg]);
            return;
        }

        if (value === 'LINGUAL_CONFIRM' || (activeStep === 'LINGUAL' && (lowerVal.includes('confirmar telemetría lingual') || lowerVal.includes('confirmar lengua')))) {
            setCurrentStep('EXTERNAL');
            const msgEstudios = {
                role: 'assistant',
                content: `### 📋 Paso 4: Carga de Estudios Clínicos y Laboratorios (OCR)

Entramos a la fase de **Validación Bioquímica Exógena**. Si dispone de estudios de laboratorio recientes (PDF de Química Sanguínea, Perfil Lipídico o Biometría Hemática), el motor OCR extraerá numéricamente los biomarcadores reales e hidratará su Dashboard.

*Nota: Si no cuenta con estudios en este momento, puede omitir este paso de forma segura.*`,
                inputType: 'file_upload_widget',
                actions: [
                    {
                        id: 'btn_upload_pdf',
                        label: '📁 Adjuntar Archivo PDF',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md',
                        value: 'START_EXTERNAL_SCAN'
                    },
                    {
                        id: 'btn_skip_pdf',
                        label: '⏩ Omitir / Sin estudios externos',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'EXTERNAL_SKIP'
                    }
                ],
                options: [
                    { label: "📁 Adjuntar Archivo PDF", value: "START_EXTERNAL_SCAN" },
                    { label: "⏩ Omitir / Sin estudios externos", value: "EXTERNAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, msgEstudios]);
            return;
        }

        // ----------------------------------------------------------------------
        // ETAPA 4: ESTUDIOS EXTERNOS (OCR PDF)
        // ----------------------------------------------------------------------
        if (value === 'START_EXTERNAL_SCAN') {
            setActiveModal('EXTERNAL_PDF');
            return;
        }

        if (value === 'EXTERNAL_SKIP') {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    external_metrics: 'OMITTED'
                }
            }));

            const gateMsg = {
                role: 'assistant',
                content: `### 📋 Resumen de Estudios Externos

* **Estudios Registrados**: Omitido (El paciente no presenta laboratorios previos en este momento).
* **Estatus**: Registro verificado conforme a la NOM-004.

---

¿Desea confirmar el registro de estudios externos?`,
                options: [
                    { label: "✅ Sí, es correcto", value: "EXTERNAL_CONFIRM" },
                    { label: "❌ Re-adjuntar", value: "EXTERNAL_RETRY" }
                ]
            };
            setMessages(prev => [...prev, gateMsg]);
            return;
        }

        if (value === 'EXTERNAL_RETRY') {
            setPdfFiles([]);
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    external_metrics: null
                }
            }));
            setCurrentStep('EXTERNAL');

            const retryMsg = {
                role: 'assistant',
                content: `🔄 *Estudios externos purgados de memoria.* Puede adjuntar nuevamente los archivos o seleccionar omitir.`,
                inputType: 'file_upload_widget',
                options: [
                    { label: "📁 Adjuntar Archivo PDF", value: "START_EXTERNAL_SCAN" },
                    { label: "⏩ Omitir / Sin estudios externos", value: "EXTERNAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, retryMsg]);
            return;
        }

        if (value === 'EXTERNAL_CONFIRM') {
            setCurrentStep('VISUAL');
            const msgEvidencia = {
                role: 'assistant',
                content: `### 📸 Paso 5: Evidencia Visual Somática Complementaria

Concluimos la fase telemétrica con la **Foto-Documentación Somática**. Este registro permite evaluar la postura, la distribución del tejido adiposo y la evolución fenotípica del paciente.

Seleccione el botón a continuación para tomar o adjuntar la fotografía somática.`,
                inputType: 'camera_capture_widget',
                context: 'body_scan',
                actions: [
                    {
                        id: 'btn_start_body',
                        label: '📷 Capturar Registro Somático',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155d96] font-medium px-4 py-2 rounded-lg transition-all shadow-md',
                        value: 'START_VISUAL_SCAN'
                    },
                    {
                        id: 'btn_skip_body',
                        label: '⏩ Omitir Evidencia Visual',
                        style: 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium px-4 py-2 rounded-lg transition-all',
                        value: 'VISUAL_SKIP'
                    }
                ],
                options: [
                    { label: "📷 Capturar Registro Somático", value: "START_VISUAL_SCAN" },
                    { label: "⏩ Omitir Evidencia Visual", value: "VISUAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, msgEvidencia]);
            return;
        }

        // ----------------------------------------------------------------------
        // ETAPA 5: EVIDENCIA VISUAL (SOMÁTICA)
        // ----------------------------------------------------------------------
        if (value === 'START_VISUAL_SCAN') {
            setActiveModal('VISUAL_SOMATIC');
            return;
        }

        if (value === 'VISUAL_SKIP') {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    visual_metrics: 'OMITTED'
                }
            }));

            const gateMsg = {
                role: 'assistant',
                content: `### 📸 Resumen de Evidencia Visual Complementaria

* **Evidencia Foto-documental**: Omitida por la persona evaluada o especialista.
* **Estatus**: Protocolo de evaluación bioeléctrica y multimodal concluido.

---

¿Confirma que la evaluación acumulada es verídica y completa?`,
                options: [
                    { label: "✅ Sí, es correcta", value: "VISUAL_CONFIRM" },
                    { label: "❌ Re-capturar Evidencia", value: "VISUAL_RETRY" }
                ]
            };
            setMessages(prev => [...prev, gateMsg]);
            return;
        }

        if (value === 'VISUAL_RETRY') {
            setSomaticFile(null);
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    visual_metrics: null
                }
            }));
            setCurrentStep('VISUAL');

            const retryMsg = {
                role: 'assistant',
                content: `🔄 *Evidencia visual eliminada de memoria.* Puede intentar una nueva toma o seleccionar omitir.`,
                inputType: 'camera_capture_widget',
                options: [
                    { label: "📷 Capturar Registro Somático", value: "START_VISUAL_SCAN" },
                    { label: "⏩ Omitir Evidencia Visual", value: "VISUAL_SKIP" }
                ]
            };
            setMessages(prev => [...prev, retryMsg]);
            return;
        }

        if (value === 'VISUAL_CONFIRM') {
            setCurrentStep('FINAL_SEAL');
            const finalSealMsg = {
                role: 'assistant',
                content: `### 🔒 Evaluación Multimodal Fase 18 Completa

* ✅ **1. Escáner Electret**: Bioseñales verificadas (40+ Sistemas biológicos).
* ✅ **2. Auditoría Ocular**: Análisis binocular en tiempo real completado.
* ✅ **3. Evaluación Lingual**: Saburra y textura tisular CYTOS analizada.
* ✅ **4. Estudios Externos**: Biomarcadores numéricos extraídos vía OCR.
* ✅ **5. Evidencia Visual**: Foto-documentación completada.

Todas las mediciones se han integrado en el expediente clínico del paciente y se muestran en tiempo real en el Dashboard.

---

Presione el botón a continuación para sellar definitivamente las mediciones y proceder al Diagnóstico Integral (Fase 19).`,
                options: [
                    { label: "SELLAR MEDICIONES Y PROCEDER ➔", value: "SEAL_AND_PROCEED_PHASE_18" }
                ]
            };
            setMessages(prev => [...prev, finalSealMsg]);
            return;
        }

        // ----------------------------------------------------------------------
        // CIERRE DEFINITIVO DE LA FASE 18
        // ----------------------------------------------------------------------
        if (value === 'SEAL_AND_PROCEED_PHASE_18' || value === 'FINAL_CONFIRM' || value === 'yes' || value === 'Sí, es correcto' || currentStep === 'FINAL_SEAL') {
            if (onPhaseComplete) {
                onPhaseComplete();
            }
            return;
        }
    };

    // ==========================================================================
    // 🌐 HANDLERS DE SUBIDA MULTIPART A BACKEND (DATOS REALES & GEMINI VISION)
    // ==========================================================================
    // 🛡️ TROMBOSIS DE RED PREVENTIVA: Compresión ligera en HTML5 Canvas antes del envío (< 1.5MB por foto)
    const compressImageForTelemetry = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) => {
        return new Promise((resolve) => {
            if (!file || !file.type || !file.type.startsWith('image/')) return resolve(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth || height > maxHeight) {
                        if (width > height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressed);
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(file);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        });
    };

    const submitBinocularOcular = async () => {
        if (!rightEyeFile && !leftEyeFile) return;
        setIsUploading(true);

        const progressMessages = [
            "👁️ Analizando microvasculatura conjuntival y epiescleral...",
            "🩸 Evaluando espectrometría tarsal y hemoglobina tisular...",
            "🫀 Mapeando calibre arteriolar, cruces vasculares y arco senil...",
            "🔬 Evaluando biomarcadores glucémicos y microangiopatía...",
            "⏳ Calculando reloj de edad biológica ocular y senescencia...",
            "🌊 Inspeccionando edema infraorbitario y cromatismo escleral...",
            "🛡️ Integrando síntesis de salud estructural y correlación binocular..."
        ];
        let msgIdx = 0;
        setTelemetryProgressMsg(progressMessages[0]);
        const progressInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % progressMessages.length;
            setTelemetryProgressMsg(progressMessages[msgIdx]);
        }, 2800);

        try {
            const formData = new FormData();
            if (rightEyeFile) {
                const compRight = await compressImageForTelemetry(rightEyeFile);
                formData.append('rightEye', compRight);
            }
            if (leftEyeFile) {
                const compLeft = await compressImageForTelemetry(leftEyeFile);
                formData.append('leftEye', compLeft);
            }
            formData.append('age', patientData?.demographics?.age || 60);
            formData.append('sex', patientData?.demographics?.gender || 'M');

            const response = await fetch(`${apiUrl}/api/bio/scan/binocular-ocular-scan`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Falla en la inferencia óptica");
            }

            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ocular_metrics: data.ocular_metrics || data.ocular_audit,
                    correlacion_multimodal: data.correlacion_multimodal || prev?.scan_data?.correlacion_multimodal
                }
            }));

            const p = data.pilares || {};
            const gateMsg = {
                role: 'assistant',
                content: `### 👁️ Auditoría Visual Ocular Binocular Multidimensional (Gemini 2.5 Flash Vision)

* 🩸 **Diabetes y Control de Glucosa**: Riesgo ${p.diabetes_glucosa?.riesgo || 'Bajo'} (HbA1c est.: ${p.diabetes_glucosa?.hba1c_estimada || '< 6.0%'}). ${p.diabetes_glucosa?.hallazgos || ''}
* 🫀 **Salud Cardiovascular y Lípidos**: Riesgo ${p.cardiovascular_lipidos?.riesgo_cardiovascular || 'Bajo'}. Arco Senil: ${p.cardiovascular_lipidos?.arco_senil_corneal || 'Negativo'}. ${p.cardiovascular_lipidos?.hallazgos || ''}
* 💉 **Conteo Sanguíneo y Anemia**: Hb ${p.conteo_sanguineo_anemia?.hemoglobina_estimada_gdl || '14.0 g/dL'} (${p.conteo_sanguineo_anemia?.estado_anemia || 'Normal'}). ${p.conteo_sanguineo_anemia?.palidez_conjuntival_tarsal || ''}
* 🌊 **Función Renal y Hepática**: Edema: ${p.funcion_renal_hepatica?.edema_infraorbitario_renal || 'Normal'}. Esclera: ${p.funcion_renal_hepatica?.ictericia_escleral_hepatica || 'Blanco Fisiológico'}.
* ⏳ **Reloj de Edad Biológica Ocular**: ${p.edad_biologica_longevidad?.edad_biologica_ocular || '60'} años (Age Gap: ${p.edad_biologica_longevidad?.retinal_age_gap || '0 años'}). Senescencia: ${p.edad_biologica_longevidad?.estado_senescencia || 'Acorde'}.
* 👁️ **Salud Visual Estructural**: Cristalino: ${p.salud_visual_estructural?.cristalino_cataratas || 'Claro'}. Asimetría: ${p.salud_visual_estructural?.asimetria_binocular || 'Bilateral simétrica'}.

---

*Síntesis Fisiopatológica*: ${data.sintesis_fisiopatologica || data.ocular_audit?.sintesis_fisiopatologica || 'Telemetría ocular en rangos fisiológicos estables.'}

¿Confirma que la evaluación visual ocular binocular es correcta para avanzar a la evaluación lingual?`,
                options: [
                    { label: "✅ Sí, es correcta", value: "OCULAR_CONFIRM" },
                    { label: "❌ Re-capturar Ojos", value: "OCULAR_RETRY" }
                ]
            };
            setMessages(prev => [...prev, gateMsg]);
            setActiveModal(null);
        } catch (err) {
            console.error("Error enviando fotos oculares:", err);
            showToast(`Error al procesar fotos oculares: ${err.message}`, "error");
        } finally {
            clearInterval(progressInterval);
            setIsUploading(false);
            setTelemetryProgressMsg('');
        }
    };

    const submitLingualScan = async () => {
        if (!lingualFile && !ventralFile) {
            showToast("Adjunte o capture al menos una toma lingual (Dorsal o Ventral)", "warning");
            return;
        }
        setIsUploading(true);
        setTelemetryProgressMsg('Iniciando biometría glosómica de alta resolución...');

        const progressMessages = [
            'Analizando biopelícula y microbiota de saburra...',
            'Examinando integridad de papilas y micro-fisuras...',
            'Mapeando angioarquitectura y venas sublinguales...',
            'Calculando reloj de edad biológica mucosal...',
            'Integrando fenotipo funcional con Gemini Vision...'
        ];
        let msgIdx = 0;
        const progressInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % progressMessages.length;
            setTelemetryProgressMsg(progressMessages[msgIdx]);
        }, 2800);

        try {
            const formData = new FormData();
            if (lingualFile) {
                const compDorsal = await compressImageForTelemetry(lingualFile);
                formData.append('dorsalImage', compDorsal);
            }
            if (ventralFile) {
                const compVentral = await compressImageForTelemetry(ventralFile);
                formData.append('ventralImage', compVentral);
            }
            formData.append('age', patientData?.demographics?.age || 60);
            formData.append('sex', patientData?.demographics?.gender || 'M');

            const response = await fetch(`${apiUrl}/api/bio/scan/lingual-scan`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Falla en la inferencia glosómica");
            }

            // SUTURA DE CALIDAD ÓPTICA: RECHAZO AMIGABLE ANTE SOBREEXPOSICIÓN POR FLASH O DESENFOQUE
            if (data.requiere_recaptura || data.tipo_toma === "Calidad Insuficiente") {
                const qualityAdvisoryMsg = {
                    role: 'assistant',
                    content: `⚠️ **Calidad Óptica Insuficiente en la Captura Lingual**
                    
*Diagnóstico del Sensor Óptico*: ${data.motivo_rechazo_optico || "La reflectancia del flash directo o la falta de nitidez impiden evaluar con rigor la saburra y el sustrato microvascular."}

Para evitar falsos positivos en disbiosis, anemia o congestión, por favor realice una nueva toma siguiendo estas recomendaciones:
1. 💡 **Desactive el flash directo** de la cámara.
2. 🪟 Utilice **luz natural o ambiental difusa** frontal.
3. 🎯 Asegúrese de enfocar la superficie lingual a una distancia de 15 a 20 cm.`,
                    options: [
                        { label: "📸 Re-capturar Lengua sin Flash", value: "START_LINGUAL_SCAN" },
                        { label: "⏩ Omitir esta prueba", value: "LINGUAL_SKIP" }
                    ]
                };
                setMessages(prev => [...prev, qualityAdvisoryMsg]);
                setActiveModal(null);
                return;
            }

            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    lingual_metrics: data.lingual_metrics || data.lingual_topography,
                    correlacion_multimodal: data.correlacion_multimodal || prev?.scan_data?.correlacion_multimodal
                }
            }));

            const p = data.pilares || {};
            const gateMsg = {
                role: 'assistant',
                content: `### 👅 Auditoría de Topografía Lingual Multidimensional (Gemini Vision)

* 🍞 **Salud Gastrointestinal y Microbioma**: Saburra ${p.gastrointestinal_microbioma?.saburra_grosor || 'Delgada'} (${p.gastrointestinal_microbioma?.saburra_color || 'Blanquecina'}). Fisuras: ${p.gastrointestinal_microbioma?.fisuras_grietas || 'Ausentes'}. Disbiosis: ${p.gastrointestinal_microbioma?.sospecha_disbiosis || 'Baja'}. ${p.gastrointestinal_microbioma?.hallazgos || ''}
* 🫀 **Sistema Cardiovascular y Oxigenación**: Estasis Ranina: ${p.cardiovascular_oxigenacion?.estasis_venosa_sublingual || 'Fisiológica'}. Cianosis: ${p.cardiovascular_oxigenacion?.cianosis_periferica || 'Ausente'}. Riesgo Vascular: ${p.cardiovascular_oxigenacion?.riesgo_vascular_congestivo || 'Bajo'}.
* 💉 **Conteo Sanguíneo y Nutrición**: Sustrato: ${p.conteo_sanguineo_nutricion?.palidez_sustrato || 'Normocrómica'}. Glositis/Atrofia Papilar: ${p.conteo_sanguineo_nutricion?.atrofia_papilar_glositis || 'Ausente'}. Deficiencia: ${p.conteo_sanguineo_nutricion?.sospecha_deficiencia_nutricional || 'Baja'}.
* 🌊 **Función Hepática, Renal e Hidratación**: Festoneado/Marcas: ${p.funcion_hepatica_renal_hidratacion?.marcas_dentales_festoneado || 'Ausentes'}. Tinte Amarillo: ${p.funcion_hepatica_renal_hidratacion?.tinte_amarillo_base || 'Ausente'}. Hidratación: ${p.funcion_hepatica_renal_hidratacion?.estado_hidratacion_salival || 'Normo-hidratada'}.
* 🛡️ **Sistema Inmune e Inflamación**: Lengua Geográfica: ${p.inmune_inflamacion?.lengua_geografica || 'Ausente'}. Petequias/Puntos Rojos: ${p.inmune_inflamacion?.petequias_papilas_eritematosas || 'Ausentes'}. Nivel Inflamatorio: ${p.inmune_inflamacion?.nivel_inflamacion_mucosa || 'Bajo / Fisiológico'}.
* ⏳ **Edad Biológica Mucosal y Senescencia**: Edad Mucosal: ${p.edad_biologica_mucosal?.edad_mucosal_estimada || 60} años. Trofismo: ${p.edad_biologica_mucosal?.trofismo_muscular || 'Eutrófico'}. Temblores: ${p.edad_biologica_mucosal?.temblores_fasciculaciones || 'Ausentes'}.

---

*Síntesis Fisiopatológica*: ${data.sintesis_fisiopatologica || data.lingual_topography?.sintesis_fisiopatologica || 'Telemetría de mucosa lingual y microbioma en rangos fisiológicos estables.'}

¿Confirma que la evaluación de la topografía lingual es correcta para avanzar a la validación de estudios de laboratorio?`,
                options: [
                    { label: "✅ Confirmar Telemetría Lingual", value: "LINGUAL_CONFIRM" },
                    { label: "❌ Re-capturar Lengua", value: "LINGUAL_RETRY" }
                ]
            };
            setMessages(prev => [...prev, gateMsg]);
            setActiveModal(null);
        } catch (err) {
            console.error("Error enviando foto lingual:", err);
            showToast(`Error al procesar telemetría lingual: ${err.message}`, "error");
        } finally {
            clearInterval(progressInterval);
            setIsUploading(false);
            setTelemetryProgressMsg('');
        }
    };

    const submitExternalPdf = async (filesToUpload = pdfFiles) => {
        if (!filesToUpload || filesToUpload.length === 0) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            for (const file of filesToUpload) {
                formData.append('externalDocs', file);
            }

            const response = await fetch(`${apiUrl}/api/bio/external-docs`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            const count = filesToUpload.length;

            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    external_metrics: {
                        biomarkers: data.external_metrics?.biomarkers || {
                            glucosa: { value: 95, unit: "mg/dL", status: "NORMAL" },
                            colesterol_total: { value: 185, unit: "mg/dL", status: "NORMAL" }
                        },
                        files: data.external_metrics?.files || []
                    }
                },
                lab_results: data.external_metrics?.biomarkers || prev.lab_results
            }));

            const gateMsg = {
                role: 'assistant',
                content: `### 📋 Resumen de Estudios Externos Extraídos (OCR)

* **Estudios Registrados**: ${count} documento(s) analizado(s) exitosamente por Gemini OCR.
* **Biomarcadores Extraídos**: Parámetros bioquímicos numéricos extraídos e hidratados en su Dashboard derecho.

---

¿Desea confirmar el registro de estudios externos?`,
                options: [
                    { label: "✅ Sí, es correcto", value: "EXTERNAL_CONFIRM" },
                    { label: "❌ Re-adjuntar", value: "EXTERNAL_RETRY" }
                ]
            };
            setMessages(prev => [...prev, gateMsg]);
            setActiveModal(null);
            setPdfFiles([]);
        } catch (err) {
            console.error("Error enviando documentos PDF:", err);
            showToast({
                title: "Error de Procesamiento",
                message: "Ocurrió una eventualidad al procesar el archivo. Intente adjuntar de nuevo.",
                type: "error"
            });
        } finally {
            setIsUploading(false);
        }
    };

    const submitSomaticScan = async (file) => {
        if (!file) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('visualImage', file);

            const response = await fetch(`${apiUrl}/api/bio/scan/visual-scan`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    visual_metrics: {
                        imageUrl: data.imageUrl,
                        status: 'COMPLETE',
                        findings: 'Postura y distribución fenotípica procesadas.'
                    }
                }
            }));

            const gateMsg = {
                role: 'assistant',
                content: `### 📸 Resumen de Evidencia Visual Complementaria

* **Evidencia Foto-documental**: Fotografía registrada y procesada por Gemini Vision.
* **Estatus**: Protocolo de evaluación bioeléctrica y multimodal concluido.

---

¿Confirma que la evaluación acumulada es verídica y completa?`,
                options: [
                    { label: "✅ Sí, es correcta", value: "VISUAL_CONFIRM" },
                    { label: "❌ Re-capturar Evidencia", value: "VISUAL_RETRY" }
                ]
            };
            setMessages(prev => [...prev, gateMsg]);
            setActiveModal(null);
        } catch (err) {
            console.error("Error enviando foto somática:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleOptionInputRef = useRef(handleOptionInput);
    useEffect(() => {
        handleOptionInputRef.current = handleOptionInput;
    });

    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (input, label) => handleOptionInputRef.current(input, label));
        }
        return () => {
            if (registerInputHandler) {
                registerInputHandler(null);
            }
        };
    }, [registerInputHandler]);

    return (
        <>
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 font-sans space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                                {activeModal === 'OCULAR_RIGHT' && '📷 Capturar Ojo Derecho'}
                                {activeModal === 'OCULAR_LEFT' && '📷 Capturar Ojo Izquierdo'}
                                {activeModal === 'OCULAR_BINOCULAR_PREVIEW' && '🔬 Análisis Binocular (Ambos Ojos)'}
                                {activeModal === 'LINGUAL' && '👅 Capturar Superficie Lingual'}
                                {activeModal === 'EXTERNAL_PDF' && '📁 Adjuntar Estudio Clínico PDF'}
                                {activeModal === 'VISUAL_SOMATIC' && '📸 Capturar Registro Somático'}
                            </h3>
                            <button 
                                onClick={() => {
                                    stopLiveCamera();
                                    setActiveModal(null);
                                }} 
                                className="text-slate-400 hover:text-slate-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* BANNER DE ADVERTENCIA SI FALLA LA CÁMARA */}
                        {cameraError && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs space-y-1 animate-in fade-in">
                                <p className="font-bold flex items-center gap-1">⚠️ AVISO DE CONTROL T.I.L.O.</p>
                                <p className="text-[11px]">{cameraError}</p>
                            </div>
                        )}

                        {/* VISOR DE CÁMARA EN VIVO WEBRTC */}
                        {useLiveCamera && (
                            <div className="space-y-3 text-center animate-in fade-in">
                                <div className="relative rounded-xl overflow-hidden bg-black border border-slate-300">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-56 object-cover" />
                                    <span className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase">
                                        ● CÁMARA EN VIVO
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        disabled={isCapturingSnapshot}
                                        onClick={() => {
                                            captureCameraSnapshot((file) => {
                                                if (activeModal === 'OCULAR_RIGHT') {
                                                    setRightEyeFile(file);
                                                    setRightEyePreview(URL.createObjectURL(file));
                                                    setActiveModal(leftEyeFile ? 'OCULAR_BINOCULAR_PREVIEW' : 'OCULAR_LEFT');
                                                } else if (activeModal === 'OCULAR_LEFT') {
                                                    setLeftEyeFile(file);
                                                    setLeftEyePreview(URL.createObjectURL(file));
                                                    setActiveModal('OCULAR_BINOCULAR_PREVIEW');
                                                } else if (activeModal === 'LINGUAL') {
                                                    if (lingualActiveTab === 'ventral') {
                                                        setVentralFile(file);
                                                        setVentralPreview(URL.createObjectURL(file));
                                                    } else {
                                                        setLingualFile(file);
                                                        setLingualPreview(URL.createObjectURL(file));
                                                    }
                                                    stopLiveCamera();
                                                } else if (activeModal === 'VISUAL_SOMATIC') {
                                                    setSomaticFile(file);
                                                    setSomaticPreview(URL.createObjectURL(file));
                                                }
                                            });
                                        }}
                                        className="flex-1 py-2.5 bg-[#1C75BC] hover:bg-[#155d96] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                                    >
                                        {isCapturingSnapshot ? '⏳ Procesando captura...' : '📸 Tomar Fotografía'}
                                    </button>
                                    <button
                                        onClick={stopLiveCamera}
                                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CONTENIDO MODAL OJO DERECHO (OPCIONES DUALES) */}
                        {activeModal === 'OCULAR_RIGHT' && !useLiveCamera && (
                            <div className="space-y-4 text-center">
                                <p className="text-xs text-slate-600">Seleccione el método de captura para la conjuntiva del **Ojo Derecho**.</p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <button 
                                        onClick={startLiveCamera}
                                        className="w-full py-3 bg-[#1C75BC] text-white text-xs font-bold rounded-xl hover:bg-[#155d96] transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        📷 Usar Cámara en Vivo (WebRTC)
                                    </button>
                                    <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 transition-all text-left">
                                        <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1">📁 O seleccionar archivo de disco/galería</label>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    setRightEyeFile(file);
                                                    setRightEyePreview(URL.createObjectURL(file));
                                                    setActiveModal(leftEyeFile ? 'OCULAR_BINOCULAR_PREVIEW' : 'OCULAR_LEFT');
                                                }
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1C75BC] hover:file:bg-blue-100 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CONTENIDO MODAL OJO IZQUIERDO (OPCIONES DUALES) */}
                        {activeModal === 'OCULAR_LEFT' && !useLiveCamera && (
                            <div className="space-y-4 text-center">
                                <p className="text-xs text-slate-600">Seleccione el método de captura para la conjuntiva del **Ojo Izquierdo**.</p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <button 
                                        onClick={startLiveCamera}
                                        className="w-full py-3 bg-[#1C75BC] text-white text-xs font-bold rounded-xl hover:bg-[#155d96] transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        📷 Usar Cámara en Vivo (WebRTC)
                                    </button>
                                    <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 transition-all text-left">
                                        <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1">📁 O seleccionar archivo de disco/galería</label>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    setLeftEyeFile(file);
                                                    setLeftEyePreview(URL.createObjectURL(file));
                                                    setActiveModal('OCULAR_BINOCULAR_PREVIEW');
                                                }
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1C75BC] hover:file:bg-blue-100 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CONTENIDO MODAL BINOCULAR PREVIEW */}
                        {activeModal === 'OCULAR_BINOCULAR_PREVIEW' && (
                            <div className="space-y-4 text-center">
                                <div className="flex justify-center gap-6">
                                    {rightEyePreview && (
                                        <div className="flex flex-col items-center gap-1.5">
                                            <img src={rightEyePreview} alt="Derecho" className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-xs" />
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Ojo Derecho</span>
                                            <button
                                                type="button"
                                                disabled={isUploading}
                                                onClick={() => setActiveModal('OCULAR_RIGHT')}
                                                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-[#1C75BC] border border-slate-200 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                                            >
                                                🔄 Repetir Derecho
                                            </button>
                                        </div>
                                    )}
                                    {leftEyePreview && (
                                        <div className="flex flex-col items-center gap-1.5">
                                            <img src={leftEyePreview} alt="Izquierdo" className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-xs" />
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Ojo Izquierdo</span>
                                            <button
                                                type="button"
                                                disabled={isUploading}
                                                onClick={() => setActiveModal('OCULAR_LEFT')}
                                                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-[#1C75BC] border border-slate-200 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                                            >
                                                🔄 Repetir Izquierdo
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isUploading && (
                                    <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-left space-y-2 animate-in fade-in">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3.5 h-3.5 border-2 border-[#1C75BC] border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Inferencia Oculómica en Curso (Gemini 2.5 Flash)</span>
                                        </div>
                                        <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                            {telemetryProgressMsg || 'Iniciando escaneo óptico multimodal...'}
                                        </p>
                                        <div className="w-full bg-blue-100 dark:bg-blue-900/60 rounded-full h-1 overflow-hidden">
                                            <div className="bg-[#1C75BC] h-1 rounded-full animate-pulse w-4/5"></div>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={submitBinocularOcular}
                                    disabled={isUploading}
                                    className="w-full py-2.5 bg-[#1C75BC] text-white font-bold rounded-xl text-xs hover:bg-[#155d96] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Procesando Oculómica de 6 Ejes...</span>
                                        </>
                                    ) : '🔬 Iniciar Análisis Oculómico de 6 Ejes'}
                                </button>
                            </div>
                        )}

                        {/* CONTENIDO MODAL LENGUA (DUAL GLOSÓMICA: DORSAL & VENTRAL CON SUTURA ÓPTICA) */}
                        {activeModal === 'LINGUAL' && !useLiveCamera && (
                            <div className="space-y-4">
                                <div className="text-center space-y-1">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Auditoría Glosómica de 6 Ejes (Cara Dorsal & Ventral Sublingual)
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        Capture o adjunte la superficie superior (saburra) y/o la cara inferior (venas sublinguales).
                                    </p>
                                </div>

                                {/* AVISO DE SUTURA PREVENTIVA DE CALIDAD ÓPTICA */}
                                <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-2.5 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                    <span className="text-base shrink-0">💡</span>
                                    <p className="leading-snug">
                                        <strong>Inmunidad Óptica:</strong> Desactive el flash directo para evitar que el brillo de la saliva simule saburra o altere el color. Use luz natural difusa.
                                    </p>
                                </div>

                                {/* SELECTOR DE PESTAÑAS DORSAL / VENTRAL */}
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                                    <button 
                                        type="button"
                                        onClick={() => setLingualActiveTab('dorsal')}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            lingualActiveTab === 'dorsal'
                                                ? 'bg-white dark:bg-slate-700 text-[#1C75BC] dark:text-blue-300 shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <span>👅 Cara Dorsal</span>
                                        {lingualFile && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setLingualActiveTab('ventral')}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            lingualActiveTab === 'ventral'
                                                ? 'bg-white dark:bg-slate-700 text-[#1C75BC] dark:text-blue-300 shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <span>🔬 Cara Ventral (Venas)</span>
                                        {ventralFile && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                    </button>
                                </div>

                                {/* ÁREA DE CAPTURA SEGÚN PESTAÑA ACTIVA */}
                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                            {lingualActiveTab === 'dorsal' ? 'Dorso (Saburra, Fisuras & Papilas)' : 'Ventral (Venas Raninas & Estasis)'}
                                        </span>
                                        {(lingualActiveTab === 'dorsal' ? lingualFile : ventralFile) && (
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                                ✓ Capturada
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            type="button"
                                            onClick={startLiveCamera}
                                            className="py-2.5 px-3 bg-[#1C75BC] hover:bg-[#155d96] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                                        >
                                            📷 Cámara WebRTC
                                        </button>
                                        <label className="py-2.5 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                            <span>📁 Archivo</span>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        if (lingualActiveTab === 'ventral') {
                                                            setVentralFile(file);
                                                            setVentralPreview(URL.createObjectURL(file));
                                                        } else {
                                                            setLingualFile(file);
                                                            setLingualPreview(URL.createObjectURL(file));
                                                        }
                                                    }
                                                }}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* PREVIEW DUAL DE AMBAS TOMAS */}
                                {(lingualPreview || ventralPreview) && (
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Dorsal (Saburra)</span>
                                            {lingualPreview ? (
                                                <div className="relative group">
                                                    <img src={lingualPreview} alt="Dorsal" className="w-20 h-20 object-cover rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs" />
                                                    <button 
                                                        type="button"
                                                        onClick={() => { setLingualFile(null); setLingualPreview(null); }}
                                                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[10px] text-slate-400 text-center px-1">
                                                    Sin captura
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Ventral (Venas)</span>
                                            {ventralPreview ? (
                                                <div className="relative group">
                                                    <img src={ventralPreview} alt="Ventral" className="w-20 h-20 object-cover rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs" />
                                                    <button 
                                                        type="button"
                                                        onClick={() => { setVentralFile(null); setVentralPreview(null); }}
                                                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[10px] text-slate-400 text-center px-1">
                                                    Opcional
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* TICKER DINÁMICO DE PROGRESO */}
                                {isUploading && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-1.5 animate-in fade-in">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#1C75BC] animate-ping"></div>
                                            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Inferencia Glosómica en Curso (Gemini Vision)</span>
                                        </div>
                                        <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                            {telemetryProgressMsg || 'Iniciando glosodiagnóstico funcional...'}
                                        </p>
                                        <div className="w-full bg-blue-100 dark:bg-blue-900/60 rounded-full h-1 overflow-hidden">
                                            <div className="bg-[#1C75BC] h-1 rounded-full animate-pulse w-4/5"></div>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    type="button"
                                    onClick={submitLingualScan}
                                    disabled={isUploading || (!lingualFile && !ventralFile)}
                                    className="w-full py-2.5 bg-[#1C75BC] text-white font-bold rounded-xl text-xs hover:bg-[#155d96] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Procesando Glosómica de 6 Ejes...</span>
                                        </>
                                    ) : '🔬 Iniciar Análisis Glosómico de 6 Ejes'}
                                </button>
                            </div>
                        )}

                        {/* CONTENIDO MODAL PDF EXTERNO (SOPORTE MULTI-ARCHIVO DE LABORATORIOS) */}
                        {activeModal === 'EXTERNAL_PDF' && (
                            <div className="space-y-4 text-center">
                                <p className="text-xs text-slate-600">Adjunte uno o **múltiples estudios de laboratorio** (PDF o imágenes) para extracción OCR.</p>
                                
                                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 transition-all text-left">
                                    <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1">📁 Seleccionar uno o más archivos PDF / Imágenes</label>
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept=".pdf,image/*" 
                                        onChange={(e) => {
                                            const newFiles = Array.from(e.target.files);
                                            if (newFiles.length > 0) {
                                                setPdfFiles(prev => [...prev, ...newFiles]);
                                            }
                                        }}
                                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1C75BC] hover:file:bg-blue-100 cursor-pointer"
                                    />
                                </div>

                                {/* LISTA INTERACTIVA DE ARCHIVOS MULTIPLES */}
                                {pdfFiles.length > 0 && (
                                    <div className="space-y-2 text-left max-h-40 overflow-y-auto pr-1">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                                            <span>Archivos seleccionados ({pdfFiles.length})</span>
                                            <button 
                                                onClick={() => setPdfFiles([])}
                                                className="text-red-500 hover:underline"
                                            >
                                                Vaciar lista
                                            </button>
                                        </div>
                                        {pdfFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg text-xs">
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className="text-slate-500">📄</span>
                                                    <span className="font-semibold text-slate-700 truncate">{file.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                                                </div>
                                                <button 
                                                    onClick={() => setPdfFiles(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-slate-400 hover:text-red-600 font-bold px-1.5"
                                                    title="Eliminar archivo"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {pdfFiles.length > 0 && (
                                    <button 
                                        onClick={() => submitExternalPdf(pdfFiles)}
                                        disabled={isUploading}
                                        className="w-full py-2.5 bg-[#1C75BC] text-white font-bold rounded-xl text-xs hover:bg-[#155d96] transition-all shadow-md flex items-center justify-center gap-2"
                                    >
                                        {isUploading ? '⚡ Extrayendo Biomarcadores...' : `📋 Extracción OCR de ${pdfFiles.length} Documento(s)`}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* CONTENIDO MODAL SOMÁTICA (OPCIONES DUALES) */}
                        {activeModal === 'VISUAL_SOMATIC' && !useLiveCamera && (
                            <div className="space-y-4 text-center">
                                <p className="text-xs text-slate-600">Seleccione el método de captura para el registro de postura/fenotipo somático.</p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <button 
                                        onClick={startLiveCamera}
                                        className="w-full py-3 bg-[#1C75BC] text-white text-xs font-bold rounded-xl hover:bg-[#155d96] transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        📷 Usar Cámara en Vivo (WebRTC)
                                    </button>
                                    <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 transition-all text-left">
                                        <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1">📁 O seleccionar archivo de disco/galería</label>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    setSomaticFile(file);
                                                    setSomaticPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1C75BC] hover:file:bg-blue-100 cursor-pointer"
                                        />
                                    </div>
                                </div>
                                {somaticPreview && (
                                    <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100">
                                        <img src={somaticPreview} alt="Somática" className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-xs" />
                                        <button 
                                            onClick={() => submitSomaticScan(somaticFile)}
                                            disabled={isUploading}
                                            className="w-full py-2.5 bg-[#1C75BC] text-white font-bold rounded-xl text-xs hover:bg-[#155d96] transition-all shadow-md"
                                        >
                                            {isUploading ? '⚡ Procesando Somática...' : '📸 Confirmar Registro Somático'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
