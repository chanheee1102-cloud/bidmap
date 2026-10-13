import type { Curve, Pick } from "@/lib/types";

/**
 * 눈금자 그림: 회색 막대는 경쟁사가 과거에 써낸 곳, 주황 점은 추천 자리.
 * 막대가 낮은 왼쪽에 점이 찍히는 것이 이 서비스의 요지다.
 */
export function PickRuler({ curve, picks }: { curve: Curve; picks: Pick[] }) {
  const lo = curve.binStart;
  const hi = lo + curve.binWidth * curve.rival.length;
  const pos = (r: number) => `${Math.max(0, Math.min(100, ((r - lo) / (hi - lo)) * 100))}%`;
  const max = Math.max(...curve.rival);
  const ticks: number[] = [];
  for (let r = Math.ceil(lo); r <= hi; r++) ticks.push(r);
  const top = picks[0];

  return (
    <div>
      <div className="relative pt-9">
        <div className="flex h-16 items-end gap-[2px]" aria-hidden>
          {curve.rival.map((s, i) => (
            <div
              key={i}
              className="grow-y flex-1 rounded-t-[3px] bg-rival/45"
              style={{ height: `${Math.max(2, (s / max) * 100)}%`, animationDelay: `${i * 12}ms` }}
            />
          ))}
        </div>
        <div className="h-[2px] rounded bg-ink" />

        {top && (
          <div
            className="fade absolute bottom-0 top-9 w-[2px] -translate-x-1/2 bg-orange/70"
            style={{ left: pos(top.rate), animationDelay: "900ms" }}
            aria-hidden
          />
        )}
        {picks
          .slice()
          .reverse()
          .map((p) => (
            <div key={p.rank} className="absolute top-9 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(p.rate) }} aria-hidden>
              <div className="drop relative flex items-center justify-center" style={{ animationDelay: `${600 + p.rank * 140}ms` }}>
                {p.rank === 1 && <span className="ping absolute size-4 rounded-full bg-orange" />}
                <span
                  className={`relative block rounded-full border-[3px] border-paper bg-orange ${
                    p.rank === 1 ? "size-5" : "size-3.5 opacity-55"
                  }`}
                />
              </div>
            </div>
          ))}
        {top && (
          <div
            className="fade absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-orange px-2.5 py-0.5 text-xs font-bold text-white"
            style={{ left: `clamp(3.2rem, ${pos(top.rate)}, calc(100% - 3.2rem))`, animationDelay: "1000ms" }}
          >
            추천 {top.rate.toFixed(2)}%
          </div>
        )}
      </div>

      <div className="relative mt-1.5 h-5 text-xs text-muted" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="num absolute -translate-x-1/2" style={{ left: pos(t) }}>
            {t}%
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-rival/45" />
          경쟁사가 써낸 곳
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-orange" />
          추천 자리
        </span>
      </div>
    </div>
  );
}
