// Service Worker — nu associates PMC
// Offline-capable with a resilient write queue.
//
// ── Strategy ─────────────────────────────────────────────────
// Static assets:  cache-first (populates on first successful fetch)
// API GET:        network-first, fall back to cache, then to a safe empty response
// API POST/PATCH: network-first; on network failure, enqueue for later sync
//
// ── Queue semantics ───────────────────────────────────────────
// Each queued item has: id (autoInc), url, method, headers, body, timestamp, attempts.
// On reconnect, the SW replays the queue oldest-first. Each item is deleted
// only on success (fixes the partial-success bug in the previous version).
// On HTTP 4xx response (permanent client error), the item is moved to the
// 'dead_letter' store — we never retry a request the server rejected.
// On HTTP 5xx or network error, we increment attempts and keep it queued.
// After MAX_ATTEMPTS retries, it's moved to dead_letter too.
//
// Multipart/form-data is NOT queued — files are too big for reliable storage,
// and user can always re-take photos. A multipart request that fails offline
// returns an explicit error so the UI can surface it.
//
// Clients can request queue status via postMessage({ type: 'queue:status' })
// and get back { pending, dead_letter, last_sync_at }. They can also trigger
// a sync manually via postMessage({ type: 'queue:sync-now' }).
// ============================================================

const CACHE_NAME     = 'nu-pmc-v4.45';
const OFFLINE_URL    = '/offline.html';
const MAX_ATTEMPTS   = 5;
const DB_NAME        = 'nu-pmc-queue';
const DB_VERSION     = 2;
const STORE_QUEUE    = 'queue';
const STORE_DEAD     = 'dead_letter';
const STORE_META     = 'meta';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/app.css?v=4.35',
  '/css/desktop.css?v=4.35',
  '/js/app.js?v=4.37',
  '/js/api.js?v=4.36',
  '/js/ui.js?v=4.37',
  '/js/offline-queue.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// ── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        STATIC_ASSETS.map(url => cache.add(url).catch(err =>
          console.warn('[SW] failed to precache', url, err.message)
        ))
      ))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — purge old caches + try to replay queue ──────
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // Opportunistic replay — in case we came back online while SW was idle
    replayQueue().catch(() => {});
  })());
});

// ── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPI(request));
    return;
  }
  event.respondWith(handleStatic(request));
});

async function handleStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch {
    if (request.destination === 'document') {
      return (await caches.match(OFFLINE_URL)) || new Response('Offline', { status: 503 });
    }
    return new Response('', { status: 503 });
  }
}

