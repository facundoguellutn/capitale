"use client";

import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  REQUIRED_FIELDS,
  type ColumnMapping,
  type ImportField,
} from "@/lib/import/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

// Asigna cada campo de la operación a una columna del archivo
export function ColumnMapper({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  function setField(field: ImportField, header: string | null) {
    const next = { ...mapping };
    if (header == null || header === NONE) delete next[field];
    else next[field] = header;
    onChange(next);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {IMPORT_FIELDS.map((field) => {
        const required = REQUIRED_FIELDS.includes(field);
        return (
          <div key={field} className="flex flex-col gap-2">
            <Label>
              {IMPORT_FIELD_LABELS[field]}
              {required && <span className="text-destructive"> *</span>}
            </Label>
            <Select
              value={mapping[field] ?? NONE}
              onValueChange={(v) => setField(field, v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Sin asignar —</SelectItem>
                {headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
