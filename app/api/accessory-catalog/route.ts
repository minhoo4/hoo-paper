import {
  NextResponse,
} from "next/server";

import {
  readdir,
} from "node:fs/promises";

import path from "node:path";

/*
 * HOO WORLD 장신구 카탈로그
 *
 * 실제 이미지 위치:
 * public/hoo-world/accessories/
 *
 * API 주소:
 * /api/hoo-world/accessory-catalog
 */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const ACCESSORY_DIRECTORY =
  path.join(
    process.cwd(),
    "public",
    "hoo-world",
    "accessories",
  );

const ACCESSORY_PUBLIC_PATH =
  "/hoo-world/accessories";

const SAFE_FILE_NAME_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9_-]*\.png$/;

export type HooWorldAccessoryCatalogItem = {
  id: string;
  fileName: string;
  imagePath: string;
};

function createAccessoryItem(
  fileName: string,
): HooWorldAccessoryCatalogItem | null {
  if (
    !SAFE_FILE_NAME_PATTERN.test(
      fileName,
    )
  ) {
    return null;
  }

  const id =
    path.basename(
      fileName,
      ".png",
    );

  return {
    id,
    fileName,
    imagePath:
      `${ACCESSORY_PUBLIC_PATH}/${fileName}`,
  };
}

export async function GET() {
  try {
    const entries =
      await readdir(
        ACCESSORY_DIRECTORY,
        {
          withFileTypes: true,
        },
      );

    const accessories =
      entries
        .filter(
          (entry) =>
            entry.isFile(),
        )
        .map(
          (entry) =>
            createAccessoryItem(
              entry.name,
            ),
        )
        .filter(
          (
            accessory,
          ): accessory is HooWorldAccessoryCatalogItem =>
            accessory !== null,
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.fileName.localeCompare(
              second.fileName,
            ),
        )
        .slice(
          0,
          10,
        );

    return NextResponse.json(
      {
        accessories,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "HOO WORLD 장신구 폴더를 읽지 못했습니다.",
      error,
    );

    return NextResponse.json(
      {
        accessories: [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }
}
