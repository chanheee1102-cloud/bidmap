#!/bin/sh
# 서버 시작: ① 볼륨에 DB가 없으면 씨앗 DB를 풀고 ② 그 DB로 화면 데이터를 만들고
#           ③ 자동 갱신을 뒤에서 돌리고 ④ 화면을 띄운다.
set -e

DATA="${BIDMAP_DATA_DIR:-/app/data}"
PORT="${PORT:-3210}"
mkdir -p "$DATA"

if [ ! -f "$DATA/bidmap.sqlite" ]; then
  if [ -f /app/seed/bidmap.sqlite.gz ]; then
    echo "볼륨에 DB가 없어 씨앗 DB를 풉니다"
    python -c "import gzip,shutil,sys; shutil.copyfileobj(gzip.open('/app/seed/bidmap.sqlite.gz'), open(sys.argv[1],'wb'))" "$DATA/bidmap.sqlite"
  else
    echo "DB도 씨앗도 없습니다 — 빈 DB로 시작해 API에서 처음부터 받습니다(하루 한도 때문에 이틀쯤 걸립니다)"
  fi
fi

# 이미지에 든 화면 데이터는 빌드 시점 것(씨앗 없이 빌드했으면 빈 데이터)이다. 볼륨의 DB로 다시 만든다.
if [ -s "$DATA/bidmap.sqlite" ]; then
  python -m bidmap export > /dev/null && echo "화면 데이터를 볼륨의 DB로 만들었습니다" \
    || echo "화면 데이터 만들기 실패 — 빌드 때의 데이터로 시작합니다"
fi

# 수집·화면 데이터 갱신. 죽어도 화면은 살아 있다. 다시 띄우기 전에 15분 쉰다 —
# 바로 다시 띄우면, 같은 이유로 계속 죽는 경우 API를 분당 몇 번씩 헛되이 부르게 된다(실제로 그랬다).
( while true; do python -m bidmap schedule || echo "스케줄러가 멈췄습니다. 15분 뒤 다시 시작합니다"; sleep 900; done ) &

# 빌드 때 구워 둔 페이지가 빌드 시점의 데이터를 담고 있다. 서버가 뜨면 한 번씩 불러 새 데이터로 다시 굽게 한다.
( sleep 10
  for round in 1 2; do
    for path in / /results /firms /method; do
      node -e "fetch('http://127.0.0.1:$PORT$path').catch(() => {})"
    done
    sleep 5
  done ) &

cd web
exec npx next start -H 0.0.0.0 -p "$PORT"
