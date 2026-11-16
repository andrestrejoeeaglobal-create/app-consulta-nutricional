import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import tiloImg from '../../assets/tilo.png';
import {
    copySSoTDocument,
    safeCopyTextToClipboard
} from '../../utils/formatPlanForClipboard';
import { useClinicalToast } from '../../hooks/useClinicalToast';

export { safeCopyTextToClipboard };

export function buildSSoTExecutiveOptions(isCompleted = false) {
    if (isCompleted) {
        return [
            { label: '📋 Copiar Guía Paciente', value: 'COPY_SSOT_PATIENT_GUIDE' },
            { label: '🩺 Copiar Expediente NOM-004', value: 'COPY_SSOT_MEDICAL_DOSSIER' },
            { label: '📅 Ver Calendario (Fase 21) ➔', value: 'GO_TO_PHASE_21' }
        ];
    }
    return [
        { label: '📋 Copiar Guía Paciente', value: 'COPY_SSOT_PATIENT_GUIDE' },
        { label: '🩺 Copiar Expediente NOM-004', value: 'COPY_SSOT_MEDICAL_DOSSIER' },
        { label: '📅 Continuar a Calendario (Fase 21) ➔', value: 'PROCEED_TO_PHASE_21' }
    ];
}

export function buildSSoTExecutiveSummaryContent(patientData) {
    const dossier = patientData?.clinical_dossier || {};
    const ortho = dossier?.orthomolecular_prescription || {};
    const bio = dossier?.bioenergetics || ortho?.bioenergetics_summary || {};
    const sem = ortho?.biosecurity_semaphore || dossier?.biosecurity_semaphore || {};
    const sups = Array.isArray(ortho?.supplements) ? ortho.supplements : [];

    const semLevel = String(sem?.level || (sem?.isPaused ? 'ROJO' : sem?.isMicroDose ? 'AMARILLO' : 'VERDE')).toUpperCase();
    const semBadge = semLevel === 'ROJO'
        ? '🔴 Semáforo ROJO — En Pausa Preventiva de Bioseguridad (0 sobres activos)'
        : semLevel === 'AMARILLO'
            ? '🟡 Semáforo AMARILLO — Protocolo de Micro-Dosis Gradual (Semana 1)'
            : '🟢 Semáforo VERDE — Protocolo Circadiano Estándar';

    const rawKcal = Number(bio?.targetKcal);
    const formattedKcal = Number.isFinite(rawKcal) && rawKcal > 0
        ? `${String(Math.round(rawKcal)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')} kcal/día`
        : 'Meta personalizada SSoTT';
    const hydrationStr = ortho?.hydrationTargetLiters
        ? `${ortho.hydrationTargetLiters} L/día`
        : 'Hidratación clínica calculada';

    const sup33 = sups.find(s => s?.id === 'sup_33plus' || /33/.test(String(s?.name || ''))) || null;
    const sup34 = sups.find(s => s?.id === 'sup_34plus' || /34/.test(String(s?.name || ''))) || null;

    const line33 = sem?.isPaused || sup33?.status === 'paused_by_biosecurity'
        ? '0 sobres activos (Diferido hasta valoración médica de estudios de control)'
        : (sup33?.dosage || 'Prescripción diurna sincronizada al despertar');

    const line34 = sem?.isPaused || sup34?.status === 'paused_by_biosecurity'
        ? '0 sobres activos (Diferido hasta valoración médica de estudios de control)'
        : (sup34?.dosage || 'Prescripción nocturna en mínimo 500 ml de agua simple 💧');

    return (
        `📋 **Compuerta Ejecutiva de Despacho y Portapapeles (SSoTT — Fase 20)**\n\n` +
        `El expediente clínico y la prescripción ortomolecular han quedado consolidados y sellados bajo **NOM-004-SSA3-2012**:\n\n` +
        `• **Bioseguridad:** ${semBadge}\n\n` +
        `• **Meta Bioenergética e Hidratación:** ${formattedKcal} | ${hydrationStr}\n\n` +
        `• **🔴 33Plus®:** ${line33}\n\n` +
        `• **🟢 34Plus®:** ${line34}\n\n` +
        `Seleccione el formato que desea copiar al portapapeles o continúe a la **Fase 21 (Calendario de 28 Días)**:`
    );
}

const Fase20_Portapapeles = ({
    patientData,
    onPhaseComplete,
    setMessages,
    registerInputHandler,
    setActiveTab
}) => {
    const isStudyCompleted = Boolean(patientData?.is_completed);
    const hasEmittedGateRef = useRef(false);
    const didAutoFocusDiagnosisRef = useRef(false);

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
        if (isStudyCompleted) {
            if (registerInputHandler) registerInputHandler(null);
            return;
        }
        if (hasEmittedGateRef.current) return;
        hasEmittedGateRef.current = true;

        if (typeof setMessages === 'function') {
            setMessages(prev => {
                const safePrev = Array.isArray(prev) ? prev : [];
                const alreadyExists = safePrev.some(
                    m => m?.id === 'phase20_ssot_executive_gate' ||
                        (typeof m?.content === 'string' && m.content.includes('Compuerta Ejecutiva de Despacho y Portapapeles (SSoTT — Fase 20)'))
                );
                if (alreadyExists) return safePrev;

                return [
                    ...safePrev,
                    {
                        id: 'phase20_ssot_executive_gate',
                        role: 'assistant',
                        content: executiveContent,
                        avatar: tiloImg,
                        options: buildSSoTExecutiveOptions(false)
                    }
                ];
            });
        }
    }, [isStudyCompleted, executiveContent, setMessages, registerInputHandler]);

    const handleSend = useCallback(async (userMsg) => {
        const cmd = String(userMsg || '').trim();

        if (cmd === 'PROCEED_TO_PHASE_21' || cmd === 'GO_TO_CALENDAR_SPRINT') {
            if (registerInputHandler) registerInputHandler(null);
            if (typeof onPhaseComplete === 'function') {
                onPhaseComplete('PHASE_21_CALENDARIO');
            }
            return;
        }

        if (cmd === 'COPY_SSOT_PATIENT_GUIDE' || cmd === 'COPY_SSOT_MEDICAL_DOSSIER') {
            const viewMode = cmd === 'COPY_SSOT_PATIENT_GUIDE' ? 'patient' : 'medical';
            const result = await copySSoTDocument({
                patientData,
                citationId:
                    patientData?.profile?.citationId ||
                    patientData?.profile?.citaId ||
                    patientData?.identificacion?.idCita ||
                    patientData?.identificacion?.citaId ||
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
    }, [patientData, onPhaseComplete, registerInputHandler, setMessages]);

    useEffect(() => {
        if (!registerInputHandler) return;
        if (isStudyCompleted) {
            registerInputHandler(null);
            return;
        }
        registerInputHandler(() => handleSend);
        return () => {
            registerInputHandler(null);
        };
    }, [registerInputHandler, isStudyCompleted, handleSend]);

    return null;
};

export default Fase20_Portapapeles;
