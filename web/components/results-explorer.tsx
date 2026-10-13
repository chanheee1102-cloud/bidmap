"use client";

import { useState } from "react";
import { PastTable } from "@/components/past-table";
import type { Past } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "전체", test: () => true },
  { key: "won", label: "낙찰 자리", test: (p: Past) => p.pickWon === true },
  { key: "above", label: "평균 이상", test: (p: Past) => (p.pickMultiple ?? 0) >= 1 },
  { key: "below", label: "평균 미만", test: (p: Past) => p.pickMultiple !== null && p.pickMultiple < 1 },
] as const;

export function ResultsExplorer({ rows }: { rows: Past[] }) {
  const [key, setKey] = useState<(typeof FILTERS)[number]["key"]>("all");
  const active = FILTERS.find((f) => f.key === key)!;
  const shown = rows.filter(active.test);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = rows.filter(f.test).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setKey(f.key)}
              aria-pressed={f.key === key}
              className={`h-11 rounded-full px-5 font-bold transition-colors ${
                f.key === key ? "bg-navy text-white" : "border border-line bg-paper text-ink-2 hover:border-ink"
              }`}
            >
              {f.label} <span className="num ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5">
        <PastTable rows={shown} />
      </div>
    </div>
  );
}
