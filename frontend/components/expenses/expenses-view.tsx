"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/constants";
import { currentMonth } from "@/lib/month";
import { formatDate, formatMoney } from "@/lib/utils";
import type { ClientExpense } from "@/lib/types";
import { useAccounts } from "@/hooks/use-accounts";
import { useDeleteExpense, useExpenses } from "@/hooks/use-expenses";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALL_CATEGORIES = "todas";

export function ExpensesView() {
  const [month, setMonth] = useState(currentMonth());
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const { data: expenses, isPending, isError } = useExpenses(month);
  const { data: accounts } = useAccounts();
  const deleteMutation = useDeleteExpense();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientExpense | null>(null);

  const accountNames = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a.name])),
    [accounts]
  );

  const filtered = (expenses ?? []).filter(
    (e) => category === ALL_CATEGORIES || e.category === category
  );

  const totalARS = filtered
    .filter((e) => e.currency === "ARS")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalUSD = filtered
    .filter((e) => e.currency === "USD")
    .reduce((sum, e) => sum + e.amount, 0);

  function handleDelete(expense: ClientExpense) {
    if (!confirm("¿Eliminar este gasto? Se revierte el saldo de la cuenta.")) return;
    deleteMutation.mutate(expense.id, {
      onSuccess: () => toast.success("Gasto eliminado"),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div>
      <PageHeader title="Gastos" description="Control de gastos por mes y categoría">
        <Select value={category} onValueChange={(v) => setCategory(v as string)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MonthPicker value={month} onChange={setMonth} />
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Nuevo gasto
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
              Error al cargar los gastos
            </p>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {accountNames.get(expense.accountId) ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-muted-foreground">
                      {expense.note || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-negative">
                      −{formatMoney(expense.amount, expense.currency)}
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
                              setEditing(expense);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(expense)}
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
              No hay gastos registrados en este mes.
            </p>
          )}
        </CardContent>
      </Card>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editing}
        accounts={(accounts ?? []).filter((a) => !a.archived)}
      />
    </div>
  );
}
