"""과거 투찰 기록으로 「어느 금액에 쓰면 낙찰 확률이 높은가」를 계산한다.

모든 투찰금액을 맞춘 사정률(rules.matched_rate)로 바꿔 한 축 위에 놓는다. 그러면

    내 값 s로 이길 확률 = 실제 사정률이 (내 바로 아래 경쟁사 값, s] 사이에 떨어질 확률
                        = F(s) − F(바로 아래 경쟁사 값)

F는 추첨 모형(draw)의 누적분포라 정확히 알고, 경쟁사 값만 과거 기록에서 배운다.
즉 「바로 아래가 비어 있는 자리」가 좋은 자리다.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import draw, rules

GRID = np.round(np.arange(97.0, 103.0001, 0.001), 3)      # 후보 사정률(0.001%p 간격)


class DrawCdf:
    """추첨 모형의 누적분포. 폭(±3%, ±2%)별로 한 번 만들어 둔다."""

    def __init__(self, n: int = 2_000_000, seed: int = 11, chunk: int = 100_000):
        self._sorted: dict[float, np.ndarray] = {}
        self._n, self._seed, self._chunk = n, seed, chunk

    def __call__(self, width: float, x: np.ndarray) -> np.ndarray:
        if width not in self._sorted:
            # 한 번에 n줄을 뽑으면 n×15칸짜리 표 세 개(약 700MB)가 생긴다. 서버(메모리 1GB)에서 이 때문에
            # 프로세스가 죽었다 — 나눠 뽑고 결과(줄당 숫자 하나)만 모은다.
            rng = np.random.default_rng(self._seed)
            parts = [draw.sample_rate(min(self._chunk, self._n - i), width, rng).astype(np.float32)
                     for i in range(0, self._n, self._chunk)]
            self._sorted[width] = np.sort(np.concatenate(parts))
        s = self._sorted[width]
        return np.searchsorted(s, x, side="right") / len(s)


@dataclass
class History:
    notices: pd.DataFrame      # 낙찰 공고 1행: 실제 사정률·기초금액·하한율·A값·폭·참가 수·조건
    bids: pd.DataFrame         # 투찰 1행: nid(공고 순번)·bizno·s(맞춘 사정률)·amt·rank·rmrk


def _license_signature(conn: sqlite3.Connection) -> pd.DataFrame:
    """공고별 면허 조건을 한 줄로. 같은 그룹은 '+'(모두 필요), 그룹 사이는 ' | '(하나만 충족), *는 주력분야 제한."""
    lic = pd.read_sql_query("SELECT bid_ntce_no, bid_ntce_ord, grp, lcns_nm, mfrc FROM license_limit", conn)
    if lic.empty:
        return pd.DataFrame(columns=["bid_ntce_no", "bid_ntce_ord", "sig"])
    code = lic.lcns_nm.str.extract(r"/(\d+)$")[0].fillna(lic.lcns_nm)
    lic["item"] = code + np.where(lic.mfrc.fillna("").str.len() > 0, "*", "")
    grp = lic.groupby(["bid_ntce_no", "bid_ntce_ord", "grp"]).item.apply(lambda x: "+".join(sorted(set(x)))).reset_index()
    return grp.groupby(["bid_ntce_no", "bid_ntce_ord"]).item.apply(lambda x: " | ".join(sorted(set(x)))).rename("sig").reset_index()


def field_key(sig: str | None, name: str | None) -> str:
    """참가 업체 수를 가르는 조건. 면허 조건이 같아도 준설 공사는 장비를 가진 업체만 들어와 따로 본다."""
    return f"{sig or '?'}{'/준설' if '준설' in (name or '') else ''}"


def load(conn: sqlite3.Connection) -> History:
    notices = pd.read_sql_query(
        """
        SELECT a.bid_ntce_no, a.bid_ntce_ord, a.bid_clsfc_no, a.rbid_no, a.ntce_nm, a.dminstt_nm, a.open_dt,
               a.prtcpt_cnum, a.winner_bizno, a.sucsfbid_amt,
               h.plnprc, h.bssamt, h.basis, n.floor_rate, n.presmpt_prce, b.a_value, b.rng_end
        FROM award a
        JOIN prep_head h USING (bid_ntce_no, bid_ntce_ord, bid_clsfc_no, rbid_no)
        JOIN notice n USING (bid_ntce_no, bid_ntce_ord)
        JOIN base_amount b USING (bid_ntce_no, bid_ntce_ord, bid_clsfc_no)
        WHERE h.tot_num = 15 AND n.floor_rate > 0 AND h.bssamt > 0
        ORDER BY a.open_dt
        """, conn)
    notices["nid"] = np.arange(len(notices))
    notices["rate"] = notices.plnprc / notices.bssamt * 100
    notices["width"] = notices.rng_end.fillna(notices.basis.map(draw.WIDTH_BY_BASIS)).abs()
    notices = notices.merge(_license_signature(conn), on=["bid_ntce_no", "bid_ntce_ord"], how="left")
    notices["field"] = [field_key(s if isinstance(s, str) else None, n) for s, n in zip(notices.sig, notices.ntce_nm)]

    bids = pd.read_sql_query(
        "SELECT bid_ntce_no, bid_ntce_ord, bid_clsfc_no, rbid_no, bizno, nm, rank, amt, rmrk FROM bidder WHERE amt > 0", conn)
    bids = bids.merge(notices[["bid_ntce_no", "bid_ntce_ord", "bid_clsfc_no", "rbid_no", "nid", "bssamt", "floor_rate", "a_value", "plnprc"]],
                      on=["bid_ntce_no", "bid_ntce_ord", "bid_clsfc_no", "rbid_no"])
    bids["s"] = rules.matched_rate(bids.amt, bids.bssamt, bids.floor_rate, bids.a_value)

    # 하한가 공식이 공개된 통과·탈락을 그대로 재현하는 공고만 쓴다. 어긋나는 공고(1~2%)는
    # 공개된 A값이 실제와 다르거나 다른 규칙이 적용된 경우라, 그 공고의 맞춘 사정률을 믿을 수 없다.
    judged = bids[bids.rmrk.isin(["정상", "낙찰하한선 미달"])]
    floor = rules.floor_price(judged.plnprc, judged.floor_rate, judged.a_value)
    agree = ((judged.amt >= np.ceil(floor - 1e-6)) == judged.rmrk.eq("정상")).groupby(judged.nid).mean()
    notices["n_bids"] = bids.groupby("nid").size().reindex(notices.nid).fillna(0).astype(int).to_numpy()
    notices["clean"] = (agree.reindex(notices.nid).fillna(0) >= 0.999).to_numpy()
    return History(notices, bids[["nid", "bizno", "nm", "rank", "amt", "rmrk", "s", "plnprc", "floor_rate", "a_value"]])


def expected_bidders(past: pd.DataFrame, field: str, last: int = 12) -> float:
    """개찰 전에 알 수 있는 조건(면허·준설 여부)이 같은 최근 공고들의 참가 업체 수 중앙값."""
    same = past[past.field == field]
    if len(same) >= 3:
        return float(same.n_bids.tail(last).median())
    sig = field.split("/")[0]
    near = past[past.field.str.split("/").str[0] == sig]
    pool = near if len(near) >= 3 else past
    return float(pool.n_bids.tail(40).median())


def win_curve(rival_s: np.ndarray, width: float, cdf: DrawCdf, grid: np.ndarray = GRID) -> np.ndarray:
    """이 경쟁사들을 상대로 후보 값마다의 낙찰 확률."""
    r = np.sort(rival_s)
    below = np.searchsorted(r, grid, side="left")             # 내 값보다 낮은 경쟁사 수
    prev = np.where(below > 0, r[np.maximum(below - 1, 0)], -np.inf)
    return cdf(width, grid) - cdf(width, prev)


def curves(hist: History, cdf: DrawCdf) -> np.ndarray:
    """공고마다의 낙찰 확률 곡선. shape (공고 수, 후보 수)."""
    out = np.zeros((len(hist.notices), len(GRID)), dtype=np.float32)
    by_notice = hist.bids.groupby("nid").s
    for nid, width in zip(hist.notices.nid, hist.notices.width):
        if nid in by_notice.groups:
            out[nid] = win_curve(by_notice.get_group(nid).to_numpy(), width, cdf)
    return out


def smooth(curve: np.ndarray, half: int = 100) -> np.ndarray:
    """±half칸(기본 ±0.1%p) 이동평균. 경쟁사 자리는 공고마다 그 정도는 흔들리므로, 더 가는 굴곡은 우연으로 본다."""
    k = np.ones(2 * half + 1) / (2 * half + 1)
    return np.convolve(curve, k, mode="same")
