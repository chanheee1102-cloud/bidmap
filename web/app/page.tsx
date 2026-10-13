import Link from "next/link";
import { CopyAmount } from "@/components/copy-amount";
import { IconArrow, IconCheck, IconClock, IconDoc, IconResults, IconStack, IconTarget, IconToday, IconTrend } from "@/components/icons";
import { CountdownClock, CountdownText, CountUp, Reveal } from "@/components/motion";
import { PickRuler } from "@/components/pick-ruler";
import { CompareBars, Fact, Kpi, PageHeader, Panel } from "@/components/ui";
import { getBoard } from "@/lib/data";
import { pct, times, when, won, wonShort, ymd } from "@/lib/format";
import type { Past, Upcoming } from "@/lib/types";

/** 공고 한 건: 왼쪽에 무엇을·언제까지, 가운데에 얼마를, 오른쪽에 왜. */
function NoticeRow({ n, index }: { n: Upcoming; index: number }) {
  const top = n.picks[0];
  return (
    <article className="rise rounded-3xl border-2 border-line p-4 transition-colors hover:border-orange md:p-6" style={{ animationDelay: `${120 + index * 110}ms` }}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.15fr_1fr] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-orange px-4 py-1.5 font-extrabold text-white">{when(n.bidClose)} 마감</span>
            <span className="rounded-full bg-mist px-4 py-1.5 font-bold text-ink-2">
              <CountdownText until={n.bidClose} />
            </span>
          </div>
          <h3 className="mt-4 text-[1.35rem] font-extrabold leading-snug tracking-tight md:text-2xl">{n.name}</h3>
          <p className="mt-1 font-semibold text-ink-2">{n.agency}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
            <Fact tone="blue" label="기초금액">{wonShort(n.baseAmount)}</Fact>
            <Fact tone="violet" label="예상 참가">약 {n.expectedBidders}개사</Fact>
          </dl>
        </div>

        <div className="min-w-0 rounded-3xl bg-sand p-4 md:p-6">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <span className="size-3 rounded-full bg-orange" />
            추천 투찰금액
          </p>
          {/* 복사해서 쓰는 금액이라 숫자가 올라가는 모션을 주지 않는다(도중의 틀린 값을 읽을 수 있다) */}
          <p className="display num mt-2 text-[1.85rem] leading-none sm:text-[2.6rem] 2xl:text-[3rem]">{won(top.amount)}</p>
          <p className="mt-3 text-lg leading-relaxed text-ink-2">
            남들 평균보다 <b className="text-orange-ink">{times(top.multiple)}</b> 유리한 자리입니다.
            <span className="block text-base">예상 낙찰 확률 {pct(top.winProb)}</span>
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <CopyAmount amount={top.amount} />
            <Link
              href={`/notice/${n.id}`}
              className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-ink/15 bg-paper px-5 text-lg font-extrabold transition-colors hover:border-ink sm:flex-1"
            >
              자세히 보기
              <IconArrow className="size-5" />
            </Link>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-1 font-bold text-ink-2">왜 이 금액인가</p>
          <PickRuler curve={n.curve} picks={n.picks} />
        </div>
      </div>
    </article>
  );
}

function PastLine({ p }: { p: Past }) {
  const good = (p.pickMultiple ?? 0) >= 1;
  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-lg font-bold">{p.name}</p>
        <p className="num text-ink-2">
          {ymd(p.openAt)} · 참가 {p.bidders}개사
        </p>
      </div>
      {p.pickMultiple !== null && (
        <span
          className={`num shrink-0 rounded-full px-4 py-1.5 text-lg font-extrabold ${
            p.pickWon ? "bg-orange text-white" : good ? "bg-green-soft" : "bg-mist text-ink-2"
          }`}
        >
          {p.pickWon ? "낙찰 자리" : times(p.pickMultiple)}
        </span>
      )}
    </li>
  );
}

const STEPS = [
  ["금액 확인", "공고마다 주황색으로 표시된 「추천 투찰금액」을 봅니다."],
  ["금액 복사", "「금액 복사」 단추를 누르면 숫자만 복사됩니다."],
  ["나라장터에 붙여넣기", "나라장터 투찰 화면의 금액 칸에 붙여넣습니다."],
];

