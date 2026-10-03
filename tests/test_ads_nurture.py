"""Meta-ads funnel: link cleaning, email flow timing, and email content."""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.services import ads_funnel, ads_nurture as an
from app.services import email_service

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)


def plan(audience="owner", *, at, sent=None, visited=None, closed=None):
    return an.plan_next_nurture_email(
        audience=audience, anchor=T0, now=at, sent=sent or {},
        checkout_visited_at=visited, property_closed_at=closed,
    )


class ContentTests(unittest.TestCase):
    def test_every_email_of_each_brief_is_there(self):
        self.assertEqual(len(an.flow_content("vendor")["main"]), 52)
        self.assertEqual(len(an.flow_content("vendor")["checkout"]), 3)
        self.assertEqual(len(an.flow_content("agent")["main"]), 104)
        self.assertEqual(len(an.flow_content("agent")["checkout"]), 3)
        self.assertEqual(len(an.flow_content("agent")["closed"]), 1)
        self.assertEqual([e["days"] for e in an.flow_content("url_reminder")["main"]], [0, 1, 3, 7, 14])

    def test_schedules_match_the_briefs(self):
        vendor = an.flow_content("vendor")
        self.assertEqual([e["days"] for e in vendor["main"][:3]], [0, 2, 5])
        self.assertEqual(vendor["main"][-1]["days"], 177)
        self.assertEqual([e["hours"] for e in vendor["checkout"]], [2, 24, 72])
        agent = an.flow_content("agent")
        self.assertEqual([e["days"] for e in agent["main"][:2]], [0, 3])
        self.assertEqual(agent["main"][-1]["days"], 360)

    def test_days_never_go_backwards(self):
        for name in ("vendor", "agent"):
            days = [e["days"] for e in an.flow_content(name)["main"]]
            self.assertEqual(days, sorted(days), name)


