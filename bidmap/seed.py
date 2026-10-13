"""낙찰 목록·예비가격 응답을 표에 넣는다.

옛 버전의 CSV는 같은 API의 응답을 그대로 저장한 파일이라 칼럼명이 응답 필드명과 같다.
그래서 CSV와 API 응답을 같은 함수로 넣는다. 있는 것은 그대로 쓰고 없는 것만 API로 채운다.
(낙찰 CSV에는 완전히 같은 행이 152개 중복돼 있다 — 열쇠가 같으면 한 번만 들어간다.)
"""
from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

from .config import LEGACY_DIR


def _rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _key(r: dict) -> tuple[str, str, str, str]:
    return (r["bidNtceNo"], r["bidNtceOrd"], r["bidClsfcNo"], r["rbidNo"])


def to_int(v) -> int | None:
    v = (v or "").strip() if isinstance(v, str) else v
    return int(float(v)) if v not in ("", None) else None


def to_float(v) -> float | None:
    v = (v or "").strip() if isinstance(v, str) else v
    return float(v) if v not in ("", None) else None


def insert_awards(conn: sqlite3.Connection, rows: list[dict], source: str) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO award VALUES (?,?,?,?, ?,?,?,?,?,?,?,?,?, ?)",
        [(*_key(r), r["bidNtceNm"], r["dminsttCd"], r["dminsttNm"], r["rlOpengDt"], to_int(r["prtcptCnum"]),
          r["bidwinnrBizno"], r["bidwinnrNm"], to_int(r["sucsfbidAmt"]), to_float(r["sucsfbidRate"]), source)
         for r in rows],
    )


def insert_prices(conn: sqlite3.Connection, rows: list[dict], source: str) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO prep_head VALUES (?,?,?,?, ?,?,?,?,?, ?)",
        [(*_key(r), to_float(r["plnprc"]), to_int(r["bssamt"]), to_int(r["totRsrvtnPrceNum"]),
          r["bidwinrSlctnAplBssCntnts"], r["rlOpengDt"], source)
         for r in rows],
    )
    # 복수예가가 아닌 공고는 예가번호가 비어 있다 — 머리 정보만 두고 15개 표에는 넣지 않는다
    conn.executemany(
        "INSERT OR IGNORE INTO prep_price VALUES (?,?,?,?, ?,?,?,?)",
        [(*_key(r), to_int(r["compnoRsrvtnPrceSno"]), to_int(r["bsisPlnprc"]), r["drwtYn"], to_int(r["drwtNum"]))
         for r in rows if to_int(r["compnoRsrvtnPrceSno"]) is not None],
    )


def seed_legacy(conn: sqlite3.Connection, folder: Path = LEGACY_DIR) -> dict:
    awards = _rows(folder / "HIST_BID_MASTER_5Y.csv")
    prices = _rows(folder / "PREP_PRICE_DETAIL.csv")
    insert_awards(conn, awards, "legacy_csv")
    insert_prices(conn, prices, "legacy_csv")
    conn.commit()
    return {
        "csv_award_rows": len(awards),
        "csv_price_rows": len(prices),
        **{t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("award", "prep_head", "prep_price")},
    }
