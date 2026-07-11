"use client";

import Link from "next/link";
import { cn, formatPercent } from "@/lib/utils";
import { formatMoneyIn } from "@/lib/fx";
import type { AssetType } from "@/lib/constants";
import type { Holding } from "@/lib/types";
import { AssetLogo } from "@/components/asset-logo";
import { useDisplayCurrency } from "@/components/display-currency";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
