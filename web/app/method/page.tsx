import type { Metadata } from "next";
import { IconCheck, IconMethod, IconStack, IconTarget } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { CompareBars, PageHeader, Panel } from "@/components/ui";
import { getBoard } from "@/lib/data";
import { ymd } from "@/lib/format";

export const metadata: Metadata = { title: "계산 방식" };

const STEP_TONE = ["bg-blue", "bg-violet", "bg-green", "bg-orange"];
const STEP_SOFT = ["bg-blue-soft", "bg-violet-soft", "bg-green-soft", "bg-orange-soft"];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className={`grid grid-cols-[3.5rem_1fr] gap-4 rounded-3xl p-5 md:p-6 ${STEP_SOFT[n - 1]}`}>
      <span className={`num flex size-14 items-center justify-center rounded-2xl text-2xl font-extrabold text-white ${STEP_TONE[n - 1]}`}>{n}</span>
      <div>
        <h3 className="text-xl font-extrabold">{title}</h3>
        <p className="mt-2 text-lg leading-relaxed text-ink-2">{children}</p>
      </div>
    </li>
  );
}

const LIMITS = [
  ["낙찰을 보장하지 않습니다", "참가 업체가 170곳이면 평균 확률은 0.6%입니다. 이 방식은 그 확률을 높일 뿐입니다."],
  ["경쟁사가 움직이면 자리도 바뀝니다", "그래서 최신 개찰 결과를 계속 반영합니다."],
  ["같은 추천을 여럿이 따르면 효과가 줄어듭니다", "그 자리가 붐비게 되기 때문입니다."],
  ["적격심사는 계산에 없습니다", "최저가로 하한선을 넘겨도 적격심사에서 탈락하면 낙찰되지 않습니다."],
  ["조달청 기준 공고는 추천하지 않습니다", "예비가격 범위가 ±2%인 공고는 표본이 적습니다."],
  ["참가 업체가 10곳 이하로 예상되면 추천하지 않습니다", "경쟁사가 서너 곳뿐이면 이 방식이 오히려 불리했습니다(과거 23건에서 평균의 0.4배)."],
  ["A값이 공개되지 않은 공고는 주의하세요", "공고문의 A값이 계산에 쓴 값과 다르면 금액이 하한가에 못 미칠 수 있습니다."],
];

export default async function Method() {
  const { backtest: bt, coverage: cv } = await getBoard();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="계산 방식"
        title="기준선을 맞히지 않습니다. 빈자리를 찾습니다."
        desc="기준선은 매번 새로 하는 추첨이라 맞힐 수 없습니다. 대신 다른 업체들이 어디에 몰려 쓰는지를 보고, 떨어질 확률에 비해 경쟁사가 적은 금액대를 찾습니다."
      />

      <Panel tone="blue" icon={<IconStack />} title="네 단계로 계산합니다">
        <ol className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Step n={1} title="기준선이 어디에 떨어지는지는 공식으로 압니다">
            발주처는 기초금액의 ±3% 안에서 예비가격 15개를 만듭니다. 8개는 기초금액 아래, 7개는 위에 놓이고, 그중 4개가 뽑혀 평균이
            예정가격이 됩니다. 이 규칙으로 계산한 분포는 실제 결과와 통계적으로 구별되지 않습니다.
          </Step>
          <Step n={2} title="모든 투찰금액을 한 눈금 위에 놓습니다">
            하한가 = (예정가격 − A값) × 낙찰하한율 + A값. 이 식을 거꾸로 풀면 공사 규모가 달라도 모든 투찰을 같은 눈금에서 견줄 수
            있습니다.
          </Step>
          <Step n={3} title="자리마다 낙찰 확률을 계산합니다">
            이기려면 기준선이 내 금액과 내 바로 아래 경쟁사 사이에 떨어져야 합니다. 과거 공고마다 이 확률을 자리별로 계산하고, 참가
            규모가 비슷한 공고에 더 무게를 둡니다.
          </Step>
          <Step n={4} title="가장 높은 자리를 금액으로 바꿉니다">
            확률이 가장 높은 자리를 골라, 이번 공고의 기초금액·A값·낙찰하한율에 넣어 투찰금액으로 바꿉니다.
          </Step>
        </ol>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Reveal>
          <Panel
            tone="orange"
            icon={<IconTarget />}
            title={`${bt.n}건 모의시험 결과`}
            desc={`${ymd(bt.from)} ~ ${ymd(bt.to)} 개찰분. 공고마다 그 전날까지의 기록만으로 자리를 고른 뒤 실제 경쟁사 금액으로 채점했습니다. 전부 참가했다면 남들 평균은 ${bt.averageWins.toFixed(1)}건, 추천 자리는 ${bt.expectedWins.toFixed(1)}건 낙찰이 기대됩니다.`}
            className="h-full"
          >
            <CompareBars
              rows={[
                { label: "추천 자리에 썼을 때", value: bt.multiple, tone: "orange", note: `90% 구간 ${bt.ci90[0].toFixed(2)}~${bt.ci90[1].toFixed(2)}배` },
                { label: "남들 평균", value: 1, tone: "mist" },
                { label: "한가운데에 썼을 때", value: bt.centre, tone: "rose", note: "업체가 가장 몰리는 자리(사정률 99.9%)" },
              ]}
            />
          </Panel>
        </Reveal>
        <Reveal delay={100}>
          <Panel tone="green" icon={<IconCheck />} title="계산이 맞는지 확인한 것" className="h-full">
            <ul className="flex flex-col gap-4 text-lg leading-relaxed">
              <li className="rounded-2xl bg-green-soft p-5">
                <b>공식의 정확도 99.4%</b>
                <span className="mt-1 block text-ink-2">
                  하한가 공식으로 계산한 통과·탈락이 공개된 결과와 일치하는 비율입니다(투찰 {cv.bids.toLocaleString("ko-KR")}건). 어긋나는
                  공고는 분석에서 뺐습니다.
                </span>
              </li>
              <li className="rounded-2xl bg-green-soft p-5">
                <b>낙찰 횟수가 아니라 확률로 채점</b>
                <span className="mt-1 block text-ink-2">
                  한 공고의 낙찰 확률은 1% 안팎이라, 낙찰 여부만으로는 실력과 운을 가를 수 없습니다. 실제 경쟁사 금액이 정해지면 자리별
                  확률은 추첨 공식으로 정확히 계산됩니다. 이렇게 계산한 기대 낙찰 수는 실제 추첨으로 센 낙찰 수와 오차 범위 안에서
                  일치했습니다.
                </span>
              </li>
            </ul>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel tone="rose" icon={<IconMethod />} title="알고 쓰셔야 하는 것">
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {LIMITS.map(([title, body]) => (
              <li key={title} className="rounded-2xl bg-rose-soft p-5">
                <h3 className="text-xl font-extrabold">{title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </Reveal>
    </div>
  );
}
