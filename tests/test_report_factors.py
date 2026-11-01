"""The code-computed facts for the 20 factors: day logic, Rightmove search-step
visibility, stamp duty and affordability, and net proceeds."""
from __future__ import annotations

import unittest

from app.services import report_factors as rf


class StructureTests(unittest.TestCase):
    def test_exactly_twenty_factors_in_order(self):
        self.assertEqual(len(rf.FACTORS), 20)
        self.assertEqual([f["num"] for f in rf.FACTORS], list(range(1, 21)))
        self.assertEqual(len(set(rf.FACTOR_KEYS)), 20)
        for f in rf.FACTORS:
            self.assertTrue(f["name"] and f["locked_subtext"])

    def test_the_two_private_data_factors_are_always_check(self):
        self.assertEqual(set(rf.ALWAYS_CHECK_KEYS), {"engagement", "viewing_conversion"})


class DayTests(unittest.TestCase):
    def test_reduced_wins_over_advertised(self):
        self.assertEqual(rf.day_sentence(12, 96),
                         "Your price was last reduced 12 days ago, and it's still on the market.")

    def test_advertised_when_not_reduced(self):
        self.assertEqual(rf.day_sentence(None, 96), "Your property has been advertised for 96 days.")
        self.assertEqual(rf.day_sentence(None, 1), "Your property has been advertised for 1 day.")

    def test_none_when_no_date(self):
        self.assertIsNone(rf.day_sentence(None, None))

    def test_agent_wording(self):
        self.assertEqual(rf.day_sentence(None, 40, agent=True), "This property has been advertised for 40 days.")
        self.assertTrue(rf.day_sentence(5, None, agent=True).startswith("This property's price was last reduced"))


class VisibilityTests(unittest.TestCase):
    def test_just_above_a_step_is_a_problem(self):
        v = rf.visibility(390_000)
        self.assertTrue(v["just_above_step"])
        self.assertEqual(v["floor_step"], 375_000)
        self.assertEqual(v["gap_to_floor"], 15_000)
        self.assertEqual(v["verdict"], rf.PROBLEM)

    def test_on_a_step_is_fine(self):
        v = rf.visibility(375_000)
        self.assertTrue(v["on_step"])
        self.assertFalse(v["just_above_step"])
        self.assertEqual(v["verdict"], rf.WORKING_WELL)

    def test_well_clear_of_a_step_is_fine(self):
        # £372k is £22k (5.9%) above the £350k step, too far to be a cheap win.
        self.assertFalse(rf.visibility(372_000)["just_above_step"])
        self.assertEqual(rf.visibility(372_000)["verdict"], rf.WORKING_WELL)

    def test_unknown_price(self):
        self.assertFalse(rf.visibility(None)["known"])
        self.assertFalse(rf.visibility(0)["known"])


class StampDutyTests(unittest.TestCase):
    def test_known_prices(self):
        # 0% to £125k, 2% to £250k, 5% above.
        self.assertEqual(rf.sdlt_england(125_000), 0)
        self.assertEqual(rf.sdlt_england(250_000), 2_500)        # 2% of the £125k-£250k slice
        self.assertEqual(rf.sdlt_england(390_000), 9_500)        # 2,500 + 5% of 140,000
        self.assertEqual(rf.sdlt_england(500_000), 15_000)       # 2,500 + 5% of 250,000
        self.assertIsNone(rf.sdlt_england(None))

    def test_affordability_england(self):
        a = rf.affordability(390_000)
        self.assertEqual(a["deposit"], 39_000)
        self.assertEqual(a["stamp_duty"], 9_500)
        self.assertTrue(a["stamp_duty_known"])
        # (390,000 - 39,000) / 4.5 = 78,000
        self.assertEqual(a["required_income"], 78_000)

    def test_affordability_wales_has_no_stamp_duty_figure(self):
        a = rf.affordability(390_000, country="Wales")
        self.assertFalse(a["stamp_duty_known"])
        self.assertIsNone(a["stamp_duty"])
        self.assertEqual(a["deposit"], 39_000)  # deposit/income still computed


class NetProceedsTests(unittest.TestCase):
    def test_a_lower_price(self):
        n = rf.net_proceeds_effect(390_000, 375_000)
        self.assertTrue(n["lower"])
        self.assertEqual(n["difference"], -15_000)
        self.assertEqual(n["pct"], 3.8)

    def test_unknown(self):
        self.assertFalse(rf.net_proceeds_effect(None, 375_000)["known"])


if __name__ == "__main__":
    unittest.main()
