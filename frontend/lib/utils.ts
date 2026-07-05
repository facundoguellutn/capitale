import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number, currency: "ARS" | "USD" = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(date))
}

// Convierte documentos lean de mongoose a JSON plano (_id -> id, fechas ISO)
export function serialize<T>(doc: unknown): T {
  const plain = JSON.parse(JSON.stringify(doc))
  return renameIds(plain) as T
}

function renameIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(renameIds)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key === "_id" ? "id" : key] = renameIds(val)
    }
    return out
  }
  return value
}
