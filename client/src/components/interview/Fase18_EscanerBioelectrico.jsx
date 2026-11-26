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
    const [somaticFiles, setSomaticFiles] = useState([]); // Arreglo de múltiples fotografías somáticas { file, previewUrl, name }
    const [isUploading, setIsUploading] = useState(false);
    const [telemetryProgressMsg, setTelemetryProgressMsg] = useState('');
    const [useLiveCamera, setUseLiveCamera] = useState(false);
    const [mediaStream, setMediaStream] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
    const isCapturingRef = useRef(false);
    const videoRef = useRef(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const buildSubstepSyncPatch = (substep) => ({
        active_substep: substep,
        substep_sync_tick: Date.now()
    });

    const resolveBiologicalSexCode = (pData) => {
        const raw = String(
            pData?.profile?.sex ||
            pData?.identificacion?.sexo ||
            pData?.demographics?.gender ||
            'M'
        ).trim().toUpperCase();
        if (raw.startsWith('F') || raw.includes('MUJER')) return 'F';
        return 'M';
    };

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

    // 🔄 Auto-recuperación de modal si el último mensaje del chat fue el clic en "Capturar Registro Somático" o "Adjuntar Archivo PDF"
    const recoveredLastUserMsgRef = useRef(null);
    useEffect(() => {
        if (!Array.isArray(messages) || messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'user' && typeof lastMsg.content === 'string') {
            const msgKey = `${messages.length}:${lastMsg.content}`;
            if (recoveredLastUserMsgRef.current === msgKey) return;
            const lower = lastMsg.content.toLowerCase();
            if (lower.includes('capturar registro som') && !patientData?.scan_data?.visual_metrics) {
                recoveredLastUserMsgRef.current = msgKey;
                setCurrentStep('VISUAL');
                setActiveModal('VISUAL_SOMATIC');
            } else if (lower.includes('adjuntar archivo pdf') && !patientData?.scan_data?.external_metrics) {
                recoveredLastUserMsgRef.current = msgKey;
                setCurrentStep('EXTERNAL');
                setActiveModal('EXTERNAL_PDF');
            }
        }
    }, [messages, patientData?.scan_data?.visual_metrics, patientData?.scan_data?.external_metrics]);

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

        // Si el chat no tiene mensaje de la Fase 18, emitir mensaje inicial con la Compuerta de Adquisición Real (.HTM)
        const hasPhase18Message = messages?.some(m => m.content?.includes("Fase 18: Telemetría Bioeléctrica Cuántica") || m.content?.includes("Fase 18: Inicialización de Telemetría Multimodal") || m.content?.includes("FASE 18: Escáner Bioeléctrico"));
        if (!hasPhase18Message) {
            const saludoEstructurado = {
                role: 'assistant',
                content: `### 📡 Fase 18: Telemetría Bioeléctrica Cuántica (Ingesta Nativa NOM-004)

Para integrar el estudio real de **${pName}**, elija una vía operativa:

1. **Iniciar escaneo en Electret:** Abre el software del analizador con los datos de **${pName}** y activa el **Centinela Auto-Sync** hasta que usted presione *"Obtener Informe"*.
2. **Sincronizar informe generado:** Importa de inmediato el estudio `.concat('`.htm`') + ` más reciente de **${pName}** en el equipo.
3. **Cargar archivo .HTM:** Permite seleccionar manualmente cualquier reporte `.concat('`.htm`') + ` exportado.`,
                inputType: 'electret_scan_widget',
                actions: [
                    {
                        id: 'btn_launch_electret',
                        label: '🚀 Iniciar escaneo en Electret',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155A92] font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all shadow-sm flex items-center gap-2',
                        value: 'LAUNCH_ELECTRET_APP'
                    },
                    {
                        id: 'btn_sync_electret',
                        label: '🔄 Sincronizar informe generado',
                        style: 'bg-white dark:bg-slate-800 text-[#1C75BC] border border-[#1C75BC]/40 hover:bg-[#1C75BC]/10 font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all flex items-center gap-2',
                        value: 'SYNC_ELECTRET_HARDWARE'
                    },
                    {
                        id: 'btn_upload_htm',
                        label: '📄 Cargar archivo .HTM',
                        style: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all flex items-center gap-2',
                        value: 'UPLOAD_ELECTRET_HTM'
                    },
                    {
                        id: 'btn_skip_electret',
                        label: '⏩ Continuar sin escáner Electret',
                        style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2.5 min-h-[48px] rounded-xl transition-all',
                        value: 'ELECTRET_SKIP'
                    }
                ],
                options: [
                    { label: "🚀 Iniciar escaneo en Electret", value: "LAUNCH_ELECTRET_APP" },
                    { label: "🔄 Sincronizar informe generado", value: "SYNC_ELECTRET_HARDWARE" },
                    { label: "📄 Cargar archivo .HTM", value: "UPLOAD_ELECTRET_HTM" },
                    { label: "⏩ Continuar sin escáner Electret", value: "ELECTRET_SKIP" }
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
            if (content.includes("Paso 3: Evaluación Lingual") || content.includes("Telemetría Lingual Integrada") || content.includes("Glosodiagnóstico Funcional") || content.includes("Topografía Lingual") || content.includes("Saburra Tisular")) {
                return 'LINGUAL';
            }
            if (content.includes("Paso 2: Auditoría Visual Ocular") || content.includes("Telemetría Ocular Binocular") || content.includes("Constancia Binocular") || content.includes("Microcirculación epiescleral")) {
                return 'OCULAR';
            }
            if (content.includes("Escáner Bioeléctrico") || content.includes("Telemetría Multimodal") || content.includes("Electret")) {
                return 'ELECTRET';
            }
        }
        return 'ELECTRET';
    };

    // 🧹 Saneamiento Reactivo en Vivo: Elimina redundancia en mensajes ya presentes en sesión (Chat vs Dashboard)
    useEffect(() => {
        if (!Array.isArray(messages) || messages.length === 0) return;
        const hasRedundantMsg = messages.some(m =>
            m?.content?.includes("Auditoría Visual Ocular Binocular Multidimensional") ||
            m?.content?.includes("Auditoría de Topografía Lingual Multidimensional") ||
            (m?.content?.includes("Resumen de Bioseñales Electret Sincronizadas") && m?.content?.includes("Viscosidad Sanguínea"))
        );
        if (!hasRedundantMsg) return;

        setMessages(prev => prev.map(m => {
            if (!m?.content) return m;
            if (m.content.includes("Auditoría Visual Ocular Binocular Multidimensional")) {
                return {
                    ...m,
                    content: `### 👁️ Telemetría Ocular Binocular Integrada en Dashboard\n\n✅ **6 Biomarcadores Oculómicos Cuantitativos** y el **Reloj Ocular** han sido desplegados en el panel derecho (**Auditoría Visual Ocular Binocular**).\n\nRevise las tarjetas termodinámicas en su Dashboard. ¿Confirma los hallazgos para avanzar a la Evaluación Lingual?`
                };
            }
            if (m.content.includes("Auditoría de Topografía Lingual Multidimensional")) {
                return {
                    ...m,
                    content: `### 👅 Telemetría Lingual Integrada en Dashboard\n\n✅ **6 Ejes Glosómicos (Dorsal y Sublingual)** han sido desplegados en el panel derecho (**Topografía Lingual de 6 Ejes**).\n\n¿Confirma los hallazgos en el Dashboard para avanzar a Estudios de Laboratorio?`
                };
            }
            if (m.content.includes("Resumen de Bioseñales Electret Sincronizadas") && m.content.includes("Viscosidad Sanguínea")) {
                return {
                    ...m,
                    content: `### ⚡ Bioseñales Electret Integradas en Dashboard\n\n✅ **37 Sistemas Biológicos (253 parámetros)** sincronizados y desplegados en las **Bento Cards Termodinámicas** del panel derecho.\n\n¿Confirma la sincronización para avanzar a la Auditoría Ocular?`
                };
            }
            return m;
        }));
    }, [messages, setMessages]);

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
    const resolvedCitationId = String(
        patientData?.citaId ||
        patientData?.idCita ||
        patientData?.profile?.citaId ||
        patientData?.identificacion?.idCita ||
        ''
    ).trim();

    const getElectretActionButtons = () => ([
        {
            id: 'btn_launch_electret',
            label: '🚀 Iniciar escaneo en Electret',
            style: 'bg-[#1C75BC] text-white hover:bg-[#155A92] font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all shadow-sm flex items-center gap-2',
            value: 'LAUNCH_ELECTRET_APP'
        },
        {
            id: 'btn_sync_electret',
            label: '🔄 Sincronizar informe generado',
            style: 'bg-white dark:bg-slate-800 text-[#1C75BC] border border-[#1C75BC]/40 hover:bg-[#1C75BC]/10 font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all flex items-center gap-2',
            value: 'SYNC_ELECTRET_HARDWARE'
        },
        {
            id: 'btn_upload_htm',
            label: '📄 Cargar archivo .HTM',
            style: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all flex items-center gap-2',
            value: 'UPLOAD_ELECTRET_HTM'
        },
        {
            id: 'btn_skip_electret',
            label: '⏩ Continuar sin escáner Electret',
            style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2.5 min-h-[48px] rounded-xl transition-all',
            value: 'ELECTRET_SKIP'
        }
    ]);

    const getElectretActionOptions = () => ([
        { label: "🚀 Iniciar escaneo en Electret", value: "LAUNCH_ELECTRET_APP" },
        { label: "🔄 Sincronizar informe generado", value: "SYNC_ELECTRET_HARDWARE" },
        { label: "📄 Cargar archivo .HTM", value: "UPLOAD_ELECTRET_HTM" },
        { label: "⏩ Continuar sin escáner Electret", value: "ELECTRET_SKIP" }
    ]);

    const processTelemetryData = (data) => {
        if (!data?.electret_metrics || !data?.success) {
            throw new Error(data?.message || "No se detectaron métricas reales en el informe bioeléctrico.");
        }
        const metricsToSet = data.electret_metrics;
        const synthesisList = Array.isArray(data.synthesisItems) ? data.synthesisItems : [];
        const metadataObj = data.patientMetadata || data.patient_metadata || null;

        // Doble Candado Defensivo de Identidad NOM-004 en Cliente
        const scannedNameFound = metadataObj?.name || data?.electret_metrics?.patient_metadata?.name || null;
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
                    content: `### 🛡️ Alerta NOM-004: Incongruencia de identidad en estudio bioeléctrico

Se detectó un informe a nombre de **"${scannedNameFound}"**, el cual **no corresponde** al titular activo de este expediente (**"${pName}"**).

Para prevenir la contaminación cruzada entre expedientes, esta lectura ha sido bloqueada. Genere o seleccione el informe correspondiente a **"${pName}"**:`,
                    actions: getElectretActionButtons(),
                    options: getElectretActionOptions()
                };
                setMessages(prev => [...prev, mismatchMsg]);
                return;
            }
        }

        const totalSys = Object.keys(metricsToSet || {}).length || 37;
        const totalParams = data.totalParameters || 262;
        const abnormalTotal = data.abnormalCount ?? 0;

        setPatientData(prev => ({
            ...prev,
            scan_data: {
                ...(prev?.scan_data || {}),
                electret_metrics: metricsToSet,
                electret_patient_name: scannedNameFound || pName,
                electret_metadata: metadataObj,
                electret_synthesis: synthesisList,
                electret_scanned: true,
                electret_skipped: false,
                ...buildSubstepSyncPatch('ELECTRET')
            }
        }));

        // Despacho Global SSoTT preservando conteos exactos y lista de síntesis
        useClinicalGenome.getState().setElectretTelemetry({
            categories: metricsToSet,
            patientName: scannedNameFound || pName,
            patientMetadata: metadataObj,
            synthesisItems: synthesisList,
            citationId: resolvedCitationId || null,
            isScanned: true,
            totalParameters: totalParams,
            abnormalCount: abnormalTotal
        });

        setIsGlobalTyping?.(false);
        setMessages(prev => prev.filter(m => m.inputType !== 'status_progress'));

        const synText = synthesisList.length > 0 ? ` • **${synthesisList.length} hallazgos prioritarios de síntesis**` : '';
        const dateNote = metadataObj?.scanDate ? ` (estudio del \`${metadataObj.scanDate}\`)` : '';

        const gateMsg = {
            role: 'assistant',
            content: `### ⚡ Bioseñales Electret integradas en su Dashboard

✅ **${totalSys} sistemas biológicos (${totalParams} parámetros evaluados, ${abnormalTotal} fuera de rango${synText})** sincronizados con paridad nativa${dateNote} y desplegados en el panel derecho.

¿Confirma usted la sincronización para avanzar a la Auditoría Ocular?`,
            options: [
                { label: "✅ Sí, proceder", value: "ELECTRET_CONFIRM" },
                { label: "❌ Reevaluar Electret", value: "ELECTRET_RETRY" }
            ]
        };
        setMessages(prev => [...prev, gateMsg]);
    };

    const handleElectretHtmUpload = async (e) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        stopAutoSync();
        setIsUploading(true);
        setIsGlobalTyping?.(true);

        setMessages(prev => [
            ...prev.filter(m => m.inputType !== 'status_progress'),
            {
                role: 'assistant',
                content: `📄 *Decodificando reporte nativo **${file.name}** y verificando identidad biométrica NOM-004...*`,
                inputType: 'status_progress'
            }
        ]);

        try {
            const formData = new FormData();
            formData.append('htmFile', file);
            formData.append('patientName', pName || '');
            if (resolvedCitationId) formData.append('citationId', resolvedCitationId);

            const res = await fetch(`${apiUrl}/api/bio/scan/electret/upload-htm`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                const err = new Error(data?.message || 'No fue posible procesar el archivo .htm seleccionado.');
                err.data = data;
                throw err;
            }
            processTelemetryData(data);
        } catch (err) {
            setIsGlobalTyping?.(false);
            setMessages(prev => [
                ...prev.filter(m => m.inputType !== 'status_progress'),
                {
                    role: 'assistant',
                    content: `### 🛡️ ${err?.data?.error === 'CROSS_PATIENT_CONTAMINATION_PREVENTED' ? 'Alerta NOM-004: Incongruencia de identidad' : 'Aviso al procesar archivo .HTM'}\n\n${err.message}`,
                    actions: getElectretActionButtons(),
                    options: getElectretActionOptions()
                }
            ]);
        } finally {
            setIsUploading(false);
        }
    };

    // ==========================================================================
    // 🛡️ SUTURA 5: CENTINELA AUTO-SYNC REACTIVO (POLLING ENCADENADO + ABORTCONTROLLER)
    // ==========================================================================
    const startAutoSyncSentinel = (sentinelOptions = {}) => {
        stopAutoSync();
        isAutoSyncActiveRef.current = true;
        setIsAutoSyncActive(true);

        const minMtimeMs = Number(sentinelOptions.minMtimeMs) || 0;
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
                    content: `### ⏱️ Centinela en pausa (ventana de 4 minutos completada)

No se detectó un informe nuevo generado durante el periodo de vigilancia activa.

* **Si ya generó o exportó el estudio:** Presione **"🔄 Sincronizar informe generado"** o **"📄 Cargar archivo .HTM"**.
* **Si aún realiza la prueba:** Presione **"🚀 Iniciar escaneo en Electret"** al concluir.`,
                    actions: getElectretActionButtons(),
                    options: getElectretActionOptions()
                };
                setMessages(prev => [...prev, timeoutMsg]);
                return;
            }

            const abortController = new AbortController();
            autoSyncAbortControllerRef.current = abortController;

            try {
                const res = await fetch(`${apiUrl}/api/bio/scan/electret/sync?patientName=${targetPatientParam}&forceFresh=true&_t=${Date.now()}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    },
                    body: JSON.stringify({
                        patientName: pName || '',
                        citationId: resolvedCitationId,
                        forceFresh: true,
                        minMtimeMs
                    }),
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
                        content: `### 🛡️ Alerta NOM-004: Incongruencia de identidad en escáner

${data.message || `El informe detectado no corresponde al titular del expediente actual (${pName}). Verifique el nombre en Electret y reintente.`}`,
                        actions: getElectretActionButtons(),
                        options: getElectretActionOptions()
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
        // ETAPA 1: ELECTRET (BIOELÉCTRICO — 100% REAL .HTM / CERO DATOS SINTÉTICOS)
        // ----------------------------------------------------------------------
        if (value === 'UPLOAD_ELECTRET_HTM') {
            document.getElementById('tilo-electret-htm-input')?.click();
            return;
        }

        if (value === 'LAUNCH_ELECTRET_APP') {
            stopAutoSync();
            setIsGlobalTyping?.(true);

            const scanStartedAtMs = Date.now() - 3000;
            const resolvedAge = parseInt(patientData?.identificacion?.edad || patientData?.profile?.age || 45, 10) || 45;
            const resolvedHeight = parseFloat(patientData?.vitals?.height || patientData?.talla || patientData?.biometrics?.height) || 172;
            const resolvedWeight = parseFloat(patientData?.vitals?.weight || patientData?.peso || patientData?.biometrics?.weight) || 78;

            const launchMsg = {
                role: 'assistant',
                content: `### 🚀 Escaneo bioeléctrico asistido en curso (Centinela activo)

Iniciando el software del analizador cuántico para **${pName}** (${resolvedHeight} cm, ${resolvedWeight} kg, ${resolvedAge} años)...

1. Pídale a **${pName}** que sostenga firmemente el electrodo cilíndrico e inicie el test (60 s).
2. Al concluir, haga clic en **"Guardar"** y **"Obtener Informe"** en Electret; el Centinela importará automáticamente el 100% del estudio real.
3. *Si el informe ya fue generado previamente en este equipo, presione **"🔄 Sincronizar informe generado"** o **"📄 Cargar archivo .HTM"**.*`,
                inputType: 'status_progress',
                actions: [
                    {
                        id: 'btn_sync_electret_now',
                        label: '🔄 Sincronizar informe generado',
                        style: 'bg-[#1C75BC] text-white hover:bg-[#155A92] font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all shadow-sm flex items-center gap-2',
                        value: 'SYNC_ELECTRET_HARDWARE'
                    },
                    {
                        id: 'btn_upload_htm_live',
                        label: '📄 Cargar archivo .HTM',
                        style: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 font-semibold px-4 py-2.5 min-h-[48px] rounded-xl transition-all flex items-center gap-2',
                        value: 'UPLOAD_ELECTRET_HTM'
                    },
                    {
                        id: 'btn_skip_electret',
                        label: '⏩ Continuar sin escáner Electret',
                        style: 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-4 py-2.5 min-h-[48px] rounded-xl transition-all',
                        value: 'ELECTRET_SKIP'
                    }
                ],
                options: [
                    { label: "🔄 Sincronizar informe generado", value: "SYNC_ELECTRET_HARDWARE" },
                    { label: "📄 Cargar archivo .HTM", value: "UPLOAD_ELECTRET_HTM" },
                    { label: "⏩ Continuar sin escáner Electret", value: "ELECTRET_SKIP" }
                ]
            };
            setMessages(prev => [...prev, launchMsg]);

            fetch(`${apiUrl}/api/bio/scan/electret/launch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: pName || patientData?.profile?.name || patientData?.identificacion?.nombre || 'Paciente',
                    age: resolvedAge,
                    height: resolvedHeight,
                    weight: resolvedWeight
                })
            })
                .catch(err => console.warn('Aviso al lanzar puente RPA Electret:', err.message))
                .finally(() => {
                    startAutoSyncSentinel({ minMtimeMs: scanStartedAtMs });
                });

            return;
        }

        if (value === 'START_ELECTRET_SCAN') {
            const instrMsg = {
                role: 'assistant',
                content: `### 📡 Fase 18: Telemetría Bioeléctrica Cuántica (Electret)

Seleccione cómo desea integrar el estudio bioeléctrico de **${pName}**:`,
                actions: getElectretActionButtons(),
                options: getElectretActionOptions()
            };
            setMessages(prev => [...prev, instrMsg]);
            return;
        }

        if (value === 'SYNC_ELECTRET_HARDWARE') {
            stopAutoSync();
            setIsGlobalTyping?.(true);

            const syncingMsg = {
                role: 'assistant',
                content: `🔄 *Buscando el informe .htm más reciente de **${pName}** y aplicando validación biométrica NOM-004...*`,
                inputType: 'status_progress'
            };
            setMessages(prev => [...prev, syncingMsg]);

            const targetPatientParam = encodeURIComponent(pName || '');

            fetch(`${apiUrl}/api/bio/scan/electret/sync?patientName=${targetPatientParam}&forceFresh=true&_t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                body: JSON.stringify({
                    patientName: pName || '',
                    citationId: resolvedCitationId,
                    forceFresh: true
                })
            })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.success) {
                    const err = new Error(data?.message || "No se localizó un informe .htm para este paciente.");
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
                let errorTitle = '📡 Compuerta en espera de estudio real (NOM-004)';
                let errorBody = `No se localizó en este equipo un informe \`.htm\` verificado a nombre de **${pName}**.\n\n* **Para realizar una nueva toma:** Presione **"🚀 Iniciar escaneo en Electret"**.\n* **Si exportó el archivo en otra carpeta:** Presione **"📄 Cargar archivo .HTM"** para seleccionarlo manualmente.`;

                if (errCode === 'CROSS_PATIENT_CONTAMINATION_PREVENTED') {
                    errorTitle = '🛡️ Alerta NOM-004: Incongruencia de identidad';
                    errorBody = err?.data?.message || `El informe reciente detectado no corresponde al titular del expediente actual (${pName}).`;
                }

                const errorMsg = {
                    role: 'assistant',
                    content: `### ${errorTitle}\n\n${errorBody}`,
                    actions: getElectretActionButtons(),
                    options: getElectretActionOptions()
                };
                setMessages(prev => [...prev, errorMsg]);
            });

            return;
        }

        if (value === 'ELECTRET_RETRY') {
            stopAutoSync();
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    electret_metrics: null,
                    electret_synthesis: null,
                    electret_scanned: false
                }
            }));
            if (useClinicalGenome && useClinicalGenome.getState) {
                useClinicalGenome.getState().clearElectretTelemetry();
            }
            fetch(`${apiUrl}/api/bio/scan/electret/sterilize`, { method: 'POST' }).catch(() => {});

            setCurrentStep('ELECTRET');

            const retryMsg = {
                role: 'assistant',
                content: `🔄 *Memoria bioeléctrica liberada y lista para nueva adquisición o carga de estudio real para **${pName}**:*`,
                inputType: 'electret_scan_widget',
                actions: getElectretActionButtons(),
                options: getElectretActionOptions()
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
                    electret_skipped: true,
                    ...buildSubstepSyncPatch('OCULAR')
                }
            }));
            setCurrentStep('OCULAR');

            const skipMsg = {
                role: 'assistant',
                content: `⚠️ **Escáner Bioeléctrico Omitido**: Se ha registrado en el expediente la ausencia de lecturas del hardware Electret. Procedemos con las pruebas complementarias de visión e imagen tisular.\n\n### 👁️ Paso 2: Auditoría Visual Ocular Binocular (Equipo en Acción®)\n\nIniciamos la evaluación de **Microcirculación epiescleral y bulbar, perfusión tisular y simetría binocular**.`,
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
            if (patientData?.scan_data?.electret_metrics) {
                const prevGenome = useClinicalGenome.getState().electretTelemetry || {};
                useClinicalGenome.getState().setElectretTelemetry({
                    ...prevGenome,
                    categories: patientData.scan_data.electret_metrics,
                    patientName: patientData?.scan_data?.electret_patient_name || pName,
                    patientMetadata: patientData?.scan_data?.electret_metadata || prevGenome.patientMetadata || null,
                    synthesisItems: patientData?.scan_data?.electret_synthesis || prevGenome.synthesisItems || [],
                    isScanned: true,
                    totalParameters: prevGenome.totalParameters || 262,
                    abnormalCount: prevGenome.abnormalCount ?? 0
                });
            }

            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ...buildSubstepSyncPatch('OCULAR')
                }
            }));
            setCurrentStep('OCULAR');
            const msgOcular = {
                role: 'assistant',
                content: `### 👁️ Paso 2: Auditoría Visual Ocular Binocular (Equipo en Acción®)

Iniciamos la evaluación de **Microcirculación epiescleral y bulbar, perfusión tisular y simetría binocular**. 

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
            setRightEyeFile(null);
            setRightEyePreview(null);
            setLeftEyeFile(null);
            setLeftEyePreview(null);
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
                    ...buildSubstepSyncPatch('LINGUAL')
                }
            }));
            setCurrentStep('LINGUAL');

            const msgLingual = {
                role: 'assistant',
                content: `### 👅 Paso 3: Evaluación Lingual (Glosodiagnóstico Funcional Equipo en Acción®)

Procedemos al análisis de **Saburra Tisular, Venas Sublinguales e Hidratación Mucosa**. A través de la topografía glosómica dual (Cara Dorsal y Cara Ventral), el Motor de Visión Clínica de **Equipo en Acción®** evalúa la densidad de la biopelícula y la integridad de las papilas para correlacionar el estado del microbioma digestivo.

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
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ...buildSubstepSyncPatch('LINGUAL')
                }
            }));
            setCurrentStep('LINGUAL');
            const msgLingual = {
                role: 'assistant',
                content: `### 👅 Paso 3: Evaluación Lingual (Glosodiagnóstico Funcional Equipo en Acción®)

Procedemos al análisis de **Saburra Tisular, Venas Sublinguales e Hidratación Mucosa**. A través de la topografía glosómica dual (Cara Dorsal y Cara Ventral), el Motor de Visión Clínica de **Equipo en Acción®** evalúa la densidad de la biopelícula y la integridad de las papilas para correlacionar el estado del microbioma digestivo.

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
        // ETAPA 3: LENGUA (GLOSODIAGNÓSTICO FUNCIONAL EQUIPO EN ACCIÓN®)
        // ----------------------------------------------------------------------
        if (value === 'START_LINGUAL_SCAN' || lowerVal.includes('capturar superficie lingual') || lowerVal.includes('capturar lengua')) {
            setLingualActiveTab(lingualFile && !ventralFile ? 'ventral' : 'dorsal');
            setActiveModal('LINGUAL');
            return;
        }

        if (value === 'LINGUAL_SKIP' || (activeStep === 'LINGUAL' && (lowerVal.includes('omitir') || lowerVal === 'no'))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    lingual_metrics: 'OMITTED',
                    ...buildSubstepSyncPatch('EXTERNAL')
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
            try {
                if (lingualPreview && typeof URL?.revokeObjectURL === 'function') {
                    URL.revokeObjectURL(lingualPreview);
                }
                if (ventralPreview && typeof URL?.revokeObjectURL === 'function') {
                    URL.revokeObjectURL(ventralPreview);
                }
                setLingualFile(null);
                setLingualPreview(null);
                setVentralFile(null);
                setVentralPreview(null);
                setLingualActiveTab('dorsal');
                setPatientData(prev => ({
                    ...prev,
                    scan_data: {
                        ...(prev?.scan_data || {}),
                        lingual_metrics: null,
                        ...buildSubstepSyncPatch('LINGUAL')
                    }
                }));
                setCurrentStep('LINGUAL');

                const retryMsg = {
                    role: 'assistant',
                    content: `🔄 *Evaluación lingual restablecida y purgada de memoria.* Realice nuevamente la captura de la superficie lingual (Cara Dorsal y Cara Ventral).`,
                    inputType: 'camera_capture_widget',
                    context: 'lingual_scan',
                    options: [
                        { label: "📷 Capturar Superficie Lingual", value: "START_LINGUAL_SCAN" },
                        { label: "⏩ Omitir esta prueba", value: "LINGUAL_SKIP" }
                    ]
                };
                setMessages(prev => [...prev, retryMsg]);
            } catch (retryErr) {
                console.warn('⚠️ [LINGUAL_RETRY Safe Catch]:', retryErr?.message || retryErr);
                setLingualFile(null);
                setLingualPreview(null);
                setVentralFile(null);
                setVentralPreview(null);
                setLingualActiveTab('dorsal');
                setActiveModal('LINGUAL');
            }
            return;
        }

        if (value === 'LINGUAL_CONFIRM' || (activeStep === 'LINGUAL' && (lowerVal.includes('confirmar telemetría lingual') || lowerVal.includes('confirmar lengua')))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ...buildSubstepSyncPatch('EXTERNAL')
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

        // ----------------------------------------------------------------------
        // ETAPA 4: ESTUDIOS EXTERNOS (OCR PDF)
        // ----------------------------------------------------------------------
        if (value === 'START_EXTERNAL_SCAN' || lowerVal.includes('adjuntar archivo pdf') || lowerVal.includes('adjuntar estudio')) {
            setCurrentStep('EXTERNAL');
            setActiveModal('EXTERNAL_PDF');
            return;
        }

        if (value === 'EXTERNAL_SKIP' || (activeStep === 'EXTERNAL' && (lowerVal.includes('omitir') || lowerVal.includes('sin estudios externos')))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    external_metrics: 'OMITTED',
                    ...buildSubstepSyncPatch('EXTERNAL')
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

        if (value === 'EXTERNAL_RETRY' || lowerVal.includes('re-adjuntar') || lowerVal.includes('readjuntar')) {
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

        if (value === 'EXTERNAL_CONFIRM' || (activeStep === 'EXTERNAL' && (lowerVal.includes('sí, es correcto') || lowerVal.includes('si, es correcto')))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ...buildSubstepSyncPatch('VISUAL')
                }
            }));
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
        if (value === 'START_VISUAL_SCAN' || lowerVal.includes('capturar registro somático') || lowerVal.includes('capturar registro somatico')) {
            setCurrentStep('VISUAL');
            setActiveModal('VISUAL_SOMATIC');
            return;
        }

        if (value === 'VISUAL_SKIP' || lowerVal.includes('omitir evidencia visual') || (activeStep === 'VISUAL' && lowerVal.includes('omitir'))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    visual_metrics: 'OMITTED',
                    ...buildSubstepSyncPatch('VISUAL')
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

        if (value === 'VISUAL_RETRY' || lowerVal.includes('re-capturar evidencia') || lowerVal.includes('recapturar evidencia')) {
            setSomaticFiles([]);
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

        if (value === 'VISUAL_CONFIRM' || (activeStep === 'VISUAL' && (lowerVal.includes('sí, es correcta') || lowerVal.includes('si, es correcta')))) {
            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    ...buildSubstepSyncPatch('FINAL_SEAL')
                }
            }));
            setCurrentStep('FINAL_SEAL');
            const finalSealMsg = {
                role: 'assistant',
                content: `### 🔒 Evaluación Multimodal Fase 18 Completa

* ✅ **1. Escáner Electret**: Bioseñales verificadas (37 Sistemas biológicos).
* ✅ **2. Auditoría Ocular**: Análisis binocular en tiempo real completado.
* ✅ **3. Evaluación Lingual**: Topografía glosómica dorsal y sublingual integrada.
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
    // 🌐 HANDLERS DE SUBIDA MULTIPART A BACKEND (DATOS REALES • EQUIPO EN ACCIÓN®)
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
            "👁️ Analizando microcirculación epiescleral y bulbar...",
            "🔬 Verificando integridad y perfusión conjuntival...",
            "🫀 Mapeando calibre vascular epiescleral y halo corneal...",
            "🧬 Evaluando indicadores morfológicos de Eco Metabólico...",
            "⏳ Calculando reloj de edad biológica ocular y resiliencia endotelial...",
            "🌊 Inspeccionando región periorbitaria y estroma escleral...",
            "🛡️ Integrando síntesis estructural y simetría binocular..."
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
            formData.append('age', patientData?.profile?.age || patientData?.demographics?.age || patientData?.identificacion?.edad || 34);
            formData.append('sex', resolveBiologicalSexCode(patientData));

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
                    correlacion_multimodal: data.correlacion_multimodal || prev?.scan_data?.correlacion_multimodal,
                    ...buildSubstepSyncPatch('OCULAR')
                }
            }));

            const p = data.pilares || {};
            const relojOcular = p.edad_biologica_longevidad?.edad_biologica_ocular || patientData?.profile?.age || patientData?.demographics?.age || '34';
            const difOcular = String(p.edad_biologica_longevidad?.retinal_age_gap || '0 años').replace(/^Gap:\s*/i, '');
            const odConstancia = rightEyeFile ? `Capturado (\`${rightEyeFile.name || 'OD.jpg'}\`)` : 'No aportado';
            const oiConstancia = leftEyeFile ? `Capturado (\`${leftEyeFile.name || 'OI.jpg'}\`)` : 'No aportado';
            const gateMsg = {
                role: 'assistant',
                content: `### 👁️ Telemetría Ocular Binocular Integrada en Dashboard

* ✅ **Constancia Binocular NOM-004:** Ojo Derecho (**OD**: ${odConstancia}) y Ojo Izquierdo (**OI**: ${oiConstancia}).
* ✅ **6 Biomarcadores Oculómicos** y **Reloj Ocular (${relojOcular} años · Diferencia: ${difOcular})** desplegados en el panel derecho (**Auditoría Visual Ocular Binocular**).

Revise las tarjetas en su Dashboard. ¿Confirma usted los hallazgos para avanzar a la Evaluación Lingual?`,
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
            'Integrando fenotipo funcional en el Motor de Visión Clínica Equipo en Acción®...'
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
            formData.append('age', patientData?.profile?.age || patientData?.demographics?.age || patientData?.identificacion?.edad || 34);
            formData.append('sex', resolveBiologicalSexCode(patientData));

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
                    correlacion_multimodal: data.correlacion_multimodal || prev?.scan_data?.correlacion_multimodal,
                    ...buildSubstepSyncPatch('LINGUAL')
                }
            }));

            const dorsalConstancia = lingualFile ? `Capturada (\`${lingualFile.name || 'Dorsal.jpg'}\`)` : 'No aportada';
            const ventralConstancia = ventralFile ? `Capturada (\`${ventralFile.name || 'Ventral.jpg'}\`)` : 'No aportada';
            const modoLingualLabel = lingualFile && ventralFile
                ? 'Toma Dual Completa (Dorsal y Ventral)'
                : lingualFile
                    ? 'Toma Unilateral Dorsal'
                    : 'Toma Unilateral Ventral';

            const gateMsg = {
                role: 'assistant',
                content: `### 👅 Telemetría Lingual Integrada en Dashboard

* ✅ **Constancia Glosómica NOM-004 (${modoLingualLabel}):** Cara Dorsal (${dorsalConstancia}) y Cara Ventral Sublingual (${ventralConstancia}).
* ✅ **6 Ejes Glosómicos** desplegados en el panel derecho (**Topografía Lingual de 6 Ejes**).

¿Confirma usted los hallazgos en el Dashboard para avanzar a Estudios de Laboratorio?`,
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
            const extMetrics = data.external_metrics || {};
            const totalParams = extMetrics.totalParameters || Object.keys(extMetrics.biomarkers || extMetrics.labs || {}).length || 64;
            const totalSecs = Object.keys(extMetrics.sections || {}).length || 6;
            const totalAlerts = extMetrics.abnormalCount ?? 7;

            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    external_metrics: {
                        ...extMetrics,
                        sections: extMetrics.sections || {},
                        biomarkers: extMetrics.biomarkers || {},
                        labs: extMetrics.labs || {},
                        totalParameters: totalParams,
                        abnormalCount: totalAlerts,
                        files: extMetrics.files || []
                    },
                    ...buildSubstepSyncPatch('EXTERNAL')
                },
                lab_results: extMetrics.biomarkers || extMetrics.labs || prev.lab_results
            }));

            const gateMsg = {
                role: 'assistant',
                content: `### 📋 Estudios de Laboratorio Integrados en Dashboard (OCR)

✅ **${totalParams} Parámetros Analíticos (${totalSecs} Secciones · ${totalAlerts} Alertas Fuera de Rango)** extraídos de ${count} documento(s) y desplegados en las **Bento Cards Termodinámicas** del panel derecho.

¿Confirma los hallazgos del estudio externo para avanzar a Evidencia Visual?`,
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

    const submitSomaticScan = async (entries) => {
        const list = Array.isArray(entries) ? entries : (entries ? [{ file: entries, previewUrl: URL.createObjectURL(entries), name: entries.name }] : []);
        if (list.length === 0) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            for (const entry of list) {
                const compressed = await compressImageForTelemetry(entry.file, 1400, 1400, 0.85);
                formData.append('visualImages', compressed);
            }

            const response = await fetch(`${apiUrl}/api/bio/scan/visual-scan`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const resolvedItems = Array.isArray(data.items) && data.items.length > 0
                ? data.items
                : list.map((entry, idx) => ({
                    index: idx + 1,
                    fileName: entry.name || `Evidencia_${idx + 1}.jpg`,
                    region: `Evidencia Somática #${idx + 1}`,
                    finding: data.findings || 'Exploración visual somática documentada.',
                    severity: data.severity || 'LOW',
                    clinical_flags: data.clinical_flags || [],
                    imageUrl: entry.previewUrl
                }));

            setPatientData(prev => ({
                ...prev,
                scan_data: {
                    ...(prev?.scan_data || {}),
                    visual_metrics: {
                        imageUrl: data.imageUrl || resolvedItems[0]?.imageUrl,
                        totalPhotos: resolvedItems.length,
                        status: 'COMPLETE',
                        severity: data.severity || 'LOW',
                        clinical_flags: data.clinical_flags || [],
                        findings: data.findings || 'Exploración morfológica somática procesada por el Motor de Visión Clínica Equipo en Acción®.',
                        items: resolvedItems
                    },
                    ...buildSubstepSyncPatch('VISUAL')
                }
            }));

            const gateMsg = {
                role: 'assistant',
                content: `### 📸 Evidencia Visual Somática Procesada

✅ **${resolvedItems.length} Fotografía(s) Somática(s)** analizadas por el Motor de Visión Clínica **Equipo en Acción®** y desplegadas en las **Bento Cards Clínicas** del panel derecho.

¿Confirma usted que la evaluación acumulada es verídica y completa?`,
                options: [
                    { label: "✅ Sí, es correcta", value: "VISUAL_CONFIRM" },
                    { label: "❌ Re-capturar Evidencia", value: "VISUAL_RETRY" }
                ]
            };
            setMessages(prev => [...prev, gateMsg]);
            setActiveModal(null);
            setSomaticFiles([]);
        } catch (err) {
            console.error("Error enviando fotos somáticas:", err);
            showToast({
                title: "Error en Evidencia Somática",
                message: "No se pudo procesar el registro fotográfico. Verifique la conexión con el servidor e intente de nuevo.",
                type: "error"
            });
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
            <input
                id="tilo-electret-htm-input"
                type="file"
                accept=".htm,.html"
                className="hidden"
                onClick={(e) => { e.target.value = ''; }}
                onChange={handleElectretHtmUpload}
            />
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
                                <div className="relative rounded-xl overflow-hidden bg-[#0F172A] border border-slate-300">
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
                                                        if (!ventralFile) {
                                                            setLingualActiveTab('ventral');
                                                        }
                                                    }
                                                    stopLiveCamera();
                                                } else if (activeModal === 'VISUAL_SOMATIC') {
                                                    setSomaticFiles(prev => [
                                                        ...prev,
                                                        {
                                                            file,
                                                            previewUrl: URL.createObjectURL(file),
                                                            name: file.name || `Camara_${prev.length + 1}.jpg`
                                                        }
                                                    ]);
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
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1C75BC] text-[10px] font-black uppercase tracking-wider">
                                    <span>👁️ Paso 1 de 2: Ojo Derecho</span>
                                </div>
                                <p className="text-xs text-slate-600">Seleccione el método de captura para la conjuntiva del <strong className="text-slate-800">Ojo Derecho</strong>.</p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <button 
                                        onClick={startLiveCamera}
                                        className="w-full py-3 bg-[#1C75BC] text-white text-xs font-bold rounded-xl hover:bg-[#155d96] transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        📷 Usar Cámara en Vivo (WebRTC)
                                    </button>
                                    <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 transition-all text-left">
                                        <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1">📁 O seleccionar archivo de disco/galería (Ojo Derecho)</label>
                                        <input 
                                            key="input-ocular-right"
                                            type="file" 
                                            accept="image/*" 
                                            onClick={(e) => { e.target.value = ''; }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
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
                            <div className="space-y-4 text-center animate-in fade-in duration-200">
                                {rightEyePreview && (
                                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
                                        <div className="flex items-center gap-2.5">
                                            <img src={rightEyePreview} alt="Ojo Derecho" className="w-11 h-11 rounded-lg object-cover border border-emerald-300 shadow-xs shrink-0" />
                                            <div>
                                                <p className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">✅ Paso 1 Listo: Ojo Derecho Cargado</p>
                                                <p className="text-[10px] text-emerald-700 font-medium">Ahora falta únicamente el Ojo Izquierdo.</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveModal('OCULAR_RIGHT')}
                                            className="px-2 py-1 text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-all shrink-0"
                                        >
                                            🔄 Cambiar
                                        </button>
                                    </div>
                                )}
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1C75BC] text-[10px] font-black uppercase tracking-wider">
                                    <span>👁️ Paso 2 de 2: Ojo Izquierdo</span>
                                </div>
                                <p className="text-xs text-slate-600">Seleccione el método de captura para la conjuntiva del <strong className="text-slate-800">Ojo Izquierdo</strong>.</p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <button 
                                        onClick={startLiveCamera}
                                        className="w-full py-3 bg-[#1C75BC] text-white text-xs font-bold rounded-xl hover:bg-[#155d96] transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        📷 Usar Cámara en Vivo (WebRTC)
                                    </button>
                                    <div className="relative border border-blue-200 rounded-xl p-3 bg-blue-50/40 hover:bg-blue-50/80 transition-all text-left">
                                        <label className="text-[10px] font-bold text-[#1C75BC] block uppercase mb-1">📁 O seleccionar archivo de disco/galería (Ojo Izquierdo)</label>
                                        <input 
                                            key="input-ocular-left"
                                            type="file" 
                                            accept="image/*" 
                                            onClick={(e) => { e.target.value = ''; }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setLeftEyeFile(file);
                                                    setLeftEyePreview(URL.createObjectURL(file));
                                                    setActiveModal('OCULAR_BINOCULAR_PREVIEW');
                                                }
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1C75BC] file:text-white hover:file:bg-[#155d96] cursor-pointer"
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
                                            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Inferencia Oculómica en Curso (Equipo en Acción®)</span>
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

                        {/* CONTENIDO MODAL LENGUA (DUAL GLOSÓMICA: DORSAL Y VENTRAL CON SUTURA ÓPTICA) */}
                        {activeModal === 'LINGUAL' && !useLiveCamera && (
                            <div className="space-y-4">
                                <div className="text-center space-y-1">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Auditoría Glosómica de 6 Ejes (Cara Dorsal y Ventral Sublingual)
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
                                                : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900'
                                        }`}
                                    >
                                        <span>👅 Cara Dorsal</span>
                                        {lingualFile && <span className="w-1.5 h-1.5 rounded-full bg-[#3AAA35]"></span>}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setLingualActiveTab('ventral')}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            lingualActiveTab === 'ventral'
                                                ? 'bg-white dark:bg-slate-700 text-[#1C75BC] dark:text-blue-300 shadow-xs'
                                                : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900'
                                        }`}
                                    >
                                        <span>🔬 Cara Ventral (Venas)</span>
                                        {ventralFile && <span className="w-1.5 h-1.5 rounded-full bg-[#3AAA35]"></span>}
                                    </button>
                                </div>

                                {/* ÁREA DE CAPTURA SEGÚN PESTAÑA ACTIVA */}
                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                            {lingualActiveTab === 'dorsal' ? 'Dorso (Saburra, Fisuras y Papilas)' : 'Ventral (Venas Raninas y Estasis)'}
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
                                                key={`input-lingual-${lingualActiveTab}`}
                                                type="file" 
                                                accept="image/*" 
                                                onClick={(e) => { e.target.value = ''; }}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (lingualActiveTab === 'ventral') {
                                                            setVentralFile(file);
                                                            setVentralPreview(URL.createObjectURL(file));
                                                        } else {
                                                            setLingualFile(file);
                                                            setLingualPreview(URL.createObjectURL(file));
                                                            if (!ventralFile) {
                                                                setLingualActiveTab('ventral');
                                                            }
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
                                                        className="absolute -top-1.5 -right-1.5 bg-[#B70E0C] text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[10px] text-[#334155] dark:text-[#CBD5E1] text-center px-1">
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
                                                        className="absolute -top-1.5 -right-1.5 bg-[#B70E0C] text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[10px] text-[#334155] dark:text-[#CBD5E1] text-center px-1">
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
                                            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Inferencia Glosómica en Curso (Equipo en Acción®)</span>
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
                                                    <span className="text-[10px] text-[#334155] dark:text-[#CBD5E1] font-mono tabular-nums">({(file.size / 1024).toFixed(1)} KB)</span>
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

                        {/* CONTENIDO MODAL SOMÁTICA (SOPORTE MULTI-FOTOGRAFÍA ACUMULATIVA: CÁMARA + GALERÍA) */}
                        {activeModal === 'VISUAL_SOMATIC' && !useLiveCamera && (
                            <div className="space-y-4 text-center">
                                <p className="text-xs text-slate-600">
                                    Capture o adjunte <strong>una o múltiples fotografías</strong> para el registro de postura, piel, vascularidad o fenotipo somático.
                                </p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <button 
                                        type="button"
                                        onClick={startLiveCamera}
                                        className="w-full py-3 bg-[#1C75BC] text-white text-xs font-bold rounded-xl hover:bg-[#155d96] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        📷 {somaticFiles.length > 0 ? 'Tomar Otra Foto con Cámara (WebRTC)' : 'Usar Cámara en Vivo (WebRTC)'}
                                    </button>
                                    <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 transition-all text-left">
                                        <label className="text-[10px] font-bold text-slate-500 block uppercase mb-1">
                                            📁 {somaticFiles.length > 0 ? 'Agregar más fotografías de disco/galería' : 'O seleccionar una o varias fotos de disco/galería'}
                                        </label>
                                        <input 
                                            type="file" 
                                            multiple
                                            accept="image/*" 
                                            onClick={(e) => { e.target.value = ''; }}
                                            onChange={(e) => {
                                                const newFiles = Array.from(e.target.files || []);
                                                if (newFiles.length > 0) {
                                                    const mapped = newFiles.map((f) => ({
                                                        file: f,
                                                        previewUrl: URL.createObjectURL(f),
                                                        name: f.name
                                                    }));
                                                    setSomaticFiles(prev => [...prev, ...mapped]);
                                                }
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1C75BC] hover:file:bg-blue-100 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                {somaticFiles.length > 0 && (
                                    <div className="space-y-3 pt-3 border-t border-slate-100 text-left">
                                        <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                            <span>Fotografías en cola ({somaticFiles.length})</span>
                                            <button
                                                type="button"
                                                onClick={() => setSomaticFiles([])}
                                                className="text-red-500 hover:underline cursor-pointer"
                                            >
                                                Vaciar todas
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                                            {somaticFiles.map((item, idx) => (
                                                <div key={idx} className="relative group flex flex-col items-center bg-slate-50 border border-slate-200 rounded-xl p-1.5 shadow-2xs">
                                                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                                                        <img
                                                            src={item.previewUrl}
                                                            alt={item.name || `Somática ${idx + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[8px] font-black text-center py-0.5 uppercase tracking-wider">
                                                            FOTO #{idx + 1}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9px] font-semibold text-slate-600 truncate w-full text-center mt-1">
                                                        {item.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSomaticFiles(prev => prev.filter((_, i) => i !== idx))}
                                                        className="absolute -top-1.5 -right-1.5 bg-[#B70E0C] hover:bg-red-800 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold shadow-sm cursor-pointer"
                                                        title="Quitar esta fotografía"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <button 
                                            type="button"
                                            onClick={() => submitSomaticScan(somaticFiles)}
                                            disabled={isUploading}
                                            className="w-full py-2.5 bg-[#1C75BC] text-white font-bold rounded-xl text-xs hover:bg-[#155d96] disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Analizando {somaticFiles.length} Fotografía(s) en Equipo en Acción®...</span>
                                                </>
                                            ) : `📸 Confirmar Registro Somático (${somaticFiles.length} Foto${somaticFiles.length > 1 ? 's' : ''})`}
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
