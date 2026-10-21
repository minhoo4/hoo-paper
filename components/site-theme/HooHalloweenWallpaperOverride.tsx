"use client";

import { useEffect } from "react";

/**
 * HOO Halloween V15.
 * Theme source of truth: the EXISTING html[data-hoo-season] set by V12/V13.
 * This file NEVER changes persisted personal-wallpaper settings, storage, RPC, or data.
 * Only large screen-filling background visuals are temporarily suppressed while ON.
 */
type OldProperty = { value: string; priority: string };
type Saved = { property: string; old: OldProperty; applied: string };
const IGNORE = ".hoo-halloween-page-ambience,[data-hoo-h-panel],[data-hoo-skin],[data-hoo-theme-no-skin]";

export default function HooHalloweenWallpaperOverride() {
  useEffect(() => {
    const patched = new Map<HTMLElement, Saved>();
    let disposed = false;
    let timeout: number | undefined;

    const restore = () => {
      for (const [element, info] of patched) {
        // Do not overwrite a concurrent user change made while the theme was ON.
        const current = element.style.getPropertyValue(info.property);
        if (current === info.applied && element.style.getPropertyPriority(info.property) === "important") {
          if (info.old.value) element.style.setProperty(info.property, info.old.value, info.old.priority);
          else element.style.removeProperty(info.property);
        }
      }
      patched.clear();
    };

    const applyTo = (element: HTMLElement, property: string, value: string) => {
      const existing = patched.get(element);
      if (existing) {
        // React may replace the live wallpaper's inline style while Halloween is ON.
        // Preserve the newest user-authored value before re-applying the visual override.
        if (element.style.getPropertyValue(property) !== value ||
            element.style.getPropertyPriority(property) !== "important") {
          existing.old = {
            value: element.style.getPropertyValue(property),
            priority: element.style.getPropertyPriority(property),
          };
          element.style.setProperty(property, value, "important");
        }
        return;
      }
      const old = {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
      };
      patched.set(element, { property, old, applied: value });
      element.style.setProperty(property, value, "important");
    };

    const scan = () => {
      timeout = undefined;
      if (disposed) return;
      if (document.documentElement.dataset.hooSeason !== "halloween" || location.pathname !== "/") {
        restore();
        return;
      }
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      if (viewW < 1 || viewH < 1) return;
      const candidates = document.querySelectorAll<HTMLElement>(
        "img,video,canvas,[class*='wallpaper'],[class*='background'],[class*='backdrop'],[style*='background']"
      );
      let examined = 0;
      for (const element of candidates) {
        if (++examined > 220) continue;
        if (element.closest(IGNORE) || element === document.body || element === document.documentElement) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width < viewW * 0.9 || rect.height < viewH * 0.9) continue;
        const css = getComputedStyle(element);
        const media = element.matches("img,video,canvas");
        // Full-viewport media are suppressed only if they are decorative background layers.
        if (media) {
          if (css.position !== "fixed" && css.position !== "absolute") continue;
          if (element.closest("a,button,[role='button']")) continue;
          applyTo(element, "visibility", "hidden");
          continue;
        }
        // For an app wrapper with children, remove ONLY the background image.
        // Never hide the whole wrapper, since it may contain actual site controls.
        if (css.backgroundImage !== "none" && /url\(/i.test(css.backgroundImage)) {
          applyTo(element, "background-image", "none");
        }
      }
    };

    const schedule = () => {
      if (disposed || timeout !== undefined) return;
      timeout = window.setTimeout(scan, 100);
    };
    const change = new MutationObserver(schedule);
    change.observe(document.documentElement, { attributes: true, attributeFilter: ["data-hoo-season"] });
    // HOO's background element can be replaced when the user switches a home slide.
    const updates = new MutationObserver((records) => {
      if (records.some((record) => record.addedNodes.length > 0 || record.removedNodes.length > 0)) schedule();
    });
    updates.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("focus", schedule);
    window.addEventListener("popstate", schedule);
    const periodic = window.setInterval(schedule, 12_000);
    schedule();
    return () => {
      disposed = true;
      change.disconnect();
      updates.disconnect();
      window.clearInterval(periodic);
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("popstate", schedule);
      restore();
    };
  }, []);
  return null;
}