class NurturePlanTests(unittest.TestCase):
    def test_first_email_immediately(self):
        self.assertEqual(plan(at=T0), ("main", 1))
        self.assertEqual(plan("agent", at=T0), ("main", 1))

    def test_waits_for_the_next_day(self):
        sent = {("main", 1): T0}
        self.assertIsNone(plan(at=T0 + timedelta(days=1), sent=sent))
        self.assertEqual(plan(at=T0 + timedelta(days=2), sent=sent), ("main", 2))
        self.assertIsNone(plan("agent", at=T0 + timedelta(days=2), sent=sent))
        self.assertEqual(plan("agent", at=T0 + timedelta(days=3), sent=sent), ("main", 2))

    def test_after_a_gap_skips_to_the_latest_due_email(self):
        sent = {("main", 1): T0}
        # Day 10 of the vendor flow: emails 2 (day 2), 3 (day 5) and 4 (day 9) are
        # due; only the latest goes, the others aren't sent late.
        self.assertEqual(plan(at=T0 + timedelta(days=10), sent=sent), ("main", 4))
        sent[("main", 4)] = T0 + timedelta(days=10)
        self.assertIsNone(plan(at=T0 + timedelta(days=11), sent=sent))
        self.assertEqual(plan(at=T0 + timedelta(days=12), sent=sent), ("main", 5))

    def test_done_after_the_last_email(self):
        sent = {("main", 52): T0 + timedelta(days=177)}
        self.assertIsNone(plan(at=T0 + timedelta(days=400), sent=sent))

    def test_checkout_branch_pauses_the_main_flow_then_hands_back(self):
        visited = T0 + timedelta(hours=1)
        sent = {("main", 1): T0}
        self.assertIsNone(plan(at=visited + timedelta(hours=1), sent=sent, visited=visited))
        self.assertEqual(plan(at=visited + timedelta(hours=2), sent=sent, visited=visited), ("checkout", 1))
        sent[("checkout", 1)] = visited + timedelta(hours=2)
        self.assertEqual(plan(at=visited + timedelta(hours=24), sent=sent, visited=visited), ("checkout", 2))
        sent[("checkout", 2)] = visited + timedelta(hours=24)
        # Day 2's main email is due, but the branch is running.
        self.assertIsNone(plan(at=T0 + timedelta(days=2), sent=sent, visited=visited))
        self.assertEqual(plan(at=visited + timedelta(hours=72), sent=sent, visited=visited), ("checkout", 3))
        sent[("checkout", 3)] = visited + timedelta(hours=72)
        # Branch over: back to the main flow with the email it held back
        # (day 2's), once the minimum gap since the last email has passed,
        # then on schedule (day 5's).
        self.assertIsNone(plan(at=visited + timedelta(hours=80), sent=sent, visited=visited))
        self.assertEqual(plan(at=visited + timedelta(hours=93), sent=sent, visited=visited), ("main", 2))
        sent[("main", 2)] = visited + timedelta(hours=93)
        self.assertEqual(plan(at=T0 + timedelta(days=5), sent=sent, visited=visited), ("main", 3))

    def test_a_branch_email_long_overdue_is_skipped(self):
        visited = T0
        sent = {("main", 1): T0}
        at = visited + timedelta(hours=60)
        # The 2h and 24h emails are well past; the 72h one isn't due yet.
        self.assertIsNone(plan(at=at, sent=sent, visited=visited))
        self.assertEqual(plan(at=visited + timedelta(hours=72), sent=sent, visited=visited), ("checkout", 3))

    def test_an_old_unfinished_branch_no_longer_pauses(self):
        visited = T0
        sent = {("main", 1): T0}
        self.assertEqual(plan(at=T0 + timedelta(days=5), sent=sent, visited=visited), ("main", 3))

    def test_agent_closed_property_gets_the_sold_email_once(self):
        closed = T0 + timedelta(days=4)
        sent = {("main", 1): T0, ("main", 2): T0 + timedelta(days=3)}
        self.assertEqual(plan("agent", at=closed, sent=sent, closed=closed), ("closed", 1))

    def test_agent_closed_property_skips_emails_about_it(self):
        closed = T0 + timedelta(days=4)
        sent = {("main", 1): T0, ("closed", 1): closed}
        content = an.flow_content("agent")["main"]
        for day in range(5, 361, 3):
            got = plan("agent", at=T0 + timedelta(days=day), sent=sent, closed=closed)
            if got:
                entry = next(e for e in content if e["stage"] == got[1])
                self.assertNotIn("[Property Address]", entry["subject"] + " ".join(entry["paragraphs"]))
                self.assertFalse(entry["cta"].startswith("VIEW "))
                sent[got] = T0 + timedelta(days=day)
        self.assertTrue(any(flow == "main" and stage > 2 for flow, stage in sent))


class ReminderPlanTests(unittest.TestCase):
    def test_reminder_schedule(self):
        self.assertEqual(an.plan_next_reminder(created_at=T0, now=T0, sent=[]), 1)
        self.assertIsNone(an.plan_next_reminder(created_at=T0, now=T0 + timedelta(hours=5), sent=[1]))
        self.assertEqual(an.plan_next_reminder(created_at=T0, now=T0 + timedelta(days=1), sent=[1]), 2)
        self.assertEqual(an.plan_next_reminder(created_at=T0, now=T0 + timedelta(days=14), sent=[1, 2, 3, 4]), 5)
        self.assertIsNone(an.plan_next_reminder(created_at=T0, now=T0 + timedelta(days=15), sent=[1, 2, 3, 4, 5]))

    def test_stops_after_the_window(self):
        self.assertIsNone(an.plan_next_reminder(created_at=T0, now=T0 + timedelta(days=30), sent=[1]))


