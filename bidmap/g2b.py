"""조달청 나라장터 공개 API 클라이언트(공공데이터포털).

· 받은 응답은 전부 raw_response에 원문으로 둔다 → 같은 요청은 다시 부르지 않는다.
· 개발계정 한도는 오퍼레이션마다 하루 1,000건. 넘기 전에 스스로 멈춘다.
· 인증키가 예외 메시지에 섞여 나가지 않게, 통신 오류는 URL 없이 다시 던진다.
"""
from __future__ import annotations

import json
import re
import sqlite3
import time
from datetime import datetime, timedelta, timezone

import requests

from .config import service_key

SERVICES = {
    "scsbid": "https://apis.data.go.kr/1230000/as/ScsbidInfoService",   # 낙찰정보서비스
    "bid": "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",   # 입찰공고정보서비스
}
DAILY_LIMIT = 1000
SAFETY_MARGIN = 50      # 한도 끝까지 쓰지 않는다(다른 곳에서 같은 키를 쓸 수 있다)
PAGE_SIZE = 999

KST = timezone(timedelta(hours=9))


class G2BError(RuntimeError):
    pass


class QuotaExceeded(G2BError):
    pass


# 응답에는 담당 공무원 이름·전화·이메일, 업체 대표자명·주소가 섞여 온다. 계산에 쓰지 않으므로 저장하지 않는다.
PERSONAL = re.compile(r"CeoNm|TelNo|Adrs|OfclNm|Email|exctvNm|CorpOfcl")


def scrub(body: dict) -> dict:
    """응답 원문에서 개인정보성 항목을 지운다(저장하기 전에)."""
    for item in items_of(body):
        for key in [k for k in item if PERSONAL.search(k)]:
            del item[key]
    return body


def items_of(body: dict) -> list[dict]:
    """items가 목록·{"item": ...}·빈 문자열 세 가지로 온다."""
    items = body.get("items") or []
    if isinstance(items, dict):
        items = items.get("item") or []
    if isinstance(items, dict):
        items = [items]
    return items


def _parse(operation: str, text: str) -> dict:
    try:
        data = json.loads(text)
    except ValueError:
        # 키 미등록·한도 초과는 type=json이어도 XML로 온다
        raise G2BError(f"{operation}: JSON이 아닌 응답 — {text[:300]!r}")
    if "response" not in data:
        # {"nkoneps.com.response.ResponseError": {"header": {...}}} 꼴의 오류
        header = next((v.get("header", {}) for v in data.values() if isinstance(v, dict)), {})
        raise G2BError(f"{operation}: {header.get('resultCode')} {header.get('resultMsg')}")
    header = data["response"].get("header", {})
    if header.get("resultCode") != "00":
        raise G2BError(f"{operation}: {header.get('resultCode')} {header.get('resultMsg')}")
    return data["response"].get("body") or {}


class Client:
    def __init__(self, conn: sqlite3.Connection, pause: float = 0.12):
        self.conn = conn
        self.pause = pause
        self._key: str | None = None

    def used_today(self, operation: str) -> int:
        day = datetime.now(KST).strftime("%Y-%m-%d")
        row = self.conn.execute(
            "SELECT COUNT(*) FROM api_call WHERE kst_day = ? AND operation = ?", (day, operation)
        ).fetchone()
        return row[0]

    def _log(self, operation: str, ok: bool, note: str | None = None) -> None:
        now = datetime.now(timezone.utc)
        self.conn.execute(
            "INSERT INTO api_call (called_at, kst_day, operation, ok, note) VALUES (?,?,?,?,?)",
            (now.isoformat(timespec="seconds"), now.astimezone(KST).strftime("%Y-%m-%d"), operation, int(ok), note),
        )
        self.conn.commit()

    def call(self, service: str, operation: str, params: dict, *, req_key: str,
             page: int = 1, refresh: bool = False) -> dict:
        """한 페이지를 받아 body를 돌려준다. 이미 받은 요청이면 저장본을 쓴다."""
        if not refresh:
            row = self.conn.execute(
                "SELECT body FROM raw_response WHERE operation=? AND req_key=? AND page_no=?",
                (operation, req_key, page),
            ).fetchone()
            if row:
                return json.loads(row["body"])

        if self.used_today(operation) >= DAILY_LIMIT - SAFETY_MARGIN:
            raise QuotaExceeded(f"{operation}: 오늘 한도({DAILY_LIMIT - SAFETY_MARGIN}건)에 닿았습니다. 내일 이어서 받습니다.")
        if self._key is None:
            self._key = service_key()

        query = {"serviceKey": self._key, "type": "json", "numOfRows": str(PAGE_SIZE), "pageNo": str(page), **params}
        try:
            res = requests.get(f"{SERVICES[service]}/{operation}", params=query, timeout=30)
        except requests.RequestException as e:
            self._log(operation, False, type(e).__name__)
            raise G2BError(f"{operation}: 통신 오류({type(e).__name__})") from None
        time.sleep(self.pause)

        try:
            body = scrub(_parse(operation, res.text))
        except G2BError as e:
            self._log(operation, False, str(e)[:200])
            raise
        self._log(operation, True)
        self.conn.execute(
            "INSERT OR REPLACE INTO raw_response (operation, req_key, page_no, fetched_at, total_count, body) "
            "VALUES (?,?,?,?,?,?)",
            (operation, req_key, page, datetime.now(timezone.utc).isoformat(timespec="seconds"),
             body.get("totalCount"), json.dumps(body, ensure_ascii=False)),
        )
        self.conn.commit()
        return body

    def fetch_all(self, service: str, operation: str, params: dict, *, req_key: str,
                  refresh: bool = False) -> list[dict]:
        """마지막 페이지까지 받아 항목을 이어 붙인다."""
        out: list[dict] = []
        page = 1
        while True:
            body = self.call(service, operation, params, req_key=req_key, page=page, refresh=refresh)
            got = items_of(body)
            out.extend(got)
            total = int(body.get("totalCount") or 0)
            if not got or len(out) >= total:
                return out
            page += 1
