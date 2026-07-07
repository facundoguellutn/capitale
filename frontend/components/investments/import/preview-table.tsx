"use client";

import { useState } from "react";
import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from "@/lib/constants";
import { parseLocaleNumber } from "@/lib/import/normalize";
import type { ImportRowDraft } from "@/lib/import/types";
import type { AssetSearchResult } from "@/lib/types";
import { AssetCombobox } from "@/components/investments/asset-combobox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DraftPatch = {
  values?: Partial<ImportRowDraft["values"]>;
  asset?: AssetSearchResult | null;
  excluded?: boolean;
};

function StatusBadge({ draft }: { draft: ImportRowDraft }) {
  if (draft.excluded) return <Badge variant="secondary">Excluida</Badge>;
  if (draft.issues.length > 0)
    return (
      <Badge variant="secondary" className="text-negative">
        Inválida
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-positive">
      Válida
    </Badge>
  );
}

// Selector de tipo + buscador para filas cuyo activo no se pudo resolver solo
function AssetResolver({
  draft,
  onPatch,
}: {
  draft: ImportRowDraft;
  onPatch: (patch: DraftPatch) => void;
}) {
  const [searchType, setSearchType] = useState<AssetType>(
    draft.values.assetType ?? "cripto"
  );

  return (
    <div className="flex min-w-64 items-center gap-2">
      <Select
        value={searchType}
        onValueChange={(v) => setSearchType(v as AssetType)}
      >
        <SelectTrigger size="sm" className="w-28 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSET_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {ASSET_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AssetCombobox
        assetType={searchType}
        value={draft.asset}
        onChange={(item) =>
          onPatch({
            asset: item,
            values: {
              ticker: item?.ticker ?? draft.values.ticker,
              assetType: item ? searchType : draft.values.assetType,
              coingeckoId: item?.coingeckoId,
            },
          })
        }
      />
    </div>
  );
}

export function PreviewTable({
  drafts,
  onPatch,
}: {
  drafts: ImportRowDraft[];
  onPatch: (index: number, patch: DraftPatch) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Estado</TableHead>
            <TableHead>Fila</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead>Moneda</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drafts.map((draft, i) => {
            const noTrade = draft.values.side == null;
            const needsAsset =
              !noTrade &&
              (draft.values.assetType == null ||
                (draft.values.assetType === "cripto" &&
                  !draft.values.coingeckoId));
            return (
              <TableRow key={i} className={draft.excluded ? "opacity-50" : ""}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={!draft.excluded}
                    disabled={noTrade}
                    onChange={(e) => onPatch(i, { excluded: !e.target.checked })}
                    aria-label="Incluir fila"
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge draft={draft} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {draft.index}
                </TableCell>
                <TableCell>
                  {noTrade ? (
                    "—"
                  ) : (
                    <Input
                      type="date"
                      className="h-8 w-36"
                      value={
                        draft.values.date
                          ? draft.values.date.toISOString().slice(0, 10)
                          : ""
                      }
                      onChange={(e) =>
                        onPatch(i, {
                          values: {
                            date: e.target.value
                              ? new Date(`${e.target.value}T00:00:00.000Z`)
                              : undefined,
                          },
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell>
                  {draft.values.side === "compra"
                    ? "Compra"
                    : draft.values.side === "venta"
                      ? "Venta"
                      : "—"}
                </TableCell>
                <TableCell>
                  {noTrade ? (
                    <span className="text-muted-foreground">
                      {draft.values.ticker ?? "—"}
                    </span>
                  ) : needsAsset ? (
                    <AssetResolver
                      draft={draft}
                      onPatch={(patch) => onPatch(i, patch)}
                    />
                  ) : (
                    <span className="font-medium">
                      {draft.values.ticker}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {draft.values.assetType &&
                          ASSET_TYPE_LABELS[draft.values.assetType]}
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {noTrade ? (
                    "—"
                  ) : (
                    <Input
                      inputMode="decimal"
                      className="h-8 w-24 text-right"
                      defaultValue={draft.values.quantity ?? ""}
                      onBlur={(e) =>
                        onPatch(i, {
                          values: {
                            quantity:
                              parseLocaleNumber(e.target.value) ?? undefined,
                          },
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {noTrade ? (
                    "—"
                  ) : (
                    <Input
                      inputMode="decimal"
                      className="h-8 w-28 text-right"
                      defaultValue={draft.values.price ?? ""}
                      onBlur={(e) =>
                        onPatch(i, {
                          values: {
                            price:
                              parseLocaleNumber(e.target.value) ?? undefined,
                          },
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell>{draft.values.currency ?? "—"}</TableCell>
                <TableCell className="max-w-56 text-xs text-muted-foreground">
                  {draft.issues.join(" · ") || draft.values.note || ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
