"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson } from "@/hooks/api";

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
  });
}
