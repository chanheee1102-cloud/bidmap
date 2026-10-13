"""수집. 과거 4년치를 한 번 채우고, 그 뒤로는 새로 생긴 것만 받는다.

순서: 공고 목록 → 낙찰 목록 → (낙찰 건마다) 예비가격 · 업체별 투찰 · 기초금액/A값
지난달까지의 목록과 한 번 받은 공고별 응답은 저장본을 쓴다. 이번 달·지난달 목록과
아직 개찰 전인 공고의 기초금액만 매번 새로 받는다.
"""
from __future__ import annotations

import calendar
import json
import sqlite3
from datetime import date, datetime

from . import g2b
from .config import INDUSTRY_CD, REGION_CD
from .seed import insert_awards, insert_prices, to_float, to_int

OP_NOTICE = "getBidPblancListInfoCnstwkPPSSrch"
OP_AWARD = "getScsbidListSttusCnstwkPPSSrch"
OP_PREP = "getOpengResultListInfoCnstwkPreparPcDetail"
OP_BIDDER = "getOpengResultListInfoOpengCompt"
OP_BASE = "getBidPblancListInfoCnstwkBsisAmount"
OP_LICENSE = "getBidPblancListInfoLicenseLimit"

SCOPE = {"prtcptLmtRgnCd": REGION_CD, "indstrytyCd": INDUSTRY_CD}
SCOPE_TAG = f"rgn{REGION_CD}|ind{INDUSTRY_CD}"

# A값을 이루는 항목(입찰가격산식A정보의 합산항목). 품질관리비는 적용대상일 때만 더한다.
A_PARTS = ("npnInsrprm", "mrfnHealthInsrprm", "rtrfundNon", "odsnLngtrmrcprInsrprm", "sftyMngcst", "sftyChckMngcst")


def month_windows(start: date, end: date) -> list[tuple[str, str]]:
    """조회 기간은 한 달을 넘기면 거절된다(오류 07) — 달 단위로 자른다."""
    out, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append((f"{y}{m:02d}010000", f"{y}{m:02d}{calendar.monthrange(y, m)[1]}2359"))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _monthly(client: g2b.Client, service: str, op: str, inqry_div: str, start: date, log) -> list[dict]:
    today = datetime.now(g2b.KST).date()       # 서버 시계(UTC)가 아니라 한국 날짜
    recent = {w for w in month_windows(start, today)[-2:]}     # 이번 달·지난달은 아직 바뀐다
    items: list[dict] = []
    for bgn, end in month_windows(start, today):
        got = client.fetch_all(service, op, {"inqryDiv": inqry_div, "inqryBgnDt": bgn, "inqryEndDt": end, **SCOPE},
                               req_key=f"{bgn}-{end}|{SCOPE_TAG}", refresh=(bgn, end) in recent)
        items.extend(got)
    log(f"{op}: {len(items)}건")
    return items


def collect_notices(client: g2b.Client, start: date, log=print) -> None:
    items = _monthly(client, "bid", OP_NOTICE, "1", start, log)          # 1 = 공고 게시일시 기준
    client.conn.executemany(
        "INSERT OR REPLACE INTO notice VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(i["bidNtceNo"], i["bidNtceOrd"], i.get("bidNtceNm"), i.get("ntceKindNm"), i.get("bidNtceDt"),
          i.get("ntceInsttNm"), i.get("dminsttCd"), i.get("dminsttNm"), i.get("bidBeginDt"), i.get("bidClseDt"),
          i.get("opengDt"), to_int(i.get("presmptPrce")), to_int(i.get("bdgtAmt")), i.get("aplBssCntnts"),
          to_float(i.get("sucsfbidLwltRate")), i.get("sucsfbidMthdNm"), i.get("prearngPrceDcsnMthdNm"),
          i.get("bidNtceDtlUrl"))
         for i in items],
    )
    client.conn.commit()


