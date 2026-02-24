"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  BOARDS_TABLE,
  type BoardRow,
  type BoardInsert,
  type BoardUpdate,
} from "@/types/board";

const QUERY_KEY = ["boards"] as const;

export function useBoardsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, userId ?? ""],
    queryFn: async (): Promise<BoardRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from(BOARDS_TABLE)
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
    enabled: !!userId,
  });
}

export function useSaveBoardMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      content,
    }: {
      id: string | null;
      title: string;
      content: BoardInsert["content"];
    }): Promise<BoardRow> => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      if (id) {
        const update: BoardUpdate = { title, content, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from(BOARDS_TABLE)
          .update(update)
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        return data as BoardRow;
      } else {
        const insert: BoardInsert = { title, content, user_id: userId };
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
