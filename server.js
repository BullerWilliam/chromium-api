const express = require("express");
const cheerio = require("cheerio");
const { URL } = require("url");

const app = express();
const PORT = 7000;

const encodeUrl = (url) => Buffer.from(url).toString("base64");
const decodeUrl = (b64) => Buffer.from(b64, "base64").toString("utf8");

// Redirect /website?site=google.com -> /encoded?site=BASE64
app.get("/website", (req, res) => {
  const site = req.query.site;
  if (!site) return res.status(400).send("Missing site parameter");
  const target = site.startsWith("http") ? site : `https://${site}`;
  res.redirect(`/encoded?site=${encodeUrl(target)}`);
});

// /encoded proxy
app.use("/encoded", async (req, res) => {
  const encoded = req.query.site;
  if (!encoded) return res.status(400).send("Missing site parameter");

  const target = decodeUrl(encoded);
  const targetUrl = new URL(req.url.replace(/^\/encoded/, ""), target).toString();

  // Dynamic import of node-fetch for CJS
  const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

  // Copy headers
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (["host", "content-length", "connection"].includes(key.toLowerCase())) continue;
    headers[key] = value;
  }

  // Forward body if needed
  let body;
  if (!["GET", "HEAD"].includes(req.method)) {
    body = [];
    for await (const chunk of req) body.push(chunk);
    body = Buffer.concat(body);
  }

  let upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body && body.length ? body : undefined,
    redirect: "manual"
  });

  // Handle redirects
  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      const redirectUrl = new URL(location, target).toString();
      return res.redirect(`/encoded?site=${encodeUrl(redirectUrl)}`);
    }
  }

  // Copy non-hop headers
  for (const [key, value] of upstream.headers) {
    if (!["connection","keep-alive","transfer-encoding","content-length","content-encoding"].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  }

  const contentType = upstream.headers.get("content-type") || "";
  const array = Buffer.from(await upstream.arrayBuffer());

  if (contentType.includes("text/html")) {
    const $ = cheerio.load(array.toString("utf8"), { decodeEntities: false });

    // Rewrite links, forms, scripts, images, etc.
    const attrs = [
      ["a","href"], ["form","action"], ["link","href"], ["script","src"],
      ["img","src"], ["iframe","src"], ["source","src"], ["video","src"],
      ["audio","src"], ["track","src"], ["area","href"], ["object","data"], ["embed","src"]
    ];

    for (const [tag, attr] of attrs) {
      $(tag).each((_, el) => {
        const val = $(el).attr(attr);
        if (!val) return;
        try {
          const u = new URL(val, target);
          $(el).attr(attr, `/encoded?site=${encodeUrl(u.toString())}`);
        } catch {}
      });
    }

    // Meta refresh
    $("meta[http-equiv='refresh']").each((_, el) => {
      const content = $(el).attr("content");
      if (!content) return;
      const match = content.match(/url=(.*)$/i);
      if (!match) return;
      const next = new URL(match[1], target).toString();
      $(el).attr("content", content.replace(/url=.*$/i, `url=/encoded?site=${encodeUrl(next)}`));
    });

    // Inject JS for dynamic clicks/forms
    $("head").prepend(`
      <script>
      (() => {
        const encode = s => btoa(s);
        const site = "${target}";
        const proxify = (v) => {
          if (!v) return v;
          try { return '/encoded?site=' + encode(new URL(v, site).toString()); } 
          catch { return v; }
        };
        document.addEventListener('click', e => {
          const a = e.target.closest('a[href]');
          if (a) {
            const n = proxify(a.href);
            if (n !== a.href) { e.preventDefault(); location.href = n; }
          }
        }, true);
        document.addEventListener('submit', e => {
          const f = e.target;
          if (f.action) f.action = proxify(f.action);
        }, true);
      })();
      </script>
    `);

    res.setHeader("content-type", "text/html");
    return res.send($.html());
  }

  if (contentType.includes("text/css")) {
    let css = array.toString("utf8");
    css = css.replace(/url\((['"]?)(.*?)\1\)/gi, (m,q,u) => {
      try { return `url(${q}/encoded?site=${encodeUrl(new URL(u, target).toString())}${q})`; }
      catch { return m; }
    });
    res.setHeader("content-type", "text/css");
    return res.send(css);
  }

  res.send(array);
});

app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));