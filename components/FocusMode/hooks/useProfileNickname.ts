"use client";

import {
  type ChangeEvent,
  useEffect,
  useState,
} from "react";

const HOO_PROFILE_NICKNAME_STORAGE_KEY =
  "hoo-profile-nickname";

const DEFAULT_PROFILE_NICKNAME =
  "사용자";

const MAX_PROFILE_NICKNAME_LENGTH =
  20;

export function useProfileNickname() {
  const [nickname, setNickname] =
    useState(
      DEFAULT_PROFILE_NICKNAME,
    );

  const [
    nicknameDraft,
    setNicknameDraft,
  ] = useState(
    DEFAULT_PROFILE_NICKNAME,
  );

  const [
    isNicknameEditing,
    setIsNicknameEditing,
  ] = useState(false);

  const [
    nicknameError,
    setNicknameError,
  ] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedNickname =
        window.localStorage.getItem(
          HOO_PROFILE_NICKNAME_STORAGE_KEY,
        );

      if (!savedNickname) {
        return;
      }

      const normalizedNickname =
        savedNickname.trim().slice(
          0,
          MAX_PROFILE_NICKNAME_LENGTH,
        );

      if (!normalizedNickname) {
        return;
      }

      setNickname(
        normalizedNickname,
      );

      setNicknameDraft(
        normalizedNickname,
      );
    } catch (error) {
      console.error(
        "프로필 닉네임을 불러오지 못했습니다.",
        error,
      );
    }
  }, []);

  function startNicknameEditing() {
    setNicknameDraft(nickname);
    setNicknameError(null);
    setIsNicknameEditing(true);
  }

  function cancelNicknameEditing() {
    setNicknameDraft(nickname);
    setNicknameError(null);
    setIsNicknameEditing(false);
  }

  function changeNicknameDraft(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setNicknameDraft(
      event.target.value.slice(
        0,
        MAX_PROFILE_NICKNAME_LENGTH,
      ),
    );

    if (nicknameError) {
      setNicknameError(null);
    }
  }

  function saveNickname() {
    const normalizedNickname =
      nicknameDraft.trim();

    if (!normalizedNickname) {
      setNicknameError(
        "닉네임을 한 글자 이상 입력해주세요.",
      );
      return;
    }

    try {
      window.localStorage.setItem(
        HOO_PROFILE_NICKNAME_STORAGE_KEY,
        normalizedNickname,
      );

      setNickname(
        normalizedNickname,
      );

      setNicknameDraft(
        normalizedNickname,
      );

      setNicknameError(null);
      setIsNicknameEditing(false);
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
