"use client";

import {
  type ChangeEvent,
  useCallback,
  useRef,
  useState,
} from "react";

import {
  HOO_PROFILE_IMAGE_MAX_BYTES,
} from "../constants/focus";

import {
  createClient,
} from "@/lib/supabase/client";

const PROFILE_IMAGE_BUCKET =
  "profile-images";

type UseProfileImageOptions = {
  profileImageUrl:
    string | null;

  onProfileImageUpdated: (
    profileImageUrl: string | null,
  ) => void;
};

function getProfileImageExtension(
  file: File,
) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      return null;
  }
}

export function useProfileImage({
  profileImageUrl,
  onProfileImageUpdated,
}: UseProfileImageOptions) {
  const [
    isProfileImageLoading,
    setIsProfileImageLoading,
  ] = useState(false);

  const [
    profileImageError,
    setProfileImageError,
  ] = useState<string | null>(
    null,
  );

  const profileImageInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const openProfileImagePicker =
    useCallback(() => {
      profileImageInputRef.current?.click();
    }, []);

  const loadProfileImage =
    useCallback(async () => {
      const supabase =
        createClient();

      setIsProfileImageLoading(true);
      setProfileImageError(null);

      try {
        const {
          data: {
            session,
          },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const user =
          session?.user ?? null;

        if (!user) {
          onProfileImageUpdated(null);
          return;
        }

        const {
          data: profile,
          error: profileError,
        } =
          await supabase
            .from("profiles")
            .select(
              "profile_image_url",
            )
            .eq(
              "id",
              user.id,
            )
            .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const savedProfileImageUrl =
          typeof profile?.profile_image_url ===
            "string" &&
          profile.profile_image_url.trim()
            ? profile.profile_image_url.trim()
            : null;

        onProfileImageUpdated(
          savedProfileImageUrl,
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
        setIsProfileImageLoading(false);
      }
    }, [
      onProfileImageUpdated,
    ]);

  const changeProfileImage =
    useCallback(
      async (
        event:
          ChangeEvent<HTMLInputElement>,
      ) => {
        const file =
          event.target.files?.[0];

        event.target.value = "";

        if (!file) {
          return;
        }

        const extension =
          getProfileImageExtension(
            file,
          );

        if (!extension) {
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

        const supabase =
          createClient();

        setIsProfileImageLoading(true);
        setProfileImageError(null);

        try {
          const {
            data: {
              session,
            },
            error: sessionError,
          } =
            await supabase.auth.getSession();

          if (sessionError) {
            throw sessionError;
          }

          const user =
            session?.user ?? null;

          if (!user) {
            setProfileImageError(
              "프로필 이미지를 변경하려면 로그인이 필요합니다.",
            );

            return;
          }

          const filePath =
            `${user.id}/avatar.${extension}`;

          const {
            error: uploadError,
          } =
            await supabase.storage
              .from(
                PROFILE_IMAGE_BUCKET,
              )
              .upload(
                filePath,
                file,
                {
                  cacheControl:
                    "3600",

                  contentType:
                    file.type,

                  upsert:
                    true,
                },
              );

          if (uploadError) {
            throw uploadError;
          }

          const {
            data: publicUrlData,
          } =
            supabase.storage
              .from(
                PROFILE_IMAGE_BUCKET,
              )
              .getPublicUrl(
                filePath,
              );

          const publicUrl =
            publicUrlData.publicUrl;

          if (!publicUrl) {
            throw new Error(
              "프로필 이미지 주소를 생성하지 못했습니다.",
            );
          }

          const cacheBustedUrl =
            `${publicUrl}?v=${Date.now()}`;

          const {
            error: profileUpdateError,
          } =
            await supabase
              .from("profiles")
              .update({
                profile_image_url:
                  cacheBustedUrl,
              })
              .eq(
                "id",
                user.id,
              );

          if (profileUpdateError) {
            throw profileUpdateError;
          }

          onProfileImageUpdated(
            cacheBustedUrl,
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
      },
      [
        onProfileImageUpdated,
      ],
    );

  const removeProfileImage =
    useCallback(async () => {
      const supabase =
        createClient();

      setIsProfileImageLoading(true);
      setProfileImageError(null);

      try {
        const {
          data: {
            session,
          },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const user =
          session?.user ?? null;

        if (!user) {
          setProfileImageError(
            "프로필 이미지를 삭제하려면 로그인이 필요합니다.",
          );

          return;
        }

        const imagePaths = [
          `${user.id}/avatar.jpg`,
          `${user.id}/avatar.png`,
          `${user.id}/avatar.webp`,
        ];

        const {
          error: removeError,
        } =
          await supabase.storage
            .from(
              PROFILE_IMAGE_BUCKET,
            )
            .remove(
              imagePaths,
            );

        if (removeError) {
          throw removeError;
        }

        const {
          error: profileUpdateError,
        } =
          await supabase
            .from("profiles")
            .update({
              profile_image_url:
                null,
            })
            .eq(
              "id",
              user.id,
            );

        if (profileUpdateError) {
          throw profileUpdateError;
        }

        onProfileImageUpdated(
          null,
        );
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
    }, [
      onProfileImageUpdated,
    ]);

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