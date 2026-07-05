export const qk = {
  accounts: ["accounts"] as const,
  incomes: (month?: string) => ["incomes", month ?? "all"] as const,
  expenses: (month?: string) => ["expenses", month ?? "all"] as const,
  investments: ["investments"] as const,
  fixedTerms: ["fixed-terms"] as const,
  quotes: ["quotes"] as const,
  dashboard: ["dashboard"] as const,
};
