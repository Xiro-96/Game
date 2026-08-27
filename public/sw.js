// Bewusst konservativ: nur eigene GET-Requests, Netz zuerst, Cache als
// Rueckfallebene. Wichtig ist vor allem, dass respondWith() nie undefined
// bekommt - das wuerde jeden Aussetzer in einen harten Ladefehler drehen.
const CACHE = "ascent-v2";

const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./icon-192.png"];

self.addEventListener("install", (e) => {
  // Der SW kontrolliert den allerersten Seitenaufruf noch nicht, sonst bliebe
  // der Cache bis zum zweiten Start leer.
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

// Die Bundle-Dateinamen tragen einen Build-Hash, stehen hier also nicht fest.
// Statt sie beim Build einzutragen, liest der SW sie aus dem index.html.
async function precache() {
  const c = await caches.open(CACHE);
  try {
    await c.addAll(SHELL);
  } catch {
    /* Einzelne fehlende Datei darf die Installation nicht kippen */
  }
  try {
    const html = await (await fetch("./index.html", { cache: "reload" })).text();
    const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await Promise.all(assets.map((a) => c.add(a).catch(() => {})));
  } catch {
    /* Ohne Netz bleibt der Cache eben leer - das ist kein Installationsfehler */
  }
}

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || Response.error())
  );
});
