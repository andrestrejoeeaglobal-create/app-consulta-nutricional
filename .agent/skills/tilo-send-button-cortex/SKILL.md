---
name: tilo-send-button-cortex
description: Estandariza la generación del "Botón de Enviar" (Send button) o "Ícono de Avión de Papel" en las interfaces de chat de toda la aplicación T.I.L.O. bajo la Constitución Visual v2.0.2.
---

# Estandarización del Botón de Enviar (Paper Plane Icon — v2.0.2)

## Descripción y Propósito
Garantizar consistencia absoluta y ergonomía táctil grado médico (WCAG 2.2 AAA, área mínima `>= 44x44 px`) en el botón para enviar mensajes dentro de los módulos de chat de la aplicación **T.I.L.O.** de **Equipo en Acción®**, empleando el Azul Corporativo oficial (`#1C75BC`).

## Regla Estricta
**SIEMPRE** que debas crear, arreglar, renderizar o refactorizar el botón para enviar texto en el chat de la aplicación, deberás usar estrictamente el ícono `Send` de `lucide-react` y las siguientes clases de Tailwind CSS:

### Blueprint del Componente Aprobado:

```jsx
import { Send } from "lucide-react";

<button
  type="button"
  onClick={handleSend}
  aria-label="Enviar mensaje"
  className="bg-[#1C75BC] hover:bg-[#155A92] text-white w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-transform active:scale-95 shadow-md flex-shrink-0 cursor-pointer"
>
  <Send className="w-5 h-5" strokeWidth={2} />
</button>
```

### Especificaciones de Diseño (Design Tokens v2.0.2)
- **Componente Ícono:** `<Send />` importado desde `lucide-react` con `strokeWidth={2}`.
- **Área Táctil Mínima:** Círculo perfecto `w-11 h-11 min-w-[44px] min-h-[44px] rounded-full`.
- **Color Institucional:** Azul Corporativo `bg-[#1C75BC]` con estado `hover:bg-[#155A92]` y texto/icono `text-white`.
- **Interacción:** `active:scale-95 transition-transform flex-shrink-0`.

## Exclusiones
1. **NO usar** íconos nativos, emojis ni tamaños menores a `44x44 px` (`w-10 h-10` queda deprecado).
2. **NO aplicar** esta regla a botones binarios de confirmación clínica (`✅`/`❌`).
