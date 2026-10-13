// 낙찰하한가 계산. bidmap/rules.py와 같은 식이다 — 한쪽을 고치면 다른 쪽도 고친다.
//   하한가 = (예정가격 − A값) × 낙찰하한율 + A값

export type Terms = { baseAmount: number; floorRate: number; aValue: number };

/** 사정률 s%를 겨냥한 투찰금액(하한가 미만이 되지 않게 원 단위 올림). */
export function bidForRate(s: number, t: Terms): number {
  return Math.ceil((((t.baseAmount * s) / 100 - t.aValue) * t.floorRate) / 100 + t.aValue);
}

/** 이 투찰금액이 딱 하한가가 되는 사정률(%). */
export function matchedRate(bid: number, t: Terms): number {
  return (((bid - t.aValue) / (t.floorRate / 100) + t.aValue) / t.baseAmount) * 100;
}
