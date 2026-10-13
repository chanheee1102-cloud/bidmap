"""명령줄 진입점.

    python -m bidmap daily                 매일 아침 한 번: 새 자료를 받고(collect) 화면용 JSON을 다시 만든다(export)
    python -m bidmap schedule              서버용: 떠 있으면서 한국 시간 06~20시 매시 5분에 daily를 돈다
    python -m bidmap snapshot              서버에 실어 보낼 씨앗 DB를 만든다(seed/bidmap.sqlite.gz)
    python -m bidmap seed                  옛 CSV를 DB에 넣는다
    python -m bidmap collect               공고·낙찰·예비가격·업체별 투찰·기초금액을 받는다(새로 생긴 것만)
    python -m bidmap reparse               저장해 둔 응답 원문으로 표를 다시 만든다
    python -m bidmap export                화면에 쓸 JSON을 만든다(web/data)
    python -m bidmap status                표별 건수와 오늘 쓴 호출 수
    python -m bidmap validate              모형이 데이터와 맞는지 확인
    python -m bidmap probe <서비스> <오퍼레이션> 키=값 ...   API를 한 번 불러 응답 모양을 본다
"""
from __future__ import annotations

import json
import sys

from . import collect, db, export, g2b, scheduler, seed, snapshot, validate


def _print(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=str))


def cmd_status(conn) -> None:
    tables = ("notice", "award", "prep_head", "prep_price", "bidder", "base_amount", "raw_response")
    counts = {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables}
    span = conn.execute("SELECT MIN(open_dt), MAX(open_dt) FROM award").fetchone()
    client = g2b.Client(conn)
    used = {r[0]: client.used_today(r[0]) for r in conn.execute("SELECT DISTINCT operation FROM api_call")}
    _print({"rows": counts, "award_open_dt": list(span), "calls_today": used, "daily_limit": g2b.DAILY_LIMIT})


def cmd_probe(conn, service: str, operation: str, *pairs: str) -> None:
    params = dict(p.split("=", 1) for p in pairs)
    params.setdefault("numOfRows", "5")       # 모양만 보면 되니 조금만 받는다
    client = g2b.Client(conn)
    req_key = "probe|" + "|".join(f"{k}={v}" for k, v in sorted(params.items()))
    body = client.call(service, operation, params, req_key=req_key, refresh=True)
    items = g2b.items_of(body)
    _print({
        "totalCount": body.get("totalCount"),
        "fields": list(items[0].keys()) if items else [],
        "first": items[0] if items else None,
        "calls_today": client.used_today(operation),
    })


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 1
    cmd, args = argv[1], argv[2:]
    if cmd == "schedule":
        scheduler.run_forever()
        return 0
    if cmd == "placeholder":
        export.write_placeholder()
        return 0
    if cmd == "snapshot":
        _print(snapshot.write())
        return 0
    conn = db.connect(readonly=cmd in ("status", "validate", "export"))
    if cmd == "seed":
        _print(seed.seed_legacy(conn))
    elif cmd == "status":
        cmd_status(conn)
    elif cmd == "validate":
        _print({"split": validate.check_split(conn), "draw": validate.check_draw(conn), "floor": validate.check_floor(conn)})
    elif cmd == "collect":
        collect.collect_all(conn, log=lambda m: print(m, flush=True))
        cmd_status(conn)
    elif cmd == "reparse":
        collect.reparse(conn)
        cmd_status(conn)
    elif cmd == "export":
        _print(export.write(conn))
    elif cmd == "daily":
        collect.collect_all(conn, log=lambda m: print(m, flush=True))
        _print(export.write(conn))
    elif cmd == "probe":
        cmd_probe(conn, *args)
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
