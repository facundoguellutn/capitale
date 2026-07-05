"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { INCOME_KIND_LABELS } from "@/lib/constants";
import { currentMonth } from "@/lib/month";
import { formatDate, formatMoney } from "@/lib/utils";
import type { ClientIncome } from "@/lib/types";
import { useAccounts } from "@/hooks/use-accounts";
import { useDeleteIncome, useIncomes } from "@/hooks/use-incomes";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { IncomeDialog } from "@/components/incomes/income-dialog";
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

export function IncomesView() {
  const [month, setMonth] = useState(currentMonth());
  const { data: incomes, isPending, isError } = useIncomes(month);
  const { data: accounts } = useAccounts();
  const deleteMutation = useDeleteIncome();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientIncome | null>(null);

  const accountNames = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a.name])),
    [accounts]
  );

  const totalARS = (incomes ?? [])
    .filter((i) => i.currency === "ARS")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalUSD = (incomes ?? [])
    .filter((i) => i.currency === "USD")
    .reduce((sum, i) => sum + i.amount, 0);

  function handleDelete(income: ClientIncome) {
    if (!confirm("¿Eliminar este ingreso? Se revierte el saldo de la cuenta.")) return;
    deleteMutation.mutate(income.id, {
      onSuccess: () => toast.success("Ingreso eliminado"),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div>
      <PageHeader title="Ingresos" description="Sueldos y pagos de proyectos">
        <MonthPicker value={month} onChange={setMonth} />
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Nuevo ingreso
        </Button>
      </PageHeader>

      <p className="mb-4 text-sm text-muted-foreground">
        Total del mes:{" "}
        <span className="font-medium text-foreground">{formatMoney(totalARS, "ARS")}</span>
        {" · "}
        <span className="font-medium text-foreground">{formatMoney(totalUSD, "USD")}</span>
      </p>

      <Card>
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              Error al cargar los ingresos
            </p>
          ) : incomes && incomes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomes.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell>{formatDate(income.date)}</TableCell>
                    <TableCell className="font-medium">{income.source}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {INCOME_KIND_LABELS[income.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {accountNames.get(income.accountId) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-positive">
                      +{formatMoney(income.amount, income.currency)}
                    </TableCell>
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
                              setEditing(income);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(income)}
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
              No hay ingresos registrados en este mes.
            </p>
          )}
        </CardContent>
      </Card>

      <IncomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        income={editing}
        accounts={(accounts ?? []).filter((a) => !a.archived)}
      />
    </div>
  );
}
