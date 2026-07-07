// Conversión ARS <-> USD al dólar MEP para la moneda de visualización.
// Usable en cliente y servidor (no importa nada server-only).
import type { Currency } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";

// null si hace falta convertir y no hay MEP disponible
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  mep: number | null
): number | null {
  if (from === to) return amount;
  if (!mep) return null;
  return from === "ARS" ? amount / mep : amount * mep;
}

// Formatea en la moneda de display; si no hay MEP cae a la moneda
// original (el símbolo $ vs US$ ya indica cuál se está mostrando)
export function formatMoneyIn(
  amount: number,
  from: Currency,
  display: Currency,
  mep: number | null
): string {
  const converted = convertAmount(amount, from, display, mep);
  if (converted === null) return formatMoney(amount, from);
  return formatMoney(converted, display);
}
