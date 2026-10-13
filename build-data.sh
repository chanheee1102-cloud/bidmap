#!/bin/sh
# 이미지 빌드 중에 화면용 데이터(web/data/*.json)를 만든다.
# 씨앗 DB가 있으면 그것으로 만들고, 없으면(공개 저장소에는 넣지 않는다) 빈 데이터로 빌드한다.
set -e

if [ -f seed/bidmap.sqlite.gz ]; then
  mkdir -p data
  python -c "import gzip,shutil; shutil.copyfileobj(gzip.open('seed/bidmap.sqlite.gz'), open('data/bidmap.sqlite','wb'))"
  python -m bidmap export > /dev/null
  rm -f data/bidmap.sqlite
else
  echo "씨앗 DB가 없어 빈 데이터로 빌드합니다"
  python -m bidmap placeholder
fi
