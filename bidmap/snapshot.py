"""씨앗 DB(seed/bidmap.sqlite.gz) 만들기 — 서버가 처음 뜰 때 영구 볼륨에 푸는 사본.

원문에 남아 있을 수 있는 개인정보성 항목(예전에 받아 둔 응답)을 지우고, 시험 호출 기록을 빼고 압축한다.
"""
from __future__ import annotations

import gzip
import json
import shutil
import sqlite3

from . import g2b
from .config import DATA_DIR, DB_PATH, ROOT

SEED = ROOT / "seed" / "bidmap.sqlite.gz"


def scrub_raw(conn: sqlite3.Connection) -> int:
    """raw_response의 원문에서 개인정보성 항목을 지운다. 바뀐 행 수를 돌려준다."""
    changed = 0
    rows = conn.execute("SELECT rowid, body FROM raw_response").fetchall()
    for rowid, body in rows:
        clean = json.dumps(g2b.scrub(json.loads(body)), ensure_ascii=False)
        if clean != body:
            conn.execute("UPDATE raw_response SET body = ? WHERE rowid = ?", (clean, rowid))
            changed += 1
    conn.commit()
    return changed


def write() -> dict:
    tmp = DATA_DIR / "seed-tmp.sqlite"
    tmp.unlink(missing_ok=True)
    src = sqlite3.connect(DB_PATH)
    src.execute(f"VACUUM INTO '{tmp.as_posix()}'")
    src.close()

    copy = sqlite3.connect(tmp)
    copy.execute("DELETE FROM raw_response WHERE req_key LIKE 'probe%'")
    scrubbed = scrub_raw(copy)
    copy.execute("VACUUM")
    copy.close()

    SEED.parent.mkdir(exist_ok=True)
    with tmp.open("rb") as f, gzip.open(SEED, "wb", compresslevel=9) as g:
        shutil.copyfileobj(f, g)
    size = tmp.stat().st_size
    tmp.unlink()
    return {"seed": str(SEED), "db_mb": round(size / 1e6, 1), "gz_mb": round(SEED.stat().st_size / 1e6, 1), "scrubbed_rows": scrubbed}
