import type { Metadata } from "next";
import { IconCheck, IconResults, IconTarget, IconToday, IconTrend } from "@/components/icons";
import { CountUp, Reveal } from "@/components/motion";
import { PeriodBars } from "@/components/period-bars";
import { ResultsExplorer } from "@/components/results-explorer";
import { Kpi, PageHeader, Panel } from "@/components/ui";
import { getBoard } from "@/lib/data";
import { ymd } from "@/lib/format";

export const metadata: Metadata = { title: "지난 결과" };

export default async function Results() {
  const { backtest: bt, past } = await getBoard();
  const scored = past.filter((p) => p.pickMultiple !== null);
  const won = scored.filter((p) => p.pickWon).length;
  const above = scored.filter((p) => (p.pickMultiple ?? 0) >= 1).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="검증"
        title="지난 결과"
        desc={`개찰이 끝난 공고마다, 그 전날까지의 기록만으로 골랐을 자리를 실제 결과와 맞춰 봅니다. (${ymd(bt.from)} ~ ${ymd(bt.to)})`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-4">
        <Kpi tone="orange" icon={<IconTrend className="size-5" />} label="추천 자리의 유리함" note={`${bt.n}건 기대 낙찰 ${bt.expectedWins.toFixed(1)}건 · 남들 평균 ${bt.averageWins.toFixed(1)}건`} dark>
          평균의 <CountUp value={bt.multiple} kind="times" />
        </Kpi>
        <Kpi tone="orange" icon={<IconTarget className="size-5" />} label="실제로 낙찰이었던 자리" note={`최근 ${scored.length}건 중`}>
          <CountUp value={won} kind="int" />건
        </Kpi>
        <Kpi tone="green" icon={<IconCheck className="size-5" />} label="평균보다 유리했던 공고" note={`최근 ${scored.length}건 중`}>
          <CountUp value={above} kind="int" />건
        </Kpi>
        <Kpi tone="violet" icon={<IconToday className="size-5" />} label="평균보다 불리했던 공고" note="한 건씩은 운이 큽니다">
          <CountUp value={scored.length - above} kind="int" />건
        </Kpi>
      </div>

      <Reveal>
        <Panel tone="blue" icon={<IconResults />} title="반기마다 나눠 봐도 평균을 넘었나" desc="파란 막대가 검은 세로선(남들 평균)보다 길면 그 기간에 유리했다는 뜻입니다.">
          <PeriodBars periods={bt.periods} />
        </Panel>
      </Reveal>

      <Panel tone="violet" icon={<IconToday />} title={`최근 ${scored.length}건`} desc="「그 자리의 결과」는 추천 자리가 남들 평균보다 몇 배 유리했는지입니다. 길게 모아서 봐야 합니다.">
        <ResultsExplorer rows={scored} />
      </Panel>
    </div>
  );
}
