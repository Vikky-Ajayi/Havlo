"""Estate agent details from Rightmove listing pages, for the agent campaign."""
from __future__ import annotations

import unittest

from app.models.models import StaleListingProspect
from app.services.listing_scraper import _rm_agent_details
from app.services.stale_prospect_service import apply_agent_details

# Shape of a real listing page's "customer" / "contactInfo" blocks (Rightmove 173245679).
CUSTOMER = {
    "branchId": 288089,
    "branchName": "London",
    "branchDisplayName": "Grant J Bates Property, London",
    "companyName": "GRANT J BATES PROPERTY LTD",
    "companyTradingName": None,
    "displayAddress": "Mortimer House\r\n27-41\r\nMortimer Street\r\nLondon\r\nW1T 3JH",
    "logoPath": "https://media.rightmove.co.uk/partner-logo/37323920-LOGO-1765974246.png",
    "customerProfileUrl": "/estate-agents/agent/Grant-J-Bates-Property/London-288089.html",
}
CONTACT = {"contactMethod": "EMAIL", "telephoneNumbers": {"localNumber": "020 4572 2432", "internationalNumber": None}}
EXPECTED = {
    "branch_id": "288089",
    "branch_name": "Grant J Bates Property, London",
    "brand": "Grant J Bates Property",
    "company_name": "GRANT J BATES PROPERTY LTD",
    "trading_name": "",
    "address": "Mortimer House, 27-41, Mortimer Street, London, W1T 3JH",
    "phone": "020 4572 2432",
    "logo_url": "https://media.rightmove.co.uk/partner-logo/37323920-LOGO-1765974246.png",
    "profile_url": "https://www.rightmove.co.uk/estate-agents/agent/Grant-J-Bates-Property/London-288089.html",
}


def compressed(customer: dict, contact: dict) -> tuple:
    """The same blocks in Rightmove's compressed PAGE_MODEL form: every value
    is an index into one flat list."""
    data: list = [None]

    def put(value):
        if isinstance(value, dict):
            value = {k: put(v) for k, v in value.items()}
        data.append(value)
        return len(data) - 1

    cust_i, contact_i = put(customer), put(contact)
    resolve = lambda i: data[i] if isinstance(i, int) and 0 <= i < len(data) else i  # noqa: E731
    return data, cust_i, contact_i, resolve


class AgentDetailsTests(unittest.TestCase):
    def test_legacy_page_format(self):
        self.assertEqual(_rm_agent_details(CUSTOMER, CONTACT), EXPECTED)

    def test_compressed_page_format(self):
        _, cust_i, contact_i, resolve = compressed(CUSTOMER, CONTACT)
        self.assertEqual(_rm_agent_details(cust_i, contact_i, resolve), EXPECTED)

    def test_missing_block(self):
        self.assertIsNone(_rm_agent_details(None, CONTACT))
        self.assertIsNone(_rm_agent_details({"primaryBrandColour": None}, None))

    def test_brand_falls_back_to_company(self):
        details = _rm_agent_details({"branchId": 1, "companyName": "ACME HOMES LTD"}, None)
        self.assertEqual(details["brand"], "ACME HOMES LTD")
        self.assertEqual(details["phone"], "")

    def test_apply_to_prospect(self):
        prospect = StaleListingProspect()
        self.assertTrue(apply_agent_details(prospect, EXPECTED))
        self.assertEqual(prospect.agent_company_name, "GRANT J BATES PROPERTY LTD")
        self.assertEqual(prospect.agent_branch_id, "288089")
        self.assertEqual(prospect.agent_brand, "Grant J Bates Property")
        self.assertIsNotNone(prospect.agent_checked_at)

    def test_apply_nothing_still_marks_checked(self):
        prospect = StaleListingProspect()
        self.assertFalse(apply_agent_details(prospect, None))
        self.assertIsNone(prospect.agent_company_name)
        self.assertIsNotNone(prospect.agent_checked_at)


if __name__ == "__main__":
    unittest.main()
