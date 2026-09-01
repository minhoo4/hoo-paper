"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type AdminStatus = {
  isLoggedIn: boolean;
  isAdmin: boolean;
  canManage: boolean;
};

type CoffeeRecord = {
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  approvedAt: string;
};

type CoffeeData = {
  ok: boolean;
  stats: {
    today: {
      count: number;
      amount: number;
    };
    month: {
      count: number;
      amount: number;
    };
  };
  recent: CoffeeRecord[];
  error?: string;
};

function formatMoney(
  value: number,
) {
  return `${value.toLocaleString(
    "ko-KR",
  )}원`;
}

function formatApprovedAt(
  value: string,
) {
  try {
    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    ).format(new Date(value));
  } catch {
    return "-";
  }
}

function shortenOrderId(
  orderId: string,
) {
  if (orderId.length <= 18) {
    return orderId;
  }

  return `${orderId.slice(
    0,
    10,
  )}…${orderId.slice(-6)}`;
}

export default function AdminPage() {
  const [status, setStatus] =
    useState<AdminStatus | null>(
      null,
    );

  const [coffeeData, setCoffeeData] =
    useState<CoffeeData | null>(
      null,
    );

  const [coffeeLoading, setCoffeeLoading] =
    useState(true);

  const [coffeeError, setCoffeeError] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [content, setContent] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    fetch("/api/admin/me", {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then(
        (
          result: AdminStatus,
        ) => {
          setStatus(result);
        },
      )
      .catch(() =>
        setStatus({
          isLoggedIn: false,
          isAdmin: false,
          canManage: false,
        }),
      );
  }, []);

  useEffect(() => {
    if (
      !status?.isLoggedIn ||
      !status.isAdmin
    ) {
      return;
    }

    let cancelled = false;

    async function loadCoffee() {
      setCoffeeLoading(true);
      setCoffeeError("");

      try {
        const response =
          await fetch(
            "/api/admin/coffee",
            {
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as
            CoffeeData;

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.error ??
              "커피 기록을 불러오지 못했습니다.",
          );
        }

        if (!cancelled) {
          setCoffeeData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setCoffeeError(
            error instanceof Error
              ? error.message
              : "커피 기록을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setCoffeeLoading(false);
        }
      }
    }

    void loadCoffee();

    return () => {
      cancelled = true;
    };
  }, [status]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !title.trim() ||
      !content.trim()
    ) {
      setMessage(
        "제목과 내용을 입력해주세요.",
      );

      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/notices",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title,
              content,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.error ??
            "공지 등록에 실패했습니다.",
        );

        return;
      }

      setTitle("");
      setContent("");
      setMessage(
        "공지가 등록되었습니다.",
      );
    } catch {
      setMessage(
        "서버 연결에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          background: "#090909",
          color: "#ffffff",
        }}
      >
        관리자 확인 중...
      </main>
    );
  }

  if (!status.isLoggedIn) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          background: "#090909",
          color: "#ffffff",
        }}
      >
        로그인이 필요합니다.
      </main>
    );
  }

  if (!status.isAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          background: "#090909",
          color: "#ffffff",
        }}
      >
        관리자 권한이 없습니다.
      </main>
    );
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
      <div
        style={{
          width: "100%",
          maxWidth: 920,
        }}
      >
        <h1
          style={{
            marginBottom: 8,
          }}
        >
          관리자 페이지
        </h1>

        <p
          style={{
            marginBottom: 32,
            color: "#b5b5b5",
          }}
        >
          HOO 운영 현황과 공지사항을
          관리할 수 있습니다.
        </p>

        {/* 김미썸커피 */}
        <section
          style={{
            marginBottom: 32,
            padding: 24,
            border:
              "1px solid #2d2d2d",
            borderRadius: 18,
            background: "#121212",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  color: "#d5a66c",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing:
                    "0.12em",
                  marginBottom: 6,
                }}
              >
                GIMME SOME COFFEE
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                }}
              >
                ☕ 김미썸커피
              </h2>
            </div>

            <div
              style={{
                color: "#777777",
                fontSize: 12,
              }}
            >
              관리자 전용
            </div>
          </div>

          {coffeeLoading ? (
            <div
              style={{
                padding: "36px 0",
                textAlign: "center",
                color: "#777777",
              }}
            >
              커피 기록 불러오는 중...
            </div>
          ) : coffeeError ? (
            <div
              style={{
                padding: 16,
                border:
                  "1px solid #5b2929",
                borderRadius: 12,
                background:
                  "#241313",
                color: "#ffb3b3",
              }}
            >
              {coffeeError}
            </div>
          ) : coffeeData ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    padding: 20,
                    border:
                      "1px solid #2d2d2d",
                    borderRadius: 14,
                    background:
                      "#0b0b0b",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 8,
                      color:
                        "#8b8b8b",
                      fontSize: 12,
                    }}
                  >
                    오늘 받은 커피
                  </div>

                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                    }}
                  >
                    {
                      coffeeData.stats
                        .today.count
                    }
                    잔
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      color:
                        "#e7bc82",
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(
                      coffeeData.stats
                        .today.amount,
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: 20,
                    border:
                      "1px solid #2d2d2d",
                    borderRadius: 14,
                    background:
                      "#0b0b0b",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 8,
                      color:
                        "#8b8b8b",
                      fontSize: 12,
                    }}
                  >
                    이번 달 받은 커피
                  </div>

                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                    }}
                  >
                    {
                      coffeeData.stats
                        .month.count
                    }
                    잔
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      color:
                        "#e7bc82",
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(
                      coffeeData.stats
                        .month.amount,
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 22,
                }}
              >
                <div
                  style={{
                    marginBottom: 12,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  최근 기록
                </div>

                {coffeeData.recent
                  .length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign:
                        "center",
                      border:
                        "1px solid #252525",
                      borderRadius: 12,
                      color:
                        "#707070",
                      background:
                        "#0b0b0b",
                    }}
                  >
                    아직 커피 기록이
                    없습니다.
                  </div>
                ) : (
                  <div
                    style={{
                      overflow:
                        "hidden",
                      border:
                        "1px solid #252525",
                      borderRadius: 12,
                      background:
                        "#0b0b0b",
                    }}
                  >
                    {coffeeData.recent.map(
                      (
                        record,
                        index,
                      ) => (
                        <div
                          key={
                            record.orderId
                          }
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "110px 1fr 100px 70px",
                            alignItems:
                              "center",
                            gap: 12,
                            padding:
                              "14px 16px",
                            borderBottom:
                              index ===
                              coffeeData
                                .recent
                                .length -
                                1
                                ? "none"
                                : "1px solid #202020",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "#8a8a8a",
                              fontSize:
                                12,
                            }}
                          >
                            {formatApprovedAt(
                              record.approvedAt,
                            )}
                          </span>

                          <span
                            title={
                              record.orderId
                            }
                            style={{
                              minWidth: 0,
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                              whiteSpace:
                                "nowrap",
                              color:
                                "#777777",
                              fontSize:
                                12,
                              fontFamily:
                                "monospace",
                            }}
                          >
                            {shortenOrderId(
                              record.orderId,
                            )}
                          </span>

                          <strong
                            style={{
                              textAlign:
                                "right",
                              color:
                                "#e7bc82",
                            }}
                          >
                            {formatMoney(
                              record.amount,
                            )}
                          </strong>

                          <span
                            style={{
                              textAlign:
                                "right",
                              color:
                                record.status ===
                                "DONE"
                                  ? "#83d7a2"
                                  : "#cccccc",
                              fontSize:
                                12,
                              fontWeight:
                                700,
                            }}
                          >
                            {record.status ===
                            "DONE"
                              ? "완료"
                              : record.status}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>

        {/* 기존 공지사항 */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 24,
            border:
              "1px solid #2d2d2d",
            borderRadius: 16,
            background: "#121212",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
            }}
          >
            공지사항 작성
          </h2>

          <label>
            <div
              style={{
                marginBottom: 8,
              }}
            >
              제목
            </div>

            <input
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value,
                )
              }
              maxLength={100}
              placeholder="공지 제목을 입력하세요."
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border:
                  "1px solid #3a3a3a",
                background:
                  "#0b0b0b",
                color: "#ffffff",
                outline: "none",
              }}
            />
          </label>

          <label>
            <div
              style={{
                marginBottom: 8,
              }}
            >
              내용
            </div>

            <textarea
              value={content}
              onChange={(event) =>
                setContent(
                  event.target.value,
                )
              }
              maxLength={5000}
              rows={10}
              placeholder="공지 내용을 입력하세요."
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border:
                  "1px solid #3a3a3a",
                background:
                  "#0b0b0b",
                color: "#ffffff",
                resize:
                  "vertical",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={
              submitting ||
              !status.canManage
            }
            style={{
              padding: 14,
              border: 0,
              borderRadius: 10,
              cursor:
                submitting ||
                !status.canManage
                  ? "not-allowed"
                  : "pointer",
              background:
                "#ffffff",
              color: "#000000",
              fontWeight: 700,
              opacity:
                submitting ||
                !status.canManage
                  ? 0.5
                  : 1,
            }}
          >
            {submitting
              ? "등록 중..."
              : "공지 등록"}
          </button>

          {message && (
            <p
              style={{
                margin: 0,
                color:
                  "#d7d7d7",
              }}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}