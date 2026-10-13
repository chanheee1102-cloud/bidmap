"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconFirms, IconMethod, IconResults, IconToday } from "@/components/icons";

const LINKS = [
  { href: "/", label: "오늘의 입찰", short: "오늘 입찰", Icon: IconToday },
  { href: "/results", label: "지난 결과", short: "지난 결과", Icon: IconResults },
  { href: "/firms", label: "경쟁 업체", short: "경쟁 업체", Icon: IconFirms },
  { href: "/method", label: "계산 방식", short: "계산 방식", Icon: IconMethod },
];

const isActive = (href: string, path: string) => (href === "/" ? path === "/" || path.startsWith("/notice") : path.startsWith(href));

/** 왼쪽 고정 메뉴(큰 화면). */
export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1.5">
      {LINKS.map(({ href, label, Icon }) => {
        const active = isActive(href, path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-14 items-center gap-3.5 rounded-2xl px-4 text-lg font-bold transition-colors ${
              active ? "bg-white/12 text-white" : "text-navy-ink hover:bg-white/6 hover:text-white"
            }`}
          >
            <span className={`absolute left-0 top-3 h-8 w-1.5 rounded-r-full bg-orange-bright transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
            <Icon className={`size-6 ${active ? "text-orange-bright" : ""}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 화면 아래 탭(폰). 엄지로 누르기 쉽게 크게. */
export function BottomTabs() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      {LINKS.map(({ href, short, Icon }) => {
        const active = isActive(href, path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.8rem] font-bold ${active ? "text-orange-ink" : "text-ink-2"}`}
          >
            <Icon className="size-6" />
            {short}
          </Link>
        );
      })}
    </nav>
  );
}
