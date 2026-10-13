"""자동 갱신. 서버에서 화면과 나란히 떠서, 정해진 시각마다 새 자료를 받고 화면용 데이터를 다시 만든다.

공고·기초금액은 업무시간에 올라오고 개찰은 대개 11시·14시라, 한국 시간 06~20시에 매시 5분에 돈다.
한 번 도는 데 API 호출은 수십 건이다(지난달까지의 목록과 이미 받은 공고는 저장본을 쓴다).
"""
from __future__ import annotations

import time
import traceback
from datetime import datetime, timedelta

from . import collect, db, export, g2b

FIRST_HOUR, LAST_HOUR, MINUTE = 6, 20, 5


def next_run(now: datetime) -> datetime:
    """now 이후의 가장 가까운 실행 시각(한국 시간)."""
    slot = now.replace(minute=MINUTE, second=0, microsecond=0)
    if slot <= now:
        slot += timedelta(hours=1)
    if slot.hour > LAST_HOUR:
        slot = (slot + timedelta(days=1)).replace(hour=FIRST_HOUR)
    elif slot.hour < FIRST_HOUR:
        slot = slot.replace(hour=FIRST_HOUR)
    return slot


def run_once(log=print) -> None:
    """수집이 실패해도(API 장애·한도) 있는 자료로 내보내기는 한다 — 화면의 「마감 전 공고」는 시각에 따라 바뀌어야 한다."""
    conn = db.connect()
    try:
        try:
            collect.collect_all(conn, log=log)
        except Exception:
            log("수집 실패 — 있는 자료로 화면 데이터만 다시 만듭니다\n" + traceback.format_exc(limit=3))
        summary = export.write(conn)
        log(f"화면 데이터 갱신: 마감 전 공고 {len(summary['upcoming'])}건, 추천 제외 {summary['pending']}건")
    finally:
        conn.close()


def run_forever(log=lambda m: print(m, flush=True)) -> None:
    while True:
        started = datetime.now(g2b.KST)
        log(f"[{started:%m-%d %H:%M}] 갱신 시작")
        try:
            run_once(log)
        except Exception:
            log("갱신 실패\n" + traceback.format_exc(limit=5))
        nxt = next_run(datetime.now(g2b.KST))
        log(f"다음 갱신 {nxt:%m-%d %H:%M}")
        time.sleep(max(30.0, (nxt - datetime.now(g2b.KST)).total_seconds()))
