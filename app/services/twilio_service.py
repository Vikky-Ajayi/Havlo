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


def _send_sms(to_phone: str, body: str, *, from_override: str | None = None) -> bool:
    """Shared send path: validates the number and config, sends via Twilio,
    and turns every failure mode into a plain False rather than an
    exception — callers (background loops, HTTP routes) should never have
    an SMS failure propagate as a crash or a 500.

    from_override lets a caller send as an alphanumeric sender ID (e.g.
    "Havlo") instead of settings.TWILIO_PHONE_NUMBER — confirmed working
    against the real account/UK destination numbers. Deliberately opt-in
    per call rather than a blanket switch: an alphanumeric sender has no
    real number behind it, so the recipient cannot reply to it at all —
    fine for a one-way nudge with a link, not for send_new_message_sms
    (inbox notifications), which stays on the real number."""
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
            from_=from_override or settings.TWILIO_PHONE_NUMBER,
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


def send_test_sms(to_phone: str) -> bool:
    """Admin QA helper — confirms TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER
    and the destination number actually work, without needing a real inbox
    message or stale-prospect abandonment event to trigger one."""
    body = "This is a test SMS from Havlo confirming the Twilio integration is working."
    return _send_sms(to_phone, body)


# ── Stale-prospect abandonment SMS ladder ───────────────────────────────────
# Day 0 -> Day 90, every 3 days (31 stages) -- see
# stale_prospect_abandonment.run_abandonment_sms_cycle for the scheduling
# (business-hours gating, per-stage idempotency). The stage key is the day
# number itself, matching StaleProspectAbandonmentSms.stage. Copy approved
# verbatim; only the {link} substitution and the unsubscribe line are added
# on top of it.
SMS_ABANDONMENT_TEMPLATES: dict[int, str] = {
    0: "Your property assessment is ready. We’ve taken a closer look at what could be standing between your property and its next buyer. See what we found: {link}",
    3: "What if the reason your property hasn’t sold isn’t what you think? We’ve identified some possibilities in your property assessment: {link}",
    6: "Your property is competing for attention with hundreds of others. The question is: what makes yours stand out? See your property assessment: {link}",
    9: "A property can be beautifully presented and still struggle to sell. Your assessment looks at some of the reasons why: {link}",
    12: "If your property could tell you why it hasn’t sold yet, what would it say? Your property assessment may have some answers: {link}",
    15: "Your asking price is only one part of the equation. See what else we identified about your property: {link}",
    18: "The right buyer could already be looking. But are they seeing your property? Find out what your property assessment says: {link}",
    21: "Three weeks in — and your property assessment is still waiting for you. Take a fresh look at what could be holding the sale back: {link}",
    24: "First impressions matter. Especially when buyers have hundreds of properties to choose from. See how your property is positioned: {link}",
    27: "Could your listing be attracting the wrong attention — or not enough of it? Your property assessment takes a closer look: {link}",
    30: "One month later, the same question remains: why hasn’t the property sold? Your property assessment was designed to help answer it: {link}",
    33: "Sometimes it’s not the property that’s the problem. It can be the way the opportunity is presented to the market. See your property assessment: {link}",
    36: "Imagine seeing your property through the eyes of a potential buyer. That’s what we want you to do with your property assessment: {link}",
    39: "What would make someone choose your property over the next one they see? Your assessment highlights areas worth considering: {link}",
    42: "Properties don’t always sell simply because they’re good properties. Positioning matters. See what we found: {link}",
    45: "If you’ve been waiting for the right buyer, it may be worth asking whether the right buyers are actually being reached. Your property assessment explains more: {link}",
    48: "Your property has been on the market. But has it been marketed to its full potential? Take another look at your property assessment: {link}",
    51: "There’s a difference between being listed and being noticed. Your property assessment looks at that difference: {link}",
    54: "What could you change today that might make your property more appealing tomorrow? Start with your property assessment: {link}",
    57: "A buyer doesn’t see everything you see. Your assessment looks at your property from the buyer’s perspective: {link}",
    60: "Two months on. If your property is still available, understanding what’s happening in the market could be more important than ever. See your property assessment: {link}",
    63: "Could there be buyers for your property that your current marketing isn’t reaching? Your property assessment explores the opportunity: {link}",
    66: "Sometimes selling isn’t about waiting longer. It’s about changing the way the property is positioned. See what we recommend: {link}",
    69: "Your property may have more potential than its current listing suggests. Find out what our assessment identified: {link}",
    72: "If you could improve one thing about the way your property is being marketed, what would it be? Your property assessment gives you a place to start: {link}",
    75: "The market changes. Buyer attention changes. Your property strategy may need to change too. See your property assessment: {link}",
    78: "Still thinking about the sale? Take another look at the property assessment we prepared for you: {link}",
    81: "Your next buyer won’t necessarily be the person who sees your property first. They may be the person your current marketing isn’t reaching. See your property assessment: {link}",
    84: "Before making another change to your property strategy, see what we identified about your listing: {link}",
    87: "You’ve had plenty of time to think about the sale. Now take a few minutes to see what our assessment says could be done differently: {link}",
    90: "This is our final message about your property assessment. If you’re still looking for answers about why your property hasn’t sold, your assessment is here: {link}",
}

SMS_ABANDONMENT_STAGE_DAYS: tuple[int, ...] = tuple(sorted(SMS_ABANDONMENT_TEMPLATES.keys()))


def send_stale_prospect_abandonment_sms(to_phone: str, stage: int, preview_url: str, unsubscribe_url: str) -> bool:
    """One stage of the Day 0 -> Day 90 abandonment SMS ladder. `stage` is
    the day number (see SMS_ABANDONMENT_TEMPLATES). Always appends an
    unsubscribe link distinct from the email drip's — see
    StaleListingProspect.sms_unsubscribed_at.

    Same 'never let a failure propagate' contract as send_new_message_sms —
    returns False on any misconfiguration, invalid number, or Twilio error.
    """
    template = SMS_ABANDONMENT_TEMPLATES.get(stage)
    if not template:
        logger.error("Unknown SMS abandonment stage: %r", stage)
        return False
    body = template.format(link=preview_url) + f"\n\nUnsubscribe: {unsubscribe_url}"
    return _send_sms(to_phone, body, from_override="Havlo")
