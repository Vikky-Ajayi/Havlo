"""Twilio SMS service for new message notifications."""
import logging

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    settings = get_settings()
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def send_new_message_sms(to_phone: str, sender_name: str, app_url: str) -> bool:
    """
    Send an SMS to the user notifying them of a new inbox message.

    Args:
        to_phone:     Recipient phone in E.164 format e.g. +2348012345678
        sender_name:  Name of the team member who sent the message
        app_url:      Frontend URL to the inbox page

    Returns:
        True if the SMS was sent successfully, False otherwise.
    """
    settings = get_settings()
    body = (
        f"Hi! You have a new message from {sender_name} in your Havlo inbox. "
        f"Log in to reply: {app_url}/dashboard/inbox"
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
