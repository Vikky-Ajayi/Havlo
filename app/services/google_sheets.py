"""Google Sheets integration for collecting form submissions."""
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import gspread
from google.oauth2.service_account import Credentials

from app.config import get_settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Tab names and their headers
SHEET_TABS: dict[str, list[str]] = {
    "Registrations": [
        "Timestamp", "User ID", "First Name", "Last Name", "Email",
        "Country Code", "Phone Number", "Full Phone", "Role",
    ],
    "Onboarding": [
        "Timestamp", "User ID", "Full Name", "Email", "Role",
        "Services Requested", "Countries", "Property Type",
        "Timeframe", "Budget Amount", "Budget Currency",
    ],
    "Property Matching": [
        "Timestamp", "User ID", "Full Name", "Email", "Phone",
        "Property Type", "Location", "Budget Amount", "Budget Currency",
        "Bedrooms", "Bathrooms", "Additional Requirements", "Contact Preference",
    ],
    "Elite Property": [
        "Timestamp", "User ID", "Full Name", "Email", "Phone",
        "Property Address", "Property Type", "Asking Price", "Currency",
        "Description", "Target Buyer Profile", "Additional Info",
    ],
    "Sell Faster": [
        "Timestamp", "User ID", "Full Name", "Email", "Phone",
        "Plan ID", "Plan Name", "Property Address", "Property Type",
        "Asking Price", "Target Countries", "Contact Preference",
        "Agent Name", "Agent Email", "Agent Phone", "Additional Info",
        "Checkout ID", "Payment Status",
    ],
    "Sale Audit": [
        "Timestamp", "User ID", "Full Name", "Email", "Phone",
        "Listing URL", "Time On Market", "Number of Viewings",
        "Number of Offers", "Original Asking Price", "Current Asking Price",
        "Currency", "Estate Agent Name", "Property Description",
        "Main Challenges",
    ],
    "Buyer Network": [
        "Timestamp", "User ID", "Full Name", "Email", "Phone",
        "Package ID", "Package Name", "Company Name", "Number of Properties",
        "Property Types", "Target Markets", "Contact Preference", "Additional Info",
    ],
    "Session Bookings": [
        "Timestamp", "User ID", "First Name", "Last Name", "Email",
        "Phone Country Code", "Phone Number", "Full Phone",
        "Preferred Date", "Preferred Time", "Checkout ID", "Payment Status",
    ],
    "Contact Form": [
        "Timestamp", "First Name", "Last Name", "Email",
        "Phone Country Code", "Phone Number", "Full Phone",
        "Country of Residence", "Message",
    ],
    "Newsletter": [
        "Timestamp", "Email", "Source",
    ],
    "Marketing Opt-Out": [
        "Timestamp", "Email", "Notes",
    ],
    "Property Demand Checks": [
        "Timestamp", "User ID", "Full Name", "Email",
        "Property Address", "City", "Postcode", "Listing URL",
    ],
    "Stale Listings": [
        "Timestamp", "Assessment ID", "Reference", "Email",
        "First Name", "Last Name", "Phone", "Package",
        "Property Address", "Listing URL", "Payment Status", "Report Status",
        "Promo Applied",
    ],
    "Stale Listing Addresses": [
        "Captured At", "Rightmove ID", "Property Code", "Property Address",
        "City", "Asking Price", "Listed Date", "Days On Market",
        "Property Type", "Bedrooms", "Bathrooms", "Listing URL",
        "Discovery Run ID", "Source Status",
    ],
    "Custom Offers": [
        "Timestamp", "Submission ID", "Reference", "Buyer Name", "Buyer Email",
        "Buyer Phone", "Listing URL", "Platform", "Property Summary", "Plan ID",
        "Plan Name", "Payment Status", "Proposal Status", "Answers Summary",
    ],
    "Eligibility Check": [
        "Timestamp", "First Name", "Last Name", "Email", "Phone",
        "Outcome", "Property Type", "Budget", "Timeline", "WhatsApp",
    ],
    "Agent / Partner Application": [
        "Timestamp", "First Name", "Last Name", "Email", "Phone",
        "Address", "Company Name", "Company Website", "Referral Volume", "Minimum Property Price",
    ],
    "Free Consultation": [
        "Timestamp", "First Name", "Last Name", "Email", "Phone",
        "Property Address", "Price (GBP)", "Property URL", "City",
    ],
    "UK Property Purchase Application": [
        "Timestamp", "Full Name", "Date of Birth", "Email", "Mobile",
        "Address", "Occupation", "UK Area", "Property Type", "Bedrooms", "Budget",
    ],
}


