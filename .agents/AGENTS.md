# Reglas Inmutables del Proyecto: Ecosistema T.I.L.O. & Sinergix (Visión 2030)

Este archivo establece las **Reglas Inmutables de Ingeniería Visual e Interfaz** que deben cumplir de forma obligatoria todos los agentes de software y desarrolladores que operen en este espacio de trabajo.

---

## 🎨 1. Sistema Semántico de Color (Regla 60-30-10)

El color opera estrictamente como un indicador de estado clínico y biológico. Quedan prohibidos los bloques de color saturados decorativos en interfaces web o móviles.

*   **60% (Lienzo)**:
    *   *Modo Claro*: Blanco Quirúrgico (`#FAFAFA`) para evocar limpieza y asepsia de laboratorio.
    *   *Modo Oscuro*: Gris Carbón / Grafito (rango de `#121212` a `#1E1E1E`). Queda **estrictamente prohibido** el uso de negro puro (`#000000`) en superficies generales de interfaz para prevenir la fatiga visual y el efecto de *halación* (resplandor de los bordes tipográficos) en usuarios con astigmatismo o dislexia.
*   **30% (Estructural)**: Azul Corporativo (`#1C75BC`). Reservado para la estructura y soporte de la interfaz (menús de navegación, bordes Bento, iconos de soporte, botones secundarios).
*   **10% (Acento Biosemántico)**: Exclusivo para estímulos de acción principal y telemetría de las fórmulas:
    *   **Rojo Ignición Mitocondrial (`#E30613`)**: Exclusivo de la fórmula **33Plus®** (Energía y termogénesis).
    *   **Verde Ingeniería Tisular (`#3AAA35`)**: Exclusivo de la fórmula **34Plus®** (Recuperación y homeostasis).
    *   *Modo Oscuro*: Estas variantes deben desaturarse en un 20%-30% (ej. Rojo Coral `#F85A5A` y Verde Menta `#76D773`) para evitar la vibración retiniana.

### ⚠️ Cuarentena Cromática: Amarillo y Rosa
*   Los colores Rosa Ilusión (`#F29FC5` / `#E6007E`) y Amarillo Creatividad (`#FFCC00`) heredados del logotipo original **tienen prohibido existir fuera de la representación tridimensional del rompecabezas (canvas WebGL en R3F)**.
*   Ningún componente general de la interfaz de usuario (botones, fondos, textos, iconos estructurales, modales) utilizará estos colores para preservar el minimalismo clínico.

---

## 🔤 2. Tipografía y Jerarquía Visual de Pantalla

Para preservar el rigor y la legibilidad matemática de la biotelemetría del paciente:
*   **Prototype**: Confinada únicamente al **Logotipo Principal** de "Equipo en Acción" y a los **nombres comerciales de los productos** a gran escala.
*   **Inter o SF Pro (Neo-Grotescas)**: De uso **obligatorio** para todo el cuerpo de texto, descripciones clínicas, valores de dosificación, tablas analíticas y pantallas del sistema.
*   **Sansation**: Queda **deprecada** de las interfaces operativas densas y de lectura clínica en pantalla. Solo se retiene para correspondencia administrativa impresa y papelería corporativa fuera de la pantalla de datos clínicos.

---

## ♿ 3. Accesibilidad Universal (WCAG 2.1 - AA)

El color nunca viajará solo para denotar estados de salud o alertas metabólicas:
*   **Doble Codificación**: Cada alerta biológica o estado (éxito/error/riesgo) se codificará con iconos vectoriales SVG discretos, tramas o texto explícito que acompañen al color.
*   **Contraste Óptico**: Relación de contraste mínima de **4.5:1** para texto normal y **3:1** para elementos gráficos y texto grande.
*   **Touch Targets**: Las cápsulas y botones interactivos en terminales móviles mantendrán un área mínima de **44x44 pt (9mm)** para permitir el control ergonómico con una sola mano.

---

## 📑 4. Visualización de Ingredientes y Fórmulas de Precisión

