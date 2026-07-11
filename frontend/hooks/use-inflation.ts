"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { InflationResponse } from "@/lib/types";

export function useInflation() {
  return useQuery({
    // v2 invalida la respuesta truncada que podía permanecer 24 h en memoria.
    queryKey: ["inflation", "v2"],
    queryFn: () => fetchJson<InflationResponse>("/api/inflation"),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
