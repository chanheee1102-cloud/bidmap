// `python -m bidmap export`가 만드는 web/data/*.json의 모양.

export type Pick = {
  rank: number;
  rate: number;       // 겨냥 사정률(%)
  amount: number;     // 투찰금액(원)
  multiple: number;   // 참가자 평균 대비 배수(과거 기록 기준 기대값)
  winProb: number;    // 추정 낙찰 확률(0~1)
};

export type Curve = {
  rate: number[];       // x축: 겨냥 사정률(같은 간격)
  multiple: number[];   // 평균 대비 배수
  binStart: number;     // 아래 두 배열의 첫 구간이 시작하는 사정률
  binWidth: number;
  rival: number[];      // 경쟁사 투찰 비중(구간별)
  draw: number[];       // 기준선이 떨어질 확률(구간별)
};

export type Upcoming = {
  id: string;
  name: string;
  agency: string;
  kind: string;
  bidClose: string;
  openAt: string;
  baseAmount: number;
  aValue: number;
  aApplied: boolean;         // 공고가 A값 적용 대상으로 올라왔나(아니면 0으로 계산했다)
  floorRate: number;
  width: number;
  estPrice: number | null;
  expectedBidders: number;
  license: string;           // 면허 조건(사람이 읽는 문장)
  similar: { n: number; min: number | null; max: number | null };   // 조건이 같은 최근 공고의 참가 업체 수
  picks: Pick[];
  curve: Curve;
  detailUrl: string | null;
};

export type Past = {
  id: string;
  name: string;
  agency: string;
  openAt: string;
  bidders: number;
  actualRate: number;        // 실제 사정률
  winAmount: number;
  pickRate: number | null;   // 그날 이 방식이 골랐을 자리
  pickAmount: number | null;
  pickMultiple: number | null;   // 실제 경쟁사 상대로 그 자리의 배수
  pickWon: boolean | null;       // 실제 추첨 결과로 낙찰이었나
};

/** 기초금액이 아직 공개되지 않았거나 추천 대상이 아닌(조달청 기준 등) 공고. */
export type Pending = { id: string; name: string; agency: string; kind: string; bidClose: string; openAt: string; reason: string };

export type BacktestPeriod = { label: string; n: number; multiple: number };

export type Board = {
  generatedAt: string;
  scope: { region: string; industry: string };
  coverage: { notices: number; bids: number; firms: number; from: string; to: string };
  backtest: {
    n: number;
    multiple: number;       // 기대 낙찰 수 ÷ 참가자 평균의 기대 낙찰 수
    ci90: [number, number];
    centre: number;         // 비교: 늘 한가운데에 쓰는 경우
    expectedWins: number;   // 이 n건에 모두 참가했을 때 추천 자리의 기대 낙찰 수
    averageWins: number;    // 같은 조건에서 참가자 평균의 기대 낙찰 수
    from: string;
    to: string;
    periods: BacktestPeriod[];
  };
  upcoming: Upcoming[];
  pending: Pending[];
  past: Past[];
};

export type Firm = {
  name: string;
  bids: number;
  wins: number;
  underFloor: number;     // 하한선 미달 비율(0~1)
  medianRate: number;     // 겨냥 사정률의 중앙값
  spread: number;         // 겨냥 사정률의 사분위 범위
  lastBid: string;
};
