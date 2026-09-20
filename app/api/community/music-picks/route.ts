import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient as createSupabaseAdminClient,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_TITLE_LENGTH = 80;
const MAX_URL_LENGTH = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractYouTubeVideoId(value: string) {
  const input = value.trim();

  if (!input || input.length > MAX_URL_LENGTH) {
    return null;
  }

  try {
    const url = new URL(
      input.startsWith("http")
        ? input
        : `https://${input}`,
    );

    const host = url.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname
        .split("/")
        .filter(Boolean)[0];

      return id && /^[A-Za-z0-9_-]{11}$/.test(id)
        ? id
        : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      const queryId = url.searchParams.get("v");

      if (
        queryId &&
        /^[A-Za-z0-9_-]{11}$/.test(queryId)
      ) {
        return queryId;
      }

      const parts = url.pathname
        .split("/")
        .filter(Boolean);
      const route = parts[0];
      const routeId = parts[1];

      if (
        ["shorts", "live", "embed"].includes(route) &&
        routeId &&
        /^[A-Za-z0-9_-]{11}$/.test(routeId)
      ) {
        return routeId;
      }
    }
  } catch {
    return null;
  }

  return null;
}

type PickRow = {
  id: string;
  user_id: string;
  nickname: string;
  title: string;
  youtube_url: string;
  youtube_video_id: string;
  created_at: string;
};

function mapPick(
  row: PickRow,
  viewerUserId?: string | null,
  canManageAll = false,
) {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    title: row.title,
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    createdAt: row.created_at,
    canManage: Boolean(
      canManageAll ||
      (viewerUserId && viewerUserId === row.user_id),
    ),
  };
}

function parseTitleAndVideo(body: {
  title?: unknown;
  youtubeUrl?: unknown;
}) {
  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : "";

  const youtubeUrl =
    typeof body.youtubeUrl === "string"
      ? body.youtubeUrl.trim()
      : "";

  if (
    !title ||
    title.length > MAX_TITLE_LENGTH
  ) {
    return {
      error: `제목은 1~${MAX_TITLE_LENGTH}자로 입력해주세요.`,
    } as const;
  }

  const videoId =
    extractYouTubeVideoId(youtubeUrl);

  if (!videoId) {
    return {
      error: "올바른 YouTube 링크를 입력해주세요.",
    } as const;
  }

  return {
    title,
    videoId,
    canonicalUrl:
      `https://www.youtube.com/watch?v=${videoId}`,
  } as const;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    supabase,
    user: error ? null : user,
  };
}


type AdminStatus = {
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  canManage?: boolean;
};

/**
 * Reuse HOO's existing administrator authority source instead of inventing
 * a second admin rule for MUSIC PICK.
 */
