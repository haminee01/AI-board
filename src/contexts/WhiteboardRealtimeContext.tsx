"use client";

import { createContext, useContext } from "react";
import { useRealtimeWhiteboard } from "@/hooks/useRealtimeWhiteboard";

type WhiteboardRealtimeValue = ReturnType<typeof useRealtimeWhiteboard>;

const WhiteboardRealtimeContext = createContext<WhiteboardRealtimeValue | null>(
  null,
);

export function WhiteboardRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useRealtimeWhiteboard();
  return (
    <WhiteboardRealtimeContext.Provider value={value}>
      {children}
    </WhiteboardRealtimeContext.Provider>
  );
}

export function useWhiteboardRealtime(): WhiteboardRealtimeValue {
  const ctx = useContext(WhiteboardRealtimeContext);
  if (!ctx)
    throw new Error(
      "useWhiteboardRealtime must be used within WhiteboardRealtimeProvider",
    );
  return ctx;
}
