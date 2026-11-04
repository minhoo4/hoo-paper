"use client";

import { useEffect, type RefObject } from "react";

const HOLD_MS = 300;
const MOVE_THRESHOLD = 18;

const directionKeys = {
  left: "KeyA",
  right: "KeyD",
  up: "KeyW",
  down: "KeyS",
} as const;

type Direction = keyof typeof directionKeys;

export function useHooWorldMobileDrag(
  playerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const mobile = window.matchMedia(
      "(pointer: coarse) and (hover: none)",
    );

    let touchId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let holding = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pressed = new Set<Direction>();

    function sendKey(direction: Direction, down: boolean) {
      const code = directionKeys[direction];

      document.dispatchEvent(
        new KeyboardEvent(down ? "keydown" : "keyup", {
          bubbles: true,
          cancelable: true,
          code,
          key: code.slice(3).toLowerCase(),
        }),
      );
    }

    function setDirection(direction: Direction, active: boolean) {
      const wasPressed = pressed.has(direction);

      if (wasPressed === active) return;

      if (active) {
        pressed.add(direction);
      } else {
        pressed.delete(direction);
      }

      sendKey(direction, active);
    }

    function releaseKeys() {
      for (const direction of Array.from(pressed)) {
        setDirection(direction, false);
      }
    }

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function stop() {
      clearTimer();
      releaseKeys();
      touchId = null;
      holding = false;
    }

    function isOnPlayer(x: number, y: number) {
      const element =
        playerRef.current?.querySelector<HTMLElement>(
          '[data-hoo-world-character="bubble-mascot"]',
        ) ?? playerRef.current;

      if (!element) return false;

      const rect = element.getBoundingClientRect();

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        x >= rect.left - 8 &&
        x <= rect.right + 8 &&
        y >= rect.top - 8 &&
        y <= rect.bottom + 8
      );
    }

    function updateMovement() {
      const dx = lastX - startX;
      const dy = lastY - startY;

      setDirection("left", dx < -MOVE_THRESHOLD);
      setDirection("right", dx > MOVE_THRESHOLD);
      setDirection("up", dy < -MOVE_THRESHOLD);
      setDirection("down", dy > MOVE_THRESHOLD);
    }

    function onTouchStart(event: TouchEvent) {
      if (!mobile.matches) return;

      if (event.touches.length > 1) {
        stop();
        return;
      }

      if (touchId !== null) return;

      if (
        playerRef.current?.dataset.hooWorldMovementLocked === "true"
      ) return;

      const target = event.target;

      if (!(target instanceof Element)) return;

      const root = playerRef.current?.closest("main");

      if (!root?.contains(target)) return;

      if (
        target.closest(
          'button, a, input, textarea, select, [role="dialog"]',
        )
      ) return;

      const touch = event.changedTouches.item(0);

      if (!touch) return;

      if (!isOnPlayer(touch.clientX, touch.clientY)) return;

      touchId = touch.identifier;
      startX = lastX = touch.clientX;
      startY = lastY = touch.clientY;

      event.preventDefault();

      timer = setTimeout(() => {
        if (touchId === null) return;
        holding = true;
        updateMovement();
      }, HOLD_MS);
    }

    function onTouchMove(event: TouchEvent) {
      if (touchId === null) return;

      if (event.touches.length !== 1) {
        stop();
        return;
      }

      const touch = Array.from(event.touches).find(
        (item) => item.identifier === touchId,
      );

      if (!touch) {
        stop();
        return;
      }

      event.preventDefault();

      lastX = touch.clientX;
      lastY = touch.clientY;

      if (!holding) {
        if (
          Math.hypot(lastX - startX, lastY - startY) >
          MOVE_THRESHOLD
        ) {
          stop();
        }
        return;
      }

      if (
        playerRef.current?.dataset.hooWorldMovementLocked === "true"
      ) {
        stop();
        return;
      }

      updateMovement();
    }

    function onTouchEnd(event: TouchEvent) {
      if (touchId === null) return;

      if (
        Array.from(event.changedTouches).some(
          (item) => item.identifier === touchId,
        )
      ) {
        stop();
      }
    }

    const options: AddEventListenerOptions = {
      passive: false,
      capture: true,
    };

    document.addEventListener("touchstart", onTouchStart, options);
    document.addEventListener("touchmove", onTouchMove, options);
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("touchcancel", onTouchEnd, true);
    window.addEventListener("blur", stop);

    return () => {
      stop();
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", onTouchEnd, true);
      window.removeEventListener("blur", stop);
    };
  }, [playerRef]);
}
