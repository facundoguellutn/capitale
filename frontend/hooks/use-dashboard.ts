"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson } from "@/hooks/api";

export function useDashboard(month?: string) {
  return useQuery({
    queryKey: [...qk.dashboard, month ?? "current"],
    queryFn: () =>
      fetchJson<DashboardData>(
        month ? `/api/dashboard?month=${month}` : "/api/dashboard"
      ),
  });
}
