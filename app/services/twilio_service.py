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


@lru_cache
def _get_client() -> Client:
    settings = get_settings()
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


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
    if not is_valid_e164(to_phone):
        logger.warning("Skipping SMS — invalid E.164 phone: %r", to_phone)
        return False

    settings = get_settings()
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER):
        logger.warning("Skipping SMS — Twilio is not configured.")
        return False

    body = (
        f"You have a new message from {sender_name} on Havlo. "
        f"Log in to reply: {app_url.rstrip('/')}/dashboard/inbox"
    )

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
