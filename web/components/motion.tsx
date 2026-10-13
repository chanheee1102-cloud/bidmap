"use client";

import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 서버 컴포넌트에서 함수를 넘길 수 없어, 표기 방식은 이름으로 받는다
const FORMATS = {
  won: (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`,
  int: (n: number) => Math.round(n).toLocaleString("ko-KR"),
  one: (n: number) => n.toFixed(1),
  times: (n: number) => `${n.toFixed(2)}배`,
};

/** 숫자가 0에서 올라온다. 서버에서는 최종값을 그려 두므로 스크립트가 없어도 값은 보인다. */
export function CountUp({ value, kind, duration = 1100 }: { value: number; kind: keyof typeof FORMATS; duration?: number }) {
  const format = FORMATS[kind];
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setShown(value * (1 - Math.pow(1 - t, 4)));     // 끝에서 천천히 멈춘다
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        setShown(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="num">
      {format(shown)}
    </span>
  );
}

/** 화면에 들어올 때 한 번 떠오른다. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-shown={shown} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const two = (n: number) => String(n).padStart(2, "0");

/** 한국 시간 문자열("2026-10-14 10:00:00")까지 남은 시간. */
function useRemaining(until: string): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const target = new Date(`${until.replace(" ", "T")}+09:00`).getTime();
    const update = () => setLeft(target - Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [until]);
  return left;
}

/** 큰 시계: 09:41:12 */
export function CountdownClock({ until }: { until: string }) {
  const left = useRemaining(until);
  if (left === null) return <span className="num">--:--:--</span>;
  if (left <= 0) return <span>마감</span>;
  const p = parts(left);
  return (
    <span className="num">
      {p.d > 0 && `${p.d}일 `}
      {two(p.h)}:{two(p.m)}:{two(p.s)}
    </span>
  );
}

/** 작은 글: 9시간 41분 남음 */
export function CountdownText({ until }: { until: string }) {
  const left = useRemaining(until);
  if (left === null) return null;
  if (left <= 0) return <span>투찰 마감</span>;
  const p = parts(left);
  return (
    <span className="num">
      {p.d > 0 ? `${p.d}일 ${p.h}시간` : p.h > 0 ? `${p.h}시간 ${p.m}분` : `${p.m}분 ${two(p.s)}초`} 남음
    </span>
  );
}
