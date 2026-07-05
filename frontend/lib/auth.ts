import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { decrypt, getSessionToken } from "@/lib/session";

export const getSession = cache(async () => {
  const token = await getSessionToken();
  return decrypt(token);
});

// Guard para layouts, server actions y route handlers.
// El proxy hace solo un chequeo optimista; este es el control real.
export async function requireUser() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  return session;
}
