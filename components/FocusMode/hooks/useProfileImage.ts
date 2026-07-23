"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  HOO_PROFILE_IMAGE_DB_NAME,
  HOO_PROFILE_IMAGE_KEY,
  HOO_PROFILE_IMAGE_MAX_BYTES,
  HOO_PROFILE_IMAGE_STORE_NAME,
} from "../constants/focus";
import type {
  ProfileImageRecord,
} from "../types/focus";

function openProfileImageDatabase() {
  return new Promise<IDBDatabase>(
    (resolve, reject) => {
      const request =
        window.indexedDB.open(
          HOO_PROFILE_IMAGE_DB_NAME,
          1,
        );

      request.onupgradeneeded = () => {
        const database = request.result;

        if (
          !database.objectStoreNames.contains(
            HOO_PROFILE_IMAGE_STORE_NAME,
          )
        ) {
          database.createObjectStore(
            HOO_PROFILE_IMAGE_STORE_NAME,
            {
              keyPath: "id",
            },
          );
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(
          request.error ??
            new Error(
              "프로필 이미지 데이터베이스를 열지 못했습니다.",
            ),
        );
      };
    },
  );
}

function readProfileImageRecord() {
  return new Promise<
    ProfileImageRecord | null
  >(async (resolve, reject) => {
    try {
      const database =
        await openProfileImageDatabase();

      const transaction =
        database.transaction(
          HOO_PROFILE_IMAGE_STORE_NAME,
          "readonly",
        );

      const request = transaction
        .objectStore(
          HOO_PROFILE_IMAGE_STORE_NAME,
        )
        .get(HOO_PROFILE_IMAGE_KEY);

      request.onsuccess = () => {
        database.close();

        resolve(
          (request.result as
            | ProfileImageRecord
            | undefined) ?? null,
        );
      };

      request.onerror = () => {
        database.close();

        reject(
          request.error ??
            new Error(
              "프로필 이미지를 불러오지 못했습니다.",
            ),
        );
      };
    } catch (error) {
      reject(error);
    }
  });
}

function saveProfileImageRecord(
  blob: Blob,
) {
  return new Promise<void>(
    async (resolve, reject) => {
      try {
        const database =
          await openProfileImageDatabase();

        const transaction =
          database.transaction(
            HOO_PROFILE_IMAGE_STORE_NAME,
            "readwrite",
          );

        transaction
          .objectStore(
            HOO_PROFILE_IMAGE_STORE_NAME,
          )
          .put({
            id: HOO_PROFILE_IMAGE_KEY,
            blob,
            updatedAt:
              new Date().toISOString(),
          } satisfies ProfileImageRecord);

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };

        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ??
              new Error(
                "프로필 이미지를 저장하지 못했습니다.",
              ),
          );
        };

        transaction.onabort = () => {
          database.close();
          reject(
            transaction.error ??
              new Error(
                "프로필 이미지 저장이 중단되었습니다.",
              ),
          );
        };
      } catch (error) {
        reject(error);
      }
    },
  );
}

function deleteProfileImageRecord() {
  return new Promise<void>(
    async (resolve, reject) => {
      try {
        const database =
          await openProfileImageDatabase();

        const transaction =
          database.transaction(
            HOO_PROFILE_IMAGE_STORE_NAME,
            "readwrite",
          );

        transaction
          .objectStore(
            HOO_PROFILE_IMAGE_STORE_NAME,
          )
          .delete(
            HOO_PROFILE_IMAGE_KEY,
          );

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };

        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ??
              new Error(
                "프로필 이미지를 삭제하지 못했습니다.",
              ),
          );
        };
      } catch (error) {
        reject(error);
      }
    },
  );
}

export function useProfileImage() {
  const [
    profileImageUrl,
    setProfileImageUrl,
  ] = useState<string | null>(null);

  const [
    isProfileImageLoading,
    setIsProfileImageLoading,
  ] = useState(false);

  const [
    profileImageError,
    setProfileImageError,
  ] = useState<string | null>(null);

  const profileImageInputRef =
    useRef<HTMLInputElement | null>(null);

  const objectUrlRef =
    useRef<string | null>(null);

  const replaceProfileImageUrl =
    useCallback(
      (nextUrl: string | null) => {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(
            objectUrlRef.current,
          );
        }

        objectUrlRef.current = nextUrl;
        setProfileImageUrl(nextUrl);
      },
      [],
    );

  const loadProfileImage =
    useCallback(async () => {
      if (!("indexedDB" in window)) {
        setProfileImageError(
          "이 브라우저에서는 프로필 이미지 저장을 지원하지 않습니다.",
        );
        return;
      }

      setIsProfileImageLoading(true);
      setProfileImageError(null);

      try {
        const record =
          await readProfileImageRecord();

        replaceProfileImageUrl(
          record
            ? URL.createObjectURL(
                record.blob,
              )
            : null,
        );
      } catch (error) {
        console.error(
          "프로필 이미지 불러오기 실패",
          error,
        );

        setProfileImageError(
          "프로필 이미지를 불러오지 못했습니다.",
        );
      } finally {
        setIsProfileImageLoading(
          false,
        );
      }
    }, [replaceProfileImageUrl]);

  function openProfileImagePicker() {
    profileImageInputRef.current?.click();
  }

  async function changeProfileImage(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    const supportedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !supportedTypes.includes(
        file.type,
      )
    ) {
      setProfileImageError(
        "JPG, PNG, WEBP 이미지만 사용할 수 있습니다.",
      );
      return;
    }

    if (
      file.size >
      HOO_PROFILE_IMAGE_MAX_BYTES
    ) {
      setProfileImageError(
        "프로필 이미지는 5MB 이하만 사용할 수 있습니다.",
      );
      return;
    }

    setIsProfileImageLoading(true);
    setProfileImageError(null);

    try {
      await saveProfileImageRecord(file);

      replaceProfileImageUrl(
        URL.createObjectURL(file),
      );
    } catch (error) {
      console.error(
        "프로필 이미지 변경 실패",
        error,
      );

      setProfileImageError(
        "프로필 이미지를 저장하지 못했습니다.",
      );
    } finally {
      setIsProfileImageLoading(false);
    }
  }

  async function removeProfileImage() {
    setIsProfileImageLoading(true);
    setProfileImageError(null);

    try {
      await deleteProfileImageRecord();
      replaceProfileImageUrl(null);
    } catch (error) {
      console.error(
        "프로필 이미지 삭제 실패",
        error,
      );

      setProfileImageError(
        "프로필 이미지를 삭제하지 못했습니다.",
      );
    } finally {
      setIsProfileImageLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(
          objectUrlRef.current,
        );
      }
    };
  }, []);

  return {
    profileImageUrl,
    isProfileImageLoading,
    profileImageError,
    profileImageInputRef,
    loadProfileImage,
    openProfileImagePicker,
    changeProfileImage,
    removeProfileImage,
  };
}