export default async function Home() {
  const board = await getBoard();
  const { backtest: bt, coverage: cv } = board;
  const next = board.upcoming[0]?.bidClose ?? board.pending[0]?.bidClose;
  const years = Math.round(((Date.parse(cv.to.slice(0, 10)) - Date.parse(cv.from.slice(0, 10))) / (365.25 * 86400e3)) * 10) / 10;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${board.scope.region} · ${board.scope.industry}`}
        title="오늘의 입찰"
        desc="마감 전 공고마다, 경쟁 업체가 비워 둔 금액대를 찾아 추천 투찰금액을 계산해 두었습니다."
      />

      {/* 핵심 수치 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-4">
        <Kpi tone="orange" icon={<IconDoc className="size-5" />} label="마감 전 공고" note="아래에서 금액을 확인하세요">
          <CountUp value={board.upcoming.length} kind="int" />건
        </Kpi>
        <Kpi tone="orange" icon={<IconClock className="size-5" />} label="가장 가까운 마감까지" note={next ? `${when(next)} 마감` : "예정된 마감 없음"} dark>
          {next ? <CountdownClock until={next} /> : "—"}
        </Kpi>
        <Kpi tone="blue" icon={<IconTrend className="size-5" />} label="추천 자리의 유리함" note={`과거 ${bt.n}건의 기대 낙찰 수 기준`}>
          평균의 <CountUp value={bt.multiple} kind="times" />
        </Kpi>
        <Kpi tone="violet" icon={<IconStack className="size-5" />} label="분석한 투찰 기록" note={`업체 ${cv.firms.toLocaleString("ko-KR")}곳 · ${years}년치`}>
          <CountUp value={cv.bids} kind="int" />건
        </Kpi>
      </div>

      {/* 지금 투찰할 공고 */}
      <Panel
        tone="orange"
        icon={<IconToday />}
        title="지금 투찰할 공고"
        desc="주황색 금액이 추천 투찰금액입니다. 「금액 복사」를 눌러 나라장터에 붙여넣으세요."
      >
        {board.upcoming.length ? (
          <div className="flex flex-col gap-5">
            {board.upcoming.map((n, i) => (
              <NoticeRow key={n.id} n={n} index={i} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-mist p-8 text-xl font-bold text-ink-2">
            지금 투찰을 받는 공고가 없습니다. 새 공고가 올라오면 여기에 나타납니다.
          </p>
        )}
        {board.pending.length > 0 && (
          <div className="mt-5 rounded-2xl bg-mist p-5">
            <p className="font-bold text-ink-2">추천하지 않는 공고 {board.pending.length}건</p>
            <ul className="mt-2 flex flex-col gap-2">
              {board.pending.map((p) => (
                <li key={p.id} className="flex flex-col md:flex-row md:items-baseline md:justify-between md:gap-4">
                  <span className="min-w-0 truncate text-lg font-bold">{p.name}</span>
                  <span className="shrink-0 text-ink-2">
                    {p.reason} · {when(p.bidClose)} 마감
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* 쓰는 순서 */}
      <Reveal>
        <Panel tone="green" icon={<IconCheck />} title="이렇게 쓰시면 됩니다">
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex items-start gap-4 rounded-2xl bg-green-soft p-5">
                <span className="num flex size-12 shrink-0 items-center justify-center rounded-full bg-green text-2xl font-extrabold text-white">{i + 1}</span>
                <div>
                  <p className="text-xl font-extrabold">{title}</p>
                  <p className="mt-1 leading-relaxed text-ink-2">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 검증 */}
        <Reveal>
          <Panel
            tone="blue"
            icon={<IconTarget />}
            title="이 계산을 얼마나 믿을 수 있나"
            desc={`${ymd(bt.from).slice(0, 7)}부터 개찰된 ${bt.n}건에 모두 참가했다고 치고, 공고마다 그 전날까지의 기록만으로 자리를 골라 실제 결과와 맞춰 봤습니다.`}
            action={
              <Link href="/method" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border-2 border-line px-4 font-bold transition-colors hover:border-ink">
                계산 방식 <IconArrow className="size-5" />
              </Link>
            }
            className="h-full"
          >
            <CompareBars
              rows={[
                { label: "추천 자리에 썼을 때", value: bt.multiple, tone: "orange", note: `90% 구간 ${bt.ci90[0].toFixed(2)}~${bt.ci90[1].toFixed(2)}배` },
                { label: "남들 평균", value: 1, tone: "mist" },
                { label: "한가운데에 썼을 때", value: bt.centre, tone: "rose", note: "업체가 가장 몰리는 자리" },
              ]}
            />
            <p className="mt-6 rounded-2xl bg-blue-soft p-4 text-lg font-semibold leading-relaxed">
              {bt.n}건에 모두 참가했다면 남들 평균은 <b>{bt.averageWins.toFixed(1)}건</b>, 추천 자리는{" "}
              <b>{bt.expectedWins.toFixed(1)}건</b> 낙찰이 기대됩니다. 낙찰을 맞히는 방식이 아니라 확률을 높이는 방식입니다.
            </p>
          </Panel>
        </Reveal>

        {/* 최근 개찰 */}
        <Reveal delay={100}>
          <Panel
            tone="violet"
            icon={<IconResults />}
            title="최근 개찰 결과"
            desc="그날의 추천 자리가 남들 평균보다 몇 배 유리했는지입니다."
            action={
              <Link href="/results" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border-2 border-line px-4 font-bold transition-colors hover:border-ink">
                전체 보기 <IconArrow className="size-5" />
              </Link>
            }
            className="h-full"
          >
            <ul className="divide-y divide-line">
              {board.past.filter((p) => p.pickMultiple !== null).slice(0, 6).map((p) => (
                <PastLine key={p.id} p={p} />
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
