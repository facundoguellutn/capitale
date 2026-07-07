"use client";

import Link from "next/link";
import { cn, formatPercent } from "@/lib/utils";
import { formatMoneyIn } from "@/lib/fx";
import type { AssetType } from "@/lib/constants";
import type { Holding, MarketQuote } from "@/lib/types";
import { AssetLogo } from "@/components/asset-logo";
import { useDisplayCurrency } from "@/components/display-currency";
import { useMarkets, type MarketType } from "@/hooks/use-markets";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function assetHref(ticker: string, type: string, coingeckoId?: string) {
  return (
    `/inversiones/${encodeURIComponent(ticker)}?type=${type}` +
    (coingeckoId ? `&coingeckoId=${encodeURIComponent(coingeckoId)}` : "")
  );
}

function MoverRow({
  ticker,
  href,
  pctChange,
  price,
  currency = "ARS",
  mep = null,
  assetType,
}: {
  ticker: string;
  href: string;
  pctChange: number;
  price?: number | null;
  currency?: "ARS" | "USD";
  mep?: number | null;
  assetType?: AssetType;
}) {
  const { displayCurrency } = useDisplayCurrency();
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <Link
        href={href}
        className="flex min-w-0 items-center gap-2 truncate font-medium hover:underline"
      >
        <AssetLogo ticker={ticker} assetType={assetType} className="size-4 text-[7px]" />
        {ticker}
      </Link>
      <span className="flex shrink-0 items-center gap-2">
        {price != null && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatMoneyIn(price, currency, displayCurrency, mep)}
          </span>
        )}
        <Badge
          variant="secondary"
          className={cn(pctChange >= 0 ? "text-positive" : "text-negative")}
        >
          {formatPercent(pctChange / 100)}
        </Badge>
      </span>
    </div>
  );
}

// Tenencias propias que más variaron hoy
export function PortfolioMovers({
  holdings,
  mep = null,
}: {
  holdings: Holding[];
  mep?: number | null;
}) {
  const withChange = holdings
    .filter((h) => h.pctChange != null)
    .sort((a, b) => b.pctChange! - a.pctChange!);
  const gainers = withChange.filter((h) => h.pctChange! >= 0).slice(0, 3);
  const losers = withChange.filter((h) => h.pctChange! < 0).slice(-3).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movers de tu cartera</CardTitle>
        <CardDescription>Variación diaria de tus tenencias</CardDescription>
      </CardHeader>
      <CardContent>
        {withChange.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subas
              </p>
              {gainers.length > 0 ? (
                gainers.map((h) => (
                  <MoverRow
                    key={h.ticker}
                    ticker={h.ticker}
                    href={assetHref(h.ticker, h.assetType, h.coingeckoId)}
                    pctChange={h.pctChange!}
                    price={h.currentPrice}
                    currency={h.assetType === "cripto" ? "USD" : "ARS"}
                    mep={mep}
                    assetType={h.assetType}
                  />
                ))
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin subas hoy.</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bajas
              </p>
              {losers.length > 0 ? (
                losers.map((h) => (
                  <MoverRow
                    key={h.ticker}
                    ticker={h.ticker}
                    href={assetHref(h.ticker, h.assetType, h.coingeckoId)}
                    pctChange={h.pctChange!}
                    price={h.currentPrice}
                    currency={h.assetType === "cripto" ? "USD" : "ARS"}
                    mep={mep}
                    assetType={h.assetType}
                  />
                ))
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin bajas hoy.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Cuando tengas inversiones con cotización, acá vas a ver cuáles se
            movieron más hoy.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Acciones y CEDEARs que más variaron hoy en todo el mercado
export function MarketMovers() {
  const acciones = useMarkets("accion");
  const cedears = useMarkets("cedear");

  const isPending = acciones.isPending || cedears.isPending;
  const isError = acciones.isError && cedears.isError;
  const mep = acciones.data?.mep ?? cedears.data?.mep ?? null;

  const merged: (MarketQuote & { type: MarketType })[] = [
    ...(acciones.data?.quotes ?? []).map((q) => ({ ...q, type: "accion" as const })),
    ...(cedears.data?.quotes ?? []).map((q) => ({ ...q, type: "cedear" as const })),
  ].sort((a, b) => b.pctChange - a.pctChange);

  const gainers = merged.slice(0, 5);
  const losers = merged.slice(-5).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movers del mercado</CardTitle>
        <CardDescription>
          Acciones y CEDEARs que más variaron hoy
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Error al cargar los datos del mercado
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subas
              </p>
              {gainers.map((q) => (
                <MoverRow
                  key={`${q.type}:${q.ticker}`}
                  ticker={q.ticker}
                  href={assetHref(q.ticker, q.type)}
                  pctChange={q.pctChange}
                  price={q.price}
                  mep={mep}
                  assetType={q.type}
                />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bajas
              </p>
              {losers.map((q) => (
                <MoverRow
                  key={`${q.type}:${q.ticker}`}
                  ticker={q.ticker}
                  href={assetHref(q.ticker, q.type)}
                  pctChange={q.pctChange}
                  price={q.price}
                  mep={mep}
                  assetType={q.type}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
