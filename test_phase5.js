const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching browser...");
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    } catch (e) {
        console.log("Could not launch system Chrome, trying Program Files (x86)...");
        browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    const page = await browser.newPage();

    // Enable console logging from the browser
    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        const text = msg.text();
        console.log(`[BROWSER ${type}] ${text}`);
    });

    page.on('pageerror', error => {
        console.log('CRASH ERROR:', error.message);
    });

    try {
        // Set request interception to mock login API
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().includes('/api/login') && request.method() === 'POST') {
                console.log("Intercepted login POST request, responding with mock success...");
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    headers: {
                        'access-control-allow-origin': '*'
                    },
                    body: JSON.stringify({
                        success: true,
                        user: {
                            userId: 67197,
                            name: "ANDRES TREJO MALDONADO",
                            puesto: "CEO",
                            role: "SPECIALIST",
                            token: "EA_LAB_MOCK_TOKEN_2026"
                        }
                    })
                });
            } else {
                request.continue();
            }
        });

        console.log("Navigating to app...");
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

        console.log("Bypassing login...");
        await page.waitForSelector('input[placeholder="Ingresa tu usuario"]', { timeout: 5000 });
        await page.type('input[placeholder="Ingresa tu usuario"]', 'andres trejo');
        await page.type('input[placeholder="••••••••"]', 'anything');
        await page.click('button[type="submit"]');

        console.log("Waiting for citation input...");
        await page.waitForSelector('input[placeholder="Escribe tu respuesta..."]', { timeout: 10000 });
        
        console.log("Entering citation ID 11000...");
        await page.type('input[placeholder="Escribe tu respuesta..."]', '11000');
        await page.keyboard.press('Enter');

        console.log("Waiting 2s...");
        await new Promise(r => setTimeout(r, 2000));
        
        // Print found buttons
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button')).map(b => b.innerText);
        });
        console.log("Found buttons:", buttons);

        // Click the privacy policy accept button if present
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const acceptBtn = btns.find(b => b.innerText.includes('ACEPTO') || b.innerText.includes('Aceptar') || b.innerText.includes('SÍ'));
            if (acceptBtn) {
                acceptBtn.click();
                console.log("Clicked Accept Privacy button in browser");
            }
        });

        await new Promise(r => setTimeout(r, 2000));

        // Click option buttons to advance
        for (let step = 0; step < 40; step++) {
            console.log(`\n--- Automation Step ${step} ---`);
            const currentMsgs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.flex-1.overflow-y-auto p, .flex-1.overflow-y-auto span')).map(el => el.innerText).slice(-3);
            });
            console.log("Last messages in chat:", currentMsgs);

            // If there are hotspots (VisualBodyMap), click the first one to select a zone!
            const hotspotClicked = await page.evaluate(() => {
                const hotspots = Array.from(document.querySelectorAll('.hotspot'));
                if (hotspots.length === 0) return null;
                const alreadyActive = hotspots.some(h => h.classList.contains('active'));
                if (alreadyActive) return null;
                hotspots[0].click();
                return `Clicked hotspot: ${hotspots[0].querySelector('.tooltip')?.innerText || 'hotspot'}`;
            });
            if (hotspotClicked) {
                console.log("Action:", hotspotClicked);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            const clicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                
                // Prioritize specific path actions
                const selectDiagnosisBtn = btns.find(b => !b.disabled && b.innerText.toUpperCase().includes('SELECCIONAR DIAGNÓSTICOS'));
                if (selectDiagnosisBtn) {
                    selectDiagnosisBtn.click();
                    return `Clicked: ${selectDiagnosisBtn.innerText}`;
                }
                
                const diabetesBtn = btns.find(b => !b.disabled && b.innerText.toUpperCase().includes('DIABETES'));
                if (diabetesBtn) {
                    diabetesBtn.click();
                    return `Clicked: ${diabetesBtn.innerText}`;
                }

                const activeBtn = btns.find(b => {
                    if (b.disabled) return false;
                    const text = b.innerText.trim();
                    if (!text) return false;
                    
                    const txt = text.toUpperCase();
                    const isChat = b.closest('.flex-1.overflow-y-auto') !== null;
                    const isInputBar = b.closest('.relative.flex.items-center.gap-2') !== null;
                    const isOverlay = txt.includes('ACEPTO AVISO') ||
                                      txt.includes('SÍ, SOY YO') ||
                                      txt.includes('NO, ES UN ERROR') ||
                                      txt.includes('ACEPTO') ||
                                      txt.includes('CONTINUAR') ||
                                      txt.includes('CONFIRMAR') ||
                                      txt.includes('GUARDAR');
                    
                    return isChat || isInputBar || isOverlay;
                });
                if (activeBtn) {
                    activeBtn.click();
                    return `Clicked: ${activeBtn.innerText}`;
                }
                return null;
            });
            console.log("Action:", clicked);
            if (!clicked) {
                // Get the last assistant message text
                const lastMsg = currentMsgs[currentMsgs.length - 1] || "";
                let typeText = "";
                
                if (lastMsg.includes("DÍA") || lastMsg.includes("Dia")) {
                    typeText = "12";
                } else if (lastMsg.includes("MES") || lastMsg.includes("Mes")) {
                    typeText = "05";
                } else if (lastMsg.includes("AÑO") || lastMsg.includes("Año")) {
                    typeText = "1985";
                } else if (lastMsg.includes("CURP")) {
                    typeText = "RESA850512HDFXXX01";
                } else if (lastMsg.includes("postal") || lastMsg.includes("CP") || lastMsg.includes("C.P.") || lastMsg.includes("Postal")) {
                    typeText = "76000";
                } else if (lastMsg.includes("calle") || lastMsg.includes("Calle") || lastMsg.includes("Domicilio") || lastMsg.includes("domicilio")) {
                    typeText = "Av. Constituyentes";
                } else if (lastMsg.includes("exterior") || lastMsg.includes("Ext")) {
                    typeText = "123";
                } else if (lastMsg.includes("alternativo") || lastMsg.includes("contacto") || lastMsg.includes("Contacto") || lastMsg.includes("emergencia")) {
                    typeText = "4429876543";
                } else if (lastMsg.includes("teléfono") || lastMsg.includes("telefono") || lastMsg.includes("celular") || lastMsg.includes("Celular")) {
                    typeText = "4421234567";
                } else if (lastMsg.includes("correo") || lastMsg.includes("electrónico") || lastMsg.includes("electronico") || lastMsg.includes("Email") || lastMsg.includes("email")) {
                    typeText = "test@example.com";
                } else if (lastMsg.includes("parentesco") || lastMsg.includes("Parentesco")) {
                    typeText = "Madre";
                } else if (lastMsg.includes("síntoma") || lastMsg.includes("sintoma") || lastMsg.includes("describa") || lastMsg.includes("molestia")) {
                    typeText = "Ninguno";
                } else if (lastMsg.includes("motivo") || lastMsg.includes("Motivo")) {
                    typeText = "Bajar de peso y mejorar mi salud";
                }

                if (typeText) {
                    console.log(`Typing: "${typeText}" for message: "${lastMsg.substring(0, 50)}..."`);
                    await page.type('input[placeholder="Escribe tu respuesta..."]', typeText);
                    await page.keyboard.press('Enter');
                } else {
                    const options = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('button')).map(b => b.innerText);
                    });
                    console.log("No matching action. Available buttons:", options);
                }
            }
            await new Promise(r => setTimeout(r, 3000));
        }

    } catch (err) {
        console.log("Error in script:", err.message);
    }
    await browser.close();
    console.log("Browser closed.");
})();
