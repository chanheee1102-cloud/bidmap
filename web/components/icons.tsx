// 메뉴·패널 머리에 쓰는 선 아이콘. 24칸 격자, 굵기 1.9.
type Props = { className?: string };

function Svg({ className = "size-6", children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const IconToday = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8.5 15l2.3 2.3 4.7-4.8" />
  </Svg>
);
export const IconResults = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20h16M7 20v-7M12 20V5M17 20v-10" />
  </Svg>
);
export const IconFirms = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 5.6a3.2 3.2 0 0 1 0 5.8M17.8 14.8c1.7.7 2.8 2.300 3.2 4.7" />
  </Svg>
);
export const IconMethod = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.6a2.5 2.5 0 1 1 3.600 2.300c-.8.5-1.200 1-1.200 1.900M12 17h.01" />
  </Svg>
);
export const IconClock = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.500V12l3 2" />
  </Svg>
);
export const IconDoc = (p: Props) => (
  <Svg {...p}>
    <path d="M7 3.500h7l4 4V19a1.500 1.500 0 0 1-1.500 1.500h-9.500A1.500 1.500 0 0 1 5.500 19V5A1.500 1.500 0 0 1 7 3.500z" />
    <path d="M14 3.500V8h4M9 12.500h6M9 16h4" />
  </Svg>
);
export const IconTrend = (p: Props) => (
  <Svg {...p}>
    <path d="M4 16.500l5-5 3.500 3.500L20 7.500M15 7.500h5v5" />
  </Svg>
);
export const IconStack = (p: Props) => (
  <Svg {...p}>
    <path d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />
  </Svg>
);
export const IconTarget = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.500" />
    <circle cx="12" cy="12" r="4.500" />
    <circle cx="12" cy="12" r="0.800" fill="currentColor" />
  </Svg>
);
export const IconCheck = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.500" />
    <path d="M8.300 12.300l2.600 2.600 4.900-5.200" />
  </Svg>
);
export const IconArrow = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconBack = (p: Props) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
