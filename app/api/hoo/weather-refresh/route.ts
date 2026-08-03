import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WeatherPreferenceRow = {
  user_id: string;
  latitude: number | string;
  longitude: number | string;
  timezone: string | null;
};

type OpenMeteoPayload = {
  timezone?: string;
  utc_offset_seconds?: number;

  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
  };

  hourly?: {
    time?: string[];
    precipitation_probability?:
      Array<number | null>;
  };

  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
};

function parseOpenMeteoTime(
  value: string | undefined,
  utcOffsetSeconds: number,
) {
  if (!value) {
    return null;
  }

  if (
    value.endsWith("Z") ||
    /[+-]\d{2}:\d{2}$/.test(value)
  ) {
    const parsedDate = new Date(value);

    return Number.isNaN(
      parsedDate.getTime(),
    )
      ? null
      : parsedDate.toISOString();
  }

  const localTimestamp = new Date(
    `${value}Z`,
  ).getTime();

  if (
    Number.isNaN(localTimestamp)
  ) {
    return null;
  }

  return new Date(
    localTimestamp -
      utcOffsetSeconds * 1000,
  ).toISOString();
}


const OPEN_METEO_MAX_ATTEMPTS = 3;
const OPEN_METEO_RETRY_DELAY_MS = 700;

function waitForOpenMeteoRetry(
  milliseconds: number,
) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchOpenMeteoWithRetry(
  url: string,
) {
  let lastNetworkError: unknown;

  for (
    let attempt = 1;
    attempt <= OPEN_METEO_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const response = await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const shouldRetry =
        response.status === 429 ||
        response.status >= 500;

      if (
        response.ok ||
        !shouldRetry ||
        attempt === OPEN_METEO_MAX_ATTEMPTS
      ) {
        return response;
      }
    } catch (error) {
      lastNetworkError = error;

      if (
        attempt === OPEN_METEO_MAX_ATTEMPTS
      ) {
        throw error;
      }
    }

    await waitForOpenMeteoRetry(
      OPEN_METEO_RETRY_DELAY_MS *
        2 ** (attempt - 1),
    );
  }

  throw (
    lastNetworkError ??
    new Error(
      "Open-Meteo 요청을 완료하지 못했습니다.",
    )
  );
}


