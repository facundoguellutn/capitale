"use client";

import { useDisplayCurrency } from "@/components/display-currency";
import { CURRENCIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Segmented control ARS / USD (dólar MEP) para la moneda de visualización
export function CurrencyToggle() {
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();

  return (
    <div className="flex items-center rounded-md border p-0.5">
      {CURRENCIES.map((currency) => (
        <button
          key={currency}
          type="button"
          onClick={() => setDisplayCurrency(currency)}
          aria-pressed={displayCurrency === currency}
          className={cn(
            "rounded-sm px-2 py-0.5 text-xs font-medium transition-colors",
            displayCurrency === currency
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}
