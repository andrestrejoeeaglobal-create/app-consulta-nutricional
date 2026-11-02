# Client Followup (Portal de Seguimiento y Bio-Auditoría)

## Overview
Frontend secundario construido con React 19 y Vite ejecutándose en el puerto 5174. Proporciona la interfaz de seguimiento longitudinal de pacientes, evolución clínica interconsulta, validación de citas de revaloración y visualización comparativa de bio-marcadores y adherencia terapéutica.

## Interface
- `src/main.jsx`: Punto de entrada Vite para el portal de seguimiento.
- `src/App.jsx`: Componente principal que orquesta la verificación de citas de seguimiento, dashboard de evolución y gráficas de progreso.
- `src/components/`: Componentes modulares para visualización de tendencias con Recharts, alertas clínicas y previsualización de reportes.
- `src/hooks/`: Hooks reactivos para sincronización de telemetría y consultas al servidor.

## Invariants
- Puerto por defecto: Debe iniciar en el puerto 5174 para evitar colisiones con el cliente principal (puerto 5173).
- Las funciones de validación de cita interconsulta deben consultar el endpoint maestro `/api/followup/validate-citation` sin modificar el contrato de respuesta esperado.
- La visualización de métricas históricas debe garantizar inmutabilidad en los registros de sesiones previas.

## Side Effects
- Comunicación HTTP vía Axios hacia el backend Node.js (`/api/followup/*`).
- Generación de reportes clínicos descargables en PDF (`html2pdf.js`).
- Mutaciones de estado en el store Zustand para tracking temporal de la sesión del paciente.

## Verification
- Run: `npm run build`
