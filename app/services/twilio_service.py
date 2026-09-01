"""Twilio SMS service for new message notifications."""
import logging
import re
from functools import lru_cache

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.config import get_settings

logger = logging.getLogger(__name__)

_E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")


def is_valid_e164(phone: str) -> bool:
    if not phone:
        return False
    return bool(_E164_RE.match(phone.strip()))


def normalize_to_e164(raw_phone: str) -> str:
    """Best-effort cleanup of a user-typed phone number into strict E.164.

    StaleListingProspect.contact_phone is stored exactly as the wizard sent
    it — "<dial code> <local number>" with a space and whatever leading
    zero/formatting the person typed (e.g. "+44 07123456789") — never
    validated or normalized at write time. Twilio requires strict E.164
    ("+447123456789": a '+', country code, subscriber number, no spaces, no
    leading zero on the subscriber part), so this has to happen before every
    send rather than trusting the stored value.
    """
    if not raw_phone:
        return ""
    digits_and_plus = re.sub(r"[^\d+]", "", raw_phone.strip())
    if not digits_and_plus.startswith("+"):
        return ""
    rest = digits_and_plus[1:]
    # A UK-style local number typed with its leading 0 still intact after
    # the dial code ("+44" + "07123456789") is the one collision this can't
    # tell apart from a country whose numbers genuinely start with 0 after
    # the calling code — not the case for any dial code in CountryCodeSelect,
    # so stripping a single leading 0 right after a 1-3 digit calling code
    # is safe here.
    m = re.match(r"^(\d{1,3})0(\d+)$", rest)
    if m:
        rest = m.group(1) + m.group(2)
    candidate = f"+{rest}"
    return candidate if is_valid_e164(candidate) else ""


@lru_cache
def _get_client() -> Client:
    settings = get_settings()
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def _send_sms(to_phone: str, body: str) -> bool:
    """Shared send path: validates the number and config, sends via Twilio,
    and turns every failure mode into a plain False rather than an
    exception — callers (background loops, HTTP routes) should never have
    an SMS failure propagate as a crash or a 500."""
    if not is_valid_e164(to_phone):
        logger.warning("Skipping SMS — invalid E.164 phone: %r", to_phone)
        return False

    settings = get_settings()
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER):
        logger.warning("Skipping SMS — Twilio is not configured.")
        return False

    try:
        client = _get_client()
        message = client.messages.create(
            body=body,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=to_phone,
        )
        logger.info("SMS sent to %s — SID: %s", to_phone, message.sid)
        return True
    except TwilioRestException as exc:
        logger.error("Twilio error sending to %s: %s", to_phone, exc)
        return False
    except Exception as exc:
        logger.error("Unexpected error sending SMS to %s: %s", to_phone, exc)
        return False


def send_new_message_sms(
    to_phone: str,
    sender_name: str,
    app_url: str,
) -> bool:
    """Send an SMS notifying a user of a new inbox message.

    Returns True only if Twilio accepted the message. Twilio failures and
    misconfiguration return False — callers should never let a failed SMS
    propagate as an HTTP error.
    """
    body = (
        f"You have a new message from {sender_name} on Havlo. "
        f"Log in to reply: {app_url.rstrip('/')}/dashboard/inbox"
    )
    return _send_sms(to_phone, body)


def send_stale_prospect_abandonment_sms(to_phone: str, preview_url: str) -> bool:
    """One-time SMS nudge (24h after "Your Details" without paying) pointing
    straight at the prospect's own preview/assessment page.

    Same 'never let a failure propagate' contract as send_new_message_sms —
    returns False on any misconfiguration, invalid number, or Twilio error.
    """
    body = f"Your Havlo property assessment is ready to view: {preview_url}"
    return _send_sms(to_phone, body)
