"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import type { ClientAccount } from "@/lib/types";
import {
  useAccounts,
  useDeleteAccount,
  useSetAccountArchived,
} from "@/hooks/use-accounts";
import { PageHeader } from "@/components/page-header";
import { AccountDialog } from "@/components/accounts/account-dialog";
import { AccountLabel } from "@/components/accounts/account-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function AccountsView() {
  const { data: accounts, isPending, isError } = useAccounts();
  const archiveMutation = useSetAccountArchived();
  const deleteMutation = useDeleteAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientAccount | null>(null);

  const active = accounts?.filter((a) => !a.archived) ?? [];
  const totalARS = active
    .filter((a) => a.currency === "ARS")
    .reduce((sum, a) => sum + a.balance, 0);
  const totalUSD = active
    .filter((a) => a.currency === "USD")
    .reduce((sum, a) => sum + a.balance, 0);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: ClientAccount) {
    setEditing(account);
    setDialogOpen(true);
  }

  function handleDelete(account: ClientAccount) {
    if (!confirm(`¿Eliminar la cuenta "${account.name}"? Los movimientos asociados quedan sin cuenta.`)) return;
    deleteMutation.mutate(account.id, {
      onSuccess: () => toast.success("Cuenta eliminada"),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div>
      <PageHeader title="Cuentas" description="Dónde está tu plata: bancos, apps, brokers y efectivo">
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Nueva cuenta
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Total en pesos</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(totalARS, "ARS")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total en dólares</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(totalUSD, "USD")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              Error al cargar las cuentas
            </p>
          ) : accounts && accounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className={account.archived ? "opacity-50" : undefined}
                  >
                    <TableCell className="font-medium">
                      <AccountLabel
                        name={account.name}
                        provider={account.provider}
                        logoSize={18}
                      />
                      {account.archived && (
                        <Badge variant="secondary" className="ml-2">
                          Archivada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{ACCOUNT_TYPE_LABELS[account.type]}</TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(account.balance, account.currency)}
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
                          <DropdownMenuItem onClick={() => openEdit(account)}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              archiveMutation.mutate({
                                id: account.id,
                                archived: !account.archived,
                              })
                            }
                          >
                            {account.archived ? (
                              <>
                                <ArchiveRestore /> Desarchivar
                              </>
                            ) : (
                              <>
                                <Archive /> Archivar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(account)}
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
              Todavía no cargaste ninguna cuenta. Creá la primera para empezar.
            </p>
          )}
        </CardContent>
      </Card>

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
      />
    </div>
  );
}
