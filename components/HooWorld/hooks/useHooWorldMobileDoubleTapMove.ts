"use client";

import { useEffect, type RefObject } from "react";

type Position = { x: number; y: number };
type Direction = "left" | "right" | "up" | "down";

const KEY_CODES: Record<Direction, string> = {
  left: "KeyA",
  right: "KeyD",
  up: "KeyW",
  down: "KeyS",
};

const DOUBLE_TAP_MS = 380;
const DOUBLE_TAP_DISTANCE = 48;
const TOUCH_MOVE_LIMIT = 14;
const STUCK_TIMEOUT_MS = 900;

export function useHooWorldMobileDoubleTapMove(
  playerRef: RefObject<HTMLDivElement | null>,
  positionRef: RefObject<Position>,
) {
  useEffect(() => {
    const world = playerRef.current?.closest("main");
    if (!world) return;

    const mobile = window.matchMedia(
      "(max-width: 767px) and (pointer: coarse)",
    );

    const pressed = new Set<Direction>();

    let target: Position | null = null;
    let frame: number | null = null;
    let previousPosition: Position | null = null;
    let lastProgressAt = 0;

    let touchStart: {
      id: number;
      x: number;
      y: number;
      time: number;
    } | null = null;

    let lastTap: {
      x: number;
      y: number;
      time: number;
    } | null = null;

    function setKey(direction: Direction, down: boolean) {
      if (pressed.has(direction) === down) return;

      if (down) pressed.add(direction);
      else pressed.delete(direction);

      const code = KEY_CODES[direction];

      window.dispatchEvent(
        new KeyboardEvent(down ? "keydown" : "keyup", {
          bubbles: true,
          cancelable: true,
          code,
          key: code.slice(3).toLowerCase(),
        }),
      );
    }

    function releaseKeys() {
      for (const direction of Array.from(pressed)) {
        setKey(direction, false);
      }
    }

    function stop() {
      target = null;

      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }

      releaseKeys();
      previousPosition = null;
    }

    function isLocked() {
      return (
        playerRef.current?.dataset.hooWorldMovementLocked ===
        "true"
      );
    }

    function tick(now: number) {
      frame = null;

      if (!target || !mobile.matches || isLocked()) {
        stop();
        return;
      }

      const current = positionRef.current;
      if (!current) {
        stop();
        return;
      }

      const dx = target.x - current.x;
      const dy = target.y - current.y;

      // 목적지 주변 약 6px 이내에서 정지
      const toleranceX = 600 / window.innerWidth;
      const toleranceY = 600 / window.innerHeight;

      if (
        Math.abs(dx) <= toleranceX &&
        Math.abs(dy) <= toleranceY
      ) {
        stop();
        return;
      }

      if (
        !previousPosition ||
        Math.hypot(
          current.x - previousPosition.x,
          current.y - previousPosition.y,
        ) > 0.008
      ) {
        lastProgressAt = now;
        previousPosition = {
          x: current.x,
          y: current.y,
        };
      }

      // 장애물 또는 이동 제한으로 더 이상 전진하지 못하면 중단
      if (now - lastProgressAt > STUCK_TIMEOUT_MS) {
        stop();
        return;
      }

      setKey("left", dx < -toleranceX);
      setKey("right", dx > toleranceX);
      setKey("up", dy < -toleranceY);
      setKey("down", dy > toleranceY);

      frame = requestAnimationFrame(tick);
    }

    function toWorldPosition(
      clientX: number,
      clientY: number,
    ): Position {
      const rect = world!.getBoundingClientRect();

      const active =
        world!.dataset.hooMobileCameraStage === "active";

      const zoomValue = Number(
        world!.style.getPropertyValue("--hoo-camera-zoom"),
      );

      const zoom =
        active && Number.isFinite(zoomValue) && zoomValue > 0
          ? zoomValue
          : 1;

      const offsetX = active
        ? Number(
            world!.style.getPropertyValue("--hoo-camera-x"),
          ) || 0
        : 0;

      const offsetY = active
        ? Number(
            world!.style.getPropertyValue("--hoo-camera-y"),
          ) || 0
        : 0;

      const x =
        (clientX - rect.left - offsetX) / zoom;
      const y =
        (clientY - rect.top - offsetY) / zoom;

      return {
        x: Math.max(
          0,
          Math.min(100, x / window.innerWidth * 100),
        ),
        y: Math.max(
          0,
          Math.min(100, y / window.innerHeight * 100),
        ),
      };
    }

    function startWalking(x: number, y: number) {
      stop();

      if (isLocked()) return;

      target = toWorldPosition(x, y);
      lastProgressAt = performance.now();
      previousPosition = null;

      frame = requestAnimationFrame(tick);
    }

    function isFieldTouch(eventTarget: EventTarget | null) {
      if (!(eventTarget instanceof Element)) return false;
      if (!world!.contains(eventTarget)) return false;

      return !eventTarget.closest(
        [
          "header",
          "button",
          "a",
          "input",
          "textarea",
          "select",
          "label",
          "[contenteditable]",
          '[role="button"]',
          '[role="dialog"]',
          '[role="menu"]',
          '[role="slider"]',
          '[data-hoo-world-local-player="true"]',
          '[data-hoo-world-collision-object="true"]',
          "[data-hoo-world-food-item-id]",
          "[data-hoo-world-item-id]",
        ].join(","),
      );
    }

    function onTouchStart(event: TouchEvent) {
      if (!mobile.matches) return;

      if (event.touches.length !== 1) {
        touchStart = null;
        lastTap = null;
        return;
      }

      if (!isFieldTouch(event.target)) {
        touchStart = null;
        lastTap = null;
        return;
      }

      const touch = event.changedTouches.item(0);
      if (!touch) return;

      touchStart = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        time: performance.now(),
      };
    }

    function onTouchMove(event: TouchEvent) {
      if (!touchStart) return;

      if (event.touches.length !== 1) {
        touchStart = null;
        lastTap = null;
        return;
      }

      const touch = Array.from(event.touches).find(
        (item) => item.identifier === touchStart?.id,
      );

      if (
        !touch ||
        Math.hypot(
          touch.clientX - touchStart.x,
          touch.clientY - touchStart.y,
        ) > TOUCH_MOVE_LIMIT
      ) {
        touchStart = null;
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (!touchStart || !mobile.matches) return;

      const candidate = touchStart;
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === candidate.id,
      );

      if (!touch) return;
      touchStart = null;

      if (
        event.touches.length !== 0 ||
        performance.now() - candidate.time > 300 ||
        Math.hypot(
          touch.clientX - candidate.x,
          touch.clientY - candidate.y,
        ) > TOUCH_MOVE_LIMIT
      ) {
        lastTap = null;
        return;
      }

      const now = performance.now();

      if (
        lastTap &&
        now - lastTap.time <= DOUBLE_TAP_MS &&
        Math.hypot(
          touch.clientX - lastTap.x,
          touch.clientY - lastTap.y,
        ) <= DOUBLE_TAP_DISTANCE
      ) {
        lastTap = null;

        if (event.cancelable) {
          event.preventDefault();
        }

        startWalking(touch.clientX, touch.clientY);
        return;
      }

      lastTap = {
        x: touch.clientX,
        y: touch.clientY,
        time: now,
      };
    }

    function onTouchCancel() {
      touchStart = null;
      lastTap = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      // 실제 키보드 조작이 시작되면 자동 이동을 중단한다.
      if (
        event.isTrusted &&
        ["KeyW", "KeyA", "KeyS", "KeyD",
         "ArrowUp", "ArrowDown",
         "ArrowLeft", "ArrowRight"].includes(event.code)
      ) {
        stop();
      }
    }

    const previousTouchAction = world.style.touchAction;

    if (mobile.matches) {
      world.style.touchAction = "manipulation";
    }

    document.addEventListener("touchstart", onTouchStart, true);
    document.addEventListener("touchmove", onTouchMove, true);
    document.addEventListener("touchend", onTouchEnd, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchcancel", onTouchCancel, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", stop);

    return () => {
      stop();
      world.style.touchAction = previousTouchAction;

      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", onTouchCancel, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", stop);
    };
  }, [playerRef, positionRef]);
}
