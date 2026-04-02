"use client";

import { useMindmapGeneratorModalStore } from "@/stores/useMindmapGeneratorModalStore";
import { MindmapGeneratorModal } from "./MindmapGeneratorModal";

export function MindmapGeneratorLauncher() {
  const open = useMindmapGeneratorModalStore((s) => s.open);

  return (
    <>
      <button
        type="button"
        onClick={() => open({ keyword: "", autoGenerate: false })}
        className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:px-3 sm:text-sm"
      >
        AI 마인드맵
      </button>
      <MindmapGeneratorModal />
    </>
  );
}
