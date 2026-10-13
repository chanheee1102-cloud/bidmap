"""경로와 환경변수. 인증키는 .env에서만 읽고 코드·로그·DB 어디에도 남기지 않는다."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 서버에서는 영구 볼륨을 가리키게 한다(BIDMAP_DATA_DIR=/data). 없으면 프로젝트 안의 data/
DATA_DIR = Path(os.environ.get("BIDMAP_DATA_DIR") or ROOT / "data")
DB_PATH = DATA_DIR / "bidmap.sqlite"

# 옛 버전(bid-analysis-app)이 모아 둔 CSV. 같은 API의 응답이라 그대로 씨앗 데이터로 쓴다.
LEGACY_DIR = ROOT.parent / "bid-analysis-app"

# 지금 다루는 범위: 대전 지역제한 × 상하수도설비공사업
REGION_CD = "30"
INDUSTRY_CD = "4996"


def _load_dotenv(path: Path) -> None:
    """KEY=VALUE 줄만 읽는다. 이미 환경변수에 있으면 건드리지 않는다."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def service_key() -> str:
    _load_dotenv(ROOT / ".env")
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if not key:
        raise RuntimeError("DATA_GO_KR_KEY가 비어 있습니다 — .env에 공공데이터포털 인증키를 넣어 주세요.")
    return key