def is_configured() -> bool:
    """Return True only when both the service-account JSON and a spreadsheet ID are set."""
    s = get_settings()
    raw = (s.GOOGLE_SERVICE_ACCOUNT_JSON or "").strip()
    sid = (s.GOOGLE_SPREADSHEET_ID or "").strip()
    return bool(raw) and raw not in (".", "./") and bool(sid)


def _get_credentials() -> Credentials:
    settings = get_settings()
    raw = (settings.GOOGLE_SERVICE_ACCOUNT_JSON or "").strip()
    if not raw:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
    # Strip wrapping quotes (Railway "Raw editor" sometimes leaves them)
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1]
    # Support both a file path and a raw JSON string
    if raw.lstrip().startswith("{"):
        try:
            info = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: {exc}. "
                "If pasting into Railway, use the Raw Editor and ensure the value is the full JSON object on a single line."
            ) from exc
    else:
        path = Path(raw)
        if not path.is_file():
            raise RuntimeError(
                f"GOOGLE_SERVICE_ACCOUNT_JSON is set to '{raw}' which is not valid JSON and not an existing file path."
            )
        info = json.loads(path.read_text())
    return Credentials.from_service_account_info(info, scopes=SCOPES)


def _get_spreadsheet() -> gspread.Spreadsheet:
    settings = get_settings()
    creds = _get_credentials()
    gc = gspread.authorize(creds)
    return gc.open_by_key(settings.GOOGLE_SPREADSHEET_ID.strip())


_tabs_verified: bool = False


def ensure_tabs_exist() -> None:
    """Create any missing tabs (worksheets). Cheap on warm starts.

    Performs a single ``worksheets()`` read and only touches the API again
    when a tab is actually missing. The previous implementation made one
    read per tab on every boot, which exhausted the Sheets per-minute read
    quota when the container restarted (HTTP 429).
    """
    global _tabs_verified
    if _tabs_verified:
        return
    if not is_configured():
        logger.info("Google Sheets not configured — skipping tab setup.")
        return
    try:
        sheet = _get_spreadsheet()
        existing = {ws.title for ws in sheet.worksheets()}  # 1 API read
        missing = [t for t in SHEET_TABS if t not in existing]
        if not missing:
            _tabs_verified = True
            logger.info("Google Sheets tabs verified (all %d present).", len(SHEET_TABS))
            return
        for tab_name in missing:
            headers = SHEET_TABS[tab_name]
            ws = sheet.add_worksheet(title=tab_name, rows=1000, cols=len(headers))
            ws.append_row(headers)
            logger.info("Created Google Sheet tab: %s", tab_name)
        _tabs_verified = True
        logger.info("Google Sheets tabs verified (created %d new).", len(missing))
    except Exception as exc:
        # Non-fatal: a transient 429 should not crash startup. The next
        # request that needs sheets will simply log its own error.
        logger.error("Failed to ensure Google Sheet tabs: [%s] %r", type(exc).__name__, exc)


def _append_row(tab_name: str, row: list[Any], raise_on_error: bool = False) -> None:
    if not is_configured():
        logger.debug("Google Sheets not configured — skipping append to %s.", tab_name)
        if raise_on_error:
            raise RuntimeError("Google Sheets is not configured")
        return
    try:
        sheet = _get_spreadsheet()
        ws = sheet.worksheet(tab_name)
        ws.append_row(row, value_input_option="USER_ENTERED")
        logger.info("Appended row to Google Sheet tab: %s", tab_name)
    except Exception as exc:
        logger.error("Failed to append row to %s: [%s] %r", tab_name, type(exc).__name__, exc)
        if raise_on_error:
            raise


