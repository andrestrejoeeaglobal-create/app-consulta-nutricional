import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import tiloImg from '../../assets/tilo.png';
import {
    copySSoTDocument,
    safeCopyTextToClipboard
} from '../../utils/formatPlanForClipboard';
import { resolvePatientFriendlyGuide } from '../../utils/patientGuideAdapter';
import { useClinicalToast } from '../../hooks/useClinicalToast';

export { safeCopyTextToClipboard };

export function buildSSoTExecutiveOptions(isCompleted = false) {
    if (isCompleted) {
        return [
            { label: 'Copiar Guía Paciente', value: 'COPY_SSOT_PATIENT_GUIDE', iconKey: 'copy' },
            { label: 'Copiar Expediente NOM-004', value: 'COPY_SSOT_MEDICAL_DOSSIER', iconKey: 'file_text' },
            { label: 'Ver Calendario (Fase 21)', value: 'GO_TO_PHASE_21', iconKey: 'calendar' }
        ];
    }
    return [
        { label: 'Copiar Guía Paciente', value: 'COPY_SSOT_PATIENT_GUIDE', iconKey: 'copy' },
        { label: 'Copiar Expediente NOM-004', value: 'COPY_SSOT_MEDICAL_DOSSIER', iconKey: 'file_text' },
        { label: 'Continuar a Calendario (Fase 21)', value: 'PROCEED_TO_PHASE_21', iconKey: 'calendar' }
    ];
}

export function buildSSoTExecutiveSummaryContent(patientData) {
    const safeData = patientData || {};
    const dossier = safeData?.clinical_dossier || {};
    const ortho = dossier?.orthomolecular_prescription || {};
    const bio = dossier?.bioenergetics || ortho?.bioenergetics_summary || {};
    const guide = resolvePatientFriendlyGuide(safeData);
    const sem = guide?.biosecuritySemaphore || ortho?.biosecurity_semaphore || dossier?.biosecurity_semaphore || {};

    const semLevel = String(sem?.level || (sem?.isPaused ? 'ROJO' : sem?.isMicroDose ? 'AMARILLO' : 'VERDE')).toUpperCase();
    const semBadge = semLevel === 'ROJO'
        ? `🔴 Semáforo ROJO — ${sem?.badgeLabel || 'Prioridad Médica • Pausa Preventiva'} (0 sobres activos)`
        : semLevel === 'AMARILLO'
            ? `🟡 Semáforo AMARILLO — ${sem?.badgeLabel || 'Inicio Gradual Preventivo • Fracción Inicial Gradual'}`
            : `🟢 Semáforo VERDE — ${sem?.badgeLabel || 'Vía Libre Biosegura • Protocolo Completo'}`;

    const rawKcal = Number(bio?.targetKcal || guide?.homeActionPlan?.protective_nutrition?.targetKcal);
    const macros = dossier?.canonical_clinical_plan?.macros || bio?.macros || guide?.homeActionPlan?.protective_nutrition?.macros || null;
    const macroLabel = macros && macros.carbs
        ? ` (${macros.carbs}% C / ${macros.protein}% P / ${macros.fat}% L)`
        : '';
    const formattedKcal = Number.isFinite(rawKcal) && rawKcal > 0
        ? `${String(Math.round(rawKcal)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} kcal/día${macroLabel}`
        : 'Meta personalizada SSoTT';

    const rawHydration = guide?.homeActionPlan?.smart_hydration?.litersPerDay || ortho?.hydrationTargetLiters;
    const hydrationStr = rawHydration
        ? `${rawHydration} L/día`
        : 'Hidratación clínica calculada';

    const line33 = semLevel === 'ROJO' || Boolean(sem?.isPaused)
        ? '0 sobres activos (Diferido hasta valoración médica de estudios de control)'
        : (guide?.formula33Card?.dosage || 'Pauta diurna sincronizada al despertar');

    const line34 = semLevel === 'ROJO' || Boolean(sem?.isPaused)
        ? '0 sobres activos (Diferido hasta valoración médica de estudios de control)'
        : (guide?.formula34Card?.dosage || 'Pauta nocturna en mínimo 500 ml de agua simple 💧');

    const patientLine = guide?.patientFullName
        ? `• **Titular del Expediente:** ${guide.patientFullName}${guide?.ageYears ? ` (${guide.ageYears} años)` : ''}\n\n`
        : '';

    return (
        `📋 **Compuerta Ejecutiva de Despacho y Portapapeles (SSoTT — Fase 20)**\n\n` +
        `El expediente clínico y la pauta de complementación nutricional han quedado consolidados y sellados bajo **NOM-004-SSA3-2012**:\n\n` +
        patientLine +
        `• **Bioseguridad:** ${semBadge}\n\n` +
        `• **Meta Bioenergética e Hidratación:** ${formattedKcal} | ${hydrationStr}\n\n` +
        `• **🔴 33Plus®:** ${line33}\n\n` +
        `• **🟢 34Plus®:** ${line34}\n\n` +
        `Seleccione el formato que desea copiar al portapapeles o continúe a la **Fase 21 (Calendario de 28 Días)**:`
    );
}

