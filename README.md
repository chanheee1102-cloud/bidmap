# bidmap (임시 이름)

공공 공사 입찰에서 「이 금액을 쓰면 낙찰 확률이 남들 평균의 몇 배인가」를 계산하고, 가장 유리한 금액을 추천한다.
지금 범위는 대전 지역제한 × 상하수도설비공사업(업종 4996).

기준선(예정가격)은 추첨이라 맞힐 수 없다. 대신 다른 업체들이 과거에 써낸 금액을 모아, 떨어질 확률에 비해
경쟁사가 적은 금액대를 찾는다.

## 내 컴퓨터에서 쓰기

```
python -m bidmap daily        # 새 자료를 받고 화면용 데이터를 다시 만든다
cd web && npm run dev         # 화면: http://localhost:3210
```

처음 한 번:

1. `.env`의 `DATA_GO_KR_KEY=` 뒤에 공공데이터포털 인증키(낙찰정보서비스·입찰공고정보서비스 공용)
2. `pip install -r requirements.txt`, `cd web && npm install`
3. DB가 없으면 `python -m bidmap collect`(조달청 API 하루 한도 때문에 4년치를 처음부터 받으면 이틀쯤 걸린다)

## 서버(Railway)

서비스 하나에 화면(Next.js)과 수집기(Python)가 같이 뜬다(`Dockerfile`, `start.sh`).

- DB는 영구 볼륨(`/data`)에 둔다. 처음 뜰 때 볼륨이 비어 있으면 `seed/bidmap.sqlite.gz`를 푼다.
- 자동 갱신: `python -m bidmap schedule`이 한국 시간 06~20시 매시 5분에 수집 → 화면 데이터 생성을 돈다.
- 화면은 1분마다 새 데이터를 읽는다.

환경변수:

| 이름 | 값 |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 인증키 |
| `BIDMAP_DATA_DIR` | `/data` (볼륨을 붙인 경로) |

씨앗 DB는 용량과 공개 범위 때문에 git에 올리지 않는다. 볼륨이 빈 서버에 처음 올릴 때는 이 컴퓨터에서
`python -m bidmap snapshot`으로 만든 뒤 `railway up --no-gitignore`로 올린다(`.railwayignore`가 올릴 것을 가린다).
볼륨에 DB가 생긴 뒤로는 씨앗 없이(=git 저장소에서 바로) 배포해도 된다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `daily` | `collect` + `export` |
| `collect` | 공고·낙찰·예비가격·업체별 투찰·기초금액·면허제한을 받는다(새로 생긴 것만) |
| `export` | 화면용 JSON을 만든다(`web/data/board.json`, `firms.json`) |
| `schedule` | 서버용. 떠 있으면서 정해진 시각마다 `daily`를 돈다 |
| `snapshot` | 서버에 실어 보낼 씨앗 DB를 만든다 |
| `validate` | 추첨 모형·하한가 규칙이 실제 데이터와 맞는지 확인 |
| `status` | 표별 건수, 오늘 쓴 API 호출 수 |
| `reparse` | 저장해 둔 응답 원문으로 표를 다시 만든다(API를 부르지 않는다) |
| `probe <서비스> <오퍼레이션> 키=값…` | API를 한 번 불러 응답 모양을 본다 |
| `python -m unittest discover -s tests` | 단위 테스트 |

## 구조

| 파일 | 하는 일 |
|---|---|
| `bidmap/g2b.py` | 조달청 API 호출. 응답 원문 보관(개인정보성 항목은 지우고), 하루 한도(오퍼레이션당 1,000건) 관리 |
| `bidmap/collect.py` | 무엇을 어떤 순서로 받을지 |
| `bidmap/db.py` | SQLite 표 정의 |
| `bidmap/draw.py` | 복수예비가격 추첨 모형 — 기준선이 떨어질 위치의 분포 |
| `bidmap/rules.py` | 낙찰하한가 계산, 투찰금액 ↔ 맞춘 사정률 변환 |
| `bidmap/model.py` | 과거 투찰을 한 눈금에 놓고 자리별 낙찰 확률을 계산 |
| `bidmap/backtest.py` | 모의시험 — 그날 알 수 있던 정보만으로 골랐다면 어땠나 |
| `bidmap/export.py` | 추천 금액과 화면용 데이터 만들기 |
| `bidmap/scheduler.py` | 서버에서 도는 자동 갱신 |
| `web/` | 화면(Next.js). `web/lib/data.ts`가 JSON을 읽는다 |

## 알아 둘 것

- 추천은 지자체 기준(예비가격 ±3%) 복수예가 공고만. 조달청 기준(±2%)과 참가 10곳 이하 예상 공고는 뺀다.
- 화면의 「평균 대비 배수」는 과거 평균을 그대로 쓰지 않고, 모의시험에서 실현된 비율만큼 눌러서 보여 준다.
- 공고의 A값이 공개되지 않았거나 실제와 다르면 추천 금액이 하한가에 못 미칠 수 있다. 화면에 계산에 쓴 값을 그대로 보여 준다.
- 화면에는 아직 로그인이 없다. 주소를 아는 사람은 누구나 추천 금액을 본다(검색 엔진 수집은 막아 두었다).

## 데이터 출처

조달청 나라장터 낙찰정보서비스·입찰공고정보서비스(공공데이터포털, 이용허락범위 제한 없음).
