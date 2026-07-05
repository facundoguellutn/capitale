"use client";

import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { useQuotes } from "@/hooks/use-quotes";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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

const DOLAR_ORDER = ["oficial", "blue", "bolsa", "contadoconliqui", "cripto", "tarjeta"];

export function QuotesView() {
  const { data, isPending, isError } = useQuotes();

  const dolares = (data?.dolares ?? [])
    .filter((d) => DOLAR_ORDER.includes(d.casa))
    .sort((a, b) => DOLAR_ORDER.indexOf(a.casa) - DOLAR_ORDER.indexOf(b.casa));

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        description={
          data
            ? `Actualizado: ${new Date(data.updatedAt).toLocaleTimeString("es-AR")} (se refresca cada 5 minutos)`
            : "Dólar y activos en cartera"
        }
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-destructive">
          Error al cargar las cotizaciones
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dolares.map((dolar) => (
              <Card key={dolar.casa}>
                <CardHeader>
                  <CardDescription>Dólar {dolar.nombre}</CardDescription>
                  <CardTitle className="text-xl">
                    {formatMoney(dolar.venta, "ARS")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Compra {formatMoney(dolar.compra, "ARS")} · Venta{" "}
                  {formatMoney(dolar.venta, "ARS")}
                </CardContent>
              </Card>
            ))}
            {dolares.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Cotización del dólar no disponible en este momento.
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activos en cartera</CardTitle>
              <CardDescription>
                Últimos precios de tus acciones, CEDEARs, bonos y cripto
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.quotes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Variación diaria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.quotes.map((quote) => (
                      <TableRow key={quote.ticker}>
                        <TableCell className="font-medium">{quote.ticker}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(quote.price, quote.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {quote.pctChange != null ? (
                            <Badge
                              variant="secondary"
                              className={cn(
                                quote.pctChange >= 0
                                  ? "text-positive"
                                  : "text-negative"
                              )}
                            >
                              {formatPercent(quote.pctChange / 100)}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Cuando cargues inversiones, acá vas a ver sus precios en vivo.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