def collect_awards(client: g2b.Client, start: date, log=print) -> None:
    insert_awards(client.conn, _monthly(client, "scsbid", OP_AWARD, "2", start, log), "api")   # 2 = 개찰일시 기준
    client.conn.commit()


def _per_notice(client: g2b.Client, service: str, op: str, params: dict, nos: list[str], insert,
                refresh_nos: set[str], log) -> None:
    """공고번호마다 한 번씩 부른다. 한도에 닿으면 받은 데까지 넣고 멈춘다."""
    done = failed_in_a_row = 0
    for no in nos:
        try:
            items = client.fetch_all(service, op, {**params, "bidNtceNo": no}, req_key=no, refresh=no in refresh_nos)
        except g2b.QuotaExceeded as e:
            log(str(e))
            break
        except g2b.G2BError as e:
            failed_in_a_row += 1
            log(f"{no} 건너뜀 — {e}")
            if failed_in_a_row >= 5:        # 키·서버 문제면 한도만 태우게 되니 멈춘다
                log(f"{op}: 연속 5회 실패로 중단")
                break
            continue
        failed_in_a_row = 0
        insert(client.conn, items)
        done += 1
        if done % 100 == 0:
            client.conn.commit()
            log(f"{op}: {done}/{len(nos)}")
    client.conn.commit()
    log(f"{op}: {done}/{len(nos)} 완료")


def _insert_bidders(conn: sqlite3.Connection, items: list[dict]) -> None:
    conn.executemany(
        "INSERT OR REPLACE INTO bidder VALUES (?,?,?,?, ?,?,?,?,?,?,?,?,?)",
        [(i["bidNtceNo"], i["bidNtceOrd"], i["bidClsfcNo"], i["rbidNo"], i["prcbdrBizno"], i.get("prcbdrNm"),
          to_int(i.get("opengRank")), to_int(i.get("bidprcAmt")), to_float(i.get("bidprcrt")), i.get("rmrk"),
          to_int(i.get("drwtNo1")), to_int(i.get("drwtNo2")), i.get("bidprcDt"))
         for i in items if i.get("prcbdrBizno")],
    )


def a_value_of(item: dict) -> int:
    if item.get("bidPrceCalclAYn") != "Y":
        return 0
    total = sum(to_int(item.get(k)) or 0 for k in A_PARTS)
    if item.get("qltyMngcstAObjYn") == "Y":
        total += to_int(item.get("qltyMngcst")) or 0
    return total


def _insert_base(conn: sqlite3.Connection, items: list[dict]) -> None:
    conn.executemany(
        "INSERT OR REPLACE INTO base_amount VALUES (?,?,?,?,?,?,?,?,?)",
        [(i["bidNtceNo"], i["bidNtceOrd"], i.get("bidClsfcNo") or "0", to_int(i.get("bssamt")),
          to_float(i.get("rsrvtnPrceRngBgnRate")), to_float(i.get("rsrvtnPrceRngEndRate")), i.get("bssamtOpenDt"),
          i.get("bidPrceCalclAYn"), a_value_of(i))
         for i in items],
    )


