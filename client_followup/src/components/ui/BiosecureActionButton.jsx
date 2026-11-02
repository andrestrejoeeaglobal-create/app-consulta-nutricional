import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

/**
 * BiosecureActionButton (TCK-2026-BIOSECURE-BTN)
 * Botón interactivo con bioseguridad para acciones críticas con acento Rojo 33Plus® (#B70E0C / #E30613).
 * Cumple con:
 * - Área táctil mínima de 48px x 48px con Hit Margin perimetral libre de 12px.
 * - Máquina de estados: IDLE -> CONFIRMING (con cuenta regresiva de 3.5s) -> TRIGGERED.
 * - Doble confirmación consciente para prevenir pulsaciones accidentales en pantallas táctiles.
 * - Cero sombras negras puras (#000000 prohibido; elevación Slate-900 #0F172A).
 */
export const BiosecureActionButton = ({
  label = "Ejecutar Acción Crítica",
  confirmLabel = "¿Confirmar Acción?",
  onConfirm = () => {},
  variant = "danger", // 'danger' (Rojo 33Plus) | 'primary' (Azul Corporativo)
  disabled = false,
  className = ""
}) => {
  const [state, setState] = useState('IDLE'); // 'IDLE' | 'CONFIRMING' | 'TRIGGERED'
  const [countdown, setCountdown] = useState(3.5);
  const timerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const resetState = () => {
    setState('IDLE');
    setCountdown(3.5);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled || state === 'TRIGGERED') return;

    if (state === 'IDLE') {
      setState('CONFIRMING');
      setCountdown(3.5);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 0.2) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return Number((prev - 0.1).toFixed(1));
        });
      }, 100);

      timerRef.current = setTimeout(() => {
        resetState();
      }, 3500);
    } else if (state === 'CONFIRMING') {
      // Confirmación exitosa dentro de la ventana de 3.5s
      resetState();
      setState('TRIGGERED');
      onConfirm();
      setTimeout(() => setState('IDLE'), 1500);
    }
  };

  const isDanger = variant === 'danger';
  const baseBg = isDanger ? 'bg-[#E30613] hover:bg-[#B70E0C]' : 'bg-[#1C75BC] hover:bg-[#155A8A]';
  const confirmingBg = 'bg-amber-600 hover:bg-amber-700 animate-pulse';

  return (
    // Hit margin perimetral libre de 12px para ergonomía táctil (Thumb Zone)
    <div className="p-3 inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={`min-w-[160px] min-h-[48px] px-5 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider
          flex items-center justify-center gap-2.5 transition-all select-none cursor-pointer
          shadow-[0_4px_6px_-1px_rgba(15,23,42,0.12),0_2px_4px_-2px_rgba(15,23,42,0.08)]
          focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isDanger ? 'focus:ring-[#E30613]' : 'focus:ring-[#1C75BC]'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-400' : state === 'CONFIRMING' ? confirmingBg : baseBg}
          ${className}`}
        aria-live="polite"
      >
        {state === 'IDLE' && (
          <>
            <ShieldAlert className="w-4 h-4 text-white" />
            <span>{label}</span>
          </>
        )}

        {state === 'CONFIRMING' && (
          <>
            <AlertTriangle className="w-4 h-4 text-white animate-bounce" />
            <div className="flex flex-col items-center">
              <span>{confirmLabel}</span>
              <span className="text-[10px] lowercase font-normal opacity-90">
                pulsa de nuevo ({countdown.toFixed(1)}s)
              </span>
            </div>
          </>
        )}

        {state === 'TRIGGERED' && (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-200" />
            <span>Confirmado</span>
          </>
        )}
      </button>
    </div>
  );
};