async function verifyAdmin(
  request: NextRequest,
): Promise<AdminStatus | null> {
  try {
    const meUrl = new URL("/api/admin/me", request.url);
    const cookie = request.headers.get("cookie") ?? "";
    const response = await fetch(meUrl, {
      cache: "no-store",
      headers: { cookie },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;

    return (await response.json()) as AdminStatus;
  } catch {
    return null;
  }
}

function hasAdminManagePermission(
  status: AdminStatus | null,
) {
  return Boolean(
    status?.isLoggedIn === true &&
    status.isAdmin === true &&
    status.canManage !== false,
  );
}

/**
 * Only invoked after /api/admin/me has positively verified the caller.
 * The service-role client lets a verified administrator manage another
 * user's row without weakening the owner-only RLS policies for browsers.
 */
function createVerifiedAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "관리자 작업에 필요한 Supabase 서버 환경변수가 설정되지 않았습니다.",
    );
  }

  return createSupabaseAdminClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(
  request: NextRequest,
) {
  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get("limit") ?? 40,
    );

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(60, Math.max(1, Math.floor(requestedLimit)))
      : 40;

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminStatus = user
      ? await verifyAdmin(request)
      : null;
    const canManageAll =
      hasAdminManagePermission(adminStatus);

    const {
      data,
      error,
    } = await supabase
      .from("hoo_music_picks")
      .select(
        "id,user_id,nickname,title,youtube_url,youtube_video_id,created_at",
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        picks: (data ?? []).map((row) =>
          mapPick(
            row as PickRow,
            user?.id ?? null,
            canManageAll,
          ),
        ),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "GET /api/community/music-picks",
      error,
    );

    return NextResponse.json(
      {
        error: "추천곡을 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      youtubeUrl?: unknown;
    };

    const parsed = parseTitleAndVideo(body);

    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }

    const {
      data: profile,
    } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .maybeSingle();

    const nickname =
      typeof profile?.nickname === "string" &&
      profile.nickname.trim()
        ? profile.nickname.trim()
        : typeof user.user_metadata?.nickname === "string" &&
            user.user_metadata.nickname.trim()
          ? user.user_metadata.nickname.trim()
          : user.email?.split("@")[0] ?? "HOO";

    const {
      data,
      error,
    } = await supabase
      .from("hoo_music_picks")
      .insert({
        user_id: user.id,
        nickname,
        title: parsed.title,
        youtube_url: parsed.canonicalUrl,
        youtube_video_id: parsed.videoId,
      })
      .select(
        "id,user_id,nickname,title,youtube_url,youtube_video_id,created_at",
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        pick: mapPick(data as PickRow, user.id),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "POST /api/community/music-picks",
      error,
    );

    return NextResponse.json(
      {
        error: "추천곡을 등록하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      title?: unknown;
      youtubeUrl?: unknown;
    };

    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: "수정할 추천곡을 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    const parsed = parseTitleAndVideo(body);

    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }

    const {
      data: target,
      error: targetError,
    } = await supabase
      .from("hoo_music_picks")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle();

    if (targetError) throw targetError;

    if (!target) {
      return NextResponse.json(
        { error: "수정할 추천곡을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const isOwner = target.user_id === user.id;
    let canManageAll = false;
    let mutationClient = supabase;

    if (!isOwner) {
      const adminStatus = await verifyAdmin(request);
      canManageAll = hasAdminManagePermission(adminStatus);

      if (!canManageAll) {
        return NextResponse.json(
          { error: "이 추천곡을 수정할 권한이 없습니다." },
          { status: 403 },
        );
      }

      mutationClient = createVerifiedAdminClient();
    }

    const {
      data,
      error,
    } = await mutationClient
      .from("hoo_music_picks")
      .update({
        title: parsed.title,
        youtube_url: parsed.canonicalUrl,
        youtube_video_id: parsed.videoId,
      })
      .eq("id", id)
      .select(
        "id,user_id,nickname,title,youtube_url,youtube_video_id,created_at",
      )
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "수정할 추천곡을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      pick: mapPick(
        data as PickRow,
        user.id,
        canManageAll,
      ),
    });
  } catch (error) {
    console.error(
      "PATCH /api/community/music-picks",
      error,
    );

    return NextResponse.json(
      {
        error: "추천곡을 수정하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
    };

    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: "삭제할 추천곡을 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    const {
      data: target,
      error: targetError,
    } = await supabase
      .from("hoo_music_picks")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle();

    if (targetError) throw targetError;

    if (!target) {
      return NextResponse.json(
        { error: "삭제할 추천곡을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const isOwner = target.user_id === user.id;
    let mutationClient = supabase;

    if (!isOwner) {
      const adminStatus = await verifyAdmin(request);

      if (!hasAdminManagePermission(adminStatus)) {
        return NextResponse.json(
          { error: "이 추천곡을 삭제할 권한이 없습니다." },
          { status: 403 },
        );
      }

      mutationClient = createVerifiedAdminClient();
    }

    const {
      data,
      error,
    } = await mutationClient
      .from("hoo_music_picks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "삭제할 추천곡을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      id,
    });
  } catch (error) {
    console.error(
      "DELETE /api/community/music-picks",
      error,
    );

    return NextResponse.json(
      {
        error: "추천곡을 삭제하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
