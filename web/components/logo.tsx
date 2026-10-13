/** 눈금자 위에 찍힌 자리 하나 — 이 서비스가 하는 일 그대로. */
export function LogoMark({ className = "size-8", onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill={onDark ? "var(--navy-2)" : "var(--navy)"} stroke={onDark ? "var(--navy-line)" : "none"} />
      <path d="M6 22h20" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      {[8, 12, 16, 20, 24].map((x) => (
        <path key={x} d={`M${x} 22v${x === 16 ? -5 : -3}`} stroke="#fff" strokeOpacity={x === 16 ? 1 : 0.55} strokeWidth="1.6" strokeLinecap="round" />
      ))}
      <circle cx="12" cy="11.5" r="3.4" fill="var(--orange-bright)" />
    </svg>
  );
}
