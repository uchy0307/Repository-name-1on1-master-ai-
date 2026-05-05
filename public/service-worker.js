// ========================================================
// 1on1 マスターAI Service Worker
// 戦略: Stale-While-Revalidate（高速 + 自動更新）
// ========================================================

// バージョンを変えると古いキャッシュが破棄される
// → 新バージョンをデプロイしたら必ず数字を上げること
const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `1on1-master-ai-${CACHE_VERSION}`;

// 起動時にプリキャッシュする最小限のファイル
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// API ホスト（キャッシュさせない）
const NETWORK_ONLY_HOSTS = [
  "api.anthropic.com",
];

// ========================================================
// install: プリキャッシュ
// ========================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // 新SWを即座に有効化
  );
});

// ========================================================
// activate: 古いキャッシュを掃除
// ========================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("1on1-master-ai-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ========================================================
// fetch: リクエスト処理
// ========================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // GETのみキャッシュ対象
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API リクエストはキャッシュしない（必ずネットワーク）
  if (NETWORK_ONLY_HOSTS.some((host) => url.hostname.includes(host))) {
    return; // SW がスルー → ブラウザが直接処理
  }

  // 別オリジン（CDNなど）はキャッシュしない
  if (url.origin !== self.location.origin) return;

  // ナビゲーション（HTML）: ネットワーク優先 → 失敗時キャッシュ
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((m) => m || caches.match("/")))
    );
    return;
  }

  // 静的アセット: Stale-While-Revalidate
  // → キャッシュを即返しつつ、裏でネットワーク更新
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached); // ネット失敗 → キャッシュ
      return cached || fetchPromise;
    })
  );
});

// ========================================================
// メッセージ: クライアントから「更新して」と呼ばれたら即更新
// ========================================================
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
