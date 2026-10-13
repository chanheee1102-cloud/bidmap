"use client";

import { useEffect, useRef, useState } from "react";
import { pct, rate as fmtRate, times, won, wonShort } from "@/lib/format";
import { bidForRate, matchedRate, type Terms } from "@/lib/rules";
import type { Curve, Pick } from "@/lib/types";

const M = { left: 50, right: 22 };
const A = { top: 30, height: 250 };     // 위: 금액별 유리함(평균 대비 배수)
const B = { top: 376, height: 120 };    // 아래: 경쟁사가 쓰는 곳 vs 기준선이 떨어지는 곳
const AXIS_Y = B.top + B.height;
const HEIGHT = AXIS_Y + 52;

/** 폭을 재고, 화면에 들어왔는지도 알려 준다(들어온 뒤에 그리기 시작하려고). */
function useStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);
  return { ref, width, seen };
}

/** 곡선 위 임의의 사정률에서의 배수(선형 보간). 범위 밖이면 null. */
function multipleAt(curve: Curve, r: number): number | null {
  const { rate, multiple } = curve;
  if (r < rate[0] || r > rate[rate.length - 1]) return null;
  const step = rate[1] - rate[0];
  const i = Math.min(rate.length - 2, Math.floor((r - rate[0]) / step));
  const t = (r - rate[i]) / step;
  return multiple[i] * (1 - t) + multiple[i + 1] * t;
}

type Props = { curve: Curve; picks: Pick[]; terms: Terms; expectedBidders: number };

