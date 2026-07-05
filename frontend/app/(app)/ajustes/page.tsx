import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export const metadata: Metadata = { title: "Ajustes — Capitale" };

export default function AjustesPage() {
  return (
    <div>
      <PageHeader title="Ajustes" description="Configuración de tu cuenta" />
      <ChangePasswordForm />
    </div>
  );
}
