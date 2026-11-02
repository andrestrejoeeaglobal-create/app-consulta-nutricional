# Client (App Consulta Nutricional Frontend)

## Overview
Single Page Application (SPA) clínica construida con React 19 y Vite para el ecosistema T.I.L.O. / Equipo en Acción®. Gestiona la toma de consulta nutricional completa a través de un flujo estructurado de 21 fases clínicas (anamnesis, signos vitales, antropometría, bio-resonancia Electret, semiótica de lengua e iris, formulación ortomolecular y entrega de plan terapéutico).

## Interface
- `src/main.jsx`: Punto de entrada DOM de React con Vite HMR.
- `src/App.jsx`: Componente maestro de consulta nutricional; orquesta la máquina de estados de las 21 fases clínicas y renderizado de módulos.
- `src/store/useClinicalGenome.js`: Estado global reactivo con Zustand que preserva el genoma clínico del paciente en sesión.
- `src/services/InteractionEngine.js`: Motor de detección y validación de interacciones fármaco-nutriente y compatibilidad metabólica.
- `src/ClinicalRules.js`: Conjunto de heurísticas clínicas y reglas de cálculo antropométrico (TMB, IMC, fórmulas Mifflin-St Jeor / Harris-Benedict).
- `src/SafetyEngine.js`: Motor de alertas y contraindicaciones clínicas según normativa sanitaria.

## Invariants
- Invarianza de layout y Thumb Zone: La arquitectura visual, ergonomía táctil y rejilla de componentes deben mantenerse estables sin colapsar vistas activas.
- Integridad de fases: La navegación entre las fases clínicas (Fase 1 a 21) debe preservar el estado del paciente sin pérdida de datos en memoria local o store.
- Las animaciones con Framer Motion y simulaciones DOM con Matter.js no deben bloquear el hilo principal de renderizado ni la interactividad del teclado/touch.

## Side Effects
- Peticiones HTTP vía Axios a endpoints locales del servidor (`/api/cortex`, `/api/bio`, `/api/clinical/validate-appointment`).
- Almacenamiento local temporal en `localStorage` / `sessionStorage` para recuperación ante caídas.
- Generación de reportes PDF en el cliente mediante `html2pdf.js`.

## Verification
- Run: `npm run build`
