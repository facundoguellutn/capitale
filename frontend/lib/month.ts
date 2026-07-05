// Helpers para el filtro por mes (YYYY-MM), siempre en UTC
export function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 1));
  return { start, end };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

// Últimos n meses incluyendo el actual, en formato YYYY-MM
export function lastMonths(n: number) {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}
