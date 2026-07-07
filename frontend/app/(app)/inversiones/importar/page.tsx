import type { Metadata } from "next";
import { ImportWizard } from "@/components/investments/import/import-wizard";

export const metadata: Metadata = { title: "Importar operaciones — Capitale" };

export default function ImportarPage() {
  return <ImportWizard />;
}
