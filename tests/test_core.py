"""python -m unittest discover -s tests"""
import unittest

import numpy as np

from bidmap import draw, g2b, rules, sim


class DrawTest(unittest.TestCase):
    def test_eight_below_seven_above(self):
        off = draw.sample_prep_offsets(2000, 3.0, np.random.default_rng(1))
        self.assertTrue(((off < 0).sum(axis=1) == 8).all())
        self.assertTrue((np.diff(off, axis=1) > 0).all())
        self.assertGreaterEqual(off.min(), -3.0)
        self.assertLessEqual(off.max(), 3.0)

    def test_rate_centre_is_below_100(self):
        # 아래 8칸·위 7칸이라 기대값은 100 − 0.1
        s = draw.sample_rate(300_000, 3.0, np.random.default_rng(2))
        self.assertAlmostEqual(s.mean(), 99.9, delta=0.01)
        self.assertAlmostEqual(draw.sample_rate(300_000, 2.0, np.random.default_rng(2)).mean(), 100 - 0.1 * 2 / 3, delta=0.01)


class RulesTest(unittest.TestCase):
    def test_bid_and_matched_rate_round_trip(self):
        bss, a, r = 931_916_000, 53_494_980, 89.745
        bid = rules.bid_for_rate(99.9, bss, r, a)
        self.assertGreaterEqual(bid, rules.floor_price(bss * 0.999, r, a))
        self.assertAlmostEqual(rules.matched_rate(bid, bss, r, a), 99.9, places=5)

    def test_a_value_raises_floor_ratio(self):
        # A값이 있으면 하한가÷예정가격이 하한율보다 높아진다(낙찰률 88.4%대 군집의 이유)
        p = 1_000_000_000
        self.assertAlmostEqual(rules.floor_price(p, 87.745) / p * 100, 87.745)
        self.assertGreater(rules.floor_price(p, 87.745, 57_000_000) / p * 100, 88.4)


class SimTest(unittest.TestCase):
    def setUp(self):
        self.draws = draw.sample_rate(200_000, 3.0, np.random.default_rng(3))
        self.grid = np.array([99.0, 99.9, 100.5])

    def test_no_rival_means_clearing_the_floor_is_enough(self):
        p = sim.win_prob(self.grid, self.draws, np.empty((len(self.draws), 0)))
        np.testing.assert_allclose(p, [(self.draws <= g).mean() for g in self.grid])

    def test_one_fixed_rival_takes_everything_below_it(self):
        rival = np.full((len(self.draws), 1), 99.9)
        p = sim.win_prob(np.array([99.5, 100.2]), self.draws, rival)
        self.assertAlmostEqual(p[0], (self.draws <= 99.5).mean())                          # 경쟁사보다 낮게: 내 값까지만
        self.assertAlmostEqual(p[1], ((self.draws > 99.9) & (self.draws <= 100.2)).mean())  # 높게: 그 사이만

    def test_absent_rival_is_ignored(self):
        rival = np.full((len(self.draws), 1), np.nan)
        np.testing.assert_allclose(sim.win_prob(self.grid, self.draws, rival),
                                   sim.win_prob(self.grid, self.draws, np.empty((len(self.draws), 0))))


class ItemsTest(unittest.TestCase):
    def test_three_shapes(self):
        self.assertEqual(g2b.items_of({"items": ""}), [])
        self.assertEqual(g2b.items_of({"items": [{"a": 1}]}), [{"a": 1}])
        self.assertEqual(g2b.items_of({"items": {"item": {"a": 1}}}), [{"a": 1}])


if __name__ == "__main__":
    unittest.main()
