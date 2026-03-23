const express = require("express")
const puppeteer = require("puppeteer")

const app = express()

let browser

async function start() {
    browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized"]
    })
}

start()

app.get("/website", async (req, res) => {
    const site = req.query.site
    if (!site) return res.send("Missing ?site=")

    const page = await browser.newPage()
    await page.goto(site.startsWith("http") ? site : "https://" + site)

    const ws = browser.wsEndpoint()

    res.send(`
        <html>
        <body style="margin:0;background:black;color:white;font-family:sans-serif">
            <h2>Chromium running locally</h2>
            <p>You are controlling a real browser window on the server.</p>
            <p>WebSocket endpoint:</p>
            <code>${ws}</code>
            <p>Open DevTools manually to interact.</p>
        </body>
        </html>
    `)
})

app.listen(3000, () => {
    console.log("http://localhost:3000/website?site=example.com")
})