def record_stale_listing_address(listing_data: dict[str, Any]) -> None:
    """Record one qualifying stale listing address without duplicating it.

    Rightmove ID is the preferred stable key; the listing URL is used when a
    legacy row has no ID. This is intentionally best-effort so a Sheets outage
    never stops stale-listing discovery or letter generation.
    """
    if not is_configured():
        logger.debug("Google Sheets not configured — skipping stale listing address.")
        return
    try:
        sheet = _get_spreadsheet()
        ws = sheet.worksheet("Stale Listing Addresses")
        values = ws.get_all_values()
        headers = values[0] if values else SHEET_TABS["Stale Listing Addresses"]
        try:
            id_index = headers.index("Rightmove ID")
            url_index = headers.index("Listing URL")
        except ValueError:
            logger.error("Stale Listing Addresses tab has unexpected headers; skipping row.")
            return

        rightmove_id = str(listing_data.get("rightmove_id") or "").strip()
        listing_url = str(listing_data.get("listing_url") or listing_data.get("url") or "").strip()
        for existing in values[1:]:
            existing_id = existing[id_index].strip() if id_index < len(existing) else ""
            existing_url = existing[url_index].strip() if url_index < len(existing) else ""
            if (rightmove_id and existing_id == rightmove_id) or (
                listing_url and existing_url == listing_url
            ):
                return

        listed_date = listing_data.get("listed_date")
        if hasattr(listed_date, "isoformat"):
            listed_date = listed_date.isoformat()
        row = [
            datetime.utcnow().isoformat(),
            rightmove_id,
            listing_data.get("property_code", ""),
            listing_data.get("property_address") or listing_data.get("address", ""),
            listing_data.get("city", ""),
            listing_data.get("asking_price", ""),
            listed_date or "",
            listing_data.get("listing_duration_days") or listing_data.get("days_on_market", ""),
            listing_data.get("property_type", ""),
            listing_data.get("bedrooms", ""),
            listing_data.get("bathrooms", ""),
            listing_url,
            listing_data.get("discovery_run_id", ""),
            listing_data.get("source_status", "stale_180_days_plus"),
        ]
        ws.append_row(row, value_input_option="USER_ENTERED")
        logger.info("Recorded stale listing address in Google Sheets: %s", listing_url or rightmove_id)
    except Exception as exc:
        logger.error(
            "Failed to record stale listing address: [%s] %r",
            type(exc).__name__,
            exc,
        )


def update_stale_listing_property_code(
    *, rightmove_id: str = "", listing_url: str = "", property_code: str
) -> None:
    """Backfill the Property Code column once a prospect has been created.

    `record_stale_listing_address` is deliberately called before the report/
    PDF/email pipeline runs, so a qualifying address is never lost to a
    downstream failure — at that point no property code exists yet, which is
    why live-discovered rows previously showed a blank Property Code column.
    This finds the row written by that earlier call (matched the same way,
    by Rightmove ID or Listing URL) and fills in the code once it's known.
    """
    if not is_configured() or not property_code:
        return
    rightmove_id = str(rightmove_id or "").strip()
    listing_url = str(listing_url or "").strip()
    if not rightmove_id and not listing_url:
        return
    try:
        sheet = _get_spreadsheet()
        ws = sheet.worksheet("Stale Listing Addresses")
        values = ws.get_all_values()
        if not values:
            return
        headers = values[0]
        try:
            id_index = headers.index("Rightmove ID")
            url_index = headers.index("Listing URL")
            code_index = headers.index("Property Code")
        except ValueError:
            logger.error("Stale Listing Addresses tab has unexpected headers; skipping code backfill.")
            return
        for row_num, existing in enumerate(values[1:], start=2):
            existing_id = existing[id_index].strip() if id_index < len(existing) else ""
            existing_url = existing[url_index].strip() if url_index < len(existing) else ""
            if (rightmove_id and existing_id == rightmove_id) or (
                listing_url and existing_url == listing_url
            ):
                ws.update_cell(row_num, code_index + 1, property_code)
                logger.info("Backfilled property code %s in Stale Listing Addresses.", property_code)
                return
        logger.debug(
            "No Stale Listing Addresses row found to backfill property code for %s",
            rightmove_id or listing_url,
        )
    except Exception as exc:
        logger.error(
            "Failed to backfill stale listing property code: [%s] %r",
            type(exc).__name__,
            exc,
        )


