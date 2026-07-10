import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';

const AntigravityCanvas = () => {
    const sceneRef = useRef(null);
    const engineRef = useRef(null);
    const requestRef = useRef(null);

    useEffect(() => {
        // 1. Setup Matter.js Engine
        const Engine = Matter.Engine;
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const Mouse = Matter.Mouse;
        const MouseConstraint = Matter.MouseConstraint;

        const engine = Engine.create();
        engineRef.current = engine;

        // Zero gravity for floating effect
        engine.world.gravity.y = 0;
        engine.world.gravity.x = 0;

        // 2. Create Bodies (Nutrient Orbs)
        const colors = [
            '#1a73e8', // Brand Blue
            '#34d399', // Emerald (Vitamins)
            '#f472b6', // Pink (Minerals)
            '#fbbf24', // Amber (Energy)
            '#a78bfa'  // Purple (Antioxidants)
        ];

        const width = window.innerWidth;
        const height = window.innerHeight;
        const orbs = [];

        for (let i = 0; i < 20; i++) {
            const radius = 15 + Math.random() * 30; // 15px to 45px
            const x = Math.random() * width;
            const y = Math.random() * height;

            const body = Bodies.circle(x, y, radius, {
                restitution: 0.9, // Bouncy
                frictionAir: 0.02, // Floating resistance
                density: 0.01 // Light
            });

            // Validamos que exista una referencia al DOM
            // (Se asignará dinámicamente en el render, pero aquí definimos la metadata)
            body.render.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            body.plugin = { id: `orb-${i}`, radius };

            // Random initial velocity to start movement
            Matter.Body.setVelocity(body, {
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2
            });

            orbs.push(body);
        }

        World.add(engine.world, orbs);

        // 3. Walls (Invisible boundaries to keep orbs in screen)
        const wallOptions = {
            isStatic: true,
            render: { visible: false }
        };
        const walls = [
            Bodies.rectangle(width / 2, -50, width, 100, wallOptions), // Top
            Bodies.rectangle(width / 2, height + 50, width, 100, wallOptions), // Bottom
            Bodies.rectangle(width + 50, height / 2, 100, height, wallOptions), // Right
            Bodies.rectangle(-50, height / 2, 100, height, wallOptions) // Left
        ];
        World.add(engine.world, walls);

        // 4. Mouse Control (Interactive!)
        // Necesitamos un elemento para capturar eventos si está detrás.
        // Pero si usamos el window como target, captura todo.
        // Usaremos el contenedor ref.
        const mouse = Mouse.create(document.body); // Capture global events for background interaction
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.1,
                render: { visible: false }
            }
        });
        World.add(engine.world, mouseConstraint);

        // Sincronizar coordenadas del mouse de Matter con el DOM
        // (Matter asume canvas, aquí ajustamos si es necesario, pero document.body suele funcionar)

        // 5. Render Loop (Custom DOM Ref Update)
        const update = () => {
            Engine.update(engine, 1000 / 60);

            // Sincronizar DOM Elements
            orbs.forEach(body => {
                const id = body.plugin.id;
                const element = document.getElementById(id);

                if (element) {
                    const { x, y } = body.position;
                    const angle = body.angle;

                    // GPU Acceleration
                    element.style.transform = `translate3d(${x - body.plugin.radius}px, ${y - body.plugin.radius}px, 0) rotate(${angle}rad)`;
                }
            });

            requestRef.current = requestAnimationFrame(update);
        };

        update();

        // Cleanup
        return () => {
            cancelAnimationFrame(requestRef.current);
            Matter.Engine.clear(engine);
            // Remove events if added manually
        };
    }, []);

    // Render estático de los elementos DOM
    // (Matter moverá estos divs via transform)
    // Re-calculamos colors/radius aquí solo para el render inicial o usamos el array del efecto con un state?
    // Para hacerlo simple y performant:
    // Renderizamos 20 divs fijos y dejamos que Matter los tome por ID.

    // Nota: En una app real, sincronizaríamos state, pero para background effects, 
    // IDs estáticos son más rápidos.

    const orbs = Array.from({ length: 20 }).map((_, i) => {
        // Estos valores iniciales visuales se sobreescribirán casi inmediatamente por el loop de Matter
        // Pero necesitamos definirlos para que existan.

        // Recuperamos los colores aleatorios de una forma determinista o los asignamos en CSS?
        // Asignaremos clases aleatorias o estilos inline.
        const colors = [
            'bg-blue-400', 'bg-emerald-400', 'bg-pink-400', 'bg-amber-400', 'bg-violet-400'
        ];
        const colorClass = colors[i % colors.length];
        const size = 15 + (i % 3) * 10; // Simple size variance: 15, 25, 35

        return (
            <div
                key={i}
                id={`orb-${i}`}
                className={`absolute rounded-full shadow-lg backdrop-blur-sm opacity-60 ${colorClass}`}
                style={{
                    width: `${size * 2}px`, // Radius * 2
                    height: `${size * 2}px`,
                    left: 0,
                    top: 0,
                    willChange: 'transform', // Opitmize layout
                    zIndex: -1, // Behind everything inside this container
                }}
            />
        );
    });

    return (
        <div
            ref={sceneRef}
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
            aria-hidden="true"
        >
            <div className="absolute inset-0 bg-slate-50 opacity-90" /> {/* Fondo base suave */}
            {orbs}
        </div>
    );
};

export default AntigravityCanvas;
