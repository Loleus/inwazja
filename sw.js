/* Service worker gry INWAZJA — szablon wypełniany przez scripts/build.mjs (cel: PWA).

   Strategia „najpierw sieć":
   - nawigacja (index.html): zawsze pytamy sieć z pominięciem pamięci HTTP, więc nowa wersja wchodzi
     od razu niezależnie od nagłówków hostingu; kopia służy tylko, gdy sieć nie odpowiada
     w NAVIGATION_TIMEOUT_MS;
   - pozostałe pliki (nazwy z hashem, czcionki, ikony): z pamięci tej wersji, a gdy ich brak — z sieci.
   Każda wersja ma własną pamięć `inwazja-<BUILD>`, więc strona nigdy nie miesza plików dwóch wersji.
   Wszystkie adresy są względne wobec tego pliku — działa pod dowolnym adresem i w podkatalogu. */
const BUILD = "42ba12a7109c";
const CACHE_PREFIX = 'inwazja-';
const CACHE = CACHE_PREFIX + BUILD;
const ASSETS = ["./assets/index--Y543lnw.css","./assets/index-PMI9l0_t.js","./assets/phaser-DFK5Ua9d.js","./audio/README.md","./audio/explosion-enemy.mp3","./audio/loop-basic.mp3","./audio/loop-boss.mp3","./audio/loop-fast.mp3","./audio/loop-megaboss.mp3","./audio/loop-tank.mp3","./audio/music-game.mp3","./audio/shot-arrow.mp3","./audio/shot-cannon.mp3","./audio/shot-frost.mp3","./audio/shot-lightning.mp3","./audio/tower-place.mp3","./audio/ui-blocked.mp3","./audio/ui-click.mp3","./audio/ui-select.mp3","./audio/ui-start.mp3","./audio/ui-wave.mp3","./fonts/0f7fcdc8ea.woff2","./fonts/51a0d45954.woff2","./fonts/679e0aefda.woff2","./fonts/b79d19c55f.woff2","./fonts/dc3ed74d89.woff2","./fonts/f0106b4413.woff2","./fonts/fonts.css","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/icon.svg","./index.html","./manifest.webmanifest","./pwa-register.js"];
const SHELL = './index.html';
const NAVIGATION_TIMEOUT_MS = 5000;

self.addEventListener('install', (event) => {
  // Wersja instaluje się w całości albo wcale; po instalacji od razu przejmuje otwarte strony.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(removeOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request));
});

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })));
}

async function removeOldCaches() {
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE).map((name) => caches.delete(name)),
  );
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request, { cache: 'no-store' }), NAVIGATION_TIMEOUT_MS);
    if (response.ok && response.type === 'basic') cache.put(SHELL, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(SHELL);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') cache.put(request, response.clone());
  return response;
}
