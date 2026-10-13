"use client";

import { useState } from "react";

/** 금액을 숫자만 복사한다 — 나라장터 투찰 칸에 그대로 붙여넣을 수 있게. */
export function CopyAmount({ amount, tone = "solid", label = "금액 복사" }: { amount: number; tone?: "solid" | "ghost"; label?: string }) {
  const [done, setDone] = useState(false);
  const look =
    tone === "solid"
      ? "bg-navy text-white hover:bg-navy-2"
      : "border-2 border-ink/15 bg-paper text-ink hover:border-ink";
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(String(amount));
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className={`inline-flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-2xl px-6 text-lg font-extrabold transition-colors ${look} ${
        done ? "!bg-green !text-white" : ""
      }`}
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {done ? <path d="M4.5 10.5l3.5 3.5 7.5-8" /> : <><rect x="7" y="7" width="9" height="9" rx="2" /><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" /></>}
      </svg>
      {done ? "복사했습니다" : label}
    </button>
  );
}