class LinkTests(unittest.TestCase):
    def test_rightmove_links_are_cleaned(self):
        for raw in (
            "https://www.rightmove.co.uk/properties/123456789#/?channel=RES_BUY",
            "rightmove.co.uk/properties/123456789?utm_source=app",
            "  https://rightmove.co.uk/properties/123456789/  ",
        ):
            self.assertEqual(ads_funnel.clean_rightmove_url(raw), "https://www.rightmove.co.uk/properties/123456789")

    def test_other_links_are_refused_with_a_reason(self):
        with self.assertRaisesRegex(ads_funnel.ListingLinkError, "Rightmove"):
            ads_funnel.clean_rightmove_url("https://www.zoopla.co.uk/for-sale/details/12345/")
        with self.assertRaises(ads_funnel.ListingLinkError):
            ads_funnel.clean_rightmove_url("my house")

    def test_signed_tokens_are_per_record(self):
        a, b = uuid4(), uuid4()
        self.assertNotEqual(an.nurture_access_token(a), an.nurture_access_token(b))
        self.assertEqual(an.nurture_access_token(a), an.nurture_access_token(a))
        self.assertNotEqual(an.closed_token(a), ads_funnel.reminder_unsubscribe_token(a))
        self.assertTrue(ads_funnel.verify_reminder_unsubscribe(str(a), ads_funnel.reminder_unsubscribe_token(a)))
        self.assertFalse(ads_funnel.verify_reminder_unsubscribe(str(b), ads_funnel.reminder_unsubscribe_token(a)))


def _prospect(audience="owner", closed=None):
    return SimpleNamespace(
        id=uuid4(), audience=audience, property_address="12 Oak Lane, Guildford, GU1",
        postcode="GU1 3AB", property_closed_at=closed,
    )


class RenderTests(unittest.TestCase):
    def test_vendor_email_fills_the_address_and_links_the_assessment(self):
        p = _prospect()
        email = an.render_nurture_email(p, "main", 1)
        self.assertEqual(email["subject"], "We’ve started looking at 12 Oak Lane, Guildford, GU1 3AB")
        self.assertIn(f"/assess/seller?token={an.nurture_access_token(p.id)}&step=assessment", email["cta_url"])
        self.assertEqual(email["note_link_text"], "Click here")
        self.assertIn("/prospects/property-closed?", email["note_link_url"])

    def test_checkout_recovery_goes_to_payment(self):
        email = an.render_nurture_email(_prospect(), "checkout", 3)
        self.assertEqual(email["cta_label"], "COMPLETE MY ASSESSMENT")
        self.assertTrue(email["cta_url"].endswith("&step=payment"))

    def test_agent_assess_another_listing_goes_to_the_landing_page(self):
        p = _prospect("agent")
        content = an.flow_content("agent")["main"]
        stage = next(e["stage"] for e in content if e["cta"].startswith("ASSESS "))
        email = an.render_nurture_email(p, "main", stage)
        self.assertTrue(email["cta_url"].endswith("/assess/agent"))
        self.assertEqual(email["note_link_text"], "Tell us")

    def test_agent_note_dropped_once_property_closed(self):
        email = an.render_nurture_email(_prospect("agent", closed=T0), "main", 30)
        self.assertIsNone(email["note"])

    def test_reminder_links_back_to_the_link_step(self):
        lead = SimpleNamespace(id=uuid4(), audience="owner")
        email = an.render_reminder_email(lead, 3)
        self.assertEqual(email["subject"], "Not sure where to find your property link?")
        self.assertIn(f"/assess/seller?reminder={ads_funnel.reminder_token(lead.id)}#listing-link", email["cta_url"])
        self.assertIn("/ads/reminder-unsubscribe?", email["unsubscribe_url"])

    def test_html_escapes_and_includes_every_part(self):
        captured = {}
        original = email_service._send_sync
        email_service._send_sync = lambda **kw: captured.update(kw) or True
        try:
            email_service.send_ads_flow_email_sync(
                to_email="a@example.com", first_name="Sam <b>", **an.render_nurture_email(_prospect(), "main", 2)
            )
        finally:
            email_service._send_sync = original
        html = captured["html_body"]
        self.assertIn("Sam &lt;b&gt;", html)
        self.assertIn("VIEW MY PROPERTY ASSESSMENT ›", html)
        self.assertIn("Regards,<br />The Havlo Team", html)
        self.assertIn(">Click here</a>", html)
        self.assertIn("Unsubscribe", captured["plain_body"])



