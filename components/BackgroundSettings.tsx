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
<div className="fixed left-6 top-6 z-[9999] flex items-center gap-2">
      <label className="cursor-pointer rounded-lg bg-white px-3 py-2 text-sm font-bold shadow hover:bg-gray-100">
        배경사진 변경
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onUpload(file);
          }}
        />
      </label>

      <button
        type="button"
        onClick={onReset}
        className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-bold hover:bg-gray-300"
      >
        기본 배경
      </button>
    </div>
  );
}