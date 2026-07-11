"use client";

import { useQuery } from "@tanstack/react-query";
import type { PortfolioHistoryResponse } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson } from "@/hooks/api";

export function usePortfolioHistory() {
  return useQuery({
    queryKey: qk.portfolioHistory,
    queryFn: () =>
      fetchJson<PortfolioHistoryResponse>("/api/dashboard/portfolio-history"),
    // La agregación combina N históricos externos: evitar refetches agresivos
    staleTime: 5 * 60 * 1000,
  });
}
