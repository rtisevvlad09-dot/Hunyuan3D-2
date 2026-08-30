/* =========================================================
 *  sw.js — Service Worker для FLO.RISTA Pro
 *  v14.2 — Network First + Cache Fallback стратегия
 *  Обеспечивает работу приложения offline
 * ========================================================= */

const CACHE_VERSION = 'flo-rista-v14.2';
const CACHE_NAME = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

/* ---------- Ресурсы для предкэширования ---------- */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/styles.css',
  '/manifest.json',

  // Core
  '/js/core/utils.js',
  '/js/core/db.js',
  '/js/core/auth.js',
  '/js/core/modal.js',
  '/js/core/state.js',

  // Services
  '/js/services/audit.js',
  '/js/services/notifications.js',
  '/js/services/sync.js',
  '/js/services/external.js',

  // Modules
  '/js/modules/dashboard.js',
  '/js/modules/orders.js',
  '/js/modules/flowers.js',
  '/js/modules/bouquets.js',
  '/js/modules/clients.js',
  '/js/modules/calendar.js',
  '/js/modules/shifts.js',
  '/js/modules/expenses.js',
  '/js/modules/supplies.js',
  '/js/modules/returns.js',
  '/js/modules/writeoffs.js',
  '/js/modules/staff.js',
  '/js/modules/analytics.js',
  '/js/modules/settings.js',

  // Boot
  '/js/app.js'
];

/* ---------- Установка (Install) ---------- */
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Установка', CACHE_VERSION);

  self.skipWaiting(); // Немедленно активировать новый SW

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 SW: Кэширование ресурсов...');
        // Кэшируем с игнором ошибок для отсутствующих файлов
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`⚠️ Не удалось кэшировать ${url}:`, err.message);
            })
          )
        );
      })
      .then(() => console.log('✅ SW: Precache завершён'))
  );
});

/* ---------- Активация (Activate) ---------- */
self.addEventListener('activate', (event) => {
  console.log('🚀 SW: Активация');

  event.waitUntil(
    (async () => {
      // Удаляем старые кэши
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name =>
            (name.startsWith('static-') || name.startsWith('runtime-')) &&
            name !== CACHE_NAME &&
            name !== RUNTIME_CACHE
          )
          .map(name => {
            console.log('🗑️ SW: Удаление старого кэша:', name);
            return caches.delete(name);
          })
      );

      // Берём контроль над всеми клиентами
      await self.clients.claim();
      console.log('✅ SW: Готов к работе');
    })()
  );
});

/* ---------- Обработка запросов (Fetch) ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Пропускаем не-GET запросы
  if (request.method !== 'GET') return;

  // Пропускаем cross-origin кроме CDN
  if (!request.url.startsWith(self.location.origin) &&
      !request.url.includes('jsdelivr.net')) {
    return;
  }

  // Пропускаем API-вызовы внешних сервисов
  if (request.url.includes('api.emailjs.com') ||
      request.url.includes('sms.ru') ||
      request.url.includes('atol.ru') ||
      request.url.includes('supabase.co') ||
      request.url.includes('googleapis.com')) {
    return;
  }

  // Chrome extension игнор
  if (request.url.startsWith('chrome-extension://')) return;

  // Навигационные запросы — Network First с offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // CDN ресурсы — Cache First (не меняются)
  if (request.url.includes('jsdelivr.net')) {
    event.respondWith(handleCDN(request));
    return;
  }

  // Все остальные — Stale While Revalidate
  event.respondWith(handleGeneric(request));
});

/* ---------- Стратегия для навигации ---------- */
async function handleNavigation(request) {
  try {
    // Пробуем получить с сети
    const networkResponse = await fetch(request);

    // Если успешно — обновляем кэш свежей версией
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    // Offline — пробуем кэш
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback на offline.html
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    // Если совсем ничего нет — минимальный HTML
    return new Response(generateOfflineHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/* ---------- Стратегия для CDN (Cache First) ---------- */
async function handleCDN(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline — CDN resource unavailable', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/* ---------- Универсальная стратегия (Stale While Revalidate) ---------- */
async function handleGeneric(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        const cache = caches.open(RUNTIME_CACHE);
        cache.then(c => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached); // Если сеть упала — возвращаем кэш

  // Возвращаем кэш сразу, параллельно обновляя его
  return cached || fetchPromise;
}

/* ---------- Генерация offline HTML ---------- */
function generateOfflineHTML() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLO.RISTA — Нет подключения</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%);
      padding: 20px;
    }
    .card {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,.2);
      max-width: 500px;
      text-align: center;
    }
    .emoji { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #111827; font-size: 24px; margin-bottom: 12px; }
    p { color: #6b7280; line-height: 1.6; margin-bottom: 20px; }
    button {
      padding: 12px 30px;
      background: #6C5CE7;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
    }
    button:hover { background: #5849d6; transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">🌸</div>
    <h1>Нет подключения к сети</h1>
    <p>
      FLO.RISTA Pro работает offline, но эта страница требует интернет.<br>
      Ваши данные сохранены локально и будут синхронизированы при восстановлении связи.
    </p>
    <button onclick="location.reload()">🔄 Попробовать снова</button>
  </div>
</body>
</html>`;
}

/* ---------- Сообщения от приложения ---------- */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).then(() => {
        event.ports?.[0]?.postMessage({ ok: true });
      });
      break;

    case 'CACHE_URLS':
      if (Array.isArray(payload)) {
        caches.open(RUNTIME_CACHE).then(cache => {
          cache.addAll(payload);
        });
      }
      break;

    case 'GET_VERSION':
      event.ports?.[0]?.postMessage({ version: CACHE_VERSION });
      break;
  }
});

/* ---------- Фоновая синхронизация (если поддерживается) ---------- */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      (async () => {
        console.log('🔄 SW: Фоновая синхронизация');
        // Уведомляем всех клиентов
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({ type: 'BACKGROUND_SYNC' });
        });
      })()
    );
  }
});

/* ---------- Push уведомления (для будущих расширений) ---------- */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Новое уведомление',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'FLO.RISTA',
      options
    )
  );
});

/* ---------- Клик по уведомлению ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Если вкладка уже открыта — фокусируем
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новую
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

console.log('🌸 FLO.RISTA Service Worker загружен:', CACHE_VERSION);