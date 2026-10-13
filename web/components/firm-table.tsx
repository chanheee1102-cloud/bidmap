"use client";

import { useState } from "react";
import { pct, rate, ymd } from "@/lib/format";
import type { Firm } from "@/lib/types";

const LO = 98;
const HI = 102;
const pos = (r: number) => `${Math.max(0, Math.min(100, ((r - LO) / (HI - LO)) * 100))}%`;

/** 그 업체가 주로 쓰는 금액대: 굵은 띠가 가운데 절반(사분위 범위), 점이 중앙값. */
function Habit({ f }: { f: Firm }) {
  return (
    <div className="relative h-7 min-w-[170px]" title={`중앙값 ${rate(f.medianRate)}, 폭 ±${(f.spread / 2).toFixed(2)}%p`}>
      <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-line" />
      <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-axis" style={{ left: pos(100) }} />
      <div
        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-violet/35"
        style={{ left: pos(f.medianRate - f.spread / 2), right: `calc(100% - ${pos(f.medianRate + f.spread / 2)})` }}
      />
      <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-violet" style={{ left: pos(f.medianRate) }} />
    </div>
  );
}

const SORTS = [
  { key: "bids", label: "참여 많은 순", by: (a: Firm, b: Firm) => b.bids - a.bids },
  { key: "wins", label: "낙찰 많은 순", by: (a: Firm, b: Firm) => b.wins - a.wins || b.bids - a.bids },
  { key: "low", label: "낮게 쓰는 순", by: (a: Firm, b: Firm) => a.medianRate - b.medianRate },
  { key: "narrow", label: "늘 같은 자리", by: (a: Firm, b: Firm) => a.spread - b.spread },
] as const;

export function FirmTable({ firms }: { firms: Firm[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("bids");
  const by = SORTS.find((s) => s.key === sort)!.by;
  const shown = firms.filter((f) => f.name.includes(q.trim())).sort(by);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="업체 이름으로 찾기"
          aria-label="업체 이름으로 찾기"
          className="h-12 w-full rounded-xl border-2 border-line bg-paper px-4 text-lg outline-none transition-colors placeholder:text-muted focus:border-ink lg:w-80"
        />
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={s.key === sort}
              className={`h-11 rounded-full px-4 font-bold transition-colors ${
                s.key === sort ? "bg-navy text-white" : "border border-line bg-paper text-ink-2 hover:border-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-line bg-paper">
        <table className="w-full min-w-[860px] text-left">
          <thead className="text-sm text-muted">
            <tr className="border-b border-line">
              <th className="px-6 py-4 font-semibold">업체</th>
              <th className="px-3 py-4 text-right font-semibold">참여</th>
              <th className="px-3 py-4 text-right font-semibold">낙찰</th>
              <th className="px-3 py-4 text-right font-semibold">하한선 미달</th>
              <th className="px-3 py-4 font-semibold">
                주로 쓰는 자리 <span className="num font-normal">({LO}% ~ {HI}%)</span>
              </th>
              <th className="px-3 py-4 text-right font-semibold">중앙값</th>
              <th className="px-6 py-4 text-right font-semibold">최근 참여</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.name} className="border-b border-line transition-colors last:border-0 hover:bg-mist/60">
                <td className="max-w-[260px] truncate px-6 py-3.5 font-semibold">{f.name}</td>
                <td className="num px-3 py-3.5 text-right">{f.bids}</td>
                <td className="px-3 py-3.5 text-right">
                  <span className={`num inline-flex min-w-9 justify-center rounded-full px-2.5 py-0.5 font-bold ${f.wins > 0 ? "bg-orange-soft" : "text-muted"}`}>
                    {f.wins}
                  </span>
                </td>
                <td className="num px-3 py-3.5 text-right">{pct(f.underFloor, 0)}</td>
                <td className="px-3 py-3.5">
                  <Habit f={f} />
                </td>
                <td className="num px-3 py-3.5 text-right font-semibold">{rate(f.medianRate)}</td>
                <td className="num whitespace-nowrap px-6 py-3.5 text-right text-ink-2">{ymd(f.lastBid)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-ink-2">
                  「{q}」에 해당하는 업체가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