def append_test_row(tab_name: str = "Registrations") -> None:
    """Strict append used by the diag endpoint — re-raises on any failure."""
    _append_row(tab_name, [
        datetime.utcnow().isoformat(),
        "diag-test", "Diag", "Test",
        f"diag-{datetime.utcnow().isoformat()}@havlo.test",
        "+44", "0000000000", "+440000000000", "buyer",
    ], raise_on_error=True)


def diagnostics() -> dict:
    """Quick diagnostics for troubleshooting Sheets config."""
    s = get_settings()
    raw = (s.GOOGLE_SERVICE_ACCOUNT_JSON or "").strip()
    info = {
        "configured": is_configured(),
        "spreadsheet_id_set": bool((s.GOOGLE_SPREADSHEET_ID or "").strip()),
        "service_account_json_len": len(raw),
        "service_account_looks_like_json": raw.lstrip().startswith("{") if raw else False,
        "service_account_looks_like_path": (not raw.lstrip().startswith("{")) and bool(raw),
    }
    if raw:
        try:
            _get_credentials()
            info["credentials_parse"] = "ok"
        except Exception as e:
            info["credentials_parse"] = f"FAIL: {type(e).__name__}: {e}"
    if is_configured():
        try:
            sheet = _get_spreadsheet()
            info["spreadsheet_title"] = sheet.title
            info["existing_tabs"] = sorted({w.title for w in sheet.worksheets()})
        except Exception as e:
            info["spreadsheet_open"] = f"FAIL: {type(e).__name__}: {e}"
    return info


def record_registration(user_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        user_data.get("first_name", ""),
        user_data.get("last_name", ""),
        user_data.get("email", ""),
        user_data.get("phone_country_code", ""),
        user_data.get("phone_number", ""),
        user_data.get("phone_country_code", "") + user_data.get("phone_number", ""),
        user_data.get("role", ""),
    ]
    _append_row("Registrations", row)


def record_onboarding(user_data: dict[str, Any], onboarding_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}",
        user_data.get("email", ""),
        user_data.get("role", ""),
        ", ".join(onboarding_data.get("services", [])),
        ", ".join(onboarding_data.get("countries", [])),
        onboarding_data.get("property_type", ""),
        onboarding_data.get("timeframe", ""),
        onboarding_data.get("budget_amount", ""),
        onboarding_data.get("budget_currency", "GBP"),
    ]
    _append_row("Onboarding", row)


def record_property_matching(user_data: dict[str, Any], form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}",
        user_data.get("email", ""),
        user_data.get("phone_country_code", "") + user_data.get("phone_number", ""),
        form_data.get("property_type", ""),
        form_data.get("location", ""),
        form_data.get("budget_amount", ""),
        form_data.get("budget_currency", "GBP"),
        form_data.get("bedrooms", ""),
        form_data.get("bathrooms", ""),
        form_data.get("additional_requirements", ""),
        form_data.get("contact_preference", "email"),
    ]
    _append_row("Property Matching", row)


def record_elite_property(user_data: dict[str, Any], form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}",
        user_data.get("email", ""),
        user_data.get("phone_country_code", "") + user_data.get("phone_number", ""),
        form_data.get("property_address", ""),
        form_data.get("property_type", ""),
        form_data.get("asking_price", ""),
        form_data.get("asking_price_currency", "GBP"),
        form_data.get("description", ""),
        form_data.get("target_buyer_profile", ""),
        form_data.get("additional_info", ""),
    ]
    _append_row("Elite Property", row)


def record_sell_faster(user_data: dict[str, Any], form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}",
        user_data.get("email", ""),
        user_data.get("phone_country_code", "") + user_data.get("phone_number", ""),
        form_data.get("plan_id", ""),
        form_data.get("plan_name", ""),
        form_data.get("property_address", ""),
        form_data.get("property_type", ""),
        form_data.get("asking_price", ""),
        ", ".join(form_data.get("target_countries", [])),
        form_data.get("contact_preference", "you"),
        form_data.get("agent_name", ""),
        form_data.get("agent_email", ""),
        form_data.get("agent_phone", ""),
        form_data.get("additional_info", ""),
        form_data.get("checkout_id", ""),
        form_data.get("payment_status", "pending"),
    ]
    _append_row("Sell Faster", row)


