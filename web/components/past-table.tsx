import { rate, times, won, ymd } from "@/lib/format";
import type { Past } from "@/lib/types";

function Result({ p }: { p: Past }) {
  if (p.pickMultiple === null) return <span className="text-muted">—</span>;
  const tone = p.pickWon ? "bg-orange text-white" : p.pickMultiple >= 1 ? "bg-green-soft text-ink" : "bg-mist text-ink-2";
  return (
    <span className={`num inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${tone}`}>
      {p.pickWon && "낙찰 자리 · "}
      {times(p.pickMultiple)}
    </span>
  );
}

/** 개찰이 끝난 공고와, 그날 이 방식이 골랐을 자리가 실제로 어땠는지. */
export function PastTable({ rows }: { rows: Past[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
      <table className="w-full min-w-[820px] text-left">
        <thead className="text-sm text-muted">
          <tr className="border-b border-line">
            <th className="px-6 py-4 font-semibold">개찰일</th>
            <th className="px-3 py-4 font-semibold">공고</th>
            <th className="px-3 py-4 text-right font-semibold">참가</th>
            <th className="px-3 py-4 text-right font-semibold">실제 사정률</th>
            <th className="px-3 py-4 text-right font-semibold">낙찰금액</th>
            <th className="px-3 py-4 text-right font-semibold">추천 자리</th>
            <th className="px-6 py-4 text-right font-semibold">그 자리의 결과</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-line transition-colors last:border-0 hover:bg-mist/60">
              <td className="num whitespace-nowrap px-6 py-4 text-ink-2">{ymd(p.openAt)}</td>
              <td className="max-w-[340px] px-3 py-4">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-sm text-muted">{p.agency}</div>
              </td>
              <td className="num px-3 py-4 text-right">{p.bidders}</td>
              <td className="num px-3 py-4 text-right">{rate(p.actualRate)}</td>
              <td className="num whitespace-nowrap px-3 py-4 text-right">{won(p.winAmount)}</td>
              <td className="num px-3 py-4 text-right">{p.pickRate === null ? "—" : rate(p.pickRate)}</td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                <Result p={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
