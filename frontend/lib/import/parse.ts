// Lectura de archivos CSV/XLS/XLSX en el navegador. El archivo nunca sube al
// server: se parsea acá y solo viajan las filas normalizadas y validadas.
import { countHeaderMatches } from "@/lib/import/normalize";
import type { ImportFormat, RawTable } from "@/lib/import/types";

function normalizedHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function detectImportFormat(headers: string[]): ImportFormat {
  const normalized = new Set(headers.map(normalizedHeader));
  const cocosHeaders = [
    "nroticket",
    "fechaejecucion",
    "tipooperacion",
    "instrumento",
    "montobruto",
    "total",
  ];
  if (cocosHeaders.every((header) => normalized.has(header))) return "cocos";

  if (
    normalized.has("tipomov") &&
    (normalized.has("concert") || normalized.has("concertacion"))
  ) {
    return "iol";
  }
  return "generic";
}

// Los exports de brokers suelen traer filas de título antes de los headers
// (IOL: "Operaciones Historicas del periodo..."). Se busca en las primeras
// filas la que más parece un encabezado; si ninguna califica, se usa la 1ª.
function findHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const score = countHeaderMatches(rows[i] ?? []);
    if (score >= 3) return i;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

// El ".xls" de IOL es en realidad una tabla HTML: si el archivo empieza con
// "<" hay que tratarlo como texto, no como Excel binario
function looksLikeHtml(buffer: ArrayBuffer): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(buffer.slice(0, 512))
    .replace(/^﻿/, "")
    .trimStart();
  return head.startsWith("<");
}

export async function parseFile(file: File): Promise<RawTable> {
  // Import dinámico: xlsx solo se carga al entrar a la página de importación
  const XLSX = await import("xlsx");

  const buffer = await file.arrayBuffer();
  const isText = /\.csv$/i.test(file.name) || looksLikeHtml(buffer);
  let workbook;
  if (isText) {
    // CSV y HTML disfrazado de .xls: leer TODO como texto crudo (raw). Si no,
    // SheetJS convierte los números con convención USA y rompe los decimales
    // con coma ("1,18" -> 118) y las fechas D/M ("2/7/26" -> 7 de febrero).
    // Los textos los convierte después normalize.ts con las reglas argentinas.
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    workbook = XLSX.read(text, { type: "string", raw: true });
  } else {
    // XLS/XLSX binarios reales: las celdas ya vienen tipadas por Excel.
    // Cargar las tablas de codepage para acentos en .xls legacy.
    const cptable = await import("xlsx/dist/cpexcel.full.mjs");
    XLSX.set_cptable(cptable);
    workbook = XLSX.read(buffer, { cellDates: true });
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no tiene hojas");
  const sheet = workbook.Sheets[sheetName];

  // Matriz cruda para poder ubicar la fila de headers
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
  if (matrix.length === 0) throw new Error("El archivo está vacío");

  const headerIndex = findHeaderRow(matrix);
  const headerCells = matrix[headerIndex] ?? [];

  // Headers únicos y no vacíos (las columnas sin nombre se numeran)
  const headers: string[] = [];
  const seen = new Set<string>();
  headerCells.forEach((cell, col) => {
    let name = String(cell ?? "").trim() || `Columna ${col + 1}`;
    while (seen.has(name)) name = `${name} (2)`;
    seen.add(name);
    headers.push(name);
  });

  const rows: Record<string, unknown>[] = [];
  for (const cells of matrix.slice(headerIndex + 1)) {
    const row: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, col) => {
      const value = cells?.[col] ?? null;
      row[header] = value;
      if (value != null && String(value).trim() !== "") hasValue = true;
    });
    if (hasValue) rows.push(row);
  }
  if (rows.length === 0) throw new Error("El archivo no tiene filas de datos");

  return { headers, rows, format: detectImportFormat(headers) };
}
