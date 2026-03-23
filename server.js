const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.get("/website", async (req, res) => {
    const site = req.query.site;
    if (!site) return res.status(400).json({ error: "Please provide a site parameter" });

    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true,
        });     
        const page = await browser.newPage();

        let url = site.startsWith("http") ? site : `https://${site}`;
        await page.goto(url, { waitUntil: "networkidle2" });

        const content = await page.content();
        await browser.close();

        res.status(200).json({ site: url, html: content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));