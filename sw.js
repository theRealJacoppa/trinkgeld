/* Trinkgeld — Service Worker
   Strategie:
   - index.html: Netzwerk zuerst, Cache als Rückfall. Dadurch reicht es,
     index.html im Repo zu ersetzen; beim nächsten Öffnen mit Netz ist die
     neue Version da.
   - Icons, Manifest, Schriften: Cache zuerst, im Hintergrund aufgefrischt.
*/
const VERSION = "trinkgeld-v1";
const SHELL   = VERSION + "-shell";
const ASSETS  = VERSION + "-assets";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);
  const istSchrift = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  const istSeite   = req.mode === "navigate" || (req.destination === "document");

  /* Seite: Netzwerk zuerst */
  if(istSeite){
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  /* Schriften und eigene Dateien: Cache zuerst */
  if(istSchrift || url.origin === self.location.origin){
    e.respondWith(
      caches.match(req).then(hit => {
        const netz = fetch(req).then(res => {
          if(res && (res.ok || res.type === "opaque")){
            const copy = res.clone();
            caches.open(ASSETS).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || netz;
      })
    );
  }
});
