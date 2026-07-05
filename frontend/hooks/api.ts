import type { ActionResult } from "@/lib/types";

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status} al cargar datos`);
  return res.json();
}

// Lanza si la action devolvió error, para que react-query lo trate como failure
export function unwrap(result: ActionResult) {
  if (!result.ok) throw new Error(result.error);
  return result;
}
