"""SQLite 저장소. 운영에 올릴 때 Postgres로 옮길 수 있게 표준 SQL만 쓴다.

공고 한 건의 열쇠는 (공고번호, 차수, 분류번호, 재입찰번호) 네 개다 — 같은 공고번호가 정정(차수)·재입찰로 여러 번 나온다.
"""
from __future__ import annotations

import sqlite3

from .config import DATA_DIR, DB_PATH

KEY = "bid_ntce_no, bid_ntce_ord, bid_clsfc_no, rbid_no"
_KEY_COLS = """
  bid_ntce_no  TEXT NOT NULL,
  bid_ntce_ord TEXT NOT NULL,
  bid_clsfc_no TEXT NOT NULL,
  rbid_no      TEXT NOT NULL,"""

SCHEMA = f"""
-- 응답 원문. 하루 호출 한도(오퍼레이션당 1,000건)가 가장 빠듯한 자원이라,
-- 한 번 받은 응답은 여기 두고 해석을 고칠 때 다시 부르지 않는다.
CREATE TABLE IF NOT EXISTS raw_response (
  operation   TEXT NOT NULL,
  req_key     TEXT NOT NULL,      -- 요청을 가르는 값(공고번호 또는 조회 기간)
  page_no     INTEGER NOT NULL,
  fetched_at  TEXT NOT NULL,      -- UTC
  total_count INTEGER,
  body        TEXT NOT NULL,      -- response.body 원문(JSON)
  PRIMARY KEY (operation, req_key, page_no)
);

-- 호출 기록. 한도는 한국 날짜로 초기화되므로 kst_day로 센다.
CREATE TABLE IF NOT EXISTS api_call (
  called_at TEXT NOT NULL,
  kst_day   TEXT NOT NULL,
  operation TEXT NOT NULL,
  ok        INTEGER NOT NULL,
  note      TEXT
);
CREATE INDEX IF NOT EXISTS api_call_day ON api_call (kst_day, operation);

-- 낙찰 결과(공고당 1행). 대표자명·전화번호·주소는 분석에 쓰지 않으므로 저장하지 않는다.
CREATE TABLE IF NOT EXISTS award ({_KEY_COLS}
  ntce_nm        TEXT,
  dminstt_cd     TEXT,
  dminstt_nm     TEXT,
  open_dt        TEXT,             -- 실제 개찰일시
  prtcpt_cnum    INTEGER,          -- 참가업체 수
  winner_bizno   TEXT,
  winner_nm      TEXT,
  sucsfbid_amt   INTEGER,
  sucsfbid_rate  REAL,             -- 낙찰금액 ÷ 예정가격 (%)
  source         TEXT NOT NULL,    -- 'legacy_csv' | 'api'
  PRIMARY KEY ({KEY})
);

-- 공고별 예정가격·기초금액
CREATE TABLE IF NOT EXISTS prep_head ({_KEY_COLS}
  plnprc   REAL,                   -- 예정가격(추첨된 4개의 평균)
  bssamt   INTEGER,                -- 기초금액
  tot_num  INTEGER,                -- 예비가격 개수(보통 15)
  basis    TEXT,                   -- 낙찰자결정 적용기준: 행자부(지자체) | 조달청
  open_dt  TEXT,
  source   TEXT NOT NULL,
  PRIMARY KEY ({KEY})
);

-- 복수예비가격 15개
CREATE TABLE IF NOT EXISTS prep_price ({_KEY_COLS}
  sno          INTEGER NOT NULL,   -- 예가번호 1~15
  bsis_plnprc  INTEGER NOT NULL,   -- 예비가격
  drwt_yn      TEXT NOT NULL,      -- 최종 추첨 여부(Y 4개)
  drwt_num     INTEGER,            -- 업체들이 이 번호를 고른 횟수
  PRIMARY KEY ({KEY}, sno)
);

-- 입찰공고(개찰 전 공고 포함). 정정공고는 차수가 올라간 새 행으로 온다.
CREATE TABLE IF NOT EXISTS notice (
  bid_ntce_no      TEXT NOT NULL,
  bid_ntce_ord     TEXT NOT NULL,
  ntce_nm          TEXT,
  ntce_kind        TEXT,           -- 등록공고 | 변경공고 | 취소공고 ...
  ntce_dt          TEXT,           -- 공고 게시일시
  ntce_instt_nm    TEXT,
  dminstt_cd       TEXT,
  dminstt_nm       TEXT,
  bid_begin_dt     TEXT,
  bid_clse_dt      TEXT,           -- 투찰 마감
  openg_dt         TEXT,           -- 개찰 예정
  presmpt_prce     INTEGER,        -- 추정가격(부가세 제외)
  bdgt_amt         INTEGER,
  basis            TEXT,           -- 행자부 | 조달청
  floor_rate       REAL,           -- 낙찰하한율(%) — 공고에 적힌 값 그대로
  sucsfbid_mthd_nm TEXT,
  prearng_mthd     TEXT,           -- 복수예가 | 단일예가 ...
  detail_url       TEXT,
  PRIMARY KEY (bid_ntce_no, bid_ntce_ord)
);

-- 기초금액과 A값(국민연금·건강보험 등 하한율을 곱하지 않는 금액의 합)
CREATE TABLE IF NOT EXISTS base_amount (
  bid_ntce_no  TEXT NOT NULL,
  bid_ntce_ord TEXT NOT NULL,
  bid_clsfc_no TEXT NOT NULL,
  bssamt       INTEGER,
  rng_bgn      REAL,               -- 예비가격 범위(%) 예: -3
  rng_end      REAL,               --                  예: +3
  open_dt      TEXT,               -- 기초금액 공개일시
  a_yn         TEXT,               -- A값 적용 공고인가
  a_value      INTEGER,
  PRIMARY KEY (bid_ntce_no, bid_ntce_ord, bid_clsfc_no)
);

-- 면허제한. 같은 그룹(grp) 안의 면허는 모두 갖춰야 하고, 그룹이 여럿이면 그중 하나만 충족하면 된다.
-- 요구 면허가 많을수록 참가할 수 있는 업체가 줄어든다(3개를 동시에 요구한 공고는 참가 30곳).
CREATE TABLE IF NOT EXISTS license_limit (
  bid_ntce_no  TEXT NOT NULL,
  bid_ntce_ord TEXT NOT NULL,
  grp          TEXT NOT NULL,
  sno          TEXT NOT NULL,
  lcns_nm      TEXT,               -- 예: 상ㆍ하수도설비공사업/4996
  mfrc         TEXT,               -- 주력분야 제한
  PRIMARY KEY (bid_ntce_no, bid_ntce_ord, grp, sno)
);

-- 업체별 투찰. 대표자명은 저장하지 않는다.
CREATE TABLE IF NOT EXISTS bidder ({_KEY_COLS}
  bizno    TEXT NOT NULL,
  nm       TEXT,
  rank     INTEGER,                -- 개찰순위(하한선 미달은 순위가 없다)
  amt      INTEGER,                -- 투찰금액
  rate     REAL,                   -- 투찰률(투찰금액 ÷ 예정가격, %)
  rmrk     TEXT,                   -- 정상 | 낙찰하한선미달 ...
  drwt1    INTEGER,                -- 고른 예가번호 2개
  drwt2    INTEGER,
  bid_dt   TEXT,
  PRIMARY KEY ({KEY}, bizno)
);
"""


def connect(readonly: bool = False) -> sqlite3.Connection:
    """readonly면 표를 만들지 않고 읽기만 한다 — 수집이 도는 중에도 분석·내보내기를 할 수 있다."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if readonly:
        conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True, timeout=60)
    else:
        conn = sqlite3.connect(DB_PATH, timeout=60)     # 수집이 도는 중에 다른 명령이 써도 기다렸다가 쓴다
        conn.executescript(SCHEMA)
    conn.row_factory = sqlite3.Row
    return conn
