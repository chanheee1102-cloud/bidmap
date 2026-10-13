"""낙찰하한가(기준선) 계산.

    하한가 = (예정가격 − A값) × 낙찰하한율 + A값

A값은 국민연금·건강보험료처럼 깎을 수 없는 비용의 합이다. 공고마다 다르고, 없는 공고는 0이다.
업체는 예정가격을 모른 채 투찰하므로, 투찰금액마다 「이 금액이 딱 하한가가 되는 사정률」이 하나씩 정해진다.
그 값을 맞춘 사정률이라 부른다 — 실제 사정률이 그 이하로 나와야 하한가를 넘긴다.
"""
from __future__ import annotations

import math


def floor_price(plnprc: float, rate_pct: float, a_value: float = 0.0) -> float:
    return (plnprc - a_value) * rate_pct / 100 + a_value


def matched_rate(bid: float, bssamt: float, rate_pct: float, a_value: float = 0.0) -> float:
    """이 투찰금액이 딱 하한가가 되는 사정률(%)."""
    return ((bid - a_value) / (rate_pct / 100) + a_value) / bssamt * 100


def bid_for_rate(s_pct: float, bssamt: float, rate_pct: float, a_value: float = 0.0) -> int:
    """사정률 s%를 겨냥한 투찰금액. 하한가 미만이 되지 않게 원 단위로 올린다."""
    return math.ceil(floor_price(bssamt * s_pct / 100, rate_pct, a_value))
