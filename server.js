const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
let browser;

async function start() {
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"]
  });
}

start();

app.get("/website", async (req, res) => {
  const site = req.query.site;
  if (!site) return res.send("Missing ?site=");

  // Open a new browser page
  const page = await browser.newPage();
  await page.goto(site.startsWith("http") ? site : "https://" + site);

  res.send(`
    <html>
      <body style="font-family:sans-serif">
        <h2>Chromium is running on your PC</h2>
        <p>Open the browser window Puppeteer launched to interact with ${site}.</p>
        <p>This endpoint cannot directly stream the interactive browser.</p>
      </body>
    </html>
  `);
});

app.listen(3000, () => console.log("Visit http://localhost:3000/website?site=example.com"));