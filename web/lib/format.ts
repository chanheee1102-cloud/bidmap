export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 1억 2,345만 원처럼 읽기 쉬운 단위로. 정확한 금액이 필요한 곳에는 won()을 쓴다. */
export function wonShort(n: number): string {
  const eok = Math.floor(n / 1e8);
  const man = Math.round((n % 1e8) / 1e4);
  if (eok && man) return `${eok}억 ${man.toLocaleString("ko-KR")}만 원`;
  if (eok) return `${eok}억 원`;
  return `${man.toLocaleString("ko-KR")}만 원`;
}

export const pct = (ratio: number, digits = 2) => `${(ratio * 100).toFixed(digits)}%`;
export const rate = (r: number) => `${r.toFixed(3)}%`;
export const times = (m: number) => `${m.toFixed(2)}배`;

const DAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-14 10:00:00" → "10/14(수) 10:00". 응답의 시각은 전부 한국 시간이다. */
export function when(s: string): string {
  const [d, t = ""] = s.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const dow = DAY[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}/${day}(${dow})${t ? ` ${t.slice(0, 5)}` : ""}`;
}

export const ymd = (s: string) => s.slice(0, 10).replaceAll("-", ".");
