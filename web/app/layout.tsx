import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/logo";
import { BottomTabs, SideNav } from "@/components/nav-links";
import { TextSize } from "@/components/text-size";
import { getBoard } from "@/lib/data";
import { when } from "@/lib/format";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: "공공 공사 입찰에서 경쟁사가 비워 둔 금액대를 찾아, 금액별 낙찰 확률을 계산합니다.",
  // 아직 로그인 없이 열려 있는 주소다. 검색에 걸려 추천 금액이 퍼지지 않게 막아 둔다.
  robots: { index: false, follow: false },
};

async function Scope() {
  const board = await getBoard();
  return (
    <div className="rounded-2xl bg-white/8 p-4">
      <p className="text-sm font-semibold text-navy-ink">분석 범위</p>
      <p className="mt-1 font-bold leading-snug text-white">
        {board.scope.region}
        <br />
        {board.scope.industry}
      </p>
      <p className="mt-3 text-sm text-navy-ink">자료 {when(board.generatedAt)} 기준</p>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-mist lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* 큰 화면: 왼쪽 고정 메뉴 */}
        <aside className="hidden bg-navy lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-8 lg:overflow-y-auto lg:p-5">
          <Link href="/" className="flex items-center gap-3 px-2 pt-2">
            <LogoMark className="size-11" onDark />
            <span>
              <span className="block text-2xl font-extrabold leading-none tracking-tight text-white">{SITE_NAME}</span>
              <span className="mt-1 block text-sm font-medium text-navy-ink">{SITE_TAGLINE}</span>
            </span>
          </Link>
          <Suspense fallback={<nav className="h-64" />}>
            <SideNav />
          </Suspense>
          <div className="mt-auto flex flex-col gap-4">
            <div>
              <p className="mb-2 px-1 text-sm font-semibold text-navy-ink">글자 크기</p>
              <TextSize onDark />
            </div>
            <Scope />
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          {/* 폰: 위쪽 띠 */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark className="size-9" />
              <span className="text-xl font-extrabold tracking-tight">{SITE_NAME}</span>
            </Link>
            <TextSize />
          </header>

          <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 pb-28 pt-6 md:px-8 md:pt-9 lg:pb-12">{children}</main>

          <footer className="mx-auto w-full max-w-[92rem] px-4 pb-28 text-sm leading-relaxed text-muted md:px-8 lg:pb-8">
            자료: 조달청 나라장터 낙찰정보서비스·입찰공고정보서비스(공공데이터포털). 이 화면의 확률은 과거 투찰 기록으로 계산한
            추정값이며 낙찰을 보장하지 않습니다. 투찰 전에 공고문의 기초금액·A값·낙찰하한율을 반드시 확인하세요.
          </footer>
        </div>

        <Suspense fallback={null}>
          <BottomTabs />
        </Suspense>
      </body>
    </html>
  );
}
