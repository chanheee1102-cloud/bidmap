import { CountUp } from "@/components/motion";

const SOFT = {
  blue: "bg-blue-soft",
  orange: "bg-orange-soft",
  violet: "bg-violet-soft",
  green: "bg-green-soft",
  amber: "bg-amber-soft",
  rose: "bg-rose-soft",
  mist: "bg-mist",
} as const;
const SOLID = {
  blue: "bg-blue",
  orange: "bg-orange",
  violet: "bg-violet",
  green: "bg-green",
  amber: "bg-amber",
  rose: "bg-rose",
  mist: "bg-muted",
} as const;
export type Tone = keyof typeof SOFT;

/** 화면 맨 위 제목 줄. */
export function PageHeader({ eyebrow, title, desc, children }: { eyebrow?: string; title: React.ReactNode; desc?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rise flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="font-bold text-orange-ink">{eyebrow}</p>}
        <h1 className="display mt-1 text-[2rem] leading-tight md:text-[2.6rem]">{title}</h1>
        {desc && <p className="mt-2 max-w-3xl text-lg leading-relaxed text-ink-2">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

/** 대시보드의 흰 패널. 머리에 색 아이콘과 제목이 붙는다 — 색으로 패널의 종류를 가른다. */
export function Panel({
  tone, icon, title, desc, action, children, className = "",
}: {
  tone: Tone; icon: React.ReactNode; title: React.ReactNode; desc?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-3xl bg-paper p-4 shadow-[0_1px_2px_rgb(11_22_56/0.06),0_8px_24px_-12px_rgb(11_22_56/0.12)] md:p-7 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-white ${SOLID[tone]}`}>{icon}</span>
          <div className="min-w-0">
            <h2 className="text-[1.45rem] font-extrabold leading-tight tracking-tight">{title}</h2>
            {desc && <p className="mt-1 leading-relaxed text-ink-2">{desc}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** 맨 윗줄의 핵심 수치 타일. 폰에서는 한 줄(이름 왼쪽·값 오른쪽)로 눕혀 세로 공간을 아낀다. */
export function Kpi({ tone, icon, label, children, note, dark = false }: { tone: Tone; icon: React.ReactNode; label: string; children: React.ReactNode; note?: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`lift flex min-w-0 items-center justify-between gap-3 rounded-3xl p-4 sm:flex-col sm:items-stretch sm:justify-start sm:p-6 ${
        dark ? "bg-navy text-white" : SOFT[tone]
      }`}
    >
      <p className={`flex min-w-0 items-center gap-2.5 font-bold ${dark ? "text-navy-ink" : "text-ink-2"}`}>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-white ${SOLID[tone]}`}>{icon}</span>
        {label}
      </p>
      <div className="shrink-0 text-right sm:text-left">
        <p className="display whitespace-nowrap text-[1.55rem] leading-none sm:mt-4 sm:text-[2rem] md:text-[2.5rem]">{children}</p>
        {note && <p className={`mt-2.5 hidden text-[0.95rem] font-medium sm:block ${dark ? "text-navy-ink" : "text-ink-2"}`}>{note}</p>}
      </div>
    </div>
  );
}

/** 색 바탕의 짧은 꼬리표. 글자는 늘 잉크색 — 색은 바탕과 점이 맡는다. */
export function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-bold text-ink ${SOFT[tone]}`}>
      <span className={`size-2 rounded-full ${SOLID[tone]}`} />
      {children}
    </span>
  );
}

export function Fact({ tone, label, children }: { tone: Tone; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-2 font-semibold text-ink-2">
        <span className={`size-2.5 rounded-full ${SOLID[tone]}`} />
        {label}
      </dt>
      <dd className="mt-1 text-xl font-extrabold leading-snug">{children}</dd>
    </div>
  );
}

/** 큰 숫자 하나를 담는 색 타일. */
export function FactTile({ tone, label, value, unit, text, kind = "int" }: { tone: Tone; label: string; value?: number; unit?: string; text?: string; kind?: "int" | "one" }) {
  return (
    <div className={`flex min-w-0 flex-col justify-between rounded-2xl p-5 ${SOFT[tone]}`}>
      <p className="flex items-center gap-2 font-bold text-ink-2">
        <span className={`size-2.5 rounded-full ${SOLID[tone]}`} />
        {label}
      </p>
      <p className="display mt-4 truncate text-3xl md:text-4xl">
        {value !== undefined ? <CountUp value={value} kind={kind} /> : text}
        {unit && <span className="ml-1 text-xl font-bold text-ink-2">{unit}</span>}
      </p>
    </div>
  );
}

/** 배수 비교 막대. 구역이 화면에 들어오면 왼쪽에서 자란다(.reveal 안에서 써야 한다). */
export function CompareBars({ rows }: { rows: { label: string; value: number; tone: Tone; note?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value)) * 1.04;
  return (
    <div className="flex flex-col gap-6">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-bold">{r.label}</span>
            <span className="num text-2xl font-extrabold">{r.value.toFixed(2)}배</span>
          </div>
          <div className="mt-2 h-6 overflow-hidden rounded-full bg-mist">
            <div
              className={`bar-x h-full rounded-full ${SOLID[r.tone]}`}
              style={{ width: `${(r.value / max) * 100}%`, transitionDelay: `${200 + i * 160}ms` }}
            />
          </div>
          {r.note && <p className="mt-1.5 text-ink-2">{r.note}</p>}
        </div>
      ))}
    </div>
  );
}