def record_sale_audit(user_data: dict[str, Any], form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}",
        user_data.get("email", ""),
        user_data.get("phone_country_code", "") + user_data.get("phone_number", ""),
        form_data.get("listing_url", ""),
        form_data.get("time_on_market", ""),
        form_data.get("number_of_viewings", ""),
        form_data.get("number_of_offers", ""),
        form_data.get("original_asking_price", ""),
        form_data.get("current_asking_price", ""),
        form_data.get("price_currency", "GBP"),
        form_data.get("estate_agent_name", ""),
        form_data.get("property_description", ""),
        form_data.get("main_challenges", ""),
    ]
    _append_row("Sale Audit", row)


def record_buyer_network(user_data: dict[str, Any], form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}",
        user_data.get("email", ""),
        user_data.get("phone_country_code", "") + user_data.get("phone_number", ""),
        form_data.get("package_id", ""),
        form_data.get("package_name", ""),
        form_data.get("company_name", ""),
        form_data.get("number_of_properties", ""),
        ", ".join(form_data.get("property_types", [])),
        ", ".join(form_data.get("target_markets", [])),
        form_data.get("contact_preference", "email"),
        form_data.get("additional_info", ""),
    ]
    _append_row("Buyer Network", row)


def record_contact_form(form: dict[str, Any]) -> None:
    code = form.get("phone_country_code", "")
    num = form.get("phone_number", "")
    row = [
        datetime.utcnow().isoformat(),
        form.get("first_name", ""),
        form.get("last_name", ""),
        form.get("email", ""),
        code,
        num,
        f"{code}{num}".strip(),
        form.get("country_of_residence", ""),
        form.get("message", ""),
    ]
    _append_row("Contact Form", row)


def record_newsletter(email: str, source: str = "footer") -> None:
    row = [datetime.utcnow().isoformat(), email, source]
    _append_row("Newsletter", row)


def record_marketing_opt_out(email: str, notes: str = "") -> None:
    row = [datetime.utcnow().isoformat(), email, notes]
    _append_row("Marketing Opt-Out", row)


def record_property_demand_check(user_data: dict[str, Any], form_data: dict[str, Any]) -> None:
    full_name = (
        form_data.get("full_name")
        or f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip()
    )
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        full_name,
        user_data.get("email", ""),
        form_data.get("property_address", ""),
        form_data.get("city", ""),
        form_data.get("postcode", ""),
        form_data.get("listing_url", ""),
    ]
    _append_row("Property Demand Checks", row)


def record_stale_listing(form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(form_data.get("assessment_id", "")),
        form_data.get("reference", ""),
        form_data.get("email", ""),
        form_data.get("first_name", ""),
        form_data.get("last_name", ""),
        f"{form_data.get('phone_country_code', '')}{form_data.get('phone', '')}".strip(),
        form_data.get("package", ""),
        form_data.get("property_address", ""),
        form_data.get("listing_url", ""),
        form_data.get("payment_status", "pending"),
        form_data.get("report_status", "pending"),
        form_data.get("promo_applied", "no"),
    ]
    _append_row("Stale Listings", row)


def record_custom_offer(form_data: dict[str, Any]) -> bool:
    if not is_configured():
        logger.debug("Google Sheets not configured - skipping append to Custom Offers.")
        return False
    row = [
        datetime.utcnow().isoformat(),
        str(form_data.get("submission_id", "")),
        form_data.get("reference", ""),
        form_data.get("buyer_name", ""),
        form_data.get("buyer_email", ""),
        form_data.get("buyer_phone", ""),
        form_data.get("listing_url", ""),
        form_data.get("listing_platform", ""),
        form_data.get("property_summary", ""),
        form_data.get("plan_id", ""),
        form_data.get("plan_name", ""),
        form_data.get("payment_status", "pending"),
        form_data.get("proposal_status", "submitted"),
        form_data.get("answers_summary", ""),
    ]
    try:
        _append_row("Custom Offers", row, raise_on_error=True)
        return True
    except Exception:
        return False


