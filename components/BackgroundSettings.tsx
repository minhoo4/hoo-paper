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
    <div className="fixed left-3 top-[calc(12px+var(--hoo-safe-top))] z-[9999] flex flex-col items-stretch gap-2 sm:left-6 sm:top-6 sm:flex-row sm:items-center">
      <label className="flex min-h-10 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#332f45] shadow transition active:scale-[0.98] sm:text-sm md:hover:bg-gray-100">
        배경사진 변경

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file =
              event.target.files?.[0];

            if (!file) {
              return;
            }

            onUpload(file);
          }}
        />
      </label>

      <button
        type="button"
        onClick={onReset}
        className="min-h-10 whitespace-nowrap rounded-lg bg-gray-200 px-3 py-2 text-xs font-bold text-[#332f45] shadow transition active:scale-[0.98] sm:text-sm md:hover:bg-gray-300"
      >
        기본 배경
      </button>
    </div>
  );
}