---
name: tilo-send-button-cortex
description: Estandariza la generación del "Botón de Enviar" (Send button) o "Ícono de Avión de Papel" en las interfaces de chat de toda la aplicación T.I.L.O.
---

# Estandarización del Botón de Enviar (Paper Plane Icon)

## Descripción y Propósito
El objetivo de esta skill es garantizar una consistencia absoluta en el diseño UI/UX del botón para enviar mensajes en los módulos de chat y formularios de entrada de la aplicación "T.I.L.O.". El botón de envío debe presentar siempre el diseño universal de un "Avión de Papel" enmarcado dentro de un círculo azul (Blue 600) que se alinee con la identidad visual institucional de la marca.

## Regla Estricta
**SIEMPRE** que debas crear, arreglar, renderizar o refactorizar el botón para enviar texto (Input submit button) en el chat de la aplicación (independientemente de la Fase en la que estés trabajando), deberás usar estrictamente el siguiente código y diseño utilizando el ícono `Send` de `lucide-react` y las siguientes clases de Tailwind CSS.

### Blueprint del Componente Aprobado:

```jsx
import { Send } from "lucide-react";

{/* ... código del input ... */}

<button
  onClick={handleSend} // o la función que active el envío
  className="bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md flex-shrink-0"
>
  <Send className="w-5 h-5" />
</button>
```

### Especificaciones de Diseño (Design Tokens)
- **Componente Ícono:** `<Send />` importado estrictamente desde `lucide-react`.
- **Dimensiones del Ícono:** `w-5 h-5`
- **Fondo y Forma del Contenedor:** Círculo perfecto (`w-10 h-10 rounded-full`) con color azul institucional (`bg-blue-600`).
- **Estado Hover:** Cambio de azul a tono más oscuro (`hover:bg-blue-700`).
- **Interacción/Feedback:** Reducción ligera al hacer clic (`active:scale-95`) y transición suave (`transition-transform`).
- **Sombras y Ajustes:** Sombra media (`shadow-md`) y resistencia al colapso en Flexbox (`flex-shrink-0`).
- **Color de Elemento:** Ícono en blanco (`text-white`).

## Exclusiones
1. **NO usar** íconos nativos, emojis, ni componentes genéricos del navegador web.
2. **NO usar** clases que deformen las proporciones del círculo a elipses u otras geometrías (`w-10 h-10` deben ser siempre estrictos).
3. **NO aplicar** esta regla a otros botones de interacción (como los botones binarios ✅/❌). Esta skill afecta **ÚNICAMENTE** al botón principal de envío de texto de usuario.
