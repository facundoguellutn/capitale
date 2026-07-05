import type { Metadata } from "next";
import { ExpensesView } from "@/components/expenses/expenses-view";

export const metadata: Metadata = { title: "Gastos — Capitale" };

export default function GastosPage() {
  return <ExpensesView />;
}
