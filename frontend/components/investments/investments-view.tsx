"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ASSET_TYPE_LABELS } from "@/lib/constants";
import { cn, formatDate, formatMoney, formatPercent } from "@/lib/utils";
import type {
  ClientFixedTerm,
  ClientInvestmentTransaction,
} from "@/lib/types";
import { useAccounts } from "@/hooks/use-accounts";
import {
  useDeleteFixedTerm,
  useDeleteInvestment,
  useFixedTerms,
  useInvestments,
} from "@/hooks/use-investments";
import { PageHeader } from "@/components/page-header";
import { InvestmentDialog } from "@/components/investments/investment-dialog";
import {
  CollectFixedTermDialog,
  FixedTermDialog,
} from "@/components/investments/fixed-term-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function PnlText({ pnl, pnlPct, currency }: { pnl: number | null; pnlPct: number | null; currency: "ARS" | "USD" }) {
  if (pnl == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "font-medium",
        pnl >= 0
          ? "text-positive"
          : "text-negative"
      )}
    >
      {pnl >= 0 ? "+" : ""}
      {formatMoney(pnl, currency)}
      {pnlPct != null && ` (${formatPercent(pnlPct)})`}
    </span>
  );
}

export function InvestmentsView() {
  const { data, isPending } = useInvestments();
  const { data: fixedTerms, isPending: ftPending } = useFixedTerms();
  const { data: accounts } = useAccounts();
  const deleteTx = useDeleteInvestment();
  const deleteFt = useDeleteFixedTerm();

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<ClientInvestmentTransaction | null>(null);
  const [ftDialogOpen, setFtDialogOpen] = useState(false);
  const [editingFt, setEditingFt] = useState<ClientFixedTerm | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collecting, setCollecting] = useState<ClientFixedTerm | null>(null);

  const activeAccounts = (accounts ?? []).filter((a) => !a.archived);
  const accountNames = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a.name])),
    [accounts]
  );

  const totalValueARS = (data?.holdings ?? []).reduce(
    (sum, h) => sum + (h.valueARS ?? 0),
    0
  );

  function handleDeleteTx(tx: ClientInvestmentTransaction) {
    if (!confirm("¿Eliminar esta operación? Se revierte el efectivo en la cuenta.")) return;
    deleteTx.mutate(tx.id, {
      onSuccess: () => toast.success("Operación eliminada"),
      onError: (err) => toast.error(err.message),
    });
  }

  function handleDeleteFt(deposit: ClientFixedTerm) {
    if (!confirm(`¿Eliminar el plazo fijo de ${deposit.bankName}?`)) return;
    deleteFt.mutate(deposit.id, {
      onSuccess: () => toast.success("Plazo fijo eliminado"),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div>
      <PageHeader
        title="Inversiones"
        description="Cartera, operaciones y plazos fijos"
      >
        <Button
          variant="outline"
          onClick={() => {
            setEditingFt(null);
            setFtDialogOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Plazo fijo
        </Button>
        <Button
          onClick={() => {
            setEditingTx(null);
            setTxDialogOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Nueva operación
        </Button>
      </PageHeader>

      <Tabs defaultValue="cartera">
        <TabsList>
          <TabsTrigger value="cartera">Cartera</TabsTrigger>
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
          <TabsTrigger value="plazos-fijos">Plazos fijos</TabsTrigger>
        </TabsList>

        <TabsContent value="cartera">
          <Card>
            <CardContent>
              {isPending ? (
                <div className="flex flex-col gap-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : data && data.holdings.length > 0 ? (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Valor total de la cartera:{" "}
                    <span className="font-medium text-foreground">
                      {formatMoney(totalValueARS, "ARS")}
                    </span>
                    {data.mep != null && (
                      <> · {formatMoney(totalValueARS / data.mep, "USD")} (MEP)</>
                    )}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">PPC</TableHead>
                        <TableHead className="text-right">Precio actual</TableHead>
                        <TableHead className="text-right">Valor (ARS)</TableHead>
                        <TableHead className="text-right">Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.holdings.map((holding) => (
                        <TableRow key={holding.ticker}>
                          <TableCell className="font-medium">{holding.ticker}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {ASSET_TYPE_LABELS[holding.assetType]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {holding.quantity.toLocaleString("es-AR", {
                              maximumFractionDigits: 8,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(holding.avgPrice, holding.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            {holding.currentPrice != null ? (
                              formatMoney(
                                holding.currentPrice,
                                holding.assetType === "cripto" ? "USD" : "ARS"
                              )
                            ) : (
                              <Badge variant="secondary">Sin cotización</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {holding.valueARS != null
                              ? formatMoney(holding.valueARS, "ARS")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <PnlText pnl={holding.pnl} pnlPct={holding.pnlPct} currency="ARS" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Registrá tu primera compra para ver tu cartera.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operaciones">
          <Card>
            <CardContent>
              {isPending ? (
                <div className="flex flex-col gap-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : data && data.transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Operación</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              tx.side === "compra"
                                ? "text-positive"
                                : "text-negative"
                            )}
                          >
                            {tx.side === "compra" ? "Compra" : "Venta"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{tx.ticker}</TableCell>
                        <TableCell className="text-right">
                          {tx.quantity.toLocaleString("es-AR", {
                            maximumFractionDigits: 8,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(tx.price, tx.currency)}
                        </TableCell>
                        <TableCell>{accountNames.get(tx.accountId) ?? "—"}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-sm">
                                  <MoreHorizontal />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingTx(tx);
                                  setTxDialogOpen(true);
                                }}
                              >
                                <Pencil /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteTx(tx)}
                              >
                                <Trash2 /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay operaciones registradas.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plazos-fijos">
          <Card>
            <CardContent>
              {ftPending ? (
                <div className="flex flex-col gap-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : fixedTerms && fixedTerms.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banco</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">TNA</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Valor devengado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fixedTerms.map((deposit) => (
                      <TableRow
                        key={deposit.id}
                        className={deposit.status === "cobrado" ? "opacity-50" : undefined}
                      >
                        <TableCell className="font-medium">{deposit.bankName}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(deposit.principal, deposit.currency)}
                        </TableCell>
                        <TableCell className="text-right">{deposit.tna}%</TableCell>
                        <TableCell>
                          {formatDate(deposit.maturityDate)}
                          {deposit.status === "activo" && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({deposit.daysToMaturity} días)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(deposit.accruedValue, deposit.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              deposit.status === "activo" &&
                                "text-positive"
                            )}
                          >
                            {deposit.status === "activo" ? "Activo" : "Cobrado"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deposit.status === "activo" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-sm">
                                    <MoreHorizontal />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCollecting(deposit);
                                    setCollectOpen(true);
                                  }}
                                >
                                  <Banknote /> Cobrar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingFt(deposit);
                                    setFtDialogOpen(true);
                                  }}
                                >
                                  <Pencil /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDeleteFt(deposit)}
                                >
                                  <Trash2 /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay plazos fijos cargados.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InvestmentDialog
        open={txDialogOpen}
        onOpenChange={setTxDialogOpen}
        transaction={editingTx}
        accounts={activeAccounts}
      />
      <FixedTermDialog
        open={ftDialogOpen}
        onOpenChange={setFtDialogOpen}
        deposit={editingFt}
      />
      <CollectFixedTermDialog
        open={collectOpen}
        onOpenChange={setCollectOpen}
        deposit={collecting}
        accounts={activeAccounts}
      />
    </div>
  );
}
