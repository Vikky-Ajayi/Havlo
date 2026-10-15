"""Buy Abroad consultation deposit through Flutterwave: the payment link
request, and what counts as a confirmed payment."""
from __future__ import annotations

import asyncio
import unittest
from unittest import mock

from app.services import flutterwave_service as fw

TX = "HAVLO-BA-0123456789ABCDEF"


def txn(**fields):
    base = {"status": "successful", "tx_ref": TX, "amount": 99.99, "currency": "GBP"}
    base.update(fields)
    return base


class PaymentConfirmedTests(unittest.TestCase):
    def check(self, transaction):
        return fw.payment_confirmed(transaction, tx_ref=TX, amount=99.99, currency="GBP")

    def test_successful_payment(self):
        self.assertTrue(self.check(txn()))
        self.assertTrue(self.check(txn(amount="99.99", currency="gbp")))

    def test_not_confirmed(self):
        self.assertFalse(self.check(None))
        self.assertFalse(self.check(txn(status="failed")))
        self.assertFalse(self.check(txn(status="pending")))
        self.assertFalse(self.check(txn(tx_ref="HAVLO-BA-SOMEONE-ELSE")))
        self.assertFalse(self.check(txn(amount=9.99)))
        self.assertFalse(self.check(txn(currency="NGN")))
        self.assertFalse(self.check(txn(amount="not a number")))


class FlutterwaveRequestTests(unittest.TestCase):
    def test_create_payment_sends_the_deposit_and_returns_the_link(self):
        sent = {}

        async def fake_request(method, path, **kwargs):
            sent.update(method=method, path=path, body=kwargs.get("json"))
            return {"status": "success", "data": {"link": "https://checkout.flutterwave.com/v3/hosted/pay/abc"}}

        with mock.patch.object(fw, "_request", fake_request):
            link = asyncio.run(fw.create_payment(
                tx_ref=TX, amount=99.99, currency="GBP", redirect_url="https://www.heyhavlo.com/buyabroad/consultation",
                customer={"email": "a@b.co", "name": "Jane Doe"}, title="Havlo Buy Abroad",
                description="Consultation deposit (refundable)", payment_options="card",
            ))
        self.assertEqual(link, "https://checkout.flutterwave.com/v3/hosted/pay/abc")
        self.assertEqual((sent["method"], sent["path"]), ("POST", "/payments"))
        self.assertEqual(sent["body"]["amount"], "99.99")
        self.assertEqual(sent["body"]["currency"], "GBP")
        self.assertEqual(sent["body"]["tx_ref"], TX)
        self.assertEqual(sent["body"]["redirect_url"], "https://www.heyhavlo.com/buyabroad/consultation")
        self.assertEqual(sent["body"]["payment_options"], "card")

    def test_create_payment_without_a_link_fails(self):
        async def fake_request(method, path, **kwargs):
            return {"status": "error", "message": "Invalid currency"}

        with mock.patch.object(fw, "_request", fake_request):
            with self.assertRaises(fw.FlutterwaveError):
                asyncio.run(fw.create_payment(
                    tx_ref=TX, amount=99.99, currency="GBP", redirect_url="https://x", customer={"email": "a@b.co"},
                    title="t", description="d",
                ))

    def test_unknown_reference_is_no_transaction(self):
        async def fake_request(method, path, **kwargs):
            raise fw.FlutterwaveError("Flutterwave returned 400", status_code=400)

        with mock.patch.object(fw, "_request", fake_request):
            self.assertIsNone(asyncio.run(fw.verify_by_reference(TX)))

    def test_server_errors_are_raised(self):
        async def fake_request(method, path, **kwargs):
            raise fw.FlutterwaveError("Flutterwave returned 500", status_code=500)

        with mock.patch.object(fw, "_request", fake_request):
            with self.assertRaises(fw.FlutterwaveError):
                asyncio.run(fw.verify_by_reference(TX))


if __name__ == "__main__":
    unittest.main()
