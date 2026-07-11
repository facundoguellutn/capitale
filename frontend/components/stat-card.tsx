import type * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// KPI reutilizable: etiqueta, valor grande y una línea secundaria opcional.
export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("gap-1", className)}>
      <div className="px-(--card-spacing)">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1.5 font-mono text-2xl tabular-nums",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative"
          )}
        >
          {value}
        </p>
        {sub != null && (
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        )}
      </div>
    </Card>
  );
}