def collect_licenses(client: g2b.Client, log=print) -> None:
    """면허제한은 공고번호와 차수를 함께 줘야 한다. 낙찰 건과 개찰 전 공고 중 아직 안 받은 것만."""
    conn = client.conn
    targets = conn.execute(
        """
        SELECT n.bid_ntce_no, n.bid_ntce_ord FROM notice n
        WHERE (EXISTS (SELECT 1 FROM award a WHERE a.bid_ntce_no = n.bid_ntce_no AND a.bid_ntce_ord = n.bid_ntce_ord)
               OR n.bid_clse_dt > ?)
          AND NOT EXISTS (SELECT 1 FROM raw_response r WHERE r.operation = ? AND r.req_key = n.bid_ntce_no || '-' || n.bid_ntce_ord)
        ORDER BY n.ntce_dt DESC
        """, (datetime.now(g2b.KST).strftime("%Y-%m-%d %H:%M:%S"), OP_LICENSE)).fetchall()
    done = 0
    for no, ord_ in targets:
        try:
            items = client.fetch_all("bid", OP_LICENSE, {"inqryDiv": "2", "bidNtceNo": no, "bidNtceOrd": ord_}, req_key=f"{no}-{ord_}")
        except g2b.QuotaExceeded as e:
            log(str(e))
            break
        except g2b.G2BError as e:
            log(f"{no} 건너뜀 — {e}")
            continue
        _insert_licenses(conn, items)
        done += 1
        if done % 100 == 0:
            conn.commit()
            log(f"{OP_LICENSE}: {done}/{len(targets)}")
    conn.commit()
    log(f"{OP_LICENSE}: {done}/{len(targets)} 완료")


def _insert_licenses(conn: sqlite3.Connection, items: list[dict]) -> None:
    conn.executemany(
        "INSERT OR REPLACE INTO license_limit VALUES (?,?,?,?,?,?)",
        [(i["bidNtceNo"], i["bidNtceOrd"], i.get("lmtGrpNo") or "1", i.get("lmtSno") or "1", i.get("lcnsLmtNm"),
          i.get("indstrytyMfrcFldList")) for i in items],
    )


def collect_all(conn: sqlite3.Connection, start: date = date(2021, 12, 1), log=print) -> None:
    client = g2b.Client(conn)
    collect_notices(client, start, log)
    last = conn.execute("SELECT MAX(open_dt) FROM award").fetchone()[0]
    collect_awards(client, datetime.fromisoformat(last).date().replace(day=1) if last else start, log)

    awarded = [r[0] for r in conn.execute("SELECT DISTINCT bid_ntce_no FROM award ORDER BY open_dt DESC")]
    no_prep = [r[0] for r in conn.execute(
        "SELECT DISTINCT a.bid_ntce_no FROM award a LEFT JOIN prep_head h USING (bid_ntce_no, bid_ntce_ord) "
        "WHERE h.bid_ntce_no IS NULL ORDER BY a.open_dt DESC")]
    now = datetime.now(g2b.KST).strftime("%Y-%m-%d %H:%M:%S")
    upcoming = [r[0] for r in conn.execute(
        "SELECT DISTINCT bid_ntce_no FROM notice WHERE openg_dt > ? ORDER BY openg_dt", (now,))]

    # 개찰 전 공고의 기초금액은 나중에 공개되므로 매번 새로 받는다
    _per_notice(client, "bid", OP_BASE, {"inqryDiv": "2"}, upcoming, _insert_base, set(upcoming), log)
    _per_notice(client, "scsbid", OP_PREP, {"inqryDiv": "2"}, no_prep,
                lambda c, items: insert_prices(c, items, "api"), set(), log)
    # 최근 공고부터 100건씩 투찰과 기초금액을 번갈아 받는다 — 전체가 끝나기 전에도 최신 구간은 온전하다
    for i in range(0, len(awarded), 100):
        chunk = awarded[i:i + 100]
        _per_notice(client, "scsbid", OP_BIDDER, {}, chunk, _insert_bidders, set(), log)
        _per_notice(client, "bid", OP_BASE, {"inqryDiv": "2"}, chunk, _insert_base, set(), log)
    collect_licenses(client, log)


def reparse(conn: sqlite3.Connection) -> None:
    """저장해 둔 원문으로 업체별 투찰·기초금액 표를 다시 만든다(API를 부르지 않는다)."""
    for op, insert in ((OP_BIDDER, _insert_bidders), (OP_BASE, _insert_base)):
        for (body,) in conn.execute("SELECT body FROM raw_response WHERE operation = ? AND req_key NOT LIKE 'probe%'", (op,)):
            insert(conn, g2b.items_of(json.loads(body)))
    conn.commit()
