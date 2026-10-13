# 화면(Next.js)과 수집기(Python)를 한 서비스에 담는다.
FROM node:22-bookworm-slim

# 공고의 일시가 전부 한국 시간이라 서버 시계도 맞춘다
ENV TZ=Asia/Seoul \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv tzdata \
 && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install -r requirements.txt
ENV PATH="/opt/venv/bin:$PATH"

# npm ci는 잠금 파일을 만든 npm 버전·운영체제가 다르면(윈도우 npm 11 ↔ 이 이미지의 npm 10) 거절한다.
# 잠금 파일을 기준으로 삼되 부족한 것은 채워 넣는 install을 쓴다.
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm install --no-audit --no-fund

COPY bidmap ./bidmap
COPY seed ./seed
COPY web ./web
COPY build-data.sh start.sh ./

# 화면을 빌드하려면 화면용 데이터가 있어야 한다(build-data.sh).
# 실제 서비스 데이터는 서버가 뜬 뒤 영구 볼륨의 DB에서 스케줄러가 다시 만든다.
RUN sh build-data.sh && cd web && npm run build

CMD ["sh", "start.sh"]
