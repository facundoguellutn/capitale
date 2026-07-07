"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AssetType } from "@/lib/constants";
import type { MarketsResponse } from "@/lib/types";
import { qk } from "@/hooks/query-keys";
import { fetchJson } from "@/hooks/api";

const FIVE_MINUTES = 5 * 60 * 1000;

export type MarketType = "accion" | "cedear" | "bono" | "letra" | "on";

export function useMarkets(type: MarketType) {
  return useQuery({
    queryKey: qk.markets(type),
    queryFn: () => fetchJson<MarketsResponse>(`/api/markets?type=${type}`),
    refetchInterval: FIVE_MINUTES,
    staleTime: FIVE_MINUTES,
  });
}

// Mapa ticker -> tipo de activo según los paneles BYMA en vivo. Se usa en la
// importación para inferir si un ticker es acción, CEDEAR o bono.
export function useTickerAssetTypes() {
  const acciones = useMarkets("accion");
  const cedears = useMarkets("cedear");
  const bonos = useMarkets("bono");
  const letras = useMarkets("letra");
  const ons = useMarkets("on");

  const accionesData = acciones.data;
  const cedearsData = cedears.data;
  const bonosData = bonos.data;
  const letrasData = letras.data;
  const onsData = ons.data;

  const map = useMemo(() => {
    const result = new Map<string, AssetType>();
    // Prioridad: accion > cedear > bono > letra > on ante una colisión
    const panels: [AssetType, MarketsResponse | undefined][] = [
      ["on", onsData],
      ["letra", letrasData],
      ["bono", bonosData],
      ["cedear", cedearsData],
      ["accion", accionesData],
    ];
    for (const [type, data] of panels) {
      for (const quote of data?.quotes ?? []) {
        result.set(quote.ticker, type);
      }
    }
    return result;
  }, [accionesData, cedearsData, bonosData, letrasData, onsData]);

  return {
    map,
    isPending:
      acciones.isPending ||
      cedears.isPending ||
      bonos.isPending ||
      letras.isPending ||
      ons.isPending,
  };
}
