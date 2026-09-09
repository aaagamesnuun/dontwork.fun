const CACHE_NAME = __CACHE_NAME__;
const BUILD = { id: CACHE_NAME, createdAt: __BUILD_TIME__ };
const STATIC_URLS = __STATIC_URLS__;
const ALLOWED = new Set(STATIC_URLS);
// Navigation requests use redirect:"manual". A cached Response whose URL list
// contains a redirect is rejected by Fetch, even if its final status is 200.
const navigationResponse = (response) =>
  response.redirected
    ? new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    : response;

async function repairPreviousShells() {
  for (const key of await caches.keys()) {
    if (!key.startsWith("bebullish-shell-") || key === CACHE_NAME) continue;
    try {
      const cache = await caches.open(key);
      const shell = await cache.match("/index.html");
      if (shell?.redirected && shell.ok)
        await cache.put("/index.html", navigationResponse(shell));
    } catch {
      // A missing/unwritable old cache must not block the corrected worker.
    }
  }
}
const clientBuild = (client) => new Promise((resolve) => {
  const channel = new MessageChannel();
  const finish = (id) => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(id); };
  const timer = setTimeout(() => finish(null), 1500);
  channel.port1.onmessage = ({ data }) => finish(
    typeof data === "string" && data.startsWith("bebullish-shell-") ? data : null,
  );
  try { client.postMessage({ type: "BEBULLISH_PAGE_BUILD" }, [channel.port2]); }
  catch { finish(null); }
});
async function pruneUnusedShells() {
  const keys = await caches.keys();
  if (self.registration?.installing || self.registration?.waiting) return;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const builds = await Promise.all(windows.map(clientBuild));
  // Old clients do not implement this handshake: keep their assets intact.
  if (builds.some(build => !build)) return;
  const keep = new Set([CACHE_NAME, ...builds]);
  for (const key of keys) {
    if (!key.startsWith("bebullish-shell-") || keep.has(key)) continue;
    if (self.registration?.installing || self.registration?.waiting) return;
    const cache = await caches.open(key), shell = await cache.match("/");
    const html = typeof shell?.text === "function" ? await shell.text() : "";
    const builtAt = Number(html.match(/name="bebullish-built-at" content="(\d+)"/)?.[1] ?? 0);
    // An older worker finishing a queued event must never remove a newer build.
    if (builtAt > BUILD.createdAt) continue;
    await caches.delete(key);
  }
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Repair v1.8's active cache without forcing a reload or changing saves.
      // This also helps when old game tabs keep the new worker waiting.
      await repairPreviousShells();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_URLS);
      // Install the complete shell before activation. Pages choose when to save
      // and reload; activating a worker never navigates a running game.
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await pruneUnusedShells();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "BEBULLISH_CLIENT_ID") event.ports[0]?.postMessage(event.source?.id??null);
  if (event.data?.type === "BEBULLISH_BUILD") event.ports[0]?.postMessage(BUILD);
  if (event.data?.type === "BEBULLISH_PRUNE") event.waitUntil(pruneUnusedShells());
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  )
    return;
  const navigation =
    request.mode === "navigate" &&
    ["/", "/index.html", "/play", "/play.html"].includes(url.pathname);
  const hashedAsset = /^\/assets\/[^/]+\.(js|css)$/.test(url.pathname);
  if (!navigation && !ALLOWED.has(url.pathname) && !hashedAsset) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Keep each HTML shell with its own hashed assets, including offline launches.
      const hit = await cache.match(navigation ? "/" : url.pathname);
      if (hit) return navigation ? navigationResponse(hit) : hit;
      if (hashedAsset) {
        for (const key of await caches.keys()) {
          if (!key.startsWith("bebullish-shell-") || key === CACHE_NAME) continue;
          const old = await (await caches.open(key)).match(url.pathname);
          if (old) return old;
        }
      }
      return fetch(request);
    })(),
  );
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const candidates=windows.filter(client=>new URL(client.url).origin===self.location.origin);
    const owners=await Promise.all(candidates.map(client=>new Promise(resolve=>{
      const channel=new MessageChannel();
      const finish=value=>{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value===true?client:null);};
      const timer=setTimeout(()=>finish(false),350);channel.port1.onmessage=event=>finish(event.data);
      try{client.postMessage({type:"BEBULLISH_GAME_OWNER"},[channel.port2]);}catch{finish(false);}
    })));
    const client=owners.find(client=>client?.id===event.notification.data?.clientId)??owners.find(Boolean)??candidates.find(client=>client.id===event.notification.data?.clientId);
    if(client){await client.focus();client.postMessage({type:"BEBULLISH_OPEN_JACKPOT"});}
    else await self.clients.openWindow("/play");
  })());
});
