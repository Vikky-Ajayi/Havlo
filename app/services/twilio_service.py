"""Twilio SMS service for new message notifications."""
import logging
import re
from functools import lru_cache

import phonenumbers
from phonenumbers import PhoneNumberType
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


# Number types that can receive a text. Everything else (landlines,
# freephone, premium rate, personal "070" numbers, pagers...) can't, but
# Twilio still charges for the attempt.
_TEXTABLE_TYPES = {PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE}
_FAKE_RUNS = ("123456789", "987654321")


def sms_number_problem(e164: str) -> str | None:
    """Why this number shouldn't be texted at all, or None if it's fine.
    Catches numbers that don't exist (wrong length, unallocated ranges such
    as Ofcom's 07700 900xxx drama numbers), landlines and other numbers that
    can't take a text, and the made-up numbers people type to get past a
    form (07123456789, 07777777777)."""
    if not is_valid_e164(e164):
        return "not a valid phone number"
    try:
        parsed = phonenumbers.parse(e164)
    except phonenumbers.NumberParseException:
        return "not a valid phone number"
    if not phonenumbers.is_valid_number(parsed):
        return "not a valid phone number"
    if phonenumbers.number_type(parsed) not in _TEXTABLE_TYPES:
        return "can't receive texts (landline or similar)"
    national = str(parsed.national_number)
    if re.search(r"(\d)\1{6,}", national) or any(run in national for run in _FAKE_RUNS):
        return "looks like a made-up number"
    return None


# Twilio error codes that mean texting this number again will fail again
# (and be charged again): https://www.twilio.com/docs/api/errors
_PERMANENT_SMS_ERRORS = {
    21211: "not a valid phone number",
    21610: "replied STOP",
    21612: "can't be reached from our sender",
    21614: "can't receive texts (landline or similar)",
    30003: "phone unreachable",
    30004: "blocked by the recipient",
    30005: "number doesn't exist",
    30006: "can't receive texts (landline or similar)",
    30007: "blocked by the carrier as spam",
}


def last_sms_failure(e164: str) -> str | None:
    """Why our recent texts to this number failed for good, or None. Reads
    the number's last two messages from Twilio (reading history is free):
    stop if the last one failed with a permanent error, or if the last two
    both failed whatever the reason. None when Twilio isn't configured or
    can't be reached, so a lookup problem never blocks a send."""
    settings = get_settings()
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN):
        return None
    try:
        messages = _get_client().messages.list(to=e164, limit=2)
    except Exception as exc:
        logger.warning("Couldn't read Twilio history for %s: %s", e164, exc)
        return None
    failed = [m for m in messages if m.status in ("failed", "undelivered")]
    if messages and messages[0] in failed:
        code = messages[0].error_code
        if code in _PERMANENT_SMS_ERRORS:
            return f"{_PERMANENT_SMS_ERRORS[code]} (Twilio {code})"
    if len(messages) == 2 and len(failed) == 2:
        return "last two texts failed"
    return None


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
# 31 texts, in this order: the first as soon as their details are in (day 0),
# then one every 2 days up to day 60 -- see
# stale_prospect_abandonment.run_abandonment_sms_cycle for the scheduling
# (business-hours gating, per-stage idempotency). The stage recorded in
# StaleProspectAbandonmentSms.stage is the day number.
#
# Until Oct 2026 the texts went every 3 days (day 1 or 0, then 4, 7, ... 91);
# prospects already part-way through that series finish it on those days --
# see LEGACY_SMS_ABANDONMENT_STAGE_DAYS. Copy approved verbatim; only the
# {link} substitution and the unsubscribe line are added on top of it.
SMS_ABANDONMENT_MESSAGES: tuple[str, ...] = (
    "Your property assessment is ready. We’ve taken a closer look at what could be standing between your property and its next buyer. See what we found: {link}",
    "What if the reason your property hasn’t sold isn’t what you think? We’ve identified some possibilities in your property assessment: {link}",
    "Your property is competing for attention with hundreds of others. The question is: what makes yours stand out? See your property assessment: {link}",
    "A property can be beautifully presented and still struggle to sell. Your assessment looks at some of the reasons why: {link}",
    "If your property could tell you why it hasn’t sold yet, what would it say? Your property assessment may have some answers: {link}",
    "Your asking price is only one part of the equation. See what else we identified about your property: {link}",
    "The right buyer could already be looking. But are they seeing your property? Find out what your property assessment says: {link}",
    "Your property assessment is still waiting for you. Take a fresh look at what could be holding the sale back: {link}",
    "First impressions matter. Especially when buyers have hundreds of properties to choose from. See how your property is positioned: {link}",
    "Could your listing be attracting the wrong attention — or not enough of it? Your property assessment takes a closer look: {link}",
    "Weeks later, the same question remains: why hasn’t the property sold? Your property assessment was designed to help answer it: {link}",
    "Sometimes it’s not the property that’s the problem. It can be the way the opportunity is presented to the market. See your property assessment: {link}",
    "Imagine seeing your property through the eyes of a potential buyer. That’s what we want you to do with your property assessment: {link}",
    "What would make someone choose your property over the next one they see? Your assessment highlights areas worth considering: {link}",
    "Properties don’t always sell simply because they’re good properties. Positioning matters. See what we found: {link}",
    "If you’ve been waiting for the right buyer, it may be worth asking whether the right buyers are actually being reached. Your property assessment explains more: {link}",
    "Your property has been on the market. But has it been marketed to its full potential? Take another look at your property assessment: {link}",
    "There’s a difference between being listed and being noticed. Your property assessment looks at that difference: {link}",
    "What could you change today that might make your property more appealing tomorrow? Start with your property assessment: {link}",
    "A buyer doesn’t see everything you see. Your assessment looks at your property from the buyer’s perspective: {link}",
    "Over a month now. If your property is still available, understanding what’s happening in the market could be more important than ever. See your property assessment: {link}",
    "Could there be buyers for your property that your current marketing isn’t reaching? Your property assessment explores the opportunity: {link}",
    "Sometimes selling isn’t about waiting longer. It’s about changing the way the property is positioned. See what we recommend: {link}",
    "Your property may have more potential than its current listing suggests. Find out what our assessment identified: {link}",
    "If you could improve one thing about the way your property is being marketed, what would it be? Your property assessment gives you a place to start: {link}",
    "The market changes. Buyer attention changes. Your property strategy may need to change too. See your property assessment: {link}",
    "Still thinking about the sale? Take another look at the property assessment we prepared for you: {link}",
    "Your next buyer won’t necessarily be the person who sees your property first. They may be the person your current marketing isn’t reaching. See your property assessment: {link}",
    "Before making another change to your property strategy, see what we identified about your listing: {link}",
    "You’ve had plenty of time to think about the sale. Now take a few minutes to see what our assessment says could be done differently: {link}",
    "This is our final message about your property assessment. If you’re still looking for answers about why your property hasn’t sold, your assessment is here: {link}",
)

