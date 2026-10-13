"""모의시험 — 「그날 알 수 있던 정보만으로 골랐다면 얼마나 유리했나」.

낙찰 여부(0/1)로 세면 공고당 0.6% 확률이라 수백 건으로는 운과 실력을 가를 수 없다.
대신 개찰 뒤 공개된 실제 경쟁사 금액을 놓고, 내 자리의 낙찰 확률을 추첨 분포로 정확히 계산한다
(= 내 바로 아래 빈 구간에 실제 사정률이 떨어질 확률). 추첨 운이 빠지므로 적은 건수로도 비교가 된다.

기준은 「참가자 평균」 = 1 ÷ (참가 업체 수 + 1). 배수 1.0이면 남들과 같다는 뜻이다.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import model
from .model import GRID


def multiple_curves(hist: model.History, cdf: model.DrawCdf) -> np.ndarray:
    """공고·후보별 「참가자 평균 대비 몇 배인가」. 참가 업체 수가 달라도 견줄 수 있게 한 값."""
    return model.curves(hist, cdf) * (hist.notices.n_bids.to_numpy()[:, None] + 1)


def pick(mean_curve: np.ndarray, k: int = 1, min_gap: float = 0.25) -> list[int]:
    """평균 곡선에서 가장 높은 자리 k개(서로 min_gap %p 이상 떨어지게). GRID의 위치를 돌려준다."""
    smooth = model.smooth(mean_curve)
    order = np.argsort(smooth)[::-1]
    chosen: list[int] = []
    for i in order:
        if all(abs(GRID[i] - GRID[j]) >= min_gap for j in chosen):
            chosen.append(int(i))
            if len(chosen) == k:
                break
    return chosen


def field_weights(n_bids: np.ndarray, n_target: float, sigma: float = 0.5, min_eff: float = 60.0) -> np.ndarray:
    """참가 규모가 비슷한 공고일수록 무겁게. 참가 30곳짜리와 180곳짜리는 좋은 자리가 다르다.

    로그 척도의 가우시안 가중. 비슷한 공고가 너무 적어 유효 표본이 min_eff에 못 미치면 폭을 넓힌다.
    """
    d = np.log(np.maximum(n_bids, 2)) - np.log(max(n_target, 2))
    while True:
        w = np.exp(-(d ** 2) / (2 * sigma ** 2))
        if w.sum() ** 2 / (w ** 2).sum() >= min_eff or sigma > 4:
            return w / w.sum()
        sigma *= 1.4


# 참가 업체가 이보다 적을 것으로 보이는 공고는 추천하지 않는다. 경쟁사가 서너 곳뿐이면
# 「빈자리」라는 개념이 통하지 않고(모의시험에서 평균의 0.4배), 배울 표본도 4년에 20여 건뿐이다.
MIN_FIELD = 10


def walk_forward(hist: model.History, mult: np.ndarray, min_train: int = 150, by_field: bool = True,
                 embargo_days: float = 1.0, min_field: float = MIN_FIELD) -> pd.DataFrame:
    """공고를 개찰 순으로 지나가며, 그 전날까지 개찰된 공고만으로 자리를 고르고 실제 결과로 채점한다.

    추천 대상인지(min_field)는 개찰 전에 알 수 있는 예상 참가 수로 가른다 — 실제 참가 수로 가르면 미래를 본 셈이 된다.
    """
    nt = hist.notices
    open_dt = pd.to_datetime(nt.open_dt).to_numpy()
    usable = (nt.n_bids > 0).to_numpy() & nt.clean.to_numpy()
    n_bids = nt.n_bids.to_numpy()
    width = nt.width.to_numpy()
    rows = []
    for t in range(len(nt)):
        if not usable[t]:
            continue
        cutoff = open_dt[t] - np.timedelta64(int(embargo_days * 24), "h")
        train = np.flatnonzero((open_dt < cutoff) & usable & (width == width[t]))
        if len(train) < min_train:
            continue
        n_exp = model.expected_bidders(nt.iloc[train], nt.field.iloc[t])
        if n_exp <= min_field:
            continue
        w = field_weights(n_bids[train], n_exp) if by_field else np.full(len(train), 1 / len(train))
        mean_curve = w @ mult[train]
        i = pick(mean_curve)[0]
        rows.append({
            "nid": t, "open_dt": nt.open_dt.iloc[t], "n_train": len(train), "n_exp": n_exp, "n_bids": int(n_bids[t]),
            "s_pick": GRID[i],
            "expected": float(model.smooth(mean_curve)[i]),      # 고를 때 기대한 배수
            "realized": float(mult[t, i]),                        # 실제 경쟁사 상대로 나온 배수
            "centre": float(mult[t, np.searchsorted(GRID, 99.9)]),  # 비교: 늘 한가운데(99.9%)에 쓰는 경우
            "best_possible": float(mult[t].max()),                # 경쟁사 금액을 미리 알았을 때의 상한
        })
    return pd.DataFrame(rows)


def wins_ratio(multiple: np.ndarray, n_bids: np.ndarray) -> float:
    """이 공고들에 모두 참가했을 때의 기대 낙찰 수 ÷ 참가자 평균의 기대 낙찰 수.

    공고별 배수를 그냥 평균하면 참가 180곳짜리(낙찰 확률 0.5%)와 30곳짜리(3%)가 같은 무게가 된다.
    사업자에게 의미 있는 것은 낙찰 건수이므로, 확률을 더한 값끼리 견준다.
    """
    base = 1 / (n_bids + 1)
    return float((multiple * base).sum() / base.sum())


def summarize(result: pd.DataFrame) -> dict:
    """기대 낙찰 수 비율과 그 불확실성(공고 단위 부트스트랩 90% 구간)."""
    if result.empty:
        return {"n": 0}
    rng = np.random.default_rng(5)
    x, n = result.realized.to_numpy(), result.n_bids.to_numpy()
    pick = rng.integers(0, len(x), size=(4000, len(x)))
    boot = np.array([wins_ratio(x[i], n[i]) for i in pick])
    return {
        "n": len(x),
        "wins_ratio": round(wins_ratio(x, n), 3),
        "ci90": [round(float(np.percentile(boot, 5)), 3), round(float(np.percentile(boot, 95)), 3)],
        "centre_wins_ratio": round(wins_ratio(result.centre.to_numpy(), n), 3),
        "expected_wins": round(float((x / (n + 1)).sum()), 2),
        "average_wins": round(float((1 / (n + 1)).sum()), 2),
        "realized_mean": round(float(x.mean()), 3),          # 공고별 배수의 단순 평균(곡선 눌러 주기에 쓴다)
        "expected_mean": round(float(result.expected.mean()), 3),
        "best_possible_mean": round(float(result.best_possible.mean()), 2),
        "share_above_1": round(float((x > 1).mean()), 3),
    }