const isStaleRecoveryCardInPhase20 = (m) =>
    m?.role === 'assistant' &&
    typeof m?.content === 'string' &&
    (
        m.content.includes('Expediente Clínico Recuperado Exitosamente') ||
        (Array.isArray(m.options) && m.options.some(o => o?.value === 'GO_TO_PHASE_20'))
    );

const Fase20_Portapapeles = ({
    patientData,
    onPhaseComplete,
    setMessages,
    registerInputHandler,
    setActiveTab
}) => {
    const isStudyCompleted = Boolean(patientData?.is_completed);
    const hasEmittedGateRef = useRef(null);
    const didAutoFocusDiagnosisRef = useRef(false);

    if (!hasEmittedGateRef.current || typeof hasEmittedGateRef.current !== 'object') {
        hasEmittedGateRef.current = {
            lastEmittedContent: '',
            handlerBound: false,
            props: {}
        };
    }
    hasEmittedGateRef.current.props = {
        patientData,
        onPhaseComplete,
        registerInputHandler
    };

    const executiveContent = useMemo(
        () => buildSSoTExecutiveSummaryContent(patientData),
        [patientData]
    );

    useEffect(() => {
        if (isStudyCompleted) return;
        if (!didAutoFocusDiagnosisRef.current && typeof setActiveTab === 'function') {
            didAutoFocusDiagnosisRef.current = true;
            setActiveTab('diagnosis');
        }
    }, [isStudyCompleted, setActiveTab]);

    useEffect(() => {
        if (isStudyCompleted) return;
        if (typeof setMessages !== 'function') return;
        if (hasEmittedGateRef.current.lastEmittedContent === executiveContent) return;

        hasEmittedGateRef.current.lastEmittedContent = executiveContent;

        setMessages(prev => {
            const safePrev = Array.isArray(prev) ? prev : [];
            const withoutStaleRecovery = safePrev.filter(m => !isStaleRecoveryCardInPhase20(m));
            const hadStaleRecovery = withoutStaleRecovery.length !== safePrev.length;

            const existingIdx = withoutStaleRecovery.findIndex(
                m => m?.id === 'phase20_ssot_executive_gate' ||
                    (typeof m?.content === 'string' && m.content.includes('Compuerta Ejecutiva de Despacho y Portapapeles (SSoTT — Fase 20)'))
            );

            if (existingIdx !== -1) {
                const existingMsg = withoutStaleRecovery[existingIdx];
                if (existingMsg?.content === executiveContent && !hadStaleRecovery) {
                    return safePrev;
                }
                const updated = [...withoutStaleRecovery];
                updated[existingIdx] = {
                    ...existingMsg,
                    id: 'phase20_ssot_executive_gate',
                    content: executiveContent,
                    options: buildSSoTExecutiveOptions(false)
                };
                return updated;
            }

            return [
                ...withoutStaleRecovery,
                {
                    id: 'phase20_ssot_executive_gate',
                    role: 'assistant',
                    content: executiveContent,
                    avatar: tiloImg,
                    options: buildSSoTExecutiveOptions(false)
                }
            ];
        });
    }, [isStudyCompleted, executiveContent, setMessages]);

    const handleSend = useCallback(async (userMsg) => {
        const cmd = String(userMsg || '').trim();
        const {
            patientData: livePatientData,
            onPhaseComplete: liveOnPhaseComplete,
            registerInputHandler: liveRegisterInputHandler
        } = hasEmittedGateRef.current?.props || {};

        if (cmd === 'PROCEED_TO_PHASE_21' || cmd === 'GO_TO_CALENDAR_SPRINT') {
            if (typeof liveRegisterInputHandler === 'function') {
                hasEmittedGateRef.current.handlerBound = false;
                liveRegisterInputHandler(null);
            }
            if (typeof liveOnPhaseComplete === 'function') {
                liveOnPhaseComplete('PHASE_21_CALENDARIO');
            }
            return;
        }

        if (cmd === 'COPY_SSOT_PATIENT_GUIDE' || cmd === 'COPY_SSOT_MEDICAL_DOSSIER') {
            const viewMode = cmd === 'COPY_SSOT_PATIENT_GUIDE' ? 'patient' : 'medical';
            const result = await copySSoTDocument({
                patientData: livePatientData,
                citationId:
                    livePatientData?.profile?.citationId ||
                    livePatientData?.profile?.citaId ||
                    livePatientData?.identificacion?.idCita ||
                    livePatientData?.identificacion?.citaId ||
                    null,
                viewMode
            });

            const showToast = useClinicalToast.getState().showToast;
            if (result.ok) {
                showToast({
                    dedupeKey: 'ssot-clipboard',
                    type: 'success',
                    icon: 'clipboard',
                    title: viewMode === 'patient' ? 'Guía del Paciente Copiada' : 'Expediente NOM-004 Copiado',
                    message: `${result.patientName} • Cita #${result.folio} sincronizada al 100% en portapapeles.`,
                    duration: 3200
                });
            } else {
                const isFailClosed = result.reason === 'MISSING_CLINICAL_DOSSIER' || result.reason === 'INCOMPLETE_IDENTITY';
                showToast({
                    dedupeKey: 'ssot-clipboard',
                    type: isFailClosed ? 'error' : 'warning',
                    icon: 'clipboard',
                    title: isFailClosed ? 'Copiado Bloqueado por Bioseguridad (NOM-004)' : 'Acceso al Portapapeles Restringido',
                    message: isFailClosed
                        ? 'El expediente clínico aún no cuenta con síntesis o identidad validada.'
                        : 'Verifique los permisos del navegador e intente nuevamente.',
                    duration: 4000
                });
            }
        }
    }, []);

    useEffect(() => {
        if (typeof registerInputHandler !== 'function') return undefined;
        if (isStudyCompleted) {
            if (hasEmittedGateRef.current.handlerBound) {
                hasEmittedGateRef.current.handlerBound = false;
                registerInputHandler(null);
            }
            return undefined;
        }
        if (!hasEmittedGateRef.current.handlerBound) {
            hasEmittedGateRef.current.handlerBound = true;
            registerInputHandler(() => handleSend);
        }
        return () => {
            if (hasEmittedGateRef.current) {
                hasEmittedGateRef.current.handlerBound = false;
            }
            registerInputHandler(null);
        };
    }, [registerInputHandler, isStudyCompleted, handleSend]);

    return null;
};

export default Fase20_Portapapeles;
