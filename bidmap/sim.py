"""낙찰 확률 계산.

낙찰자는 「하한가 이상을 쓴 업체 중 가장 낮은 금액」이다. 금액을 맞춘 사정률(rules.matched_rate)로 바꿔 놓으면:

    내가 이긴다  ⟺  실제 사정률 ≤ 내 값 < 하한선을 넘긴 경쟁사 중 가장 낮은 값

실제 사정률은 추첨(draw.sample_rate), 경쟁사 값은 과거 투찰 기록에서 뽑아 회차마다 겨뤄 본다.
"""
from __future__ import annotations

import numpy as np


def win_prob(my_rates: np.ndarray, draw_rates: np.ndarray, rival_rates: np.ndarray) -> np.ndarray:
    """후보별 낙찰 확률.

    my_rates    (G,)    내가 고를 수 있는 맞춘 사정률 후보
    draw_rates  (M,)    회차별 실제 사정률
    rival_rates (M, N)  회차별 경쟁사들의 맞춘 사정률(불참은 nan)
    """
    passed = np.where(rival_rates >= draw_rates[:, None], rival_rates, np.inf)   # nan 비교는 False → inf
    best_rival = passed.min(axis=1) if passed.shape[1] else np.full(len(draw_rates), np.inf)
    mine = my_rates[None, :]
    won = (mine >= draw_rates[:, None]) & (mine < best_rival[:, None])
    return won.mean(axis=0)
