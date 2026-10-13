#!/bin/sh
# 서버 시작: ① 볼륨에 DB가 없으면 씨앗 DB를 풀고 ② 자동 갱신을 뒤에서 돌리고 ③ 화면을 띄운다.
set -e

DATA="${BIDMAP_DATA_DIR:-/app/data}"
mkdir -p "$DATA"
if [ ! -f "$DATA/bidmap.sqlite" ]; then
  if [ -f /app/seed/bidmap.sqlite.gz ]; then
    echo "볼륨에 DB가 없어 씨앗 DB를 풉니다"
    python -c "import gzip,shutil,sys; shutil.copyfileobj(gzip.open('/app/seed/bidmap.sqlite.gz'), open(sys.argv[1],'wb'))" "$DATA/bidmap.sqlite"
  else
    echo "DB도 씨앗도 없습니다 — 빈 DB로 시작해 API에서 처음부터 받습니다(하루 한도 때문에 이틀쯤 걸립니다)"
  fi
fi

# 수집·화면 데이터 갱신. 죽어도 화면은 살아 있고, 1분 뒤 다시 뜬다.
( while true; do python -m bidmap schedule || echo "스케줄러가 멈춰 다시 시작합니다"; sleep 60; done ) &

cd web
exec npx next start -H 0.0.0.0 -p "${PORT:-3210}"
