import type { Metadata } from "next";
import { InvestmentsView } from "@/components/investments/investments-view";

export const metadata: Metadata = { title: "Inversiones — Capitale" };

export default function InversionesPage() {
  return <InvestmentsView />;
}
