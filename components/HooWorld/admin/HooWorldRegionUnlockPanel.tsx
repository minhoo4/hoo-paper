"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "../../../lib/supabase/client";

import {
  HOO_WORLD_DEFAULT_REGION_ID,
  HOO_WORLD_REGION_LIST,
  type HooWorldRegionId,
} from "../world/hooWorldMap";

import {
  useHooWorldRegionUnlocks,
} from "../world/useHooWorldRegionUnlocks";

type HooWorldRegionUnlockPanelProps = {
  isAdmin: boolean;
  canManage: boolean;
};

type AdminRegionUnlockResult = {
  ok?: unknown;
  error_code?: unknown;
  error_message?: unknown;
  region_id?: unknown;
  is_unlocked?: unknown;
};

export default function HooWorldRegionUnlockPanel({
  isAdmin,
  canManage,
}: HooWorldRegionUnlockPanelProps) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const {
    regionStates,
    isLoading,
    error,
    isRealtimeConnected,
  } = useHooWorldRegionUnlocks({
    enabled: isAdmin,
  });

  const [
    savingRegionId,
    setSavingRegionId,
  ] = useState<
    HooWorldRegionId | null
  >(null);

  const [message, setMessage] =
    useState("");

  if (!isAdmin) {
    return null;
  }

  const stateByRegionId =
    new Map(
      regionStates.map(
        (state) => [
          state.regionId,
          state,
        ],
      ),
    );

  async function toggleRegion(
    regionId: HooWorldRegionId,
  ) {
    if (
      !canManage ||
      savingRegionId !== null ||
      regionId ===
        HOO_WORLD_DEFAULT_REGION_ID
    ) {
      return;
    }

    const current =
      stateByRegionId.get(
        regionId,
      );

    const nextUnlocked =
      !current?.isUnlocked;

    setSavingRegionId(
      regionId,
    );
    setMessage("");

    try {
      const {
        data,
        error: rpcError,
      } = await supabase.rpc(
        "admin_set_hoo_world_region_unlocked",
        {
          p_region_id:
            regionId,
          p_is_unlocked:
            nextUnlocked,
        },
      );

      if (rpcError) {
        throw rpcError;
      }

      const result =
        data &&
        typeof data === "object" &&
        !Array.isArray(data)
          ? data as AdminRegionUnlockResult
          : null;

      if (result?.ok !== true) {
        const errorMessage =
          typeof result?.error_message ===
            "string"
            ? result.error_message
            : "지역 상태 변경에 실패했습니다.";

        throw new Error(
          errorMessage,
        );
      }

      const region =
        HOO_WORLD_REGION_LIST.find(
          (item) =>
            item.id ===
            regionId,
        );

      setMessage(
        nextUnlocked
          ? `${region?.name ?? regionId} 지역을 해금했습니다.`
          : `${region?.name ?? regionId} 지역을 잠갔습니다.`,
      );
    } catch (saveError) {
      console.error(
        "HOO WORLD 지역 해금 상태 변경 실패:",
        saveError,
      );

      const errorMessage =
        saveError instanceof Error
          ? saveError.message
          : "지역 상태 변경에 실패했습니다.";

      setMessage(
        errorMessage.includes(
          "ADMIN_REQUIRED",
        )
          ? "관리자 권한이 없습니다."
          : errorMessage.includes(
                "DEFAULT_REGION_LOCKED",
              )
            ? "기본 캠핑필드는 잠글 수 없습니다."
            : errorMessage,
      );
    } finally {
      setSavingRegionId(
        null,
      );
    }
  }

  return (
    <section
      style={{
        marginBottom: 32,
        padding: 24,
        border:
          "1px solid #2f4537",
        borderRadius: 18,
        background:
          "#101713",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems:
            "flex-start",
          justifyContent:
            "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#7dbf91",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing:
                "0.16em",
            }}
          >
            HOO WORLD REGION CONTROL
          </div>

          <h2
            style={{
              margin: "7px 0 0",
              color: "#edf7ee",
              fontSize: 22,
              fontWeight: 900,
            }}
          >
            🗺️ 후월드 지역 해금
          </h2>

          <p
            style={{
              margin:
                "8px 0 0",
              color: "#9caf9f",
              fontSize: 12,
              lineHeight: 1.65,
            }}
          >
            지역을 열거나 잠그면 접속 중인 이용자의 미니맵과 이동 가능 여부에 실시간 반영됩니다.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color:
              isRealtimeConnected
                ? "#8ce2a8"
                : "#d7b56d",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          <span>
            {isRealtimeConnected
              ? "● REALTIME"
              : "● CONNECTING"}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            background:
              "#0b110d",
            color: "#97a89a",
            fontSize: 12,
          }}
        >
          지역 상태 불러오는 중...
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding:
              "11px 13px",
            border:
              "1px solid #6b4a32",
            borderRadius: 11,
            background:
              "#1a110d",
            color: "#efbc94",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          지역 DB를 읽지 못했습니다. 먼저 함께 제공된 SQL을 Supabase에 적용해 주세요. ({error})
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
          marginTop: 18,
        }}
      >
        {HOO_WORLD_REGION_LIST.map(
          (region) => {
            const state =
              stateByRegionId.get(
                region.id,
              );

            const isDefault =
              region.id ===
              HOO_WORLD_DEFAULT_REGION_ID;

            const isUnlocked =
              isDefault ||
              state?.isUnlocked ===
                true;

            const isSaving =
              savingRegionId ===
              region.id;

            return (
              <div
                key={region.id}
                style={{
                  padding: 14,
                  border:
                    isUnlocked
                      ? "1px solid #42694f"
                      : "1px solid #343c36",
                  borderRadius: 13,
                  background:
                    isUnlocked
                      ? "#132219"
                      : "#111512",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "flex-start",
                    justifyContent:
                      "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color:
                          isUnlocked
                            ? "#b8e4c4"
                            : "#a7afa9",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {isUnlocked
                        ? "🔓"
                        : "🔒"}{" "}
                      {region.name}
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        color: "#68766c",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {region.id}
                    </div>
                  </div>

                  {isDefault ? (
                    <span
                      style={{
                        borderRadius: 999,
                        background:
                          "#264b31",
                        padding:
                          "4px 7px",
                        color: "#aee5bd",
                        fontSize: 9,
                        fontWeight: 900,
                      }}
                    >
                      기본 지역
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={
                    !canManage ||
                    isDefault ||
                    savingRegionId !==
                      null
                  }
                  onClick={() => {
                    void toggleRegion(
                      region.id,
                    );
                  }}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    border: 0,
                    borderRadius: 10,
                    padding:
                      "9px 10px",
                    background:
                      isDefault
                        ? "#29312b"
                        : isUnlocked
                          ? "#633e37"
                          : "#2e6741",
                    color:
                      isDefault
                        ? "#78817b"
                        : "#ffffff",
                    fontSize: 11,
                    fontWeight: 900,
                    cursor:
                      !canManage ||
                      isDefault ||
                      savingRegionId !==
                        null
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      !canManage
                        ? 0.55
                        : 1,
                  }}
                >
                  {isSaving
                    ? "저장 중..."
                    : isDefault
                      ? "항상 해금"
                      : isUnlocked
                        ? "다시 잠그기"
                        : "지역 해금"}
                </button>
              </div>
            );
          },
        )}
      </div>

      {message ? (
        <div
          style={{
            marginTop: 14,
            padding:
              "11px 13px",
            border:
              "1px solid #305046",
            borderRadius: 11,
            background:
              "#0d1815",
            color: "#a9dece",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ) : null}

      {!canManage ? (
        <div
          style={{
            marginTop: 14,
            color: "#d7b56d",
            fontSize: 11,
          }}
        >
          현재 계정은 지역 상태를 읽을 수 있지만 변경 권한은 없습니다.
        </div>
      ) : null}
    </section>
  );
}
