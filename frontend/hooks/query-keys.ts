export const qk = {
  accounts: ["accounts"] as const,
  incomes: (month?: string) => ["incomes", month ?? "all"] as const,
  expenses: (month?: string) => ["expenses", month ?? "all"] as const,
  investments: ["investments"] as const,
  fixedTerms: ["fixed-terms"] as const,
  quotes: ["quotes"] as const,
  markets: (type: string) => ["markets", type] as const,
  dashboard: ["dashboard"] as const,
  portfolioHistory: ["portfolio-history"] as const,
};
