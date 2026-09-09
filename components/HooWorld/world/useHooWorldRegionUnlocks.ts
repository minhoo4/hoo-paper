"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "../../../lib/supabase/client";

import {
  HOO_WORLD_DEFAULT_UNLOCKED_REGION_IDS,
  HOO_WORLD_REGION_LIST,
  isHooWorldRegionId,
  type HooWorldRegionId,
} from "./hooWorldMap";

export type HooWorldRegionUnlockState = {
  regionId: HooWorldRegionId;
  isUnlocked: boolean;
  unlockedAt: string | null;
  unlockedBy: string | null;
  updatedAt: string | null;
};

type HooWorldRegionRow = {
  region_id: string;
  is_unlocked: boolean;
  unlocked_at: string | null;
  unlocked_by: string | null;
  updated_at: string | null;
};

type UseHooWorldRegionUnlocksOptions = {
  enabled?: boolean;
};

function createFallbackStates():
  HooWorldRegionUnlockState[] {
  const defaultUnlockedSet =
    new Set<HooWorldRegionId>(
      HOO_WORLD_DEFAULT_UNLOCKED_REGION_IDS,
    );

  return HOO_WORLD_REGION_LIST.map(
    (region) => ({
      regionId: region.id,
      isUnlocked:
        defaultUnlockedSet.has(
          region.id,
        ),
      unlockedAt: null,
      unlockedBy: null,
      updatedAt: null,
    }),
  );
}

function normalizeRegionStates(
  rows: HooWorldRegionRow[] | null,
) {
  const defaultUnlockedSet =
    new Set<HooWorldRegionId>(
      HOO_WORLD_DEFAULT_UNLOCKED_REGION_IDS,
    );

  const rowByRegionId =
    new Map<
      HooWorldRegionId,
      HooWorldRegionRow
    >();

  for (const row of rows ?? []) {
    if (
      isHooWorldRegionId(
        row.region_id,
      )
    ) {
      rowByRegionId.set(
        row.region_id,
        row,
      );
    }
  }

  return HOO_WORLD_REGION_LIST.map(
    (region) => {
      const row =
        rowByRegionId.get(
          region.id,
        );

      /*
       * 기본 지역(camping)은 DB가 비었거나 잘못 잠겨 있어도
       * 항상 진입 가능 상태를 유지한다.
       */
      const isUnlocked =
        defaultUnlockedSet.has(
          region.id,
        ) ||
        row?.is_unlocked === true;

      return {
        regionId: region.id,
        isUnlocked,
        unlockedAt:
          row?.unlocked_at ?? null,
        unlockedBy:
          row?.unlocked_by ?? null,
        updatedAt:
          row?.updated_at ?? null,
      } satisfies HooWorldRegionUnlockState;
    },
  );
}

export function useHooWorldRegionUnlocks({
  enabled = true,
}: UseHooWorldRegionUnlocksOptions = {}) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [
    regionStates,
    setRegionStates,
  ] = useState<
    HooWorldRegionUnlockState[]
  >(() => createFallbackStates());

  const [
    isLoading,
    setIsLoading,
  ] = useState(enabled);

  const [error, setError] =
    useState("");

  const [
    isRealtimeConnected,
    setIsRealtimeConnected,
  ] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setRegionStates(
        createFallbackStates(),
      );
      setIsLoading(false);
      setError("");
      setIsRealtimeConnected(
        false,
      );
      return;
    }

    let cancelled = false;
    let refreshTimer:
      ReturnType<
        typeof setTimeout
      > | null = null;

    async function loadRegionStates(
      showLoading = false,
    ) {
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        setError("");

        const {
          data,
          error: selectError,
        } = await supabase
          .from("hoo_world_regions")
          .select(
            `
              region_id,
              is_unlocked,
              unlocked_at,
              unlocked_by,
              updated_at
            `,
          )
          .order(
            "region_id",
            {
              ascending: true,
            },
          );

        if (cancelled) {
          return;
        }

        if (selectError) {
          throw selectError;
        }

        setRegionStates(
          normalizeRegionStates(
            (data ?? []) as HooWorldRegionRow[],
          ),
        );
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        console.warn(
          "HOO WORLD 지역 해금 상태를 불러오지 못했습니다.",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "지역 해금 상태를 불러오지 못했습니다.",
        );

        /*
         * DB가 아직 준비되지 않았거나 일시적으로 실패해도
         * 기본 캠핑필드는 이용할 수 있게 유지한다.
         */
        setRegionStates(
          createFallbackStates(),
        );
      } finally {
        if (
          showLoading &&
          !cancelled
        ) {
          setIsLoading(false);
        }
      }
    }

    function scheduleRefresh() {
      if (refreshTimer) {
        clearTimeout(
          refreshTimer,
        );
      }

      refreshTimer =
        setTimeout(
          () => {
            refreshTimer = null;
            void loadRegionStates(
              false,
            );
          },
          100,
        );
    }

    void loadRegionStates(true);

    const channel =
      supabase
        .channel(
          "hoo-world-region-unlocks",
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "hoo_world_regions",
          },
          () => {
            scheduleRefresh();
          },
        )
        .subscribe(
          (subscriptionStatus) => {
            if (cancelled) {
              return;
            }

            setIsRealtimeConnected(
              subscriptionStatus ===
                "SUBSCRIBED",
            );
          },
        );

    return () => {
      cancelled = true;

      if (refreshTimer) {
        clearTimeout(
          refreshTimer,
        );
      }

      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    enabled,
    supabase,
  ]);

  const unlockedRegionIds =
    useMemo(
      () =>
        regionStates
          .filter(
            (region) =>
              region.isUnlocked,
          )
          .map(
            (region) =>
              region.regionId,
          ),
      [regionStates],
    );

  return {
    regionStates,
    unlockedRegionIds,
    isLoading,
    error,
    isRealtimeConnected,
  };
}
