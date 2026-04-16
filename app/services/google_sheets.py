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
}


def _get_credentials() -> Credentials:
    settings = get_settings()
    raw = settings.GOOGLE_SERVICE_ACCOUNT_JSON
    # Support both a file path and a raw JSON string
    if raw.strip().startswith("{"):
        info = json.loads(raw)
    else:
        path = Path(raw)
        info = json.loads(path.read_text())
    return Credentials.from_service_account_info(info, scopes=SCOPES)


def _get_spreadsheet() -> gspread.Spreadsheet:
    settings = get_settings()
    creds = _get_credentials()
    gc = gspread.authorize(creds)
    return gc.open_by_key(settings.GOOGLE_SPREADSHEET_ID)


def ensure_tabs_exist() -> None:
    """Create all required tabs (worksheets) if they do not exist yet."""
    try:
        sheet = _get_spreadsheet()
        existing = {ws.title for ws in sheet.worksheets()}
        for tab_name, headers in SHEET_TABS.items():
            if tab_name not in existing:
                ws = sheet.add_worksheet(title=tab_name, rows=1000, cols=len(headers))
                ws.append_row(headers)
                logger.info("Created Google Sheet tab: %s", tab_name)
            else:
                # Ensure header row exists
                ws = sheet.worksheet(tab_name)
                if ws.row_count == 0 or not ws.row_values(1):
                    ws.insert_row(headers, 1)
        logger.info("Google Sheets tabs verified.")
    except Exception as exc:
        logger.error("Failed to ensure Google Sheet tabs: %s", exc)
        raise


def _append_row(tab_name: str, row: list[Any]) -> None:
    try:
        sheet = _get_spreadsheet()
        ws = sheet.worksheet(tab_name)
        ws.append_row(row, value_input_option="USER_ENTERED")
    except Exception as exc:
        logger.error("Failed to append row to %s: %s", tab_name, exc)
        raise


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
