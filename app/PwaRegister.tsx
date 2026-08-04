"use client";

import {
  useEffect,
} from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (
      !(
        "serviceWorker" in
        navigator
      )
    ) {
      return;
    }

    async function registerServiceWorker() {
      try {
        await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
            updateViaCache: "none",
          },
        );
      } catch (error) {
        console.error(
          "HOO 서비스 워커 등록 실패:",
          error,
        );
      }
    }

    void registerServiceWorker();
  }, []);

  return null;
}