export function SpotChart({ curve, picks, terms, expectedBidders }: Props) {
  const { ref, width, seen } = useStage();
  const [hover, setHover] = useState<number | null>(null);   // curve.rate의 위치
  const [mine, setMine] = useState("");

  const x0 = curve.rate[0];
  const x1 = curve.rate[curve.rate.length - 1];
  const plotW = Math.max(0, width - M.left - M.right);
  const x = (r: number) => M.left + ((r - x0) / (x1 - x0)) * plotW;

  const yMax = Math.max(2, Math.ceil(Math.max(...curve.multiple) * 1.1 * 2) / 2);
  const yA = (m: number) => A.top + A.height - (Math.min(m, yMax) / yMax) * A.height;
  const shareMax = Math.max(...curve.rival, ...curve.draw) * 1.12;
  const yB = (s: number) => B.top + B.height - (s / shareMax) * B.height;

  const line = curve.rate.map((r, i) => `${i ? "L" : "M"}${x(r).toFixed(1)},${yA(curve.multiple[i]).toFixed(1)}`).join("");
  const area = `${line}L${x(x1).toFixed(1)},${yA(0)}L${x(x0).toFixed(1)},${yA(0)}Z`;
  const binX = (i: number) => curve.binStart + curve.binWidth * i;
  const drawLine = curve.draw
    .map((s, i) => `${i ? "L" : "M"}${x(binX(i) + curve.binWidth / 2).toFixed(1)},${yB(s).toFixed(1)}`)
    .join("");
  const barW = Math.max(1, Math.min(24, plotW / curve.rival.length - 2));

  // 축 눈금: 칸이 110px보다 좁아지지 않게 간격을 고른다
  const tickStep = [0.5, 1, 2].find((s) => (plotW / (x1 - x0)) * s >= 110) ?? 2;
  const ticks: number[] = [];
  for (let r = Math.ceil(x0 / tickStep) * tickStep; r <= x1 + 1e-9; r += tickStep) ticks.push(Math.round(r * 100) / 100);
  const anchor = (r: number) => (x(r) < M.left + 40 ? "start" : x(r) > width - M.right - 40 ? "end" : "middle");
  const yTicks: number[] = [];
  for (let m = 0; m <= yMax + 1e-9; m += 0.5) yTicks.push(m);

  const mineAmount = Number(mine.replace(/[^\d]/g, ""));
  const mineRate = mineAmount > 0 ? matchedRate(mineAmount, terms) : null;
  const mineMultiple = mineRate === null ? null : multipleAt(curve, mineRate);
  const setAmount = (n: number) => setMine(n.toLocaleString("ko-KR"));

  const onMove = (clientX: number, target: SVGRectElement) => {
    const box = target.getBoundingClientRect();
    const r = x0 + ((clientX - box.left) / box.width) * (x1 - x0);
    const step = curve.rate[1] - curve.rate[0];
    setHover(Math.max(0, Math.min(curve.rate.length - 1, Math.round((r - x0) / step))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const stride = e.shiftKey ? 10 : 1;
    setHover((h) => {
      const base = h ?? Math.round(curve.rate.length / 2);
      return Math.max(0, Math.min(curve.rate.length - 1, base + (e.key === "ArrowRight" ? stride : -stride)));
    });
  };

  const hv = hover === null ? null : { r: curve.rate[hover], m: curve.multiple[hover] };
  const show = seen && width > 0;
  const narrow = plotW < 520;      // 폰: 표시를 줄여 겹치지 않게 한다

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <div ref={ref} className="relative" style={{ height: HEIGHT }}>
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label="투찰금액에 따른 낙찰 확률 배수와, 경쟁사 투찰 분포·기준선 분포"
              tabIndex={0}
              onKeyDown={onKey}
              onBlur={() => setHover(null)}
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue"
            >
              {/* 위 패널: 금액별 유리함 */}
              {yTicks.map((m) => (
                <g key={m}>
                  <line x1={M.left} x2={width - M.right} y1={yA(m)} y2={yA(m)} stroke={m === 1 ? "var(--axis)" : "var(--grid)"} strokeWidth={m === 1 ? 1.5 : 1} />
                  {Number.isInteger(m) && (
                    <text x={M.left - 10} y={yA(m) + 5} textAnchor="end" className="num" fontSize={13} fill="var(--muted)">
                      {m}배
                    </text>
                  )}
                </g>
              ))}
              {/* 곡선이 지나지 않는 오른쪽 아래에 둔다. 폰에서는 자리가 없어 세로축의 「1배」 눈금에 맡긴다 */}
              {!narrow && (
                <text x={width - M.right - 8} y={yA(1) + 19} textAnchor="end" fontSize={13} fontWeight={600} fill="var(--ink-2)">
                  참가자 평균 = 1배
                </text>
              )}

              {show && (
                <>
                  <path d={area} fill="var(--brand-wash)" className="fade" style={{ animationDelay: "500ms" }} />
                  <path d={line} pathLength={1} className="draw" fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                  {picks.map((p) => (
                    <g key={p.rank} className="drop" style={{ animationDelay: `${1000 + p.rank * 160}ms` }}>
                      {p.rank === 1 && <circle cx={x(p.rate)} cy={yA(p.multiple)} r={7} fill="var(--mark)" className="ping" />}
                      <circle cx={x(p.rate)} cy={yA(p.multiple)} r={p.rank === 1 ? 7.5 : 6} fill="var(--mark)" stroke="var(--paper)" strokeWidth={2.5} />
                      {(!narrow || p.rank === 1) && (
                        <text x={x(p.rate)} y={yA(p.multiple) - 15} textAnchor="middle" className="num" fontSize={14} fontWeight={800} fill="var(--ink)">
                          {narrow ? "추천" : p.rank}
                        </text>
                      )}
                    </g>
                  ))}
                </>
              )}

              {/* 아래 패널: 왜 그 자리인가 */}
              <text x={M.left} y={B.top - (narrow ? 68 : 52)} fontSize={17} fontWeight={700} fill="var(--ink)">
                왜 그 자리인가
              </text>
              <g transform={`translate(${M.left}, ${B.top - (narrow ? 44 : 26)})`} fontSize={13} fill="var(--ink-2)">
                <rect width={12} height={12} y={-10} rx={3} fill="var(--rival)" opacity={0.6} />
                <text x={18}>경쟁사가 써낸 곳</text>
                <g transform={narrow ? "translate(0, 20)" : "translate(136, 0)"}>
                  <line x1={0} x2={14} y1={-4} y2={-4} stroke="var(--brand)" strokeWidth={2.5} strokeLinecap="round" />
                  <text x={narrow ? 18 : 22}>기준선이 떨어지는 곳</text>
                </g>
              </g>
              {show &&
                curve.rival.map((s, i) => {
                  const h = AXIS_Y - yB(s);
                  const cx = x(binX(i) + curve.binWidth / 2);
                  const q = Math.min(3, h);
                  return h > 0.5 ? (
                    <path
                      key={i}
                      className="grow-y"
                      style={{ animationDelay: `${i * 10}ms` }}
                      d={`M${cx - barW / 2},${AXIS_Y}V${AXIS_Y - h + q}q0,-${q} ${q},-${q}H${cx + barW / 2 - q}q${q},0 ${q},${q}V${AXIS_Y}Z`}
                      fill="var(--rival)"
                      opacity={0.6}
                    />
                  ) : null;
                })}
              {show && (
                <path d={drawLine} pathLength={1} className="draw" style={{ animationDelay: "500ms" }} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              )}
              <line x1={M.left} x2={width - M.right} y1={AXIS_Y} y2={AXIS_Y} stroke="var(--ink)" strokeWidth={1.5} />

              {/* 가로축: 겨냥 사정률과 그에 해당하는 투찰금액 */}
              {ticks.map((r) => (
                <g key={r}>
                  <line x1={x(r)} x2={x(r)} y1={AXIS_Y} y2={AXIS_Y + 6} stroke="var(--ink)" strokeWidth={1.5} />
                  <text x={x(r)} y={AXIS_Y + 23} textAnchor={anchor(r)} className="num" fontSize={13} fontWeight={600} fill="var(--ink-2)">
                    {r.toFixed(tickStep < 1 ? 1 : 0)}%
                  </text>
                  <text x={x(r)} y={AXIS_Y + 41} textAnchor={anchor(r)} fontSize={12} fill="var(--muted)">
                    {wonShort(bidForRate(r, terms))}
                  </text>
                </g>
              ))}

              {mineRate !== null && mineMultiple !== null && (
                <g>
                  <line x1={x(mineRate)} x2={x(mineRate)} y1={A.top} y2={AXIS_Y} stroke="var(--ink)" strokeWidth={2} />
                  <circle cx={x(mineRate)} cy={yA(mineMultiple)} r={6.5} fill="var(--ink)" stroke="var(--paper)" strokeWidth={2.5} />
                  <text x={x(mineRate)} y={A.top - 10} textAnchor={anchor(mineRate)} fontSize={13} fontWeight={700} fill="var(--ink)">
                    내 금액
                  </text>
                </g>
              )}
              {hv && (
                <g pointerEvents="none">
                  <line x1={x(hv.r)} x2={x(hv.r)} y1={A.top} y2={AXIS_Y} stroke="var(--axis)" strokeWidth={1.5} />
                  <circle cx={x(hv.r)} cy={yA(hv.m)} r={6} fill="var(--brand)" stroke="var(--paper)" strokeWidth={2.5} />
                </g>
              )}
              <rect
                x={M.left}
                y={A.top}
                width={plotW}
                height={AXIS_Y - A.top}
                fill="transparent"
                className="cursor-crosshair"
                onPointerMove={(e) => onMove(e.clientX, e.currentTarget)}
                onPointerDown={(e) => onMove(e.clientX, e.currentTarget)}
                onPointerLeave={() => setHover(null)}
                onClick={() => hv && setAmount(bidForRate(hv.r, terms))}
              />
            </svg>
          )}

          {hv && width > 0 && (
            <div
              className="pointer-events-none absolute top-10 z-10 w-56 rounded-2xl border border-line bg-paper p-4 shadow-lg"
              style={{ left: Math.max(0, Math.min(width - 224, x(hv.r) + (x(hv.r) > width / 2 ? -240 : 16))) }}
            >
              <div className="num text-lg font-extrabold">{won(bidForRate(hv.r, terms))}</div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-ink-2">
                <dt>겨냥 사정률</dt>
                <dd className="num text-right font-semibold text-ink">{fmtRate(hv.r)}</dd>
                <dt>평균 대비</dt>
                <dd className="num text-right font-semibold text-ink">{times(hv.m)}</dd>
                <dt>추정 확률</dt>
                <dd className="num text-right font-semibold text-ink">{pct(hv.m / (expectedBidders + 1))}</dd>
              </dl>
              <p className="mt-2 text-xs text-muted">누르면 오른쪽 계산기에 넣습니다</p>
            </div>
          )}
        </div>

        <details className="mt-4">
          <summary className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-line px-4 font-semibold text-ink-2 hover:border-ink">
            표로 보기
          </summary>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[460px] text-left">
              <thead className="text-sm text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-semibold">겨냥 사정률</th>
                  <th className="px-4 py-3 text-right font-semibold">투찰금액</th>
                  <th className="px-4 py-3 text-right font-semibold">평균 대비</th>
                  <th className="px-4 py-3 text-right font-semibold">추정 확률</th>
                </tr>
              </thead>
              <tbody className="num">
                {curve.rate
                  .map((r, i) => ({ r, m: curve.multiple[i] }))
                  .filter((_, i) => i % 25 === 0)
                  .map(({ r, m }) => (
                    <tr key={r} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">{fmtRate(r)}</td>
                      <td className="px-4 py-2.5 text-right">{won(bidForRate(r, terms))}</td>
                      <td className="px-4 py-2.5 text-right">{times(m)}</td>
                      <td className="px-4 py-2.5 text-right">{pct(m / (expectedBidders + 1))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {/* 계산기 */}
      <aside className="h-fit rounded-3xl bg-sand p-6">
        <h3 className="text-xl font-bold">내 금액 넣어 보기</h3>
        <p className="mt-1 text-ink-2">쓰려는 금액이 얼마나 유리한지 바로 확인합니다.</p>
        <label className="mt-5 block text-sm font-bold text-ink-2" htmlFor="mine">
          투찰금액(원)
        </label>
        <input
          id="mine"
          inputMode="numeric"
          value={mine}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 13);
            setMine(digits ? Number(digits).toLocaleString("ko-KR") : "");
          }}
          placeholder={bidForRate(picks[0]?.rate ?? 100, terms).toLocaleString("ko-KR")}
          className="num mt-2 h-14 w-full rounded-xl border-2 border-line bg-paper px-4 text-right text-xl font-bold outline-none transition-colors placeholder:font-medium placeholder:text-muted/60 focus:border-ink"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {picks.map((p) => (
            <button
              key={p.rank}
              type="button"
              onClick={() => setAmount(p.amount)}
              className="h-10 rounded-full border border-line bg-paper px-4 text-sm font-bold transition-colors hover:border-orange"
            >
              추천 {p.rank}
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-ink/10 pt-5">
          {mineRate === null ? (
            <p className="leading-relaxed text-ink-2">금액을 입력하거나, 그래프에서 원하는 자리를 누르세요.</p>
          ) : mineMultiple === null ? (
            <p className="rounded-xl bg-rose-soft p-4 font-semibold leading-relaxed">
              겨냥 사정률 {fmtRate(mineRate)} — 기준선이 떨어질 수 있는 범위를 벗어난 금액입니다.
            </p>
          ) : (
            <dl className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <dt className="font-semibold text-ink-2">평균 대비</dt>
                <dd className={`num rounded-full px-3 py-1 text-2xl font-extrabold ${mineMultiple >= 1 ? "bg-green-soft" : "bg-rose-soft"}`}>
                  {times(mineMultiple)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="font-semibold text-ink-2">추정 낙찰 확률</dt>
                <dd className="num text-xl font-bold">{pct(mineMultiple / (expectedBidders + 1))}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="font-semibold text-ink-2">겨냥 사정률</dt>
                <dd className="num text-xl font-bold">{fmtRate(mineRate)}</dd>
              </div>
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}
