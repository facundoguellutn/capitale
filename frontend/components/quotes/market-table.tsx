"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";
import { formatMoneyIn } from "@/lib/fx";
import { AssetLogo } from "@/components/asset-logo";
import { useDisplayCurrency } from "@/components/display-currency";
import { useMarkets, type MarketType } from "@/hooks/use-markets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Título por panel (los labels genéricos no pluralizan bien)
const MARKET_TITLES: Record<MarketType, string> = {
  accion: "Acciones argentinas",
  cedear: "CEDEARs",
  bono: "Bonos",
  letra: "Letras del Tesoro",
  on: "Obligaciones negociables",
};

type SortMode = "ticker" | "desc" | "asc";

const NEXT_SORT: Record<SortMode, SortMode> = {
  ticker: "desc",
  desc: "asc",
  asc: "ticker",
};

export function MarketTable({ type }: { type: MarketType }) {
  const { data, isPending, isError } = useMarkets(type);
  const { displayCurrency } = useDisplayCurrency();
  const [sort, setSort] = useState<SortMode>("ticker");

  const quotes = useMemo(() => {
    const list = [...(data?.quotes ?? [])];
    if (sort === "desc") list.sort((a, b) => b.pctChange - a.pctChange);
    if (sort === "asc") list.sort((a, b) => a.pctChange - b.pctChange);
    return list;
  }, [data, sort]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Error al cargar las cotizaciones del mercado
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{MARKET_TITLES[type]}</CardTitle>
        <CardDescription>
          {quotes.length} activos · Actualizado:{" "}
          {new Date(data.updatedAt).toLocaleTimeString("es-AR")} · Hacé click en
          un ticker para ver su detalle
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="xs"
                  className="-mr-2"
                  onClick={() => setSort(NEXT_SORT[sort])}
                >
                  Variación diaria
                  {sort === "ticker" && <ArrowUpDown data-icon="inline-end" />}
                  {sort === "desc" && <ArrowDown data-icon="inline-end" />}
                  {sort === "asc" && <ArrowUp data-icon="inline-end" />}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow key={quote.ticker}>
                <TableCell className="p-0 font-medium">
                  <Link
                    href={`/inversiones/${encodeURIComponent(quote.ticker)}?type=${type}`}
                    className="flex items-center gap-2 px-2 py-2 hover:underline"
                  >
                    <AssetLogo ticker={quote.ticker} assetType={type} />
                    {quote.ticker}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {formatMoneyIn(quote.price, "ARS", displayCurrency, data.mep)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="secondary"
                    className={cn(
                      quote.pctChange >= 0 ? "text-positive" : "text-negative"
                    )}
                  >
                    {formatPercent(quote.pctChange / 100)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
