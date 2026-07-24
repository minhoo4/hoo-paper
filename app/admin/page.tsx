"use client";

import { FormEvent, useEffect, useState } from "react";

type AdminStatus = {
  isLoggedIn: boolean;
  isAdmin: boolean;
  canManage: boolean;
};

export default function AdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !content.trim()) {
      setMessage("제목과 내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/notices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "공지 등록에 실패했습니다.");
        return;
      }

      setTitle("");
      setContent("");
      setMessage("공지가 등록되었습니다.");
    } catch {
      setMessage("서버 연결에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

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
    <main
      style={{
        minHeight: "100vh",
        padding: "40px",
        background: "#090909",
        color: "#ffffff",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <h1 style={{ marginBottom: 8 }}>관리자 페이지</h1>
        <p style={{ marginBottom: 32, color: "#b5b5b5" }}>
          공지사항을 작성하고 관리할 수 있습니다.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 24,
            border: "1px solid #2d2d2d",
            borderRadius: 16,
            background: "#121212",
          }}
        >
          <label>
            <div style={{ marginBottom: 8 }}>제목</div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="공지 제목을 입력하세요."
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border: "1px solid #3a3a3a",
                background: "#0b0b0b",
                color: "#ffffff",
                outline: "none",
              }}
            />
          </label>

          <label>
            <div style={{ marginBottom: 8 }}>내용</div>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={5000}
              rows={10}
              placeholder="공지 내용을 입력하세요."
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border: "1px solid #3a3a3a",
                background: "#0b0b0b",
                color: "#ffffff",
                resize: "vertical",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !status.canManage}
            style={{
              padding: 14,
              border: 0,
              borderRadius: 10,
              cursor:
                submitting || !status.canManage
                  ? "not-allowed"
                  : "pointer",
              background: "#ffffff",
              color: "#000000",
              fontWeight: 700,
              opacity:
                submitting || !status.canManage
                  ? 0.5
                  : 1,
            }}
          >
            {submitting ? "등록 중..." : "공지 등록"}
          </button>

          {message && (
            <p style={{ margin: 0, color: "#d7d7d7" }}>
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}