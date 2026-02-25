import type { BoardContent } from "@/stores/useBoardStore";

export const BOARDS_TABLE = "boards";
export const BOARD_MEMBERS_TABLE = "board_members";
export const BOARD_JOIN_REQUESTS_TABLE = "board_join_requests";

export type BoardVisibility = "public" | "private";

export interface BoardRow {
  id: string;
  title: string;
  content: BoardContent;
  user_id: string;
  visibility: BoardVisibility;
  created_at: string;
  updated_at: string;
}

export interface BoardInsert {
  title: string;
  content: BoardContent;
  user_id: string;
  visibility?: BoardVisibility;
}

export interface BoardUpdate {
  title?: string;
  content?: BoardContent;
  visibility?: BoardVisibility;
  updated_at?: string;
}

export interface BoardMemberRow {
  id: string;
  board_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface BoardJoinRequestRow {
  id: string;
  board_id: string;
  user_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}
