"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuotesResponse } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson } from "@/hooks/api";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useQuotes() {
  return useQuery({
    queryKey: qk.quotes,
    queryFn: () => fetchJson<QuotesResponse>("/api/quotes"),
    refetchInterval: FIVE_MINUTES,
    staleTime: FIVE_MINUTES,
  });
}
