"use client";

import { useEffect, useRef } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;

type Camera = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export function useHooWorldMobileCamera() {
  const worldRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<Camera>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    const mobile = window.matchMedia(
      "(pointer: coarse) and (hover: none)"
    );

    const previewEnabled =
      new URLSearchParams(window.location.search).get(
        "hooMobileCameraPreview"
      ) === "1";

    if (previewEnabled && mobile.matches) {
      world.dataset.hooMobileCameraStage = "active";
    }

    let pinching = false;
    let previousDistance = 0;

    function distance(a: Touch, b: Touch) {
      return Math.hypot(
        a.clientX - b.clientX,
        a.clientY - b.clientY
      );
    }

    function publish() {
      if (!world) return;

      const camera = cameraRef.current;

      world.style.setProperty(
        "--hoo-camera-inverse-zoom",
        String(1 / camera.zoom)
      );

      world.style.setProperty(
        "--hoo-camera-zoom",
        String(camera.zoom)
      );

      world.style.setProperty(
        "--hoo-camera-x",
        camera.offsetX + "px"
      );

      world.style.setProperty(
        "--hoo-camera-y",
        camera.offsetY + "px"
      );

      world.dispatchEvent(
        new CustomEvent("hoo:mobile-camera-change", {
          detail: { ...camera },
          bubbles: false,
        })
      );
    }

    function onStart(event: TouchEvent) {
      if (!mobile.matches) return;

      if (
        document.documentElement.dataset.hooTrading === "on"
      ) return;

      if (event.touches.length !== 2) return;

      const a = event.touches[0];
      const b = event.touches[1];

      previousDistance = distance(a, b);
      pinching = previousDistance > 0;
    }

    function onMove(event: TouchEvent) {
      if (!pinching || !mobile.matches || !world) return;

      if (
        event.touches.length !== 2 ||
        document.documentElement.dataset.hooTrading === "on"
      ) {
        pinching = false;
        return;
      }

      event.preventDefault();

      const a = event.touches[0];
      const b = event.touches[1];

      const nextDistance = distance(a, b);
      if (!nextDistance || !previousDistance) return;

      const rect = world.getBoundingClientRect();
      const focusX =
        (a.clientX + b.clientX) / 2 - rect.left;
      const focusY =
        (a.clientY + b.clientY) / 2 - rect.top;

      const camera = cameraRef.current;
      const previousZoom = camera.zoom;

      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(
          MAX_ZOOM,
          previousZoom * nextDistance / previousDistance
        )
      );

      const ratio = nextZoom / previousZoom;

      let nextX =
        focusX - (focusX - camera.offsetX) * ratio;
      let nextY =
        focusY - (focusY - camera.offsetY) * ratio;

      nextX = Math.max(
        rect.width * (1 - nextZoom),
        Math.min(0, nextX)
      );

      nextY = Math.max(
        rect.height * (1 - nextZoom),
        Math.min(0, nextY)
      );

      cameraRef.current = {
        zoom: nextZoom,
        offsetX: nextX,
        offsetY: nextY,
      };

      previousDistance = nextDistance;
      publish();
    }

    function onEnd(event: TouchEvent) {
      if (event.touches.length < 2) {
        pinching = false;
        previousDistance = 0;
      }
    }

    function onResize() {
      const camera = cameraRef.current;
      if (!world) return;

      const width = world.clientWidth;
      const height = world.clientHeight;

      camera.offsetX = Math.max(
        width * (1 - camera.zoom),
        Math.min(0, camera.offsetX)
      );
      camera.offsetY = Math.max(
        height * (1 - camera.zoom),
        Math.min(0, camera.offsetY)
      );

      publish();
    }

    const options: AddEventListenerOptions = {
      passive: false,
      capture: true,
    };

    world.addEventListener("touchstart", onStart, options);
    world.addEventListener("touchmove", onMove, options);
    world.addEventListener("touchend", onEnd, true);
    world.addEventListener("touchcancel", onEnd, true);
    window.addEventListener("resize", onResize);

    publish();

    return () => {
      world.removeEventListener("touchstart", onStart, true);
      world.removeEventListener("touchmove", onMove, true);
      world.removeEventListener("touchend", onEnd, true);
      world.removeEventListener("touchcancel", onEnd, true);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return worldRef;
}
