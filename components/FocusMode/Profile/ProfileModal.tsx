"use client";

import type {
  ChangeEvent,
  ChangeEventHandler,
  RefObject,
} from "react";

import type {
  FocusHistory,
  FocusStatistics,
  FocusStreak,
  ProfileTab,
} from "../types/focus";
import ProfileAchievements from "./ProfileAchievements";
import ProfileCalendar from "./ProfileCalendar";
import ProfileHeader from "./ProfileHeader";
import ProfileNavigation from "./ProfileNavigation";
import ProfileOverview from "./ProfileOverview";
type ProfileModalProps = {
  isOpen: boolean;
  activeTab: ProfileTab;

  nickname: string;
  nicknameDraft: string;
  isNicknameEditing: boolean;
  nicknameError: string | null;
  maxNicknameLength: number;

  statistics: FocusStatistics | null;
  streak: FocusStreak | null;
  history: FocusHistory[];

  profileImageUrl: string | null;
  isProfileImageLoading: boolean;
  profileImageError: string | null;

  profileImageInputRef:
    RefObject<HTMLInputElement | null>;

  dailyJournal: string;
  journalLoading: boolean;
  journalSaving: boolean;
  journalSaved: boolean;
  journalExists: boolean;

  onClose: () => void;

  onStartNicknameEditing: () => void;
  onCancelNicknameEditing: () => void;

  onChangeNickname:
    ChangeEventHandler<HTMLInputElement>;

  onSaveNickname: () => void;

  onTabChange:
    (tab: ProfileTab) => void;

  onOpenImagePicker: () => void;

  onChangeImage:
    ChangeEventHandler<HTMLInputElement>;

  onRemoveImage: () => void;

  onLoadDailyJournal:
    (targetDate: Date) =>
      void | Promise<void>;

  onChangeDailyJournal: (
    event:
      ChangeEvent<HTMLTextAreaElement>,
    targetDate: Date,
  ) => void;
};


export default function ProfileModal({
  isOpen,
  activeTab,
  nickname,
  nicknameDraft,
  isNicknameEditing,
  nicknameError,
  maxNicknameLength,
  statistics,
  streak,
  history,
  profileImageUrl,
  isProfileImageLoading,
  profileImageError,
  profileImageInputRef,
  dailyJournal,
  journalLoading,
  journalSaving,
  journalSaved,
  journalExists,
  onClose,
  onStartNicknameEditing,
  onCancelNicknameEditing,
  onChangeNickname,
  onSaveNickname,
  onTabChange,
  onOpenImagePicker,
  onChangeImage,
  onRemoveImage,
  onLoadDailyJournal,
  onChangeDailyJournal,
}: ProfileModalProps) {


  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center overflow-y-auto bg-[#010610]/80 px-3 py-4 backdrop-blur-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hoo-profile-title"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section className="relative my-auto max-h-[calc(100vh-32px)] w-full max-w-[1080px] overflow-y-auto rounded-[32px] border border-white/15 bg-[linear-gradient(145deg,rgba(13,19,32,0.98),rgba(6,10,19,0.98))] p-5 text-white shadow-[0_35px_120px_rgba(0,0,0,0.72)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-[#6d5ee7]/20 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-28 h-80 w-80 rounded-full bg-[#294a96]/20 blur-[110px]"
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full text-3xl font-light text-white/60 transition hover:bg-white/[0.07] hover:text-white"
          aria-label="프로필 닫기"
        >
          ×
        </button>

        <div className="relative z-10">
          <ProfileHeader
            nickname={nickname}
            nicknameDraft={
              nicknameDraft
            }
            isNicknameEditing={
              isNicknameEditing
            }
            nicknameError={
              nicknameError
            }
            maxNicknameLength={
              maxNicknameLength
            }
            profileImageUrl={
              profileImageUrl
            }
            isProfileImageLoading={
              isProfileImageLoading
            }
            profileImageError={
              profileImageError
            }
            profileImageInputRef={
              profileImageInputRef
            }
            onStartNicknameEditing={
              onStartNicknameEditing
            }
            onCancelNicknameEditing={
              onCancelNicknameEditing
            }
            onChangeNickname={
              onChangeNickname
            }
            onSaveNickname={
              onSaveNickname
            }
            onOpenImagePicker={
              onOpenImagePicker
            }
            onChangeImage={
              onChangeImage
            }
            onRemoveImage={
              onRemoveImage
            }
          />

          <ProfileNavigation
            activeTab={activeTab}
            onChange={onTabChange}
          />

          {activeTab === "overview" && (
            <ProfileOverview
              statistics={statistics}
              streak={streak}
              history={history}
            />
          )}

        {activeTab === "calendar" && (
  <ProfileCalendar
    history={history}
    dailyJournal={
      dailyJournal
    }
    journalLoading={
      journalLoading
    }
    journalSaving={
      journalSaving
    }
    journalSaved={
      journalSaved
    }
    journalExists={
      journalExists
    }
    onLoadDailyJournal={
      onLoadDailyJournal
    }
    onChangeDailyJournal={
      onChangeDailyJournal
    }
  />
)}

          {activeTab ===
  "achievements" && (
 <ProfileAchievements
  statistics={statistics}
  streak={streak}
  history={history}
/>
)}
        </div>
      </section>
    </div>
  );
}
