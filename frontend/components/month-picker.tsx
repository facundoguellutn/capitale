"use client";

import { Input } from "@/components/ui/input";

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  return (
    <Input
      type="month"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="w-40"
    />
  );
}
