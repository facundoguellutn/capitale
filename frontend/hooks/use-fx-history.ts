"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { FxHistoryResponse } from "@/lib/types";

export function useFxHistory(enabled = true) {
  return useQuery({
    queryKey: ["fx-history", "al30-ratio-v1"],
    queryFn: () => fetchJson<FxHistoryResponse>("/api/fx/history"),
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}
