"use client";

import type {
  ChangeEventHandler,
  KeyboardEvent,
  RefObject,
} from "react";

type ProfileHeaderProps = {
  nickname: string;
  nicknameDraft: string;
  isNicknameEditing: boolean;
  nicknameError: string | null;
  maxNicknameLength: number;
  profileImageUrl: string | null;
  isProfileImageLoading: boolean;
  profileImageError: string | null;
  profileImageInputRef:
    RefObject<HTMLInputElement | null>;
  onStartNicknameEditing: () => void;
  onCancelNicknameEditing: () => void;
  onChangeNickname:
    ChangeEventHandler<HTMLInputElement>;
  onSaveNickname: () => void;
  onOpenImagePicker: () => void;
  onChangeImage:
    ChangeEventHandler<HTMLInputElement>;
  onRemoveImage: () => void;
};

export default function ProfileHeader({
  nickname,
  nicknameDraft,
  isNicknameEditing,
  nicknameError,
  maxNicknameLength,
  profileImageUrl,
  isProfileImageLoading,
  profileImageError,
  profileImageInputRef,
  onStartNicknameEditing,
  onCancelNicknameEditing,
  onChangeNickname,
  onSaveNickname,
  onOpenImagePicker,
  onChangeImage,
  onRemoveImage,
}: ProfileHeaderProps) {
  function handleNicknameKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      onSaveNickname();
    }

    if (event.key === "Escape") {
      onCancelNicknameEditing();
    }
  }

  return (
    <header className="pr-14">
      <p className="flex items-center gap-2 text-[11px] font-black tracking-[0.22em] text-[#9485ff]">
        <span aria-hidden="true">
          ✦
        </span>
        HOO PERSONAL PROFILE
      </p>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <input
            ref={profileImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onChangeImage}
            className="hidden"
          />

          <button
            type="button"
            onClick={onOpenImagePicker}
            disabled={
              isProfileImageLoading
            }
            className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[30px] border border-white/20 bg-[radial-gradient(circle_at_35%_25%,#b8afff,#7062dc_45%,#302950_78%)] text-3xl font-black shadow-[0_18px_50px_rgba(61,48,140,0.4)] transition hover:-translate-y-0.5 hover:border-[#b8afff]/70 disabled:cursor-wait"
            aria-label="프로필 사진 변경"
          >
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={`${nickname}의 프로필 사진`}
                className="h-full w-full object-cover"
              />
            ) : (
              nickname
                .slice(0, 1)
                .toUpperCase()
            )}

            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11px] font-black tracking-[0.12em] text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {isProfileImageLoading
                ? "저장 중"
                : "사진 변경"}
            </span>

            <span className="absolute bottom-2 right-2 h-4 w-4 rounded-full border-[3px] border-[#29233f] bg-[#69e6a6]" />
          </button>

          <div className="mt-2 flex justify-center">
            {profileImageUrl ? (
              <button
                type="button"
                onClick={onRemoveImage}
                disabled={
                  isProfileImageLoading
                }
                className="text-[10px] font-black tracking-[0.08em] text-white/35 transition hover:text-white/70 disabled:cursor-wait"
              >
                기본 이미지로
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  onOpenImagePicker
                }
                disabled={
                  isProfileImageLoading
                }
                className="text-[10px] font-black tracking-[0.08em] text-[#a99cff] transition hover:text-[#c7c0ff] disabled:cursor-wait"
              >
                사진 설정
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {isNicknameEditing ? (
            <div className="max-w-xl">
              <label
                htmlFor="hoo-profile-nickname"
                className="text-xs font-black tracking-[0.12em] text-[#a99cff]"
              >
                닉네임
              </label>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="hoo-profile-nickname"
                  type="text"
                  value={nicknameDraft}
                  maxLength={
                    maxNicknameLength
                  }
                  onChange={
                    onChangeNickname
                  }
                  onKeyDown={
                    handleNicknameKeyDown
                  }
                  autoFocus
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-lg font-black text-white outline-none transition placeholder:text-white/20 focus:border-[#998bff]/75 focus:ring-2 focus:ring-[#7869e8]/20"
                  placeholder="닉네임 입력"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      onSaveNickname
                    }
                    className="min-h-12 rounded-xl bg-[#7869e8] px-5 text-sm font-black text-white transition hover:brightness-110"
                  >
                    저장
                  </button>

                  <button
                    type="button"
                    onClick={
                      onCancelNicknameEditing
                    }
                    className="min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    취소
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs font-bold text-rose-200/85">
                  {nicknameError ?? ""}
                </p>

                <p className="text-xs font-bold text-white/30">
                  {nicknameDraft.length}/
                  {maxNicknameLength}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2
                  id="hoo-profile-title"
                  className="min-w-0 break-words text-3xl font-black tracking-[-0.04em] md:text-[42px]"
                >
                  {nickname}의 프로필
                </h2>

                <button
                  type="button"
                  onClick={
                    onStartNicknameEditing
                  }
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-white/38 transition hover:border-[#8d7cff]/40 hover:bg-[#7869e8]/12 hover:text-[#b6adff]"
                >
                  닉네임 변경
                </button>
              </div>

              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/50">
                집중 시간과 연속 기록,
                앞으로 획득할 업적까지
                한곳에서 확인하는 HOO
                성장 프로필입니다.
              </p>
            </>
          )}
        </div>
      </div>

      {(profileImageError ||
        (!isNicknameEditing &&
          nicknameError)) && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-100/85"
        >
          {profileImageError ??
            nicknameError}
        </p>
      )}
    </header>
  );
}