class SummaryTests(unittest.TestCase):
    REPORT = {
        "scores": {"buyer_appeal": 41, "pricing": 58, "listing_presentation": 44, "competition": 39},
        "key_findings": [
            {"title": "Price reduced but still overlooked", "description": "Your property has undergone a price reduction but continues to compete against newer listings.", "type": "issue", "icon": "price"},
            {"title": "Lead photo undersells the garden", "description": "The first image is dark.", "type": "issue", "icon": "photos"},
            {"title": "Generous plot", "description": "A large garden.", "type": "strength", "icon": "location"},
        ],
        "action_plan": [
            {"title": "Reshoot the lead photo", "description": "Bright, wide exterior."},
            {"title": "Add a floorplan", "description": "Buyers filter for them."},
            {"title": "Review the asking price", "description": "Against recent sales."},
        ],
    }

    def _prospect(self, competition=None, competition_at=None):
        import json
        return SimpleNamespace(
            agent_edited_report_json=None, report_json=json.dumps(self.REPORT), preview_json="{}",
            competition_json=json.dumps(competition) if competition else None, competition_at=competition_at,
            country="UK",
        )

    def test_score_wording(self):
        self.assertEqual(ads_funnel.score_status(41), "Needs attention")
        self.assertEqual(ads_funnel.score_status(58), "Review recommended")
        self.assertEqual(ads_funnel.score_status(80), "Performing well")
        self.assertIsNone(ads_funnel.score_status(None))
        self.assertIsNone(ads_funnel.score_status("n/a"))

    def test_presentation_counts_distinct_presentation_points(self):
        # The photo finding, the reshoot and the floorplan; not price, not the strength.
        self.assertEqual(ads_funnel.presentation_opportunities(self.REPORT), 3)
        self.assertEqual(ads_funnel.presentation_opportunities({}), 0)

    def test_summary_comes_from_the_report(self):
        summary = ads_funnel.assessment_summary(self._prospect({"status": "ready", "count": 7, "basis": "similar", "area": "within a mile"}))
        self.assertEqual(summary["buyer_appeal"], "Needs attention")
        self.assertEqual(summary["pricing"], "Review recommended")
        self.assertEqual(summary["presentation"]["count"], 3)
        self.assertEqual(summary["competition"]["count"], 7)
        self.assertEqual(summary["competition"]["fallback"], "Needs attention")
        self.assertTrue(summary["finding"].startswith("Your property has undergone a price reduction"))

    def test_competition_search_runs_once(self):
        now = datetime.now(timezone.utc)
        self.assertTrue(ads_funnel.competition_needs_search(self._prospect()))
        self.assertFalse(ads_funnel.competition_needs_search(self._prospect({"status": "pending"}, now)))
        self.assertTrue(ads_funnel.competition_needs_search(self._prospect({"status": "pending"}, now - timedelta(minutes=10))))
        self.assertFalse(ads_funnel.competition_needs_search(self._prospect({"status": "ready", "count": 3})))
        self.assertFalse(ads_funnel.competition_needs_search(self._prospect({"status": "unavailable"})))

    def test_reminder_emails_only_mention_rightmove(self):
        import json
        text = json.dumps(an.flow_content("url_reminder"), ensure_ascii=False)
        self.assertNotIn("Zoopla", text)
        self.assertNotIn("OnTheMarket", text)
        self.assertIn("Rightmove", text)


class RateLimitTests(unittest.TestCase):
    def test_reminders_limited_per_connection(self):
        from fastapi import HTTPException
        from app.routers import stale_listings as sl

        sl._ads_attempts.clear()
        request = SimpleNamespace(headers={"x-forwarded-for": "203.0.113.9"}, client=None)
        for _ in range(sl._ADS_LIMITS["reminder"]):
            sl._ads_rate_limit(request, "reminder")
        with self.assertRaises(HTTPException) as ctx:
            sl._ads_rate_limit(request, "reminder")
        self.assertEqual(ctx.exception.status_code, 429)
        # Another connection, and the other endpoint, are unaffected.
        sl._ads_rate_limit(SimpleNamespace(headers={"x-forwarded-for": "203.0.113.10"}, client=None), "reminder")
        sl._ads_rate_limit(request, "start")
        sl._ads_attempts.clear()


if __name__ == "__main__":
    unittest.main()
