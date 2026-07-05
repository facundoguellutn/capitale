import type { Metadata } from "next";
import { IncomesView } from "@/components/incomes/incomes-view";

export const metadata: Metadata = { title: "Ingresos — Capitale" };

export default function IngresosPage() {
  return <IncomesView />;
}