def _parse_message_lines(message: str) -> dict[str, str]:
    """Parse a newline-separated 'Key: Value' message string into a dict."""
    result: dict[str, str] = {}
    for line in message.splitlines():
        if ": " in line:
            key, _, value = line.partition(": ")
            result[key.strip()] = value.strip()
    return result


def record_uk_buyer_enquiry(form_data: dict[str, Any]) -> None:
    parsed = _parse_message_lines(form_data.get("message", ""))
    phone = f"{form_data.get('phone_country_code', '')}{form_data.get('phone_number', '')}".strip()
    row = [
        datetime.utcnow().isoformat(),
        form_data.get("first_name", ""),
        form_data.get("last_name", ""),
        form_data.get("email", ""),
        phone,
        parsed.get("Outcome", ""),
        parsed.get("Looking to buy", ""),
        parsed.get("Approximate budget", ""),
        parsed.get("Timeline", ""),
        parsed.get("WhatsApp", ""),
    ]
    _append_row("Eligibility Check", row)


def record_uk_agent_partner(form_data: dict[str, Any]) -> None:
    parsed = _parse_message_lines(form_data.get("message", ""))
    phone = f"{form_data.get('phone_country_code', '')}{form_data.get('phone_number', '')}".strip()
    row = [
        datetime.utcnow().isoformat(),
        form_data.get("first_name", ""),
        form_data.get("last_name", ""),
        form_data.get("email", ""),
        phone,
        parsed.get("Address", ""),
        parsed.get("Real estate company / agency", ""),
        parsed.get("Company website / social link", ""),
        parsed.get("Clients they can refer monthly", ""),
        parsed.get("Minimum property price their clients can afford", ""),
    ]
    _append_row("Agent / Partner Application", row)


def record_uk_listing_consultation(form_data: dict[str, Any]) -> None:
    parsed = _parse_message_lines(form_data.get("message", ""))
    phone = f"{form_data.get('phone_country_code', '')}{form_data.get('phone_number', '')}".strip()
    row = [
        datetime.utcnow().isoformat(),
        form_data.get("first_name", ""),
        form_data.get("last_name", ""),
        form_data.get("email", ""),
        phone,
        parsed.get("Property", ""),
        parsed.get("Price", ""),
        parsed.get("Property URL", ""),
        parsed.get("City", ""),
    ]
    _append_row("Free Consultation", row)


def record_uk_client_application(form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        form_data.get("full_name", ""),
        form_data.get("date_of_birth", ""),
        form_data.get("email", ""),
        form_data.get("mobile", ""),
        form_data.get("address", ""),
        form_data.get("occupation", ""),
        form_data.get("uk_area", ""),
        form_data.get("property_type", ""),
        form_data.get("bedrooms", ""),
        form_data.get("budget", ""),
    ]
    _append_row("UK Property Purchase Application", row)


def record_public_assessment(form_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        form_data.get("email", ""),
        form_data.get("phone_country_code", "") + form_data.get("phone", ""),
        form_data.get("property_url", ""),
        form_data.get("property_address", ""),
        form_data.get("scraped_title", ""),
        form_data.get("scraped_price", ""),
        form_data.get("recommended_plan", ""),
        form_data.get("setup_fee", ""),
    ]
    _append_row("Public Property Assessments", row)


def record_session_booking(user_data: dict[str, Any], booking_data: dict[str, Any]) -> None:
    row = [
        datetime.utcnow().isoformat(),
        str(user_data.get("id", "")),
        booking_data.get("first_name", ""),
        booking_data.get("last_name", ""),
        booking_data.get("email", ""),
        booking_data.get("phone_country_code", ""),
        booking_data.get("phone_number", ""),
        booking_data.get("phone_country_code", "") + booking_data.get("phone_number", ""),
        booking_data.get("preferred_date", ""),
        booking_data.get("preferred_time", ""),
        booking_data.get("checkout_id", ""),
        booking_data.get("payment_status", "pending"),
    ]
    _append_row("Session Bookings", row)
