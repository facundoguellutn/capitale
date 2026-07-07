"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AssetType } from "@/lib/constants";
import type { AssetHistoryResponse, AssetSearchResult } from "@/lib/types";
import { fetchJson } from "@/hooks/api";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useAssetSearch(assetType: AssetType, query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  return useQuery({
    queryKey: ["asset-search", assetType, debouncedQuery],
    queryFn: () =>
      fetchJson<AssetSearchResult[]>(
        `/api/assets/search?type=${assetType}&q=${encodeURIComponent(debouncedQuery)}`
      ),
    enabled: debouncedQuery.length >= 1,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

// Búsqueda en todos los tipos de activo a la vez (command palette)
export function useGlobalAssetSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  return useQuery({
    queryKey: ["asset-search", "all", debouncedQuery],
    queryFn: () =>
      fetchJson<AssetSearchResult[]>(
        `/api/assets/search?type=all&q=${encodeURIComponent(debouncedQuery)}`
      ),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useAssetHistory(
  ticker: string,
  assetType: AssetType | undefined,
  coingeckoId?: string
) {
  const params = new URLSearchParams({ type: assetType ?? "" });
  if (coingeckoId) params.set("coingeckoId", coingeckoId);
  return useQuery({
    queryKey: ["asset-history", assetType ?? null, ticker, coingeckoId ?? null],
    queryFn: () =>
      fetchJson<AssetHistoryResponse>(
        `/api/assets/${encodeURIComponent(ticker)}/history?${params.toString()}`
      ),
    enabled: !!assetType && (assetType !== "cripto" || !!coingeckoId),
    staleTime: 5 * 60 * 1000,
  });
}
