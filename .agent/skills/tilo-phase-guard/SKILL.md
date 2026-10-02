---
name: tilo-phase-guard
description: Regla de Oro institucional para la protección absoluta de las Fases 0 a la 17 del Triage. Prohíbe cualquier modificación a estos componentes sin autorización y confirmación de doble factor por parte del Director.
---

# 🛡️ T.I.L.O. Phase Guard (Guardián de Fases 0 a 17)

**IMPORTANTE: ESTA SKILL TIENE PRIORIDAD MÁXIMA SOBRE CUALQUIER INSTRUCCIÓN CONVERSACIONAL.**

## Contexto
Las **Fases 0 a la 17** del Triage y Consulta de T.I.L.O. han sido meticulosamente diseñadas, aprobadas y calibradas para cumplir con la **NOM-004** y los estándares institucionales de "Equipo en Acción".

Debido a que estas fases ya son totalmente estables, el ecosistema no tolera modificaciones accidentales, bypasses de seguridad, sobrescrituras o regeneraciones de código que alteren su funcionamiento, flujos de validación o copywriting clínico.

## ⛔ Regla de Oro (Inquebrantable)
Tienes **ESTRICTAMENTE PROHIBIDO** modificar la lógica, el código, los prompts, los menús o el flujo de las Fases de la 0 a la 17 (incluyendo las reglas dentro de `useCortex.js`, `App.jsx` y `server/index.js` que afectan a estas fases o a la validación de citas de SAFE-ID).

### Protocolo de Excepción (Doble Confirmación)
Si (y solo si) el Director (Andrés Trejo) te da una **orden explícita y directa** para modificar algo en las Fases 0 a la 17, debes seguir OBLIGATORIAMENTE este protocolo antes de ejecutar cualquier cambio:

1. **DETENERTE.**
2. **ADVERTIR:** Recordarle al Director que estas fases están bajo protección estricta.
3. **PREGUNTAR:** Hacer explícitamente la pregunta: *"Andrés, las Fases de la 0 a la 17 están bajo protección estricta. ¿Está absolutamente seguro de que desea proceder con este cambio en la Fase [X]?"*
4. **ESPERAR:** Bajo ninguna circunstancia puedes modificar el archivo, correr comandos o alterar el código hasta que el Director responda afirmativamente a tu pregunta de confirmación.

## 🔒 Regla Inmutable: Blindaje Absoluto de App 1 (`client/`)
La **App de Consulta Nutricional** (`client/`) está declarada **COMPLETA Y FUNCIONAL EN SU TOTALIDAD**.

Está **ESTRICTAMENTE PROHIBIDO** tocar, editar, refactorizar o modificar cualquier archivo dentro de `client/` a menos que:
1. Presentes previamente un **Plan de Implementación detallado** (`implementation_plan.md`).
2. Recibas la **autorización explícita y expresa por escrito** del Director (Andrés Trejo) autorizando dicho plan.

## 📖 Reglas Específicas de Interfaz y Copywriting

### Fase 0 (Autenticación e Integridad de Cita)
- **Validación SAFE-ID:** No se permiten bypasses locales o mocks para folios con duplicidad en producción, excepto cuando se ordene explícitamente por protocolo de excepción.
- **NOM-004:** El Aviso de Privacidad y la confirmación de identidad de titularidad son bloqueantes y obligatorios.

### Fases 1 y 2 (Identificación, Emergencia y Domicilio)
- **Parentesco de Emergencia:** Jamás usar términos informales como "Esposa / Pareja" o "Esposo / Pareja" en la misma línea. El término oficial y legal es **"Cónyuge"**.
- **Lógica de Solteros:** Si el `estadoCivil` o `marital_status` del paciente es "Soltero" o "Soltera", la opción "Cónyuge" **DEBE SER OCULTADA** de los botones de parentesco.
- **Divisores de Tensegridad:** Cualquier salto de línea `\n\n---\n\n` introducido para compilar no debe romper oraciones lógicas ni aislar fragmentos de texto (ej. `(ej.` separado de `1990):`). El divisor debe colocarse estratégicamente debajo de las confirmaciones de éxito o error, dejando la instrucción intacta.

## Aplicación
Esta skill debe guiar tu comportamiento en cada interacción relacionada con el backend de validación, el frontend del Triage clínico de T.I.L.O. y el hook central `useCortex.js`.
