import type { BacktestPeriod } from "@/lib/types";

/** 기간별 「평균 대비 배수」 가로 막대. 1배(참가자 평균)에 기준선을 긋는다. .reveal 안에서 쓴다. */
export function PeriodBars({ periods }: { periods: BacktestPeriod[] }) {
  const max = Math.max(2, ...periods.map((p) => p.multiple)) * 1.06;
  const left = (m: number) => `${(m / max) * 100}%`;
  return (
    <div className="flex flex-col gap-4">
      {periods.map((p, i) => (
        <div key={p.label} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 md:grid-cols-[130px_1fr_150px] md:gap-5">
          <span className="font-bold">{p.label}</span>
          <div className="relative h-8">
            <div
              className={`bar-x absolute inset-y-1 left-0 rounded-r-lg ${p.multiple >= 1 ? "bg-blue" : "bg-rose"}`}
              style={{ width: left(p.multiple), transitionDelay: `${i * 70}ms` }}
              title={`${p.label}: ${p.multiple.toFixed(2)}배 (${p.n}건)`}
            />
            <div className="absolute inset-y-0 w-[2px] bg-ink" style={{ left: left(1) }} />
          </div>
          <span className="num text-right text-lg font-extrabold">
            {p.multiple.toFixed(2)}배 <span className="text-sm font-semibold text-muted">{p.n}건</span>
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[92px_1fr_auto] gap-3 text-sm font-semibold text-ink-2 md:grid-cols-[130px_1fr_150px] md:gap-5">
        <span />
        <div className="relative h-5">
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: left(1) }}>
            ↑ 1배 = 참가자 평균
          </span>
        </div>
        <span />
      </div>
    </div>
  );
}
