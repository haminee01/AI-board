import { create } from "zustand";

interface MindmapGeneratorModalState {
  isOpen: boolean;
  keyword: string;
  autoGenerate: boolean;
  open: (options?: { keyword?: string; autoGenerate?: boolean }) => void;
  close: () => void;
}

export const useMindmapGeneratorModalStore =
  create<MindmapGeneratorModalState>((set) => ({
    isOpen: false,
    keyword: "",
    autoGenerate: false,
    open: (options) =>
      set({
        isOpen: true,
        keyword: options?.keyword ?? "",
        autoGenerate: options?.autoGenerate ?? false,
      }),
    close: () =>
      set({
        isOpen: false,
        keyword: "",
        autoGenerate: false,
      }),
  }));

