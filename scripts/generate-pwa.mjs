import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "dist/client";
const urls = [
  "/",
  "/manifest.webmanifest",
  "/intro-cash.png",
  "/intro-cash-front.png",
  "/work-banknote.png",
  ...(await readdir(root + "/banknotes"))
    .filter(name => name.endsWith(".webp")).sort()
    .map(name => "/banknotes/" + name),
  "/flip-bull-coin.png",
  "/flip-bear-coin.png",
  "/icons/bull.svg",
  "/icons/dontwork.svg",
  "/icons/icon-192-dw.png",
  "/icons/icon-512-dw.png",
  "/icons/maskable-512-dw.png",
  "/icons/apple-touch-icon-dw.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192-v2.png",
  "/icons/icon-512-v2.png",
  "/icons/maskable-512-v2.png",
  "/icons/apple-touch-icon-v2.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  ...(await readdir(root + "/assets"))
    .filter((f) => /\.(js|css)$/.test(f))
    .sort()
    .map((f) => "/assets/" + f),
];
const hash = createHash("sha256");
for (const url of urls) {
  hash.update(url);
  hash.update(await readFile(root + (url === "/" ? "/index.html" : url)));
}
const template = await readFile("scripts/service-worker.template.js", "utf8");
hash.update(template);
const buildId = "bebullish-shell-" + hash.digest("hex").slice(0, 16);
const builtAt = Date.now();
const html = await readFile(root + "/index.html", "utf8");
await writeFile(root + "/index.html", html.replace("</head>",
  `<meta name="bebullish-build" content="${buildId}"><meta name="bebullish-built-at" content="${builtAt}"></head>`));
const source = template
  .replace(
    "__CACHE_NAME__",
    JSON.stringify(buildId),
  )
  .replace("__BUILD_TIME__", JSON.stringify(builtAt))
  .replace("__STATIC_URLS__", JSON.stringify(urls));
await writeFile(root + "/sw.js", source);
