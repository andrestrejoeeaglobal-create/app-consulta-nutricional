---
name: tilo-phase-closure-standard
description: Estándar arquitectónico Headless y visual (Markdown-Pill Protocol) para la generación y cierre de resúmenes de datos en todas las Fases del ecosistema T.I.L.O.
---

# T.I.L.O. Phase Closure Standard (Markdown-Pill Protocol)

## 🎯 Objetivo de la Skill
Esta Skill es un guardián arquitectónico. Su propósito es garantizar la consistencia visual, la ligereza del DOM y evitar bloqueos en la interfaz conversacional al finalizar cualquier Fase Clínica de recolección de datos (Fase 3 a Fase 17). Obliga a separar estrictamente la UI Compleja (Dashboard) de la UI Conversacional (Chat).

## 🚫 1. RESTRICCIONES ABSOLUTAS (PROHIBICIONES EN EL CHAT)
- **NUNCA** retornes componentes UI pesados (`<Card>`, `<Grid>`, `<Table>`, modales o contenedores con `h-full`/`w-full`) desde el componente lógico de una Fase para ser renderizados en el flujo del chat.
- **NUNCA** utilices estilos de fondo, bordes o márgenes complejos para mostrar resúmenes de datos en el panel izquierdo. Las tarjetas clínicas estructuradas pertenecen *única y exclusivamente* al Dashboard (Panel Derecho).

## ✅ 2. ARQUITECTURA HEADLESS Y RETORNO CERO
- Los componentes de Fase (Ej. `Fase7_Habitos.jsx`) que operan dentro del bucle del chat deben ser estrictamente **Headless** al momento del cierre.
- Deben finalizar su ejecución retornando `null` o renderizando únicamente slots dinámicos mínimos que no ocupen toda la pantalla.
- La inserción del resumen en pantalla se hará **exclusivamente inyectando un mensaje estándar** a través de la función `setMessages`.

## 💬 3. ANATOMÍA DEL MENSAJE DE CIERRE (El Patrón "Markdown-Pill")
Todo resumen de cierre inyectado mediante `setMessages` debe ser construido como un `Template Literal` de JavaScript y seguir esta jerarquía estricta:

1. **Apertura Institucional:** Un párrafo breve justificando la validación de datos (ej. *"Para dar cumplimiento a la NOM-004 y sellar formalmente este bloque..."*).
2. **Cuerpo de Datos (Lista Markdown):** Los valores capturados se enlistan verticalmente. Cada línea debe usar un solo Emoji temático como viñeta, seguido de la etiqueta en negrita y su valor. (Uso intensivo de `\n`).
3. **Pregunta de Cierre:** Una llamada a la acción directa. (Ej. *"\n\n¿Es correcta esta información?"*).

**Ejemplo Estructural del Código:**
```javascript
const summaryText = `Para cerrar este bloque del expediente, por favor verifique los datos registrados:

🚭 **Tabaquismo:** ${smokeStatus}
🍺 **Alcohol:** ${alcoholStatus}
🏃 **Ejercicio:** ${exerciseStatus}

¿Es correcta esta información?`;

setMessages(prev => [...prev, {
    role: 'assistant',
    content: summaryText,
    options: [
        { label: "✅ Sí, es correcta", value: "CONFIRM" },
        { label: "❌ No, quiero corregir algo", value: "EDIT" }
    ]
}]);
```

## 🔘 4. ESTANDARIZACIÓN DE BOTONES INTERACTIVOS (PILLS)
- La respuesta del usuario al cierre de fase siempre se capturará usando el atributo nativo `options` dentro del objeto de mensaje.
- **Orden Obligatorio:** La acción afirmativa/positiva **siempre** va a la izquierda (índice 0). La acción negativa/correctiva va a la derecha (índice 1).
- **Estándar Visual:** Deben incluir emojis universales de confirmación (`✅` y `❌`) para facilitar la rápida toma de decisiones cognitivas del paciente/usuario.