async function handleAPI(request) {
  const method = request.method.toUpperCase();
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  try {
    const response = await fetch(request.clone());
    if (method === 'GET' && response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch {
    // Network unavailable
    if (method === 'GET') {
      const cached = await caches.match(request);
      if (cached) return cached;
      return new Response(JSON.stringify({ error: 'Offline', offline: true, data: [] }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (['POST','PATCH','PUT','DELETE'].includes(method)) {
      if (isMultipart) {
        return new Response(JSON.stringify({
          error: 'Offline — cannot queue file uploads. Reconnect and try again.',
          offline: true, requires_reconnect: true,
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        await enqueue(request.clone());
        broadcastQueueStatus();
        try { await self.registration.sync.register('sync-queue'); } catch {}
        return new Response(JSON.stringify({
          success: true, queued: true, offline: true,
          message: 'Saved offline — will sync when signal returns',
        }), { headers: { 'Content-Type': 'application/json' } });
      } catch (qerr) {
        return new Response(JSON.stringify({
          error: 'Failed to save offline. Please try again.',
          details: qerr.message,
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── QUEUE OPERATIONS ────────────────────────────────────────
// CSRF NOTE: captured headers (including X-Nu-CSRF) are replayed verbatim.
// With per-session token rotation this works correctly:
//   - If the session that issued the token is still alive at replay time,
//     the token is still valid (rotation happens at login only).
//   - If the user logged out and back in during the offline window, the
//     new session rejects the stale token with 403 CSRF_INVALID. The 4xx
//     branch below moves the request to the dead-letter queue, where the
//     user can see and manually retry it.
async function enqueue(request) {
  const body = await request.text();
  const item = {
    url:       request.url,
    method:    request.method,
    headers:   Object.fromEntries(request.headers.entries()),
    body,
    timestamp: Date.now(),
    attempts:  0,
    last_error: null,
  };
  const db = await openDB();
  await idbAdd(db, STORE_QUEUE, item);
}

async function replayQueue() {
  const db = await openDB();
  const items = await idbGetAll(db, STORE_QUEUE);
  if (!items.length) return { replayed: 0, failed: 0, dead: 0 };

  let replayed = 0, failed = 0, dead = 0;
  items.sort((a, b) => a.timestamp - b.timestamp);  // oldest-first

  // Refresh the CSRF token from the current cookie before replay. The token
  // captured at enqueue time may be stale — the user could have logged out
  // and back in during the offline window, rotating the token. cookieStore
  // is Chrome/Edge/Android; Safari + Firefox return undefined and we send
  // the captured (possibly stale) token. Server rejects stale tokens with
  // CSRF_INVALID → item moves to dead-letter, user re-submits manually.
  let freshCsrf = null;
  if (self.cookieStore) {
    try {
      const c = await self.cookieStore.get('nu_csrf');
      if (c) freshCsrf = c.value;
    } catch { /* feature unavailable; fall through */ }
  }

  for (const item of items) {
    const headers = { ...item.headers };
    if (freshCsrf) headers['X-Nu-CSRF'] = freshCsrf;

    let response;
    try {
      response = await fetch(item.url, {
        method:  item.method, headers, body: item.body,
      });
    } catch {
      item.attempts = (item.attempts || 0) + 1;
      item.last_error = 'network_error';
      if (item.attempts >= MAX_ATTEMPTS) {
        await moveToDeadLetter(db, item); dead++;
      } else {
        await idbPut(db, STORE_QUEUE, item);
      }
      failed++;
      continue;
    }

    if (response.ok || response.status === 409) {
      // 409 = already applied (idempotent replay) — treat as success
      await idbDelete(db, STORE_QUEUE, item.id);
      replayed++;
    } else if (response.status >= 400 && response.status < 500) {
      item.last_error = 'http_' + response.status;
      item.response_body = await response.text().catch(() => '');
      await moveToDeadLetter(db, item); dead++;
    } else {
      item.attempts = (item.attempts || 0) + 1;
      item.last_error = 'http_' + response.status;
      if (item.attempts >= MAX_ATTEMPTS) {
        await moveToDeadLetter(db, item); dead++;
      } else {
        await idbPut(db, STORE_QUEUE, item);
      }
      failed++;
    }
  }

  await idbSetMeta(db, 'last_sync_at', Date.now());
  broadcastQueueStatus();
  return { replayed, failed, dead };
}

async function moveToDeadLetter(db, item) {
  const copy = { ...item, dead_at: Date.now() };
  delete copy.id;   // let dead-letter assign its own id
  await idbAdd(db, STORE_DEAD, copy);
  await idbDelete(db, STORE_QUEUE, item.id);
}

async function getQueueStatus() {
  const db = await openDB();
  const [pending, dead, meta] = await Promise.all([
    idbCount(db, STORE_QUEUE),
    idbCount(db, STORE_DEAD),
    idbGetMeta(db, 'last_sync_at'),
  ]);
  return { pending, dead_letter: dead, last_sync_at: meta || null };
}

async function broadcastQueueStatus() {
  const status = await getQueueStatus();
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'queue:status', ...status });
}

// ── BACKGROUND SYNC ─────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-queue') event.waitUntil(replayQueue());
});

// ── MESSAGING from clients ──────────────────────────────────
self.addEventListener('message', event => {
  const data = event.data;
  if (data === 'SKIP_WAITING' || (data && data.type === 'skip-waiting')) {
    self.skipWaiting(); return;
  }
  if (data && data.type === 'queue:status') {
    getQueueStatus().then(s => event.source?.postMessage({ type: 'queue:status', ...s }));
    return;
  }
  if (data && data.type === 'queue:sync-now') {
    replayQueue().then(result => event.source?.postMessage({ type: 'queue:sync-complete', ...result }));
    return;
  }
  if (data && data.type === 'queue:clear-dead-letter') {
    openDB().then(db => idbClear(db, STORE_DEAD)).then(() => broadcastQueueStatus());
    return;
  }
  if (data && data.type === 'queue:list-dead-letter') {
    openDB().then(db => idbGetAll(db, STORE_DEAD)).then(items =>
      event.source?.postMessage({ type: 'queue:dead-letter-list', items })
    );
    return;
  }
});

// ── IndexedDB wrappers ──────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE))
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(STORE_DEAD))
        db.createObjectStore(STORE_DEAD, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(STORE_META))
        db.createObjectStore(STORE_META, { keyPath: 'key' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
function idbAdd(db, store, data) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).add(data);
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
function idbPut(db, store, data) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(data);
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
function idbDelete(db, store, key) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    req.onsuccess = () => res(); req.onerror = () => rej(req.error);
  });
}
function idbClear(db, store) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).clear();
    req.onsuccess = () => res(); req.onerror = () => rej(req.error);
  });
}
function idbGetAll(db, store) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
function idbCount(db, store) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).count();
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
function idbSetMeta(db, key, value) { return idbPut(db, STORE_META, { key, value }); }
function idbGetMeta(db, key) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(key);
    req.onsuccess = () => res(req.result?.value); req.onerror = () => rej(req.error);
  });
}
