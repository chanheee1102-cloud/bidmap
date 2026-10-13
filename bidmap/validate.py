"""모형이 실제 데이터와 맞는지 확인한다. 데이터가 늘 때마다 다시 돌린다."""
from __future__ import annotations

import math
import sqlite3

import numpy as np

from . import draw


def _ks_pvalue(d: float, n: int, m: int) -> float:
    """두 표본 콜모고로프-스미르노프 검정의 근사 p값."""
    en = math.sqrt(n * m / (n + m))
    lam = (en + 0.12 + 0.11 / en) * d
    return max(0.0, min(1.0, 2 * sum((-1) ** (k - 1) * math.exp(-2 * k * k * lam * lam) for k in range(1, 101))))


def _ks(a: np.ndarray, b: np.ndarray) -> tuple[float, float]:
    a, b = np.sort(a), np.sort(b)
    grid = np.concatenate([a, b])
    d = np.abs(np.searchsorted(a, grid, side="right") / len(a) - np.searchsorted(b, grid, side="right") / len(b)).max()
    return float(d), _ks_pvalue(float(d), len(a), len(b))


def check_draw(conn: sqlite3.Connection, seed: int = 7) -> list[dict]:
    """추첨 모형이 만든 사정률 분포를 실제 사정률과 견준다(결정기준별)."""
    out = []
    for basis, width in draw.WIDTH_BY_BASIS.items():
        rows = conn.execute(
            "SELECT h.plnprc * 100.0 / h.bssamt FROM prep_head h WHERE h.basis = ? AND h.tot_num = 15 AND EXISTS "
            "(SELECT 1 FROM prep_price p WHERE p.bid_ntce_no = h.bid_ntce_no AND p.bid_ntce_ord = h.bid_ntce_ord)",
            (basis,),
        ).fetchall()
        real = np.array([r[0] for r in rows])
        if len(real) < 5:
            continue
        model = draw.sample_rate(400_000, width, np.random.default_rng(seed))
        d, p = _ks(real, model)
        q = [5, 25, 50, 75, 95]
        out.append({
            "basis": basis, "n": len(real),
            "mean": (round(real.mean(), 4), round(model.mean(), 4)),
            "std": (round(real.std(ddof=1), 4), round(model.std(), 4)),
            "quantiles": {k: (round(float(np.percentile(real, k)), 3), round(float(np.percentile(model, k)), 3)) for k in q},
            "ks_d": round(d, 4), "ks_p": round(p, 3),
        })
    return out


def check_split(conn: sqlite3.Connection) -> dict:
    """공고마다 기초금액 위쪽 예비가격이 정확히 7개인지(결정기준별 분포)."""
    rows = conn.execute(
        "SELECT h.basis, SUM(p.bsis_plnprc > h.bssamt) AS above FROM prep_price p JOIN prep_head h "
        "USING (bid_ntce_no, bid_ntce_ord, bid_clsfc_no, rbid_no) GROUP BY 1, p.bid_ntce_no, p.bid_ntce_ord"
    ).fetchall()
    out: dict = {}
    for basis, above in rows:
        out.setdefault(basis, {}).setdefault(above, 0)
        out[basis][above] += 1
    return out


def check_floor(conn: sqlite3.Connection) -> dict:
    """낙찰률(낙찰금액 ÷ 예정가격)이 하한율 아래로 내려간 적이 있는지.

    A값이 0 이상이면 낙찰률은 반드시 하한율 이상이다. 10억 미만 지자체 공사의 하한율이
    87.745%(2025년 인상 뒤 89.745%)라면, 그보다 낮은 낙찰은 큰 공사에서만 나와야 한다.
    """
    rows = conn.execute(
        "SELECT a.sucsfbid_rate, h.bssamt, a.open_dt, h.basis FROM award a JOIN prep_head h "
        "USING (bid_ntce_no, bid_ntce_ord, bid_clsfc_no, rbid_no) WHERE a.sucsfbid_rate < 95"
    ).fetchall()
    rate = np.array([r[0] for r in rows])
    bss = np.array([r[1] for r in rows], dtype=float)
    dt = np.array([r[2] for r in rows])
    small = bss < 1.1e9                 # 추정가격 10억 ≈ 기초금액 11억(부가세 포함)
    below = rate < 87.745
    new = rate >= 89.745
    return {
        "n": len(rows),
        "below_87.745": int(below.sum()),
        "below_87.745_and_small": int((below & small).sum()),
        "big_notice_rates": sorted(round(float(x), 3) for x in rate[~small]),
        "old_rate_last_open": max(dt[~new].tolist(), default=None),
        "new_rate_first_open": min(dt[new].tolist(), default=None),
        "new_rate_count_since_2025-07": int((new & (dt >= "2025-07-01")).sum()),
        "old_rate_count_since_2025-07": int((~new & (dt >= "2025-07-01")).sum()),
    }
