"use client";

type BackgroundSettingsProps = {
  onUpload: (file: File) => void;
  onReset: () => void;
};

export default function BackgroundSettings({
  onUpload,
  onReset,
}: BackgroundSettingsProps) {
  return (
    <div className="space-y-2">
      <label className="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition active:scale-[0.98]">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7467d8]/25 text-lg">
            🖼️
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-black text-white">
              배경사진 변경
            </span>

            <span className="mt-0.5 block text-[10px] font-bold text-white/45">
              기기에 저장된 사진을 선택합니다.
            </span>
          </span>
        </span>

        <span className="shrink-0 text-base font-black text-white/35">
          ›
        </span>

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (!file) {
              return;
            }

            onUpload(file);

            event.currentTarget.value = "";
          }}
        />
      </label>

      <button
        type="button"
        onClick={onReset}
        className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition active:scale-[0.98]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7467d8]/25 text-lg">
            ↺
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-black text-white">
              기본 배경으로 복원
            </span>

            <span className="mt-0.5 block text-[10px] font-bold text-white/45">
              HOO의 기본 배경을 적용합니다.
            </span>
          </span>
        </span>

        <span className="shrink-0 text-base font-black text-white/35">
          ›
        </span>
      </button>
    </div>
  );
}
