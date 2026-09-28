const CACHE="fitness-ai-v4-1.0"; const ASSETS=["./","./index.html","./styles.css","./app.js","./foods.js","./ai.js","./health.js","./integrations.js","./manifest.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(ASSETS.map(u=>c.add(u)))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;
  e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(CACHE).then(cache=>cache.put(e.request,c)); return r }).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
});