"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * V3: administrator menu independent from app/layout.tsx and from
 * any conditional shortcut injected by older patches.
 * Next.js mounts this automatically on every route in app/admin/.
 * It does not change the existing admin page or its auth/business logic.
 * Actual theme mutation is protected by the Supabase RPC on the settings page.
 */
export default function AdminTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onSettings = pathname === "/admin/seasonal-theme" || pathname === "/admin/seasonal-theme/";
  return (
    <>
      {!onSettings ? (
        <nav
          data-hoo-theme-admin-link="v3"
          aria-label="이벤트테마 변경"
          style={{
            position: "fixed",
            right: "clamp(24px, 8vw, 136px)",
            top: "max(86px, env(safe-area-inset-top))",
            zIndex: 2147482000,
            maxWidth: "min(300px, calc(100vw - 48px))",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <Link
            href="/admin/seasonal-theme"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              minWidth: 218,
              padding: "16px 20px",
              borderRadius: 16,
              color: "#ffe4bf",
              background: "#281b33",
              border: "2px solid #e58f42",
              boxShadow: "0 8px 26px rgba(0,0,0,.4)",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 29 }}>🎃</span>
            <span style={{ display: "grid", gap: 3 }}>
              <strong style={{ fontSize: 17, lineHeight: 1.3 }}>이벤트테마 변경</strong>
              <span style={{ fontSize: 12, color: "#efbb94" }}>할로윈 테마 ON / OFF</span>
            </span>
            <span aria-hidden="true" style={{ marginLeft: "auto", fontSize: 19 }}>›</span>
          </Link>
        </nav>
      ) : null}
      {children}
    </>
  );
}
