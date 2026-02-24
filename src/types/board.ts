import type { BoardContent } from "@/stores/useBoardStore";

export const BOARDS_TABLE = "boards";

export interface BoardRow {
  id: string;
  title: string;
  content: BoardContent;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface BoardInsert {
  title: string;
  content: BoardContent;
  user_id: string;
}

export interface BoardUpdate {
  title?: string;
  content?: BoardContent;
  updated_at?: string;
}
