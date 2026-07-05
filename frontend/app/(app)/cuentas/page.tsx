import type { Metadata } from "next";
import { AccountsView } from "@/components/accounts/accounts-view";

export const metadata: Metadata = { title: "Cuentas — Capitale" };

export default function CuentasPage() {
  return <AccountsView />;
}
