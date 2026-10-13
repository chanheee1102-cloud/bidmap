"""화면에 쓸 JSON을 만든다(web/data/board.json, firms.json).

화면에 나가는 「평균 대비 배수」는 과거 기록의 평균을 그대로 쓰지 않고 모의시험에서 실제로 실현된 만큼만 남긴다.
가장 높은 자리를 고르면 우연히 높았던 부분까지 고르게 되기 때문이다(모의시험에서 기대의 일부만 실현됐다).
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from . import backtest, model, rules
from .config import ROOT
from .model import GRID

WEB_DATA = ROOT / "web" / "data"
KST = timezone(timedelta(hours=9))

CURVE_LO, CURVE_HI = 97.5, 102.5     # 화면에 그리는 범위
BIN = 0.1                            # 분포 막대 한 칸(%p)
N_PICKS = 3
MIN_TRAIN = 150
WIDTH = 3.0                          # 지자체 기준(±3%)만 추천한다 — 조달청 기준은 표본이 적다


def _half(dt: str) -> str:
    return f"{dt[:4]} {'상' if int(dt[5:7]) <= 6 else '하'}반기"


def _licenses(conn: sqlite3.Connection, no: str, ord_: str) -> tuple[str | None, str]:
    """(조건 열쇠, 사람이 읽는 문장). 같은 그룹은 모두, 그룹이 여럿이면 그중 하나."""
    rows = conn.execute(
        "SELECT grp, lcns_nm, mfrc FROM license_limit WHERE bid_ntce_no = ? AND bid_ntce_ord = ? ORDER BY grp, sno",
        (no, ord_)).fetchall()
    if not rows:
        return None, "공고서 참조"
    keys: dict[str, list[str]] = {}
    names: dict[str, list[str]] = {}
    for grp, nm, mfrc in rows:
        code = nm.rsplit("/", 1)[-1] if "/" in nm else nm
        keys.setdefault(grp, []).append(code + ("*" if mfrc else ""))
        names.setdefault(grp, []).append(nm.rsplit("/", 1)[0])
    sig = " | ".join(sorted("+".join(sorted(set(v))) for v in keys.values()))
    label = " 또는 ".join(" + ".join(v) for v in names.values())
    return sig, label


def build(conn: sqlite3.Connection) -> tuple[dict, list[dict]]:
    hist = model.load(conn)
    nt = hist.notices
    cdf = model.DrawCdf()
    mult = backtest.multiple_curves(hist, cdf)

    result = backtest.walk_forward(hist, mult, min_train=MIN_TRAIN)
    bt = backtest.summarize(result)
    lam = max(0.0, min(1.0, (bt["realized_mean"] - 1) / (bt["expected_mean"] - 1)))
    periods = [{"label": k, "n": int(len(g)),
                "multiple": round(backtest.wins_ratio(g.realized.to_numpy(), g.n_bids.to_numpy()), 2)}
               for k, g in result.groupby(result.open_dt.map(_half), sort=True)]

    # 지난 결과: 추천 자리가 실제 추첨으로도 낙찰이었는지까지
    rivals = {nid: g.to_numpy() for nid, g in hist.bids.groupby("nid").s}
    picked = result.set_index("nid")
    past = []
    for row in nt[nt.n_bids > 0].sort_values("open_dt", ascending=False).head(150).itertuples():
        pk = picked.loc[row.nid] if row.nid in picked.index else None
        won = None
        if pk is not None:
            r = rivals[row.nid]
            won = bool(row.rate <= pk.s_pick and not ((r >= row.rate) & (r < pk.s_pick)).any())
        past.append({
            "id": f"{row.bid_ntce_no}-{row.bid_ntce_ord}", "name": row.ntce_nm, "agency": row.dminstt_nm,
            "openAt": row.open_dt, "bidders": int(row.n_bids), "actualRate": round(float(row.rate), 3),
            "winAmount": int(row.sucsfbid_amt),
            "pickRate": None if pk is None else round(float(pk.s_pick), 3),
            "pickAmount": None if pk is None else rules.bid_for_rate(pk.s_pick, row.bssamt, row.floor_rate, row.a_value),
            "pickMultiple": None if pk is None else round(float(pk.realized), 2),
            "pickWon": won,
        })

    # 추천: 지금까지의 모든 기록으로, 참가 규모가 비슷한 공고에 더 무게를 둔다
    usable = ((nt.width == WIDTH) & (nt.n_bids > 0) & nt.clean).to_numpy()
    train = np.flatnonzero(usable)
    bids = hist.bids[hist.bids.nid.isin(train)]
    keep = (GRID >= CURVE_LO - 1e-9) & (GRID <= CURVE_HI + 1e-9)
    every = 10                                                   # 0.001 → 0.01 간격으로 줄여 내보낸다
    edges = np.round(np.arange(CURVE_LO, CURVE_HI + 1e-9, BIN), 4)
    draw_share = np.diff(cdf(WIDTH, edges))

    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")
    open_rows = conn.execute(
        """
        SELECT n.bid_ntce_no, n.bid_ntce_ord, n.ntce_nm, n.dminstt_nm, n.ntce_kind, n.bid_clse_dt, n.openg_dt,
               n.presmpt_prce, n.floor_rate, n.prearng_mthd, n.detail_url,
               b.bssamt, b.rng_end, b.a_value, b.a_yn
        FROM notice n
        LEFT JOIN base_amount b USING (bid_ntce_no, bid_ntce_ord)
        WHERE n.bid_clse_dt > ? AND n.ntce_kind NOT LIKE '%취소%'
          AND n.bid_ntce_ord = (SELECT MAX(bid_ntce_ord) FROM notice m WHERE m.bid_ntce_no = n.bid_ntce_no)
        ORDER BY n.bid_clse_dt
        """, (now,)).fetchall()
    upcoming, pending = [], []
    for r in open_rows:
        head = {"id": f"{r['bid_ntce_no']}-{r['bid_ntce_ord']}", "name": r["ntce_nm"], "agency": r["dminstt_nm"],
                "kind": r["ntce_kind"], "bidClose": r["bid_clse_dt"], "openAt": r["openg_dt"]}
        usable_now = r["bssamt"] and r["floor_rate"] and r["prearng_mthd"] == "복수예가" and abs(r["rng_end"] or 0) == WIDTH
        if not usable_now:
            why = "기초금액 공개 전" if not r["bssamt"] else "조달청 기준 등 추천 대상이 아닌 방식"
            pending.append({**head, "reason": why})
            continue
        sig, license_label = _licenses(conn, r["bid_ntce_no"], r["bid_ntce_ord"])
        field = model.field_key(sig, r["ntce_nm"])
        n_exp = model.expected_bidders(nt.iloc[train], field)
        if n_exp <= backtest.MIN_FIELD:
            pending.append({**head, "reason": f"참가 업체가 약 {round(n_exp)}곳으로 너무 적음"})
            continue
        w = backtest.field_weights(nt.n_bids.to_numpy()[train], n_exp)
        mean_curve = w @ mult[train]
        shown = 1 + lam * (model.smooth(mean_curve) - 1)
        # 경쟁사 분포도 같은 가중으로: 공고마다 가중 w를 그 공고의 투찰 수로 나눠 투찰 하나의 몫으로 준다
        per_bid = pd.Series(w / nt.n_bids.to_numpy()[train], index=train).reindex(bids.nid).to_numpy()
        rival_share = np.histogram(bids.s.to_numpy(), edges, weights=per_bid)[0]
        same = nt.iloc[train][nt.iloc[train].field == field].tail(12)
        terms = (r["bssamt"], r["floor_rate"], r["a_value"] or 0)
        upcoming.append({
            **head, "baseAmount": r["bssamt"], "aValue": r["a_value"] or 0, "aApplied": r["a_yn"] == "Y",
            "floorRate": r["floor_rate"], "width": WIDTH, "estPrice": r["presmpt_prce"],
            "expectedBidders": int(round(n_exp)), "license": license_label,
            "similar": {"n": int(len(same)), "min": int(same.n_bids.min()) if len(same) else None,
                        "max": int(same.n_bids.max()) if len(same) else None},
            "detailUrl": r["detail_url"],
            "picks": [{"rank": k + 1, "rate": round(float(GRID[i]), 3), "amount": rules.bid_for_rate(float(GRID[i]), *terms),
                       "multiple": round(float(shown[i]), 2), "winProb": round(float(shown[i]) / (n_exp + 1), 5)}
                      for k, i in enumerate(backtest.pick(mean_curve, k=N_PICKS))],
            "curve": {
                "rate": [round(float(x), 2) for x in GRID[keep][::every]],
                "multiple": [round(float(x), 3) for x in shown[keep][::every]],
                "binStart": CURVE_LO, "binWidth": BIN,
                "rival": [round(float(x), 5) for x in rival_share],
                "draw": [round(float(x), 5) for x in draw_share],
            },
        })

    scored = nt[nt.n_bids > 0]
    board = {
        "generatedAt": now,
        "scope": {"region": "대전", "industry": "상하수도설비공사업"},
        "coverage": {"notices": int(len(scored)), "bids": int(len(hist.bids)), "firms": int(hist.bids.bizno.nunique()),
                     "from": scored.open_dt.min(), "to": scored.open_dt.max()},
        "backtest": {"n": bt["n"], "multiple": bt["wins_ratio"], "ci90": bt["ci90"], "centre": bt["centre_wins_ratio"],
                     "expectedWins": bt["expected_wins"], "averageWins": bt["average_wins"],
                     "from": result.open_dt.min(), "to": result.open_dt.max(), "periods": periods},
        "upcoming": upcoming, "pending": pending, "past": past,
    }
    return board, _firms(hist, nt)


def _firms(hist: model.History, nt: pd.DataFrame, top: int = 200) -> list[dict]:
    since = (datetime.now(KST) - timedelta(days=730)).strftime("%Y-%m-%d")
    b = hist.bids.merge(nt[["nid", "open_dt", "winner_bizno", "clean"]], on="nid")
    b = b[(b.open_dt >= since) & b.clean & b.s.between(90, 110)]
    b = b.assign(won=b.bizno == b.winner_bizno, under=b.rmrk == "낙찰하한선 미달")
    g = b.groupby("bizno")
    out = pd.DataFrame({
        "name": g.nm.last(), "bids": g.size(), "wins": g.won.sum(), "underFloor": g.under.mean(),
        "medianRate": g.s.median(), "spread": g.s.quantile(0.75) - g.s.quantile(0.25), "lastBid": g.open_dt.max(),
    }).sort_values("bids", ascending=False).head(top)
    return [{"name": r["name"], "bids": int(r["bids"]), "wins": int(r["wins"]), "underFloor": round(float(r["underFloor"]), 3),
             "medianRate": round(float(r["medianRate"]), 3), "spread": round(float(r["spread"]), 3), "lastBid": r["lastBid"]}
            for r in out.to_dict("records")]


def write(conn: sqlite3.Connection) -> dict:
    board, firms = build(conn)
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    for name, data in (("board.json", board), ("firms.json", firms)):
        # 화면이 읽는 도중에 반쯤 쓴 파일을 보지 않게, 옆에 다 쓴 뒤 한 번에 바꿔치기한다
        tmp = WEB_DATA / f"{name}.tmp"
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(WEB_DATA / name)
    return {"upcoming": [{k: u[k] for k in ("name", "expectedBidders", "license", "similar", "picks")} for u in board["upcoming"]],
            "pending": len(board["pending"]), "past": len(board["past"]), "firms": len(firms),
            "backtest": {k: v for k, v in board["backtest"].items() if k != "periods"}}


def write_placeholder() -> None:
    """DB 없이 화면을 빌드해야 할 때 쓰는 빈 데이터. 서버가 뜨면 스케줄러가 실제 데이터로 바꾼다."""
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")
    board = {
        "generatedAt": now, "scope": {"region": "대전", "industry": "상하수도설비공사업"},
        "coverage": {"notices": 0, "bids": 0, "firms": 0, "from": now, "to": now},
        "backtest": {"n": 0, "multiple": 1.0, "ci90": [1.0, 1.0], "centre": 1.0, "expectedWins": 0.0, "averageWins": 0.0,
                     "from": now, "to": now, "periods": []},
        "upcoming": [], "pending": [], "past": [],
    }
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    (WEB_DATA / "board.json").write_text(json.dumps(board, ensure_ascii=False), encoding="utf-8")
    (WEB_DATA / "firms.json").write_text("[]", encoding="utf-8")