export async function POST(
  request: Request,
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret =
    process.env.HOO_WEATHER_CRON_SECRET?.trim();

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !cronSecret
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "서버 환경 변수가 설정되지 않았습니다.",
      },
      {
        status: 500,
      },
    );
  }

  const authorization =
    request.headers
      .get("authorization")
      ?.trim();

  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {


    return NextResponse.json(
      {
        ok: false,
        error: "인증되지 않은 요청입니다.",
      },
      {
        status: 401,
      },
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const {
    data: preferenceData,
    error: preferenceError,
  } = await supabase
    .from("hoo_weather_preferences")
    .select(
      `
        user_id,
        latitude,
        longitude,
        timezone
      `,
    )
    .eq("weather_enabled", true)
    .eq(
      "background_weather_enabled",
      true,
    )
    .eq(
      "location_processing_mode",
      "persisted_coarse",
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (preferenceError) {
    return NextResponse.json(
      {
        ok: false,
        error:
          preferenceError.message,
      },
      {
        status: 500,
      },
    );
  }

  const preferences =
    (preferenceData ??
      []) as WeatherPreferenceRow[];

  let refreshedCount = 0;
  let briefingAppliedCount = 0;
  let failedCount = 0;

  const failures: Array<{
    userId: string;
    reason: string;
  }> = [];

  for (const preference of preferences) {
    try {
      const latitude = Number(
        preference.latitude,
      );

      const longitude = Number(
        preference.longitude,
      );

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error(
          "저장된 대략적 좌표가 올바르지 않습니다.",
        );
      }

      const weatherUrl = new URL(
        "https://api.open-meteo.com/v1/forecast",
      );

      weatherUrl.searchParams.set(
        "latitude",
        String(latitude),
      );

      weatherUrl.searchParams.set(
        "longitude",
        String(longitude),
      );

      weatherUrl.searchParams.set(
        "current",
        [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "is_day",
          "precipitation",
          "weather_code",
          "cloud_cover",
          "wind_speed_10m",
        ].join(","),
      );

      weatherUrl.searchParams.set(
        "hourly",
        "precipitation_probability",
      );

      weatherUrl.searchParams.set(
        "daily",
        "sunrise,sunset",
      );

      weatherUrl.searchParams.set(
        "timezone",
        "auto",
      );

      weatherUrl.searchParams.set(
        "forecast_days",
        "2",
      );

          const weatherResponse =
        await fetchOpenMeteoWithRetry(
          weatherUrl.toString(),
        );

        
      if (!weatherResponse.ok) {
        throw new Error(
          `Open-Meteo 응답 오류: ${weatherResponse.status}`,
        );
      }

      const weatherPayload =
        (await weatherResponse.json()) as OpenMeteoPayload;

      const weatherCurrent =
        weatherPayload.current;

      if (
        !weatherCurrent ||
        !weatherCurrent.time
      ) {
        throw new Error(
          "현재 날씨 정보가 없습니다.",
        );
      }

      const utcOffsetSeconds =
        typeof weatherPayload
          .utc_offset_seconds ===
        "number"
          ? weatherPayload
              .utc_offset_seconds
          : 0;

      const forecastAt =
        parseOpenMeteoTime(
          weatherCurrent.time,
          utcOffsetSeconds,
        );

      if (!forecastAt) {
        throw new Error(
          "날씨 기준 시각을 변환하지 못했습니다.",
        );
      }

      const forecastTimestamp =
        new Date(
          forecastAt,
        ).getTime();

      const hourlyTimes =
        weatherPayload.hourly?.time ??
        [];

      const rainProbabilities =
        weatherPayload.hourly
          ?.precipitation_probability ??
        [];

      let nearestHourlyIndex = -1;
      let nearestDifference =
        Number.POSITIVE_INFINITY;

      hourlyTimes.forEach(
        (
          hourlyTime,
          index,
        ) => {
          const parsedHourlyTime =
            parseOpenMeteoTime(
              hourlyTime,
              utcOffsetSeconds,
            );

          if (!parsedHourlyTime) {
            return;
          }

          const difference =
            Math.abs(
              new Date(
                parsedHourlyTime,
              ).getTime() -
                forecastTimestamp,
            );

          if (
            difference <
            nearestDifference
          ) {
            nearestDifference =
              difference;

            nearestHourlyIndex =
              index;
          }
        },
      );

      const precipitationProbability =
        nearestHourlyIndex >= 0 &&
        typeof rainProbabilities[
          nearestHourlyIndex
        ] === "number"
          ? rainProbabilities[
              nearestHourlyIndex
            ]
          : null;

      const sunriseAt =
        parseOpenMeteoTime(
          weatherPayload.daily
            ?.sunrise?.[0],
          utcOffsetSeconds,
        );

      const sunsetAt =
        parseOpenMeteoTime(
          weatherPayload.daily
            ?.sunset?.[0],
          utcOffsetSeconds,
        );

      const {
        error: snapshotError,
      } = await supabase
        .from(
          "hoo_weather_snapshots",
        )
        .upsert(
          {
            user_id:
              preference.user_id,

            forecast_at:
              forecastAt,

            provider:
              "open-meteo-server",

            weather_code:
              weatherCurrent
                .weather_code ??
              null,

            temperature_celsius:
              weatherCurrent
                .temperature_2m ??
              null,

            apparent_temperature_celsius:
              weatherCurrent
                .apparent_temperature ??
              null,

            relative_humidity:
              weatherCurrent
                .relative_humidity_2m ??
              null,

            precipitation_probability:
              precipitationProbability,

            cloud_cover:
              weatherCurrent
                .cloud_cover ??
              null,

            wind_speed_kmh:
              weatherCurrent
                .wind_speed_10m ??
              null,

            is_day:
              typeof weatherCurrent
                .is_day === "number"
                ? weatherCurrent
                    .is_day === 1
                : null,

            sunrise_at:
              sunriseAt,

            sunset_at:
              sunsetAt,

            /*
             * 좌표와 위치명은 스냅샷에
             * 중복 저장하지 않는다.
             */
            raw_data: {
              sourceTime:
                weatherCurrent.time,

              precipitation:
                weatherCurrent
                  .precipitation ??
                null,

              serverRefresh: true,
            },

            fetched_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id,forecast_at,provider",
          },
        );

      if (snapshotError) {
        throw snapshotError;
      }

      /*
       * 서비스 역할에서는 auth.uid()가 대상 사용자를 가리키지 않는다.
       * 서버 전용 RPC가 대상 사용자의 인증 문맥을 제한적으로 설정한 뒤
       * 기존 아침·저녁 날씨 결합 함수를 실행한다.
       */
      const briefingDate =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone:
              preference.timezone ??
              "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          },
        ).format(new Date(forecastAt));

      const {
        data: briefingApplyResult,
        error: briefingApplyError,
      } = await supabase.rpc(
        "apply_hoo_weather_to_briefings_for_user",
        {
          p_user_id:
            preference.user_id,
          p_briefing_date:
            briefingDate,
        },
      );

      if (briefingApplyError) {
        throw briefingApplyError;
      }

      if (
        briefingApplyResult &&
        typeof briefingApplyResult ===
          "object" &&
        !Array.isArray(
          briefingApplyResult,
        )
      ) {
        const applyResult =
          briefingApplyResult as {
            morningApplied?: boolean;
            eveningApplied?: boolean;
          };

        if (
          applyResult.morningApplied ||
          applyResult.eveningApplied
        ) {
          briefingAppliedCount += 1;
        }
      }

      refreshedCount += 1;
    } catch (error) {
      failedCount += 1;

      failures.push({
        userId:
          preference.user_id,

        reason:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류",
      });
    }
  }

  /*
   * 갱신된 최신 날씨를 바탕으로
   * 사용자별 상황형 메시지를 생성한다.
   */
  const {
    data: generatedMessageCount,
    error: messageError,
  } = await supabase.rpc(
    "run_hoo_weather_context_message_generation",
  );

  if (messageError) {
    return NextResponse.json(
      {
        ok: false,
        refreshedCount,
        failedCount,
        failures,
        error:
          messageError.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    targetCount:
      preferences.length,
    refreshedCount,
    briefingAppliedCount,
    failedCount,
    generatedMessageCount:
      Number(
        generatedMessageCount ?? 0,
      ),
    failures,
  });
}