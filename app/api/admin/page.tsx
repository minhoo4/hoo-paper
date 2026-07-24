"use client";

import { useEffect, useState } from "react";

type AdminStatus = {
  isLoggedIn: boolean;
  isAdmin: boolean;
  canManage: boolean;
};

export default function AdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() =>
        setStatus({
          isLoggedIn: false,
          isAdmin: false,
          canManage: false,
        }),
      );
  }, []);

  if (!status) {
    return <main style={{ padding: 40 }}>관리자 확인 중...</main>;
  }

  if (!status.isLoggedIn) {
    return <main style={{ padding: 40 }}>로그인이 필요합니다.</main>;
  }

  if (!status.isAdmin) {
    return <main style={{ padding: 40 }}>관리자 권한이 없습니다.</main>;
  }

  return (
    <main style={{ minHeight: "100vh", padding: 40 }}>
      <h1>관리자 페이지</h1>
      <p>공지사항을 작성하고 관리할 수 있습니다.</p>
    </main>
  );
}