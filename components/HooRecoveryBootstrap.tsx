"use client";

import { useEffect } from "react";

import {
  captureHooLocalStorageSnapshot,
  createHooRecoveryBundle,
  downloadHooRecoveryBundle,
  restoreHooLocalStorageSnapshot,
} from "@/lib/recovery/hooRecoveryVault";

declare global {
  interface Window {
    hooRecovery?: {
      captureNow: () => Promise<void>;
      exportBackup: () => Promise<void>;
      createBundle: typeof createHooRecoveryBundle;
      restoreMissingLocalData: () => Promise<number>;
    };
  }
}

export default function HooRecoveryBootstrap() {
  useEffect(() => {
    let disposed = false;

    const capture = async () => {
      if (disposed) {
        return;
      }

      try {
        await captureHooLocalStorageSnapshot();
      } catch (error) {
        console.warn("HOO 로컬 복구 스냅샷 저장을 건너뜁니다.", error);
      }
    };

    void capture();

    const interval = window.setInterval(() => {
      void capture();
    }, 60_000);

    const handlePageHide = () => {
      void capture();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void capture();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    window.hooRecovery = {
      captureNow: async () => {
        await capture();
      },
      exportBackup: downloadHooRecoveryBundle,
      createBundle: createHooRecoveryBundle,
      restoreMissingLocalData: async () =>
        await restoreHooLocalStorageSnapshot({ overwrite: false }),
    };

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (window.hooRecovery) {
        delete window.hooRecovery;
      }
    };
  }, []);

  return null;
}
