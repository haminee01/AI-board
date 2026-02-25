"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  BOARDS_TABLE,
  BOARD_MEMBERS_TABLE,
  BOARD_JOIN_REQUESTS_TABLE,
  type BoardRow,
  type BoardInsert,
  type BoardUpdate,
  type BoardMemberRow,
  type BoardJoinRequestRow,
} from "@/types/board";

const QUERY_KEY = ["boards"] as const;
const MEMBERS_QUERY_KEY = ["board-members"] as const;
const JOIN_REQUESTS_QUERY_KEY = ["board-join-requests"] as const;

/** 로그인한 사용자가 접근 가능한 보드만 조회 (소유 + 공개 + 멤버인 비공개) — RLS 적용 */
export function useBoardsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, userId ?? ""],
    queryFn: async (): Promise<BoardRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from(BOARDS_TABLE)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
    enabled: !!userId,
  });
}

/** 보드 ID로 단건 조회 (접근 권한 있으면 반환, 없으면 에러) */
export function useBoardByIdQuery(
  boardId: string | null,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, "single", boardId ?? ""],
    queryFn: async (): Promise<BoardRow | null> => {
      if (!boardId) return null;
      const { data, error } = await supabase
        .from(BOARDS_TABLE)
        .select("*")
        .eq("id", boardId)
        .single();
      if (error) throw error;
      return data as BoardRow;
    },
    enabled: !!boardId && !!userId,
    retry: false,
  });
}

export function useSaveBoardMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      content,
      visibility,
    }: {
      id: string | null;
      title: string;
      content: BoardInsert["content"];
      visibility?: BoardRow["visibility"];
    }): Promise<BoardRow> => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      if (id) {
        const update: BoardUpdate = {
          title,
          content,
          ...(visibility != null && { visibility }),
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from(BOARDS_TABLE)
          .update(update)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as BoardRow;
      } else {
        const insert: BoardInsert = {
          title,
          content,
          user_id: userId,
          visibility: visibility ?? "private",
        };
        const { data, error } = await supabase
          .from(BOARDS_TABLE)
          .insert(insert)
          .select()
          .single();
        if (error) throw error;
        return data as BoardRow;
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/** 소유자만 보드 삭제 가능 (RLS에서도 user_id로만 delete 허용) */
export function useDeleteBoardMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase
        .from(BOARDS_TABLE)
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/** 보드 멤버 목록 (소유자만 조회 가능하도록 사용처에서 보드 소유 여부 확인) */
export function useBoardMembersQuery(boardId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...MEMBERS_QUERY_KEY, boardId ?? ""],
    queryFn: async (): Promise<BoardMemberRow[]> => {
      if (!boardId) return [];
      const { data, error } = await supabase
        .from(BOARD_MEMBERS_TABLE)
        .select("*")
        .eq("board_id", boardId);
      if (error) throw error;
      return (data ?? []) as BoardMemberRow[];
    },
    enabled: !!boardId && enabled,
  });
}

/** 가입 요청 목록 (보드 소유자만 조회 가능) */
export function useBoardJoinRequestsQuery(
  boardId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...JOIN_REQUESTS_QUERY_KEY, boardId ?? ""],
    queryFn: async (): Promise<BoardJoinRequestRow[]> => {
      if (!boardId) return [];
      const { data, error } = await supabase
        .from(BOARD_JOIN_REQUESTS_TABLE)
        .select("*")
        .eq("board_id", boardId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BoardJoinRequestRow[];
    },
    enabled: !!boardId && enabled,
  });
}

/** 비공개 보드에 멤버 초대 (보드 소유자만) */
export function useInviteMemberMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      boardId,
      inviteeUserId,
    }: {
      boardId: string;
      inviteeUserId: string;
    }) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from(BOARD_MEMBERS_TABLE).insert({
        board_id: boardId,
        user_id: inviteeUserId,
        role: "editor",
      });
      if (error) throw error;
    },
    onSuccess: (_data, { boardId }) => {
      queryClient.invalidateQueries({
        queryKey: [...MEMBERS_QUERY_KEY, boardId],
      });
    },
  });
}

/** 가입 요청 수락 시 멤버 추가 후 상태 변경 */
export function useAcceptJoinRequestMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      boardId,
      acceptedUserId,
    }: {
      requestId: string;
      boardId: string;
      acceptedUserId: string;
    }) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { error: insertError } = await supabase
        .from(BOARD_MEMBERS_TABLE)
        .insert({
          board_id: boardId,
          user_id: acceptedUserId,
          role: "editor",
        });
      if (insertError) throw insertError;
      const { error: updateError } = await supabase
        .from(BOARD_JOIN_REQUESTS_TABLE)
        .update({ status: "accepted" })
        .eq("id", requestId);
      if (updateError) throw updateError;
    },
    onSuccess: (_data, { boardId }) => {
      queryClient.invalidateQueries({
        queryKey: [...JOIN_REQUESTS_QUERY_KEY, boardId],
      });
      queryClient.invalidateQueries({ queryKey: [...MEMBERS_QUERY_KEY, boardId] });
    },
  });
}

/** 가입 요청 거절 */
export function useRejectJoinRequestMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      boardId,
    }: {
      requestId: string;
      boardId: string;
    }) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase
        .from(BOARD_JOIN_REQUESTS_TABLE)
        .update({ status: "rejected" })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: (_data, { boardId }) => {
      queryClient.invalidateQueries({
        queryKey: [...JOIN_REQUESTS_QUERY_KEY, boardId],
      });
    },
  });
}

/** 비공개 보드 가입 요청 */
export function useRequestToJoinMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (boardId: string) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from(BOARD_JOIN_REQUESTS_TABLE).insert({
        board_id: boardId,
        user_id: userId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: (boardId) => {
      queryClient.invalidateQueries({
        queryKey: [...JOIN_REQUESTS_QUERY_KEY, boardId],
      });
    },
  });
}
