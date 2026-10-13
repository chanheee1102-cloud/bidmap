import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyAmount } from "@/components/copy-amount";
import { IconBack, IconDoc, IconMethod, IconTarget, IconTrend } from "@/components/icons";
import { CountdownText, Reveal } from "@/components/motion";
import { SpotChart } from "@/components/spot-chart";
import { Panel } from "@/components/ui";
import { getBoard } from "@/lib/data";
import { pct, rate, times, when, won } from "@/lib/format";

function Term({ tone, label, value, note }: { tone: string; label: string; value: string; note?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${tone}`}>
      <dt className="font-bold text-ink-2">{label}</dt>
      <dd className="num mt-2 truncate text-2xl font-extrabold tracking-tight">{value}</dd>
      {note && <p className="mt-1 text-ink-2">{note}</p>}
    </div>
  );
}

async function Notice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = await getBoard();
  const n = board.upcoming.find((u) => u.id === id);
  if (!n) notFound();
  const terms = { baseAmount: n.baseAmount, floorRate: n.floorRate, aValue: n.aValue };
  const [top, ...rest] = n.picks;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="inline-flex h-12 w-fit items-center gap-2 rounded-2xl bg-paper px-4 text-lg font-bold shadow-sm transition-colors hover:bg-sand">
        <IconBack className="size-5" />
        오늘의 입찰로
      </Link>

      {/* 공고 머리 */}
      <header className="rise ruler-edge rounded-3xl bg-navy p-6 text-white md:p-9">
        <p className="text-lg font-semibold text-navy-ink">{n.agency}</p>
        <h1 className="display mt-2 max-w-5xl text-[1.9rem] leading-tight md:text-[2.7rem]">{n.name}</h1>
        <div className="mt-6 flex flex-wrap items-center gap-2.5 pb-4 text-lg">
          <span className="rounded-full bg-orange px-5 py-2 font-extrabold">{when(n.bidClose)} 투찰 마감</span>
          <span className="rounded-full bg-white/12 px-5 py-2 font-bold">
            <CountdownText until={n.bidClose} />
          </span>
          <span className="rounded-full border border-navy-line px-5 py-2 font-semibold text-navy-ink">{when(n.openAt)} 개찰</span>
          {n.detailUrl && (
            <a href={n.detailUrl} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center px-2 font-bold text-blue-bright underline underline-offset-4">
              나라장터에서 공고 보기 ↗
            </a>
          )}
        </div>
      </header>

      {/* 추천 금액 */}
      <Panel tone="orange" icon={<IconTarget />} title="추천 투찰금액" desc="가장 유리한 자리부터 세 곳입니다. 「금액 복사」를 눌러 나라장터 금액 칸에 붙여넣으세요.">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr_1fr]">
          <div className="rise rounded-3xl border-[3px] border-orange bg-sand p-6 md:p-7" style={{ animationDelay: "120ms" }}>
            <p className="flex items-center gap-2.5 text-xl font-extrabold">
              <span className="num flex size-9 items-center justify-center rounded-full bg-orange text-white">1</span>
              가장 유리한 자리
            </p>
            <p className="display num mt-4 text-[2.1rem] leading-none sm:text-[2.9rem] 2xl:text-[3.4rem]">{won(top.amount)}</p>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              남들 평균보다 <b className="text-orange-ink">{times(top.multiple)}</b> 유리 · 예상 낙찰 확률 <b className="num text-ink">{pct(top.winProb)}</b>
            </p>
            <div className="mt-5">
              <CopyAmount amount={top.amount} label="이 금액 복사" />
            </div>
          </div>

          {rest.map((p, i) => (
            <div key={p.rank} className="rise flex flex-col rounded-3xl border-2 border-line p-6" style={{ animationDelay: `${240 + i * 120}ms` }}>
              <p className="flex items-center gap-2.5 text-lg font-extrabold text-ink-2">
                <span className="num flex size-9 items-center justify-center rounded-full bg-orange-soft text-ink">{p.rank}</span>
                다른 자리
              </p>
              <p className="display num mt-4 text-[1.8rem] leading-none 2xl:text-[2.1rem]">{won(p.amount)}</p>
              <p className="mt-3 leading-relaxed text-ink-2">
                평균보다 <b className="text-ink">{times(p.multiple)}</b> 유리
                <br />
                예상 확률 <b className="num text-ink">{pct(p.winProb)}</b>
              </p>
              <div className="mt-auto pt-5">
                <CopyAmount amount={p.amount} tone="ghost" />
              </div>
            </div>
          ))}
        </div>

        {!n.aApplied && (
          <p className="mt-5 rounded-2xl bg-amber-soft p-5 text-lg font-bold leading-relaxed">
            이 공고는 A값이 공개되지 않아 0원으로 계산했습니다. 공고문에 A값이 있으면 위 금액은 하한가에 미달할 수 있으니 반드시
            확인하세요.
          </p>
        )}
      </Panel>

      {/* 근거 그래프와 계산기 */}
      <Reveal>
        <Panel tone="blue" icon={<IconTrend />} title="금액별 유리함" desc="선이 높을수록 그 금액에 썼을 때 낙찰 확률이 높습니다. 그래프를 누르면 그 금액이 오른쪽 계산기에 들어갑니다.">
          <SpotChart curve={n.curve} picks={n.picks} terms={terms} expectedBidders={n.expectedBidders} />
        </Panel>
      </Reveal>

      {/* 계산에 쓴 값 */}
      <Reveal>
        <Panel tone="green" icon={<IconDoc />} title="계산에 쓴 값" desc="아래 값이 공고문과 다르면 추천 금액도 달라집니다. 투찰 전에 A값과 낙찰하한율을 꼭 맞춰 보세요.">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Term tone="bg-blue-soft" label="기초금액" value={won(n.baseAmount)} note={`예비가격 범위 ±${n.width}%`} />
            <Term tone="bg-amber-soft" label="A값" value={won(n.aValue)} note="국민연금·건강보험 등 합산" />
            <Term tone="bg-green-soft" label="낙찰하한율" value={`${n.floorRate}%`} note="공고에 적힌 값" />
            <Term
              tone="bg-violet-soft"
              label="예상 참가"
              value={`약 ${n.expectedBidders}개사`}
              note={n.similar.n ? `조건이 같은 최근 ${n.similar.n}건: ${n.similar.min}~${n.similar.max}개사` : "비슷한 공고가 적어 전체 평균으로 추정"}
            />
          </dl>
          <div className="mt-4 rounded-2xl bg-mist p-5">
            <p className="font-bold text-ink-2">면허 조건</p>
            <p className="mt-1 text-xl font-extrabold">{n.license}</p>
            <p className="mt-3 leading-relaxed text-ink-2">
              추천 1의 겨냥 사정률은 <b className="num text-ink">{rate(top.rate)}</b>입니다. 하한가 = (예정가격 − A값) × 낙찰하한율 + A값
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* 읽는 법 */}
      <Reveal>
        <Panel tone="violet" icon={<IconMethod />} title="왜 이 자리가 유리한가">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-center">
            <p className="text-lg leading-loose text-ink-2">
              낙찰자는 <b className="text-ink">하한가 이상을 쓴 업체 중 가장 낮은 금액</b>입니다. 그래서 추첨으로 정해지는 기준선이{" "}
              <b className="text-ink">내 금액과 내 바로 아래 경쟁사 사이</b>에 떨어져야 내가 낙찰됩니다. 그 사이가 넓게 비어 있을수록
              유리합니다.
            </p>
            <svg viewBox="0 0 520 190" className="w-full rounded-3xl bg-mist p-4" role="img" aria-label="내 금액과 바로 아래 경쟁사 사이에 기준선이 떨어지면 낙찰">
              <rect x="150" y="62" width="190" height="56" rx="10" fill="var(--orange-soft)" />
              <path d="M30 118h460" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
              {[60, 96, 150, 372, 398, 430, 452].map((cx) => (
                <g key={cx}>
                  <path d={`M${cx} 118V84`} stroke="var(--rival)" strokeWidth="2.5" />
                  <circle cx={cx} cy="80" r="8" fill="var(--rival)" />
                </g>
              ))}
              <path d="M340 118V60" stroke="var(--orange)" strokeWidth="3" />
              <circle cx="340" cy="54" r="11" fill="var(--orange)" stroke="#fff" strokeWidth="3" />
              <text x="340" y="32" textAnchor="middle" fontSize="17" fontWeight="800" fill="var(--ink)">내 금액</text>
              <text x="245" y="96" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">여기에 기준선이 떨어지면 낙찰</text>
              <text x="150" y="146" textAnchor="middle" fontSize="15" fill="var(--ink-2)">바로 아래 경쟁사</text>
              <text x="60" y="174" fontSize="15" fill="var(--ink-2)">← 낮은 금액</text>
              <text x="460" y="174" textAnchor="end" fontSize="15" fill="var(--ink-2)">높은 금액 →</text>
            </svg>
          </div>
        </Panel>
      </Reveal>

      {/* 폰에서는 추천 금액을 아래 탭 바로 위에 붙여 둔다 */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-2">추천 투찰금액</p>
            <p className="num truncate text-xl font-extrabold">{won(top.amount)}</p>
          </div>
          <CopyAmount amount={top.amount} label="복사" />
        </div>
      </div>
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-3xl bg-paper" />}>
      <Notice params={params} />
    </Suspense>
  );
}
