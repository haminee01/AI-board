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
        className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        AI 마인드맵
      </button>
      <MindmapGeneratorModal />
    </>
  );
}

