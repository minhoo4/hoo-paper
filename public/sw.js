const HOO_CACHE_NAME =
  "hoo-static-v2";

const HOO_STUDY_NOTE_CACHE_NAME =
  "hoo-study-note-v1";

const HOO_STATIC_FILES = [
  "/offline.html",
  "/apple-touch-icon.png",
  "/icons/hoo-icon-192.png",
  "/icons/hoo-icon-512.png",
  "/icons/hoo-maskable-512.png",
  "/study-note.webmanifest",
];

const HOO_STUDY_NOTE_PATH =
  "/study-note";

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      Promise.all([
        caches
          .open(HOO_CACHE_NAME)
          .then((cache) =>
            cache.addAll(
              HOO_STATIC_FILES,
            ),
          ),

        /*
         * HOO터디 노트 전용 캐시.
         *
         * /study-note 페이지 자체는
         * 실제로 온라인에서 성공적으로 열린 뒤
         * fetch 단계에서 저장한다.
         */
        caches.open(
          HOO_STUDY_NOTE_CACHE_NAME,
        ),
      ]).then(() =>
        self.skipWaiting(),
      ),
    );
  },
);

self.addEventListener(
  "activate",
  (event) => {
    const validCaches =
      new Set([
        HOO_CACHE_NAME,
        HOO_STUDY_NOTE_CACHE_NAME,
      ]);

    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter(
                (cacheName) =>
                  !validCaches.has(
                    cacheName,
                  ),
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

async function cacheStudyNoteResponse(
  request,
  response,
) {
  if (
    !response ||
    !response.ok
  ) {
    return response;
  }

  const cache =
    await caches.open(
      HOO_STUDY_NOTE_CACHE_NAME,
    );

  await cache.put(
    request,
    response.clone(),
  );

  return response;
}

async function getCachedStudyNotePage() {
  const cache =
    await caches.open(
      HOO_STUDY_NOTE_CACHE_NAME,
    );

  return (
    (await cache.match(
      HOO_STUDY_NOTE_PATH,
    )) ??
    (await cache.match(
      `${HOO_STUDY_NOTE_PATH}/`,
    )) ??
    null
  );
}

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const requestUrl =
      new URL(
        request.url,
      );

    /*
     * Supabase 및 외부 요청은
     * 서비스워커에서 캐시하지 않는다.
     */
    if (
      requestUrl.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
     * 로그인 / DB / API 응답은
     * 사용자별 데이터이므로 캐시하지 않는다.
     */
    if (
      requestUrl.pathname.startsWith(
        "/api/",
      )
    ) {
      return;
    }

    const isStudyNotePath =
      requestUrl.pathname ===
        HOO_STUDY_NOTE_PATH ||
      requestUrl.pathname.startsWith(
        `${HOO_STUDY_NOTE_PATH}/`,
      );

    /*
     * ─────────────────────────────
     * HOO터디 노트 페이지 이동
     * ─────────────────────────────
     *
     * 온라인:
     * 서버에서 최신 화면을 받아온 뒤 캐시에 저장
     *
     * 오프라인:
     * 마지막으로 저장된 HOO터디 노트 화면 실행
     *
     * 노트 본문은 서비스워커가 아니라
     * 기존 IndexedDB에 저장된다.
     */
    if (
      request.mode ===
        "navigate" &&
      isStudyNotePath
    ) {
      event.respondWith(
        fetch(request)
          .then(
            async (
              response,
            ) => {
              const cache =
                await caches.open(
                  HOO_STUDY_NOTE_CACHE_NAME,
                );

              if (
                response.ok
              ) {
                await cache.put(
                  HOO_STUDY_NOTE_PATH,
                  response.clone(),
                );
              }

              return response;
            },
          )
          .catch(
            async () => {
              const cachedPage =
                await getCachedStudyNotePage();

              if (
                cachedPage
              ) {
                return cachedPage;
              }

              const staticCache =
                await caches.open(
                  HOO_CACHE_NAME,
                );

              return (
                (await staticCache.match(
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
     * 일반 HOO 페이지는
     * 기존 방식 그대로 유지.
     */
    if (
      request.mode ===
      "navigate"
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
     * ─────────────────────────────
     * Next.js 정적 파일 캐시
     * ─────────────────────────────
     *
     * HOO터디 노트가 온라인에서 한 번 실행되면
     * 필요한 JS / CSS / 정적 리소스를 저장한다.
     *
     * 이후 인터넷 연결이 없어도
     * 설치 앱 화면을 구성할 수 있다.
     */
    const isNextStaticAsset =
      requestUrl.pathname.startsWith(
        "/_next/static/",
      );

    const isStudyNoteStaticAsset =
      isStudyNotePath ||
      requestUrl.pathname ===
        "/study-note.webmanifest";

    if (
      isNextStaticAsset ||
      isStudyNoteStaticAsset
    ) {
      event.respondWith(
        caches
          .open(
            HOO_STUDY_NOTE_CACHE_NAME,
          )
          .then(
            async (
              cache,
            ) => {
              const cached =
                await cache.match(
                  request,
                );

              if (
                cached
              ) {
                /*
                 * 화면에는 캐시를 즉시 사용하고,
                 * 온라인이면 뒤에서 최신 파일로 교체.
                 */
                event.waitUntil(
                  fetch(request)
                    .then(
                      (
                        response,
                      ) =>
                        cacheStudyNoteResponse(
                          request,
                          response,
                        ),
                    )
                    .catch(
                      () =>
                        undefined,
                    ),
                );

                return cached;
              }

              return fetch(
                request,
              ).then(
                (
                  response,
                ) =>
                  cacheStudyNoteResponse(
                    request,
                    response,
                  ),
              );
            },
          ),
      );

      return;
    }

    /*
     * 기존 HOO 정적 파일.
     */
    if (
      HOO_STATIC_FILES.includes(
        requestUrl.pathname,
      )
    ) {
      event.respondWith(
        caches
          .match(
            request,
          )
          .then(
            (
              cachedResponse,
            ) =>
              cachedResponse ??
              fetch(
                request,
              ),
          ),
      );
    }
  },
);

/*
 * ─────────────────────────────
 * Push Notification
 * ─────────────────────────────
 */

self.addEventListener(
  "push",
  (event) => {
    let payload = {
      title: "HOO",
      body:
        "새로운 HOO 메시지가 도착했어요.",
      url: "/",
      tag:
        "hoo-notification",
    };

    if (
      event.data
    ) {
      try {
        payload = {
          ...payload,
          ...event.data.json(),
        };
      } catch {
        payload.body =
          event.data.text();
      }
    }

    event.waitUntil(
      self.registration.showNotification(
        payload.title,
        {
          body:
            payload.body,

          icon:
            "/icons/hoo-icon-192.png",

          badge:
            "/icons/hoo-icon-192.png",

          tag:
            payload.tag,

          renotify:
            true,

          data: {
            url:
              payload.url,
          },
        },
      ),
    );
  },
);

/*
 * ─────────────────────────────
 * Notification Click
 * ─────────────────────────────
 */

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      new URL(
        event.notification
          .data?.url ||
          "/",

        self.location.origin,
      ).href;

    event.waitUntil(
      clients
        .matchAll({
          type:
            "window",

          includeUncontrolled:
            true,
        })
        .then(
          (
            windowClients,
          ) => {
            for (
              const client of
              windowClients
            ) {
              if (
                "focus" in
                client
              ) {
                void client.navigate(
                  targetUrl,
                );

                return client.focus();
              }
            }

            return clients.openWindow(
              targetUrl,
            );
          },
        ),
    );
  },
);