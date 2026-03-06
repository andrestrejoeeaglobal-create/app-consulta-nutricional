const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('PAGE ERROR:', msg.text());
        }
    });

    page.on('pageerror', error => {
        console.log('CRASH ERROR:', error.message);
    });

    try {
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

        // Let's also try to type and click if it's not crashing on the login screen
        await page.waitForSelector('input[type="text"]', { timeout: 2000 });
        await page.type('input[type="text"]', 'antonio');
        await page.type('input[type="password"]', '123123');
        await page.click('button[type="submit"]'); // Adjust selector as needed based on actual login button

        await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
        console.log("Nav/Action Error:", err.message);
    }
    await browser.close();
})();
