"use client";

import { useState } from "react";
/* eslint-disable @next/next/no-img-element */
import type { AssetType } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Logos por ticker de Parqet (API pública, sin key). Funciona para acciones
// argentinas y CEDEARs (mismo símbolo que USA); lo que no exista cae al
// círculo con iniciales (bonos, letras, ONs y variantes en dólares).
const LOGO_ASSET_TYPES: AssetType[] = ["accion", "cedear"];

export function parqetLogoUrl(ticker: string) {
  return `https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=png`;
}

export function AssetLogo({
  ticker,
  assetType,
  logo,
  className,
}: {
  ticker: string;
  assetType?: AssetType;
  // URL explícita (ej. thumb de CoinGecko); tiene prioridad sobre Parqet
  logo?: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const src =
    logo ??
    (assetType && LOGO_ASSET_TYPES.includes(assetType)
      ? parqetLogoUrl(ticker)
      : null);

  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 select-none items-center justify-center rounded-full bg-muted text-[9px] font-semibold leading-none text-muted-foreground",
          className
        )}
      >
        {ticker.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn(
        "size-5 shrink-0 rounded-full bg-white object-contain",
        className
      )}
    />
  );
}
