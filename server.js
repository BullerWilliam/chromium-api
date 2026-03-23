const express = require("express")
const puppeteer = require("puppeteer")

const app = express()

let browser

async function start() {
    browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox"
        ]
    })
}

start()

app.get("/website", async (req, res) => {
    const site = req.query.site
    if (!site) return res.send("Missing ?site=")

    const page = await browser.newPage()
    await page.goto(site.startsWith("http") ? site : "https://" + site)

    const content = await page.content()

    res.send(content)
})

app.listen(3000, () => {
    console.log("Running on port 3000")
})