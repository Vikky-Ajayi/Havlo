"""Console > Compare models: every model writes from the same facts, the same
checks run on each, and the model choice never leaks into live reports."""
from __future__ import annotations

import asyncio
import types
import unittest
from unittest import mock

from app.services import groq_service, model_comparison
from app.services import stale_prospect_service as sps

FINDINGS = [
    {"title": "Listing is losing momentum", "icon": "timing", "type": "issue",
     "description": "The home has been on the market for 40 days."},
    {"title": "Sparse visual storytelling", "icon": "photos", "type": "issue",
     "description": "The living room appears cluttered."},
]


def fake_response(content="{}", prompt_tokens=1000, completion_tokens=500):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content), finish_reason="stop")],
        usage=types.SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens),
    )


class RoutingTests(unittest.TestCase):
    def test_default_is_the_current_model(self):
        self.assertEqual(groq_service.REPORT_MODEL.get(), ("groq", groq_service.GROQ_MODEL))

    def test_openai_calls_go_to_openai_and_are_logged(self):
        calls = []

        async def go():
            groq_service.REPORT_MODEL.set(("openai", "gpt-6-luna"))
            groq_service.REPORT_CALLS.set(calls)
            with mock.patch.object(groq_service, "_openai_chat", return_value=fake_response()) as chat:
                await asyncio.to_thread(groq_service._report_chat, messages=[], max_tokens=10)
            return chat.call_args.args[0]

        self.assertEqual(asyncio.run(go()), "gpt-6-luna")
        self.assertEqual(calls[0]["prompt_tokens"], 1000)
        # Set inside that run's own context: live reports still use Groq.
        self.assertEqual(groq_service.REPORT_MODEL.get(), ("groq", groq_service.GROQ_MODEL))

    def test_refused_parameters_are_dropped(self):
        responses = [
            types.SimpleNamespace(status_code=400, text="Unsupported parameter: 'temperature' is not supported"),
            types.SimpleNamespace(status_code=200, text="", json=lambda: {
                "choices": [{"message": {"content": "{}"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 5, "completion_tokens": 7}}),
        ]
        sent = []

        def fake_post(url, json, headers, timeout):
            sent.append(dict(json))
            return responses.pop(0)

        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test"}), mock.patch("httpx.post", fake_post):
            out = groq_service._openai_chat("gpt-6-luna", {"messages": [], "max_tokens": 10, "temperature": 0.35})
        self.assertIn("temperature", sent[0])
        self.assertNotIn("temperature", sent[1])
        self.assertEqual(sent[1]["max_completion_tokens"], 10)
        self.assertEqual(out.usage.completion_tokens, 7)


class WriteTests(unittest.TestCase):
    def test_each_model_is_checked_on_the_same_facts(self):
        prospect = types.SimpleNamespace(
            property_address="1 Test Road", rightmove_url="https://www.rightmove.co.uk/properties/1",
            listing_duration_days=40, asking_price=250_000, bedrooms=3, bathrooms=1, listed_date=None,
        )
        snapshot = {"description": "A three-bedroom home.", "media": {"photos": 20, "floorplans": 1, "virtual_tours": 0}}

        async def fake_generate(**kwargs):
            await asyncio.to_thread(groq_service._report_chat, messages=[], max_tokens=10)
            return {"key_findings": [dict(f) for f in FINDINGS]}

        def fake_chat(model, body):
            return fake_response(prompt_tokens=2_000_000, completion_tokens=1_000_000)

        async def go():
            with mock.patch.object(sps, "generate_prospect_report", fake_generate), \
                    mock.patch.object(groq_service, "_openai_chat", fake_chat), \
                    mock.patch.object(groq_service, "_get_client", return_value=types.SimpleNamespace(
                        chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=lambda **kw: fake_response())))):
                return await asyncio.gather(
                    model_comparison._write("groq", groq_service.GROQ_MODEL, prospect=prospect, snapshot=snapshot, sales=[]),
                    model_comparison._write("openai", "gpt-6-luna", prospect=prospect, snapshot=snapshot, sales=[]),
                )

        current, luna = asyncio.run(go())
        for result in (current, luna):
            self.assertTrue(result["ok"])
            self.assertEqual([f["title"] for f in result["preview"]], ["Listing is losing momentum"])
            self.assertEqual({r["rule"] for r in result["removed"]}, {"unseen_photos"})
        self.assertEqual(luna["cost_usd"], 0.7)  # 2M input at $0.10 + 1M output at $0.50
        self.assertEqual(model_comparison.summary({"models": [{"provider": "openai", "model": "gpt-6-luna"}],
                                                   "results": [{"models": [luna]}]})[0]["claims_removed"], 1)

    def test_a_failed_call_is_not_scored(self):
        prospect = types.SimpleNamespace(property_address="x", rightmove_url="x", listing_duration_days=None,
                                         asking_price=None, bedrooms=None, bathrooms=None, listed_date=None)

        async def fake_generate(**kwargs):
            try:
                await asyncio.to_thread(groq_service._report_chat, messages=[], max_tokens=10)
            except RuntimeError:
                pass
            return {"key_findings": FINDINGS}  # the stock fallback

        def broken(model, body):
            raise RuntimeError("OpenAI returned 500")

        async def go():
            with mock.patch.object(sps, "generate_prospect_report", fake_generate), \
                    mock.patch.object(groq_service, "_openai_chat", broken):
                return await model_comparison._write("openai", "gpt-6-luna", prospect=prospect, snapshot={}, sales=None)

        result = asyncio.run(go())
        self.assertFalse(result["ok"])
        self.assertIn("500", result["error"])
        self.assertNotIn("preview", result)


if __name__ == "__main__":
    unittest.main()
