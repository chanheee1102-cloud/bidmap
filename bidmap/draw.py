"""복수예비가격 추첨 모형 — 「기준선이 어디에 떨어질지」의 분포.

대전 상하수도 공고 652건(지자체 기준)에서 예외 없이 확인한 규칙:
  · 예비가격 15개 중 8개는 기초금액 아래(−폭~0을 8칸으로), 7개는 위(0~+폭을 7칸으로),
    칸마다 균등하게 1개씩 만든다. 아래쪽이 하나 더 많아 평균이 −0.1%로 치우친다.
  · 그중 4개가 뽑혀 평균이 예정가격이 된다. 어느 4개가 뽑히는지는 금액 크기와 무관하다
    (예가번호와 금액 순위의 상관 −0.002).
폭은 지자체(행자부 기준) ±3%, 조달청 기준 ±2%.

과거 표본(수백 건)으로 분포를 그리는 대신 이 규칙으로 직접 뽑으므로, 표본이 적은 꼬리도 매끈하다.
"""
from __future__ import annotations

import numpy as np

N_LOW, N_HIGH, N_PICK = 8, 7, 4
WIDTH_BY_BASIS = {"행자부": 3.0, "조달청": 2.0}


def sample_prep_offsets(n: int, width: float = 3.0, rng: np.random.Generator | None = None) -> np.ndarray:
    """예비가격 15개의 기초금액 대비 편차(%). shape (n, 15), 행마다 오름차순."""
    rng = rng or np.random.default_rng()
    low_w, high_w = width / N_LOW, width / N_HIGH
    low = -width + low_w * (np.arange(N_LOW) + rng.random((n, N_LOW)))
    high = high_w * (np.arange(N_HIGH) + rng.random((n, N_HIGH)))
    return np.concatenate([low, high], axis=1)


def sample_rate(n: int, width: float = 3.0, rng: np.random.Generator | None = None) -> np.ndarray:
    """사정률(예정가격 ÷ 기초금액, %) n개."""
    rng = rng or np.random.default_rng()
    offsets = sample_prep_offsets(n, width, rng)
    # 행마다 15개 중 4개를 겹치지 않게: 난수를 정렬한 순서의 앞 4개
    pick = np.argsort(rng.random(offsets.shape), axis=1)[:, :N_PICK]
    return 100.0 + np.take_along_axis(offsets, pick, axis=1).mean(axis=1)
