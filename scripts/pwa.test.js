import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createServer } from "node:http";

const files = [
  "/",
  "/manifest.webmanifest",
  "/assets/game.js",
  "/assets/game.css",
];
function worker() {
  const listeners = {},
    cache = {
      addAll: vi.fn(async () => {}),
      match: vi.fn(async () => "cached-shell"),
      put: vi.fn(async () => {}),
    };
  const caches = {
    open: vi.fn(async () => cache),
    keys: async () => [
      "other-app-cache",
      "bebullish-shell-old",
      "bebullish-shell-test",
    ],
    delete: vi.fn(async () => true),
  };
  const self = {
    location: { origin: "https://game.example" },
    clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => []) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: (name, cb) => {
      listeners[name] = cb;
    },
  };
  const fetch = vi.fn(async () => "network");
  const source = readFileSync(
    new URL("./service-worker.template.js", import.meta.url),
    "utf8",
  )
    .replace("__CACHE_NAME__", JSON.stringify("bebullish-shell-test"))
    .replace("__BUILD_TIME__", "200")
    .replace("__STATIC_URLS__", JSON.stringify(files));
  runInNewContext(source, { self, caches, URL, fetch, Response, MessageChannel, setTimeout, clearTimeout });
  const request = (path, method = "GET", mode = "cors") => {
    const event = {
      request: { url: new URL(path, self.location.origin).href, method, mode },
      respondWith: vi.fn(),
    };
    listeners.fetch(event);
    return event;
  };
  return { listeners, cache, caches, self, fetch, request };
}
describe("PWA shell caching", () => {
  it("preloads a versioned shell and removes only older BeBullish caches", async () => {
    const w = worker();
    let task;
    w.listeners.install({
      waitUntil: (p) => {
        task = p;
      },
    });
    await task;
    expect(w.cache.addAll).toHaveBeenCalledWith(files);
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
    w.listeners.activate({
      waitUntil: (p) => {
        task = p;
      },
    });
    await task;
    expect(w.caches.delete.mock.calls).toEqual([["bebullish-shell-old"]]);
    expect(w.self.clients.claim).toHaveBeenCalledOnce();
  });
  it("activates without navigating live games or deleting the assets they still use", async () => {
    const w = worker(), navigate = vi.fn();
    w.self.clients.matchAll.mockResolvedValue([{navigate}]);
    let task;
    w.listeners.activate({waitUntil: p => {task = p}}); await task;
    expect(w.caches.delete).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(w.self.clients.claim).toHaveBeenCalledOnce();
    w.cache.match.mockResolvedValueOnce(undefined).mockResolvedValueOnce("old-hashed-js");
    expect(await w.request("/assets/old.js").respondWith.mock.calls[0][0]).toBe("old-hashed-js");
    expect(w.fetch).not.toHaveBeenCalled();
  });
  it("does not activate an incomplete update when precaching fails offline", async () => {
    const w = worker(); w.cache.addAll.mockRejectedValue(new Error("offline"));
    let task; w.listeners.install({waitUntil: p => {task = p}});
    await expect(task).rejects.toThrow("offline");
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    expect(w.caches.delete).not.toHaveBeenCalled();
  });
  it("prunes unused builds only after every open page identifies the shell it uses", async () => {
    const w = worker();
    w.self.clients.matchAll.mockResolvedValue([{postMessage:(_data,ports)=>ports[0].postMessage("bebullish-shell-old")}]);
    let task; w.listeners.message({data:{type:"BEBULLISH_PRUNE"},waitUntil:p=>{task=p}}); await task;
    expect(w.caches.delete).not.toHaveBeenCalled();
    w.self.clients.matchAll.mockResolvedValue([{postMessage:(_data,ports)=>ports[0].postMessage("bebullish-shell-test")}]);
    w.listeners.message({data:{type:"BEBULLISH_PRUNE"},waitUntil:p=>{task=p}}); await task;
    expect(w.caches.delete.mock.calls).toEqual([["bebullish-shell-old"]]);
  });
  it("answers build checks and opens both same-origin entry points from its complete shell", async () => {
    const w = worker(), port = {postMessage:vi.fn()};
    w.listeners.message({data:{type:"BEBULLISH_BUILD"},ports:[port]});
    expect(port.postMessage).toHaveBeenCalledWith({id:"bebullish-shell-test",createdAt:200});
    for (const path of ["/play", "/play.html", "/index.html"])
      expect(await w.request(path,"GET","navigate").respondWith.mock.calls[0][0]).toBe("cached-shell");
  });
  it("never intercepts API traffic, POSTs, external origins or unlisted assets", () => {
    const w = worker();
    for (const [path, method] of [
      ["/api/leaderboard", "GET"],
      ["/api", "GET"],
      ["/api/feedback", "POST"],
      ["/index.html", "POST"],
      ["https://other.example/assets/game.js", "GET"],
      ["/assets/game.js.map", "GET"],
    ])
      expect(w.request(path, method).respondWith).not.toHaveBeenCalled();
    expect(w.caches.open).not.toHaveBeenCalled();
  });
  it("opens the matching shell offline and uses network only for a missing allowlisted asset", async () => {
    const w = worker();
    const home = w.request("/?source=home", "GET", "navigate");
    expect(await home.respondWith.mock.calls[0][0]).toBe("cached-shell");
    expect(w.cache.match).toHaveBeenCalledWith("/");
    w.cache.match.mockResolvedValue(undefined);
    const asset = w.request("/assets/game.js");
    expect(await asset.respondWith.mock.calls[0][0]).toBe("network");
    expect(w.fetch).toHaveBeenCalledOnce();
  });
  it("repairs actual redirected HTML before activation and keeps it usable for navigation", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/index.html") {
        res.writeHead(301, { location: "/" });
        res.end();
      } else {
        res.writeHead(200, {
          "content-type": "text/html",
          "x-shell-version": "old",
        });
        res.end('<html><script src="/assets/old.js"></script></html>');
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const old = await fetch(
        `http://127.0.0.1:${server.address().port}/index.html`,
      );
      expect(old.redirected).toBe(true);
      const html = await old.clone().text();
      const w = worker();
      w.cache.match.mockResolvedValueOnce(old);
      let installed;
      w.listeners.install({
        waitUntil: (task) => {
          installed = task;
        },
      });
      await installed;
      expect(w.cache.put).toHaveBeenCalledOnce();
      const [key, repaired] = w.cache.put.mock.calls[0];
      expect(key).toBe("/index.html");
      expect(repaired.redirected).toBe(false);
      expect(repaired.status).toBe(200);
      expect(repaired.headers.get("content-type")).toBe("text/html");
      expect(await repaired.clone().text()).toBe(html);
      expect(w.caches.delete).not.toHaveBeenCalled();
      expect(w.self.clients.claim).not.toHaveBeenCalled();
      expect(
        w.caches.open.mock.calls.every(([key]) =>
          key.startsWith("bebullish-shell-"),
        ),
      ).toBe(true);

      // Guard future redirects as well, without changing the cached HTML bytes.
      const freshRedirect = await fetch(
        `http://127.0.0.1:${server.address().port}/index.html`,
      );
      w.cache.match.mockResolvedValueOnce(freshRedirect);
      const event = w.request("/", "GET", "navigate");
      const navigation = await event.respondWith.mock.calls[0][0];
      expect(navigation.redirected).toBe(false);
      expect(await navigation.text()).toBe(html);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  it("ships standalone metadata and correctly sized square PNG icons", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("../public/manifest.webmanifest", import.meta.url),
        "utf8",
      ),
    );
    expect(manifest).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
    for (const icon of manifest.icons) {
      const data = readFileSync(
        new URL("../public" + icon.src, import.meta.url),
      );
      expect(data.subarray(1, 4).toString()).toBe("PNG");
      expect(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`).toBe(
        icon.sizes,
      );
    }
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});

it("ships the DW logo at versioned install URLs and both Safari root fallbacks", () => {
  const read = (path) => readFileSync(new URL("../" + path, import.meta.url));
  const original = read("public/icons/apple-touch-icon.png");
  for (const path of [
    "public/icons/apple-touch-icon-dw-arrow.png",
    "public/apple-touch-icon.png",
    "public/apple-touch-icon-precomposed.png",
  ])
    expect(read(path).equals(original)).toBe(true);
  for (const page of ["index.html", "public/transfer.html"]) {
    const html = read(page).toString();
    expect(html).toMatch(
      /rel="apple-touch-icon"\s+sizes="180x180"\s+href="\/icons\/apple-touch-icon-dw-arrow.png"/,
    );
    expect(html).toContain('rel="manifest"');
  }
  const manifest = JSON.parse(read("public/manifest.webmanifest").toString());
  const generator = read("scripts/generate-pwa.mjs").toString();
  for (const icon of manifest.icons) {
    expect(icon.src).toMatch(/-dw-arrow\.png$/);
    expect(generator).toContain('"' + icon.src + '"');
    expect(
      read("public" + icon.src).equals(
        read("public" + icon.src.replace("-dw-arrow.png", ".png")),
      ),
    ).toBe(true);
  }
  expect(generator).toContain('"/icons/icon-192.png"'); // legacy game shell offline logo
});
