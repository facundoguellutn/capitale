"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import type { InvestmentTransactionInput } from "@/lib/schemas";
import { parseFile } from "@/lib/import/parse";
import { autoMapColumns, buildDrafts, computeIssues } from "@/lib/import/normalize";
import {
  REQUIRED_FIELDS,
  type ColumnMapping,
  type ImportRowDraft,
  type RawTable,
} from "@/lib/import/types";
import { useAccounts } from "@/hooks/use-accounts";
import { useBulkCreateInvestments } from "@/hooks/use-investments";
import { useTickerAssetTypes } from "@/hooks/use-markets";
import { PageHeader } from "@/components/page-header";
import { AccountSelect } from "@/components/accounts/account-select";
import { ColumnMapper } from "@/components/investments/import/column-mapper";
import { ImportSummary } from "@/components/investments/import/import-summary";
import {
  PreviewTable,
  type DraftPatch,
} from "@/components/investments/import/preview-table";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = "file" | "map" | "preview";

function mappingComplete(mapping: ColumnMapping) {
  return REQUIRED_FIELDS.every((field) => mapping[field]);
}

export function ImportWizard() {
  const router = useRouter();
  const { data: accounts } = useAccounts();
  const tickerTypes = useTickerAssetTypes();
  const bulkCreate = useBulkCreateInvestments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState<RawTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [drafts, setDrafts] = useState<ImportRowDraft[]>([]);
  const [accountId, setAccountId] = useState("");
  const [parsing, setParsing] = useState(false);

  const validDrafts = drafts.filter((d) => !d.excluded && d.issues.length === 0);
  const includedInvalid = drafts.filter(
    (d) => !d.excluded && d.issues.length > 0
  );

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const table = await parseFile(file);
      const auto = autoMapColumns(table.headers);
      setRaw(table);
      setFileName(file.name);
      setMapping(auto);
      if (mappingComplete(auto)) {
        setDrafts(buildDrafts(table, auto, tickerTypes.map));
        setStep("preview");
      } else {
        setStep("map");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo leer el archivo"
      );
    } finally {
      setParsing(false);
    }
  }

  function confirmMapping() {
    if (!raw) return;
    setDrafts(buildDrafts(raw, mapping, tickerTypes.map));
    setStep("preview");
  }

  function patchDraft(index: number, patch: DraftPatch) {
    setDrafts((prev) =>
      prev.map((draft, i) => {
        if (i !== index) return draft;
        const values = patch.values
          ? { ...draft.values, ...patch.values }
          : draft.values;
        return {
          ...draft,
          values,
          asset: patch.asset !== undefined ? patch.asset : draft.asset,
          excluded: patch.excluded ?? draft.excluded,
          // Las filas que no son compra/venta no se revalidan: siguen excluidas
          issues: draft.values.side == null ? draft.issues : computeIssues(values),
        };
      })
    );
  }

  function handleImport() {
    if (!accountId) {
      toast.error("Elegí la cuenta destino");
      return;
    }
    const inputs = validDrafts.map(
      (draft) => ({ ...draft.values, accountId }) as InvestmentTransactionInput
    );
    bulkCreate.mutate(inputs, {
      onSuccess: (result) => {
        toast.success(
          `${result.inserted} operaciones importadas` +
            (result.skipped > 0 ? ` · ${result.skipped} duplicadas` : "")
        );
        router.push("/inversiones");
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div>
      <Link
        href="/inversiones"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
      >
        <ArrowLeft data-icon="inline-start" />
        Inversiones
      </Link>
      <PageHeader
        title="Importar operaciones"
        description="Cargá el Excel de tu broker (IOL exporta desde Mi Cuenta → Movimientos) o la plantilla genérica"
      />

      {step === "file" && (
        <Card>
          <CardHeader>
            <CardTitle>Archivo</CardTitle>
            <CardDescription>
              Formatos soportados: CSV, XLS y XLSX. El archivo se procesa en tu
              navegador, no se sube a ningún servidor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <FileSpreadsheet className="size-8" />
              {parsing ? "Leyendo archivo..." : "Hacé click para elegir el archivo"}
            </button>
            <div className="text-sm text-muted-foreground">
              <p className="mb-1">
                ¿No tenés un export? Usá la plantilla genérica (sirve para Cocos
                Capital o para cargar a mano):
              </p>
              <a
                href="/plantilla-importacion.csv"
                download
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download data-icon="inline-start" />
                Descargar plantilla CSV
              </a>
              <ul className="mt-3 list-inside list-disc space-y-0.5 text-xs">
                <li>Fecha: AAAA-MM-DD o DD/MM/AAAA</li>
                <li>Tipo: compra o venta (otras filas se ignoran)</li>
                <li>
                  Tipo de activo: accion, cedear, bono, letra, on o cripto
                  (opcional, se infiere del ticker)
                </li>
                <li>Decimales con punto o coma · Bonos: precio por 100 nominales</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "map" && raw && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeo de columnas</CardTitle>
            <CardDescription>
              {fileName}: indicá qué columna del archivo corresponde a cada dato.
              Los campos con * son obligatorios.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ColumnMapper
              headers={raw.headers}
              mapping={mapping}
              onChange={setMapping}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("file")}>
                Volver
              </Button>
              <Button
                onClick={confirmMapping}
                disabled={!mappingComplete(mapping) || tickerTypes.isPending}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Revisión</CardTitle>
              <CardDescription>
                {fileName} · {validDrafts.length} válidas de {drafts.length}{" "}
                filas
                {includedInvalid.length > 0 &&
                  ` · ${includedInvalid.length} con errores (no se importan)`}
                . Podés corregir valores, elegir el activo con el buscador o
                destildar filas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewTable drafts={drafts} onPatch={patchDraft} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confirmar importación</CardTitle>
              <CardDescription>
                Las operaciones ajustan el efectivo de la cuenta elegida (compras
                restan, ventas suman). Las duplicadas se saltean.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <ImportSummary drafts={validDrafts} />
              <div className="flex w-full max-w-sm flex-col gap-2">
                <Label>Cuenta destino (efectivo)</Label>
                <AccountSelect
                  accounts={accounts ?? []}
                  value={accountId}
                  onValueChange={setAccountId}
                />
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" onClick={() => setStep("map")}>
                  Ajustar columnas
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    validDrafts.length === 0 || !accountId || bulkCreate.isPending
                  }
                >
                  <Upload data-icon="inline-start" />
                  {bulkCreate.isPending
                    ? "Importando..."
                    : `Importar ${validDrafts.length} operaciones`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