SMS_ABANDONMENT_INTERVAL_DAYS = 2
SMS_ABANDONMENT_STAGE_DAYS: tuple[int, ...] = tuple(
    i * SMS_ABANDONMENT_INTERVAL_DAYS for i in range(len(SMS_ABANDONMENT_MESSAGES))
)
# The old every-3-days series (its first text was day 1, later day 0).
LEGACY_SMS_ABANDONMENT_STAGE_DAYS: tuple[int, ...] = (0,) + tuple(range(4, 92, 3))


def sms_abandonment_schedule(already_sent: set[int]) -> tuple[int, ...]:
    """The stage days this prospect is on. Anyone who started on the old
    every-3-days series (had the day-1 text, or got past the first text
    without a day-2 one) finishes on it; everyone else is on every 2 days.
    Texts go out strictly in order, so the stages sent are always the start
    of one schedule or the other."""
    if 1 in already_sent or (already_sent - {0} and 2 not in already_sent):
        return LEGACY_SMS_ABANDONMENT_STAGE_DAYS
    return SMS_ABANDONMENT_STAGE_DAYS


def send_stale_prospect_abandonment_sms(to_phone: str, message: int, preview_url: str, unsubscribe_url: str) -> bool:
    """One text of the abandonment SMS series. `message` is its position in
    SMS_ABANDONMENT_MESSAGES (0 = the first). Always ends with an "Opt out"
    link distinct from the email drip's unsubscribe — see
    StaleListingProspect.sms_unsubscribed_at.

    Same 'never let a failure propagate' contract as send_new_message_sms —
    returns False on any misconfiguration, invalid number, or Twilio error.
    """
    if not 0 <= message < len(SMS_ABANDONMENT_MESSAGES):
        logger.error("Unknown SMS abandonment message: %r", message)
        return False
    body = SMS_ABANDONMENT_MESSAGES[message].format(link=preview_url) + f"\n\nOpt out: {unsubscribe_url}"
    return _send_sms(to_phone, body, from_override="Havlo")


# Agency follow-up texts (app/services/agent_followups.py): stage -> template.
AGENT_FOLLOWUP_SMS_TEMPLATES: dict[int, str] = {
    1: "Havlo: the assessments for {brand}'s {count} stale listings are ready - see what may be holding each one back: {link}",
    2: "Havlo: {brand}'s {count} stale-listing assessments are still waiting - independent findings to take to your vendors: {link}",
}


def send_stale_agent_followup_sms(to_phone: str, stage: int, *, brand: str, count: int, link: str, unsubscribe_url: str) -> bool:
    """One agency follow-up text. Same never-raise contract as the other senders."""
    template = AGENT_FOLLOWUP_SMS_TEMPLATES.get(stage)
    if not template:
        logger.error("Unknown agent follow-up SMS stage: %r", stage)
        return False
    body = template.format(brand=brand, count=count, link=link) + f"\n\nUnsubscribe: {unsubscribe_url}"
    return _send_sms(to_phone, body, from_override="Havlo")


# The one text with a purchased report's 90-day dashboard link
# (app/services/listing_monitor.py). A service message about something
# they've bought, so no marketing opt-out link, but never sent after one.
MONITOR_DASHBOARD_SMS = (
    "Havlo: your 90-day listing dashboard for {address} is live. We'll track your listing, "
    "the changes you make and homes nearby: {link}"
)


def send_monitor_dashboard_sms(to_phone: str, *, address: str, link: str) -> bool:
    return _send_sms(to_phone, MONITOR_DASHBOARD_SMS.format(address=address, link=link), from_override="Havlo")
