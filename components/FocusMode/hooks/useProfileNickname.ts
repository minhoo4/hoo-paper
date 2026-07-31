"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

const HOO_PROFILE_NICKNAME_STORAGE_KEY =
  "hoo-profile-nickname";

const DEFAULT_PROFILE_NICKNAME =
  "사용자";

const MAX_PROFILE_NICKNAME_LENGTH =
  20;

export function useProfileNickname(
  loggedInNickname:
    string | null,

  onNicknameUpdated: (
    nickname: string,
  ) => void,
) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const normalizedLoggedInNickname =
    loggedInNickname
      ?.trim()
      .slice(
        0,
        MAX_PROFILE_NICKNAME_LENGTH,
      ) ?? "";

  const nickname =
    normalizedLoggedInNickname ||
    DEFAULT_PROFILE_NICKNAME;

  const [
    nicknameDraft,
    setNicknameDraft,
  ] = useState(
    nickname,
  );

  const [
    isNicknameEditing,
    setIsNicknameEditing,
  ] = useState(false);

  const [
    nicknameError,
    setNicknameError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (isNicknameEditing) {
      return;
    }

    setNicknameDraft(
      nickname,
    );
  }, [
    nickname,
    isNicknameEditing,
  ]);

  function startNicknameEditing() {
    setNicknameDraft(
      nickname,
    );

    setNicknameError(
      null,
    );

    setIsNicknameEditing(
      true,
    );
  }

  function cancelNicknameEditing() {
    setNicknameDraft(
      nickname,
    );

    setNicknameError(
      null,
    );

    setIsNicknameEditing(
      false,
    );
  }

  function changeNicknameDraft(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    setNicknameDraft(
      event.target.value.slice(
        0,
        MAX_PROFILE_NICKNAME_LENGTH,
      ),
    );

    if (nicknameError) {
      setNicknameError(
        null,
      );
    }
  }

  async function saveNickname() {
    const normalizedNickname =
      nicknameDraft
        .trim()
        .slice(
          0,
          MAX_PROFILE_NICKNAME_LENGTH,
        );

    if (!normalizedNickname) {
      setNicknameError(
        "닉네임을 한 글자 이상 입력해주세요.",
      );

      return;
    }

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

      if (user) {
        const {
          error: updateError,
        } =
          await supabase
            .from("profiles")
            .update({
              nickname:
                normalizedNickname,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              user.id,
            );

        if (updateError) {
          throw updateError;
        }
      }

      window.localStorage.setItem(
        HOO_PROFILE_NICKNAME_STORAGE_KEY,
        normalizedNickname,
      );

      setNicknameDraft(
        normalizedNickname,
      );

      setNicknameError(
        null,
      );

      setIsNicknameEditing(
        false,
      );

      onNicknameUpdated(
        normalizedNickname,
      );
    } catch (error) {
      console.error(
        "프로필 닉네임 저장 실패",
        error,
      );

      setNicknameError(
        "닉네임을 저장하지 못했습니다.",
      );
    }
  }

  return {
    nickname,
    nicknameDraft,
    isNicknameEditing,
    nicknameError,
    maxNicknameLength:
      MAX_PROFILE_NICKNAME_LENGTH,
    startNicknameEditing,
    cancelNicknameEditing,
    changeNicknameDraft,
    saveNickname,
  };
}