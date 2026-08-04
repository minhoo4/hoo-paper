const HOO_CACHE_NAME =
  "hoo-static-v1";

const HOO_STATIC_FILES = [
  "/offline.html",
  "/apple-touch-icon.png",
  "/icons/hoo-icon-192.png",
  "/icons/hoo-icon-512.png",
  "/icons/hoo-maskable-512.png",
];

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(HOO_CACHE_NAME)
        .then((cache) =>
          cache.addAll(
            HOO_STATIC_FILES,
          ),
        )
        .then(() =>
          self.skipWaiting(),
        ),
    );
  },
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter(
                (cacheName) =>
                  cacheName !==
                  HOO_CACHE_NAME,
              )
              .map((cacheName) =>
                caches.delete(
                  cacheName,
                ),
              ),
          ),
        )
        .then(() =>
          self.clients.claim(),
        ),
    );
  },
);

self.addEventListener(
  "fetch",
  (event) => {
    const request = event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const requestUrl =
      new URL(request.url);

    /*
     * Supabase·외부 요청은 캐시하지 않습니다.
     */
    if (
      requestUrl.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
     * 로그인·DB API 응답은 사용자별 데이터이므로
     * 서비스 워커에 저장하지 않습니다.
     */
    if (
      requestUrl.pathname.startsWith(
        "/api/",
      )
    ) {
      return;
    }

    /*
     * 페이지 이동은 항상 최신 서버 응답을 우선합니다.
     * 인터넷이 끊겼을 때만 오프라인 화면을 표시합니다.
     */
    if (
      request.mode === "navigate"
    ) {
      event.respondWith(
        fetch(request).catch(
          async () => {
            const cache =
              await caches.open(
                HOO_CACHE_NAME,
              );

            return (
              (await cache.match(
                "/offline.html",
              )) ??
              Response.error()
            );
          },
        ),
      );

      return;
    }

    /*
     * 매니페스트에 사용하는 정적 아이콘만
     * 캐시에서 우선 불러옵니다.
     */
    if (
      HOO_STATIC_FILES.includes(
        requestUrl.pathname,
      )
    ) {
      event.respondWith(
        caches.match(request).then(
          (cachedResponse) =>
            cachedResponse ??
            fetch(request),
        ),
      );
    }
  },
);

self.addEventListener("push", (event) => {
  let payload = {
    title: "HOO",
    body: "새로운 HOO 메시지가 도착했어요.",
    url: "/",
    tag: "hoo-notification",
  };

  if (event.data) {
    try {
      payload = {
        ...payload,
        ...event.data.json(),
      };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/hoo-icon-192.png",
      badge: "/icons/hoo-icon-192.png",
      tag: payload.tag,
      renotify: true,
      data: {
        url: payload.url,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            void client.navigate(targetUrl);
            return client.focus();
          }
        }

        return clients.openWindow(targetUrl);
      }),
  );
});
