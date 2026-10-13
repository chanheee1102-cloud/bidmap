import type { Metadata } from "next";
import { FirmTable } from "@/components/firm-table";
import { IconFirms } from "@/components/icons";
import { PageHeader, Panel } from "@/components/ui";
import { getFirms } from "@/lib/data";

export const metadata: Metadata = { title: "경쟁 업체" };

export default async function Firms() {
  const firms = await getFirms();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="경쟁 업체"
        title="업체마다 쓰는 자리가 있습니다"
        desc={`최근 2년 동안 많이 참여한 업체 ${firms.length}곳이 주로 어느 금액대에 쓰는지 보여 줍니다.`}
      />
      <Panel
        tone="violet"
        icon={<IconFirms />}
        title="업체별 투찰 습관"
        desc="보라색 띠가 그 업체가 주로 쓰는 범위, 점이 한가운데 값입니다. 띠가 좁을수록 늘 비슷한 자리에 씁니다."
      >
        <FirmTable firms={firms} />
      </Panel>
    </div>
  );
}
