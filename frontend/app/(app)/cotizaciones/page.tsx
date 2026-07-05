import type { Metadata } from "next";
import { QuotesView } from "@/components/quotes/quotes-view";

export const metadata: Metadata = { title: "Cotizaciones — Capitale" };

export default function CotizacionesPage() {
  return <QuotesView />;
}
