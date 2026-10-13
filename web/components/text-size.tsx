"use client";

import { useEffect, useSyncExternalStore } from "react";

// 화면 전체가 rem으로 짜여 있어, 기본 글자 크기만 바꾸면 모든 글씨와 간격이 함께 커진다.
const SIZES = [
  { key: "normal", px: 18, label: "보통", glyph: "text-base" },
  { key: "large", px: 20, label: "크게", glyph: "text-xl" },
  { key: "xlarge", px: 22.5, label: "아주 크게", glyph: "text-2xl" },
] as const;
const STORE = "bidmap:text-size";
const CHANGED = "bidmap:text-size-changed";

// 고른 크기는 브라우저에 저장해 두고, 화면의 두 군데(왼쪽 메뉴·폰 머리)가 같은 값을 본다
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}
const read = () => localStorage.getItem(STORE) ?? "normal";

export function TextSize({ onDark = false }: { onDark?: boolean }) {
  const key = useSyncExternalStore(subscribe, read, () => "normal");

  useEffect(() => {
    const size = SIZES.find((s) => s.key === key) ?? SIZES[0];
    document.documentElement.style.setProperty("font-size", `${size.px}px`);
  }, [key]);

  return (
    <div role="group" aria-label="글자 크기" className={`inline-flex items-center gap-1 rounded-2xl p-1 ${onDark ? "bg-white/10" : "bg-mist"}`}>
      {SIZES.map((s) => {
        const active = s.key === key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              localStorage.setItem(STORE, s.key);
              window.dispatchEvent(new Event(CHANGED));
            }}
            aria-pressed={active}
            title={`글자 ${s.label}`}
            className={`flex size-11 items-center justify-center rounded-xl font-extrabold leading-none transition-colors ${s.glyph} ${
              active ? "bg-orange text-white" : onDark ? "text-navy-ink hover:text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            가<span className="sr-only"> {s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
