/*
 * Fa funzionare la versione web anche senza rete: i file dell'app restano salvati nel telefono,
 * così si apre subito e in aereo o senza campo mostra comunque le schedine già caricate.
 * I risultati delle partite e i loghi arrivano sempre dalla rete: non vengono mai conservati qui.
 * La versione è nell'indirizzo con cui viene registrato (sw.js?v=1.5.1): quando cambia,
 * questo file è "nuovo" per il browser e la vecchia copia dell'app viene buttata.
 */

const VERSIONE = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `screen-bet-${VERSIONE}`;
const BASE = ['./', './index.html', './manifest.webmanifest', './logo.png', './favicon.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // se un file non c'è non si blocca tutto: si riproverà alla prima apertura
      await Promise.all(BASE.map((f) => cache.add(f).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome.startsWith('screen-bet-') && nome !== CACHE) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // risultati, quote e loghi: sempre dalla rete, non si salvano
  if (new URL(req.url).origin !== self.location.origin) return;

  // la pagina: prima la rete, così una versione nuova arriva subito; senza rete la copia salvata
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          // "no-cache": si chiede sempre al server se la pagina è cambiata. Senza questo, dopo
          // un aggiornamento il telefono può continuare a mostrare la versione vecchia per minuti,
          // perché la copia tenuta dal browser (non dall'app) è ancora considerata buona.
          const res = await fetch(req, { cache: 'no-cache' });
          const cache = await caches.open(CACHE);
          void cache.put('./index.html', res.clone());
          return res;
        } catch {
          return (await caches.match('./index.html')) ?? (await caches.match('./')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // file dell'app: prima la copia salvata (nel nome hanno un codice che cambia a ogni versione)
  e.respondWith(
    (async () => {
      const salvato = await caches.match(req);
      if (salvato) return salvato;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        void cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});