Toda maquetación de ingredientes moleculares de las fórmulas **33Plus®** y **34Plus®** se estructurará bajo las siguientes reglas:
1.  **Divulgación Progresiva Obligatoria**:
    *   *Nivel 1 (Glanceable)*: Lienzo libre de ruido que muestra de 3 a 5 "Ingredientes Héroes" y un anillo de progreso concentrado o gráfico modular.
    *   *Nivel 2 (Interacción Activa)*: Apertura de panel lateral translúcido Liquid Glass (glassmorphism con 60% de opacidad y `backdrop-filter: blur(16px)`) con detalle del beneficio clínico, dosificación y evidencia científica.
2.  **Sistemas de Espaciado Estricto**:
    *   *Grilla de 4 Puntos*: Todo componente de interfaz se calculará en múltiplos de **4px**.
    *   *Macro-espacios Clínicos*: Márgenes de respiro de **40px a 64px** entre bloques principales de datos para proyectar sofisticación y orden clínico.

---

## ⚡ 5. Rendimiento de Gráficos (WebGL / Three.js) y Reducción de Movimiento

Para sostener el pilar de **Sustentabilidad Digital**:
1.  **Eficiencia y Recolección de Recursos**: Todo renderizador de R3F o Three.js debe empaquetarse con carga diferida (`<Suspense>`) y destruir activamente sus render loops y event listeners cuando el componente sea desmontado o la pestaña no sea visible.
2.  **Respeto al Movimiento Reducido**: Vinculación obligatoria del sensor `@media (prefers-reduced-motion)` para detener la simulación física e inercias de cámara WebGL de inmediato, reemplazándolas por una vista estática optimizada de alta fidelidad.

---

## 🔒 6. Protección Estricta de Fases del Triage (Fases 0 a 17)

Queda estrictamente prohibida cualquier modificación de código, prompts, flujos de validación o copywriting clínico en las **Fases 0 a la 17** de la aplicación (incluyendo los archivos de componentes, y las reglas dentro de `useCortex.js`, `App.jsx` y `server/index.js` que afecten a estas fases), a menos que exista una orden explícita y de doble confirmación por parte del Director (Andrés Trejo).

### Protocolo de Excepción (Doble Confirmación)
Ante cualquier solicitud de cambio en estas fases (0 a 17), el agente debe:
1. **Detenerse de inmediato.**
2. **Advertir:** Recordar al usuario que estas fases están bajo protección estricta del proyecto.
3. **Preguntar de forma explícita:** *"Andrés, las Fases de la 0 a la 17 están bajo protección estricta. ¿Está absolutamente seguro de que desea proceder con este cambio en la Fase [X]?"*
4. **Esperar confirmación:** No realizar ningún cambio en el código, ejecutar comandos ni alterar archivos hasta que el Director responda afirmativamente por escrito.

---

## 🔒 7. Blindaje Inviolable de la App de Consulta Nutricional (App 1)

La **App de Consulta Nutricional** (`client/`) se declara **OFICIALMENTE COMPLETA Y FUNCIONAL EN SU TOTALIDAD**.

Queda **ESTRICTAMENTE PROHIBIDO** bajo cualquier concepto modificar, alterar, refactorizar o editar cualquier archivo, componente, hook, módulo o configuración perteneciente a la **App de Consulta Nutricional** (`client/`), a menos que se cumpla el siguiente protocolo obligatorio:

### Protocolo Obligatorio para Modificar la App 1:
1. **Presentación de Plan de Implementación:** El agente debe elaborar y presentar previamente un **Plan de Implementación detallado** (`implementation_plan.md`) exponiendo los cambios sugeridos, la justificación clínica/técnica y la evaluación de impacto.
2. **Autorización Expresa del Director:** El agente debe **detener la ejecución de inmediato** y solicitar la autorización afirmativa, explícita y por escrito del Director (Andrés Trejo) para proceder con dicho plan.
3. **Prohibición de Edición Directa:** Sin un plan presentado y la confirmación explícita recibida por escrito del Director, queda estrictamente prohibida la edición de cualquier archivo dentro de `client/`.
