"""
SendGrid email service.

Used for:
- Welcome email on user registration
- New unread inbox message notification email

Like every other integration in this codebase, the service is fully optional:
when SENDGRID_API_KEY / EMAIL_FROM are not configured the helpers log a
warning and return False. They never raise, so the API request that triggered
the email cannot fail because of an email problem.

Sending is performed in a worker thread (the SendGrid SDK is sync), and is
always called from a FastAPI BackgroundTask so the user-facing HTTP response
is sent before SendGrid is contacted.
"""
from __future__ import annotations

import asyncio
import html as _html_lib
import logging
import time
from functools import lru_cache
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

# SendGrid retry policy — short, bounded, sync-safe.
_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF_S = (1, 3, 6)  # backoff before attempts 2 and 3 (we use index attempt-1)


def _is_configured() -> bool:
    s = get_settings()
    return bool(s.SENDGRID_API_KEY and s.EMAIL_FROM)


_GLOBAL_HOST = "https://api.sendgrid.com"
_EU_HOST = "https://api.eu.sendgrid.com"


def _resolve_sendgrid_host() -> str:
    """Return the correct SendGrid base URL for the configured region.

    SendGrid runs two independent regions: global (api.sendgrid.com) and EU
    data-residency (api.eu.sendgrid.com). API keys belong to exactly one
    region; calling the wrong host returns ``HTTP 401 Unauthorized`` even
    with a valid key.

    Reference: https://www.twilio.com/docs/sendgrid/for-developers/sending-email/getting-started-eu-data-residency
    """
    s = get_settings()
    region = (getattr(s, "SENDGRID_REGION", "") or "").strip().lower()
    if region in ("eu", "europe"):
        return _EU_HOST
    return _GLOBAL_HOST


@lru_cache
def _get_client():
    """Lazily import + cache the SendGrid client so the package is optional."""
    try:
        from sendgrid import SendGridAPIClient
    except ImportError:  # pragma: no cover - sendgrid not installed
        logger.warning("sendgrid package not installed — email is disabled.")
        return None
    s = get_settings()
    if not s.SENDGRID_API_KEY:
        return None
    host = _resolve_sendgrid_host()
    # Pass host directly to the constructor — this is the documented API and
    # propagates correctly into the underlying python_http_client.Client.
    client = SendGridAPIClient(api_key=s.SENDGRID_API_KEY, host=host)
    logger.info(
        "SendGrid client initialised (host=%s, region=%s, from=%s).",
        host, getattr(s, "SENDGRID_REGION", "global") or "global", s.EMAIL_FROM or "MISSING",
    )
    return client


def reset_client_cache() -> None:
    """Drop the cached client so the next call re-reads settings.

    Useful in tests or after rotating env vars without restarting the process.
    """
    _get_client.cache_clear()


def _send_sync(to_email: str, subject: str, html_body: str, plain_body: str) -> bool:
    """Synchronous send with bounded retries. Always returns a bool, never raises.

    Retries on transient errors (HTTP 429 rate limit, HTTP 5xx, network/timeout
    exceptions). Permanent failures (4xx other than 429) are NOT retried —
    re-sending them would just be rejected again.
    """
    if not _is_configured():
        logger.warning(
            "Skipping email to %s — SendGrid is not configured (SENDGRID_API_KEY=%s, EMAIL_FROM=%s).",
            to_email,
            "set" if get_settings().SENDGRID_API_KEY else "MISSING",
            get_settings().EMAIL_FROM or "MISSING",
        )
        return False

    try:
        from sendgrid.helpers.mail import Mail, Email, To, Content
    except ImportError:  # pragma: no cover
        logger.warning("sendgrid helpers not available — email skipped.")
        return False

    s = get_settings()
    client = _get_client()
    if client is None:
        return False

    from_email = Email(s.EMAIL_FROM, s.EMAIL_FROM_NAME or "Havlo")
    message = Mail(
        from_email=from_email,
        to_emails=To(to_email),
        subject=subject,
        plain_text_content=Content("text/plain", plain_body),
        html_content=Content("text/html", html_body),
    )
    if s.EMAIL_REPLY_TO:
        message.reply_to = Email(s.EMAIL_REPLY_TO)

    # Import the SDK's typed HTTP error so we can read .status_code/.body
    # instead of relying on the str(exc) form which loses detail.
    try:
        from python_http_client.exceptions import HTTPError as SgHTTPError
    except ImportError:  # pragma: no cover - bundled with sendgrid
        SgHTTPError = None  # type: ignore[assignment]

    host = _resolve_sendgrid_host()
    last_error: Optional[str] = None
    for attempt in range(1, _RETRY_ATTEMPTS + 1):
        try:
            response = client.send(message)
            status_code = int(response.status_code)
            if 200 <= status_code < 300:
                logger.info(
                    "Email delivered to %s (subject=%r, status=%s, attempt=%d, host=%s)",
                    to_email, subject, status_code, attempt, host,
                )
                return True
            # SendGrid normally raises on non-2xx, but handle the rare path.
            body_preview = getattr(response, "body", b"")
            try:
                body_preview = body_preview.decode("utf-8", "replace")[:500]
            except Exception:
                body_preview = str(body_preview)[:500]
            transient = status_code == 429 or 500 <= status_code < 600
            logger.error(
                "SendGrid %s for %s (attempt %d/%d, host=%s, from=%s): status=%s body=%s",
                "transient error" if transient else "permanent error",
                to_email, attempt, _RETRY_ATTEMPTS, host, s.EMAIL_FROM, status_code, body_preview,
            )
            last_error = f"status={status_code}"
            if not transient:
                return False
        except Exception as exc:  # noqa: BLE001
            status_code = getattr(exc, "status_code", None)
            body = getattr(exc, "body", None)
            try:
                body_preview = (
                    body.decode("utf-8", "replace") if isinstance(body, (bytes, bytearray)) else str(body or "")
                )[:500]
            except Exception:
                body_preview = ""
            transient = (
                status_code is None  # network/timeout
                or status_code == 429
                or (isinstance(status_code, int) and 500 <= status_code < 600)
            )
            logger.error(
                "SendGrid %s for %s (attempt %d/%d, host=%s, from=%s): status=%s body=%s exc=%s",
                "transient error" if transient else "permanent error",
                to_email, attempt, _RETRY_ATTEMPTS, host, s.EMAIL_FROM,
                status_code if status_code is not None else "n/a",
                body_preview, exc,
            )
            if status_code == 401:
                # Highest-signal hint: the credentials were rejected by the
                # endpoint we hit. Tell the operator exactly what to check.
                region_set = (getattr(s, "SENDGRID_REGION", "") or "").strip().lower()
                logger.error(
                    "SendGrid 401 from %s. The API key was rejected by this region. "
                    "If your SendGrid account is on EU data residency, set the env var "
                    "SENDGRID_REGION=eu and redeploy. Current SENDGRID_REGION=%r.",
                    host, region_set or "(unset → defaults to global)",
                )
            last_error = f"status={status_code} body={body_preview!r}" if status_code else str(exc)
            if not transient:
                return False

        if attempt < _RETRY_ATTEMPTS:
            time.sleep(_RETRY_BACKOFF_S[attempt - 1])

    logger.error(
        "SendGrid send permanently failed for %s after %d attempts: %s",
        to_email, _RETRY_ATTEMPTS, last_error,
    )
    return False


async def _send_async(to_email: str, subject: str, html_body: str, plain_body: str) -> bool:
    return await asyncio.to_thread(_send_sync, to_email, subject, html_body, plain_body)


# ────────────────────────────────────────────────────────────────────────────
# Welcome email — matches the Figma design supplied by the product team.
# ────────────────────────────────────────────────────────────────────────────

_WELCOME_HERO_URL = (
    "https://api.builder.io/api/v1/image/assets/TEMP/"
    "64884eb598f4215081379f41efe3ccc7f5caa687?width=1016"
)


def _welcome_html(first_name: str, support_email: str) -> str:
    safe_name = _html_lib.escape(first_name or "there")
    safe_support = _html_lib.escape(support_email or "support@Havlo.com")

    # Email-client-safe HTML: tables for layout, inline styles for everything,
    # @media query for the mobile breakpoint. Keep <style> minimal so Outlook
    # / Gmail Web both render correctly. Width: 600px is the standard.
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to Havlo</title>
<style>
  body {{ margin:0; padding:0; background:#F4F4F4; }}
  table {{ border-collapse:collapse; }}
  img {{ border:0; outline:none; text-decoration:none; display:block; }}
  a {{ color:#3247E5; text-decoration:none; }}
  .havlo-card {{ width:600px; max-width:600px; }}
  .havlo-pad-x {{ padding-left:48px; padding-right:48px; }}
  .havlo-pad-y {{ padding-top:32px; padding-bottom:32px; }}
  @media only screen and (max-width: 620px) {{
    .havlo-card  {{ width:100% !important; max-width:100% !important; }}
    .havlo-pad-x {{ padding-left:16px !important; padding-right:16px !important; }}
    .havlo-h1    {{ font-size:24px !important; line-height:32px !important; }}
    .havlo-hero  {{ height:auto !important; max-height:200px !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif;color:#000;">
<!-- preheader (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F4F4F4;">
  Welcome to Havlo — the future of property is here.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F4F4">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <!-- Card -->
      <table role="presentation" class="havlo-card" cellpadding="0" cellspacing="0" border="0"
             style="background:#FFFFFF;border:1px solid rgba(207,207,206,0.20);width:600px;max-width:600px;">
        <!-- Header: logo + social icons -->
        <tr>
          <td class="havlo-pad-x" style="padding:32px 48px 0 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:28px;letter-spacing:-1px;color:#000;">
                  HAVLO
                </td>
                <td align="right">
                  <a href="https://facebook.com/havlo" style="display:inline-block;margin-left:6px;width:32px;height:32px;line-height:32px;text-align:center;border:1px solid rgba(0,0,0,0.10);border-radius:8px;background:#FFF;color:#000;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;">f</a>
                  <a href="https://instagram.com/havlo" style="display:inline-block;margin-left:6px;width:32px;height:32px;line-height:32px;text-align:center;border:1px solid rgba(0,0,0,0.10);border-radius:8px;background:#FFF;color:#000;font-family:Arial,sans-serif;font-size:13px;text-decoration:none;">IG</a>
                  <a href="https://x.com/havlo" style="display:inline-block;margin-left:6px;width:32px;height:32px;line-height:32px;text-align:center;border:1px solid rgba(0,0,0,0.10);border-radius:8px;background:#FFF;color:#000;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;">X</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero illustration -->
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 0 48px;" align="center">
            <img class="havlo-hero" src="{_WELCOME_HERO_URL}" width="508" alt=""
                 style="display:block;width:100%;max-width:508px;height:auto;" />
          </td>
        </tr>

        <!-- Greeting + body -->
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;color:#000;">
            <p style="margin:0 0 12px 0;font-size:16px;line-height:24px;color:#000;">Hi {safe_name},</p>
            <h1 class="havlo-h1" style="margin:0 0 16px 0;font-size:28px;line-height:36px;font-weight:800;letter-spacing:-0.6px;color:#000;">
              Welcome to Havlo, the future of property is here.
            </h1>
            <p style="margin:0 0 12px 0;font-size:14px;line-height:22px;color:#4F5A68;">
              We&rsquo;re excited to have you join a new kind of property platform &mdash; one built to connect opportunity across borders, simplify selling, and unlock global buying power.
            </p>
            <p style="margin:0 0 16px 0;font-size:14px;line-height:22px;color:#4F5A68;">
              At Havlo, we bring together estate agents, homeowners, and international buyers in one seamless place designed for speed, visibility, and trust.
            </p>
          </td>
        </tr>

        <!-- WHETHER YOU'RE block (light pink) -->
        <tr>
          <td class="havlo-pad-x" style="padding:0 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="border:1px solid #FEE1FD;background:#FFF0FE;border-radius:8px;">
              <tr>
                <td style="padding:16px;font-family:Arial,Helvetica,sans-serif;color:#000;">
                  <p style="margin:0 0 12px 0;font-size:12px;font-weight:800;letter-spacing:1px;color:#A0049A;">WHETHER YOU&rsquo;RE</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="top" width="14" style="padding:6px 8px 0 0;">
                        <div style="width:8px;height:8px;border-radius:50%;background:#A0049A;"></div>
                      </td>
                      <td style="padding:4px 0;font-size:14px;line-height:22px;color:#000;">
                        <strong>An estate agent</strong> looking to expand your reach and attract serious, qualified buyers
                      </td>
                    </tr>
                    <tr>
                      <td valign="top" width="14" style="padding:6px 8px 0 0;">
                        <div style="width:8px;height:8px;border-radius:50%;background:#A0049A;"></div>
                      </td>
                      <td style="padding:4px 0;font-size:14px;line-height:22px;color:#000;">
                        <strong>A homeowner</strong> ready to sell your property with maximum exposure
                      </td>
                    </tr>
                    <tr>
                      <td valign="top" width="14" style="padding:6px 8px 0 0;">
                        <div style="width:8px;height:8px;border-radius:50%;background:#A0049A;"></div>
                      </td>
                      <td style="padding:4px 0;font-size:14px;line-height:22px;color:#000;">
                        <strong>A buyer searching</strong> for your next home abroad with confidence and ease
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding:8px 0 0 0;font-size:14px;line-height:22px;color:#000;">
                        Havlo is built to make it happen &mdash; faster and smarter.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- WHY HAVLO? block (dark) -->
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 0 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#0E0E10;border-radius:8px;">
              <tr>
                <td style="padding:16px;font-family:Arial,Helvetica,sans-serif;color:#FFF;">
                  <p style="margin:0 0 12px 0;font-size:12px;font-weight:800;letter-spacing:1px;color:#FFF;">WHY HAVLO?</p>
                  <!-- pill 1 -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background:#1A1A1D;border-radius:24px;">
                    <tr>
                      <td width="36" align="center" style="padding:8px 0 8px 8px;">
                        <div style="width:28px;height:28px;border-radius:50%;background:#A0049A;color:#FFF;font-weight:bold;line-height:28px;text-align:center;">&#127760;</div>
                      </td>
                      <td style="padding:10px 12px;font-size:13px;line-height:18px;color:#FFF;">
                        Global property exposure, without the complexity
                      </td>
                    </tr>
                  </table>
                  <!-- pill 2 -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background:#1A1A1D;border-radius:24px;">
                    <tr>
                      <td width="36" align="center" style="padding:8px 0 8px 8px;">
                        <div style="width:28px;height:28px;border-radius:50%;background:#A0049A;color:#FFF;font-weight:bold;line-height:28px;text-align:center;">&#8634;</div>
                      </td>
                      <td style="padding:10px 12px;font-size:13px;line-height:18px;color:#FFF;">
                        A streamlined experience for international transactions
                      </td>
                    </tr>
                  </table>
                  <!-- pill 3 -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1A1A1D;border-radius:24px;">
                    <tr>
                      <td width="36" align="center" style="padding:8px 0 8px 8px;">
                        <div style="width:28px;height:28px;border-radius:50%;background:#A0049A;color:#FFF;font-weight:bold;line-height:28px;text-align:center;">&#9650;</div>
                      </td>
                      <td style="padding:10px 12px;font-size:13px;line-height:18px;color:#FFF;">
                        More visibility for listings, more opportunities for deals
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Closing -->
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 32px 48px;font-family:Arial,Helvetica,sans-serif;color:#000;">
            <p style="margin:0 0 12px 0;font-size:14px;line-height:22px;color:#4F5A68;">
              We&rsquo;re not just another property platform &mdash; we&rsquo;re building a global bridge for real estate. Your journey starts here, and we&rsquo;re excited to be part of it.
            </p>
            <p style="margin:0 0 16px 0;font-size:14px;line-height:22px;color:#000;font-weight:bold;">
              Welcome to the future of property.
            </p>
            <p style="margin:0 0 4px 0;font-size:14px;line-height:22px;color:#000;">Warm regards,</p>
            <p style="margin:0;font-size:14px;line-height:22px;color:#000;font-weight:bold;">The Havlo Team.</p>
          </td>
        </tr>
      </table>
      <!-- /Card -->

      <!-- Footer -->
      <table role="presentation" class="havlo-card" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" style="padding:24px 16px 8px 16px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#3247E5;">
            If you ever need support, we&rsquo;re always here:
            <a href="mailto:{safe_support}" style="color:#3247E5;text-decoration:underline;">{safe_support}</a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 16px 24px 16px;font-family:Inter,Arial,Helvetica,sans-serif;font-size:12px;color:#3A3C3E;">
            Copyright &copy;Havlo. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
"""


def _welcome_plain(first_name: str, support_email: str) -> str:
    name = first_name or "there"
    return (
        f"Hi {name},\n\n"
        "Welcome to Havlo — the future of property is here.\n\n"
        "We're excited to have you join a new kind of property platform — one built to "
        "connect opportunity across borders, simplify selling, and unlock global buying power.\n\n"
        "At Havlo, we bring together estate agents, homeowners, and international buyers in "
        "one seamless place designed for speed, visibility, and trust.\n\n"
        "WHETHER YOU'RE\n"
        " • An estate agent looking to expand your reach and attract serious, qualified buyers\n"
        " • A homeowner ready to sell your property with maximum exposure\n"
        " • A buyer searching for your next home abroad with confidence and ease\n"
        "Havlo is built to make it happen — faster and smarter.\n\n"
        "WHY HAVLO?\n"
        " • Global property exposure, without the complexity\n"
        " • A streamlined experience for international transactions\n"
        " • More visibility for listings, more opportunities for deals\n\n"
        "We're not just another property platform — we're building a global bridge for real estate.\n"
        "Your journey starts here, and we're excited to be part of it.\n\n"
        "Welcome to the future of property.\n\n"
        "Warm regards,\n"
        "The Havlo Team\n\n"
        f"Need support? {support_email}\n"
    )


def send_welcome_email_sync(to_email: str, first_name: str) -> bool:
    """Send the welcome email synchronously (intended for FastAPI BackgroundTasks)."""
    s = get_settings()
    support_email = s.SUPPORT_EMAIL or "support@Havlo.com"
    return _send_sync(
        to_email=to_email,
        subject="Welcome to Havlo — the future of property is here",
        html_body=_welcome_html(first_name, support_email),
        plain_body=_welcome_plain(first_name, support_email),
    )


async def send_welcome_email(to_email: str, first_name: str) -> bool:
    return await asyncio.to_thread(send_welcome_email_sync, to_email, first_name)


# ────────────────────────────────────────────────────────────────────────────
# Inbox notification email — sent when a user has an unread message and is
# not currently connected over the inbox WebSocket.
# ────────────────────────────────────────────────────────────────────────────

def _inbox_notice_html(first_name: str, sender_name: str, snippet: str, inbox_url: str) -> str:
    name_safe = _html_lib.escape(first_name or "there")
    sender_safe = _html_lib.escape(sender_name or "Havlo Advisory")
    snippet_safe = _html_lib.escape((snippet or "").strip())
    if not snippet_safe:
        snippet_safe = "You have a new message in your Havlo inbox."

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif;color:#000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F4F4">
  <tr><td align="center" style="padding:24px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">
      <tr><td style="padding:24px 28px 8px 28px;">
        <div style="font-weight:900;font-size:22px;letter-spacing:-1px;color:#000;">HAVLO</div>
      </td></tr>
      <tr><td style="padding:8px 28px 0 28px;">
        <h1 style="margin:0 0 12px 0;font-size:22px;line-height:30px;font-weight:800;color:#000;">
          You have a new message
        </h1>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:22px;color:#4F5A68;">
          Hi {name_safe}, <strong>{sender_safe}</strong> just sent you a message on Havlo.
        </p>
      </td></tr>
      <tr><td style="padding:0 28px;">
        <div style="border-left:3px solid #A0049A;background:#FFF0FE;padding:14px 16px;border-radius:6px;font-size:14px;line-height:22px;color:#000;">
          {snippet_safe}
        </div>
      </td></tr>
      <tr><td align="center" style="padding:24px 28px 8px 28px;">
        <a href="{_html_lib.escape(inbox_url)}"
           style="display:inline-block;background:#A409D2;color:#FFFFFF;text-decoration:none;
                  padding:12px 28px;border-radius:32px;font-weight:bold;font-size:14px;">
          Open inbox
        </a>
      </td></tr>
      <tr><td style="padding:8px 28px 24px 28px;">
        <p style="margin:0;font-size:12px;line-height:18px;color:#3A3C3E;">
          You&rsquo;re receiving this because you have notifications turned on for new messages.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _inbox_notice_plain(first_name: str, sender_name: str, snippet: str, inbox_url: str) -> str:
    name = first_name or "there"
    s = (snippet or "").strip() or "You have a new message in your Havlo inbox."
    return (
        f"Hi {name},\n\n"
        f"{sender_name or 'Havlo Advisory'} just sent you a new message on Havlo:\n\n"
        f"  {s}\n\n"
        f"Open your inbox: {inbox_url}\n"
    )


def send_inbox_notification_sync(
    to_email: str,
    first_name: str,
    sender_name: str,
    snippet: str,
    inbox_url: str,
) -> bool:
    return _send_sync(
        to_email=to_email,
        subject=f"New message from {sender_name or 'Havlo'}",
        html_body=_inbox_notice_html(first_name, sender_name, snippet, inbox_url),
        plain_body=_inbox_notice_plain(first_name, sender_name, snippet, inbox_url),
    )


# ────────────────────────────────────────────────────────────────────────────
# Admin "new sheet entry" notification
# Sent (best-effort) to ADMIN_NOTIFY_EMAIL whenever a website form writes a
# new row to a Google Sheet tab. Uses BackgroundTasks so the user-facing
# response is never delayed.
# ────────────────────────────────────────────────────────────────────────────

def _admin_notice_html(sheet_tab: str, summary: str, fields: dict[str, str]) -> str:
    rows = "".join(
        f"<tr>"
        f"<td style='padding:6px 12px;font-weight:600;color:#000;border-bottom:1px solid #eee;'>"
        f"{_html_lib.escape(str(k))}</td>"
        f"<td style='padding:6px 12px;color:#1F1F1E;border-bottom:1px solid #eee;'>"
        f"{_html_lib.escape(str(v))}</td>"
        f"</tr>"
        for k, v in fields.items()
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset='UTF-8'></head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif;color:#000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F4F4">
  <tr><td align="center" style="padding:24px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">
      <tr><td style="padding:24px 28px 4px 28px;">
        <div style="font-weight:900;font-size:22px;letter-spacing:-1px;color:#000;">HAVLO</div>
      </td></tr>
      <tr><td style="padding:8px 28px 0 28px;">
        <h1 style="margin:0 0 8px 0;font-size:20px;line-height:28px;font-weight:800;color:#000;">
          New entry: {_html_lib.escape(sheet_tab)}
        </h1>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:22px;color:#4F5A68;">
          {_html_lib.escape(summary)}
        </p>
      </td></tr>
      <tr><td style="padding:0 28px 16px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid #eee;border-radius:8px;font-size:14px;">
          {rows}
        </table>
      </td></tr>
      <tr><td style="padding:0 28px 24px 28px;">
        <p style="margin:0;font-size:12px;color:#3A3C3E;">
          Sent automatically when a Havlo website form writes a row to your Google Sheet.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _admin_notice_plain(sheet_tab: str, summary: str, fields: dict[str, str]) -> str:
    body = f"New entry: {sheet_tab}\n{summary}\n\n"
    for k, v in fields.items():
        body += f"  {k}: {v}\n"
    body += "\nSent automatically when a Havlo website form writes a row to your Google Sheet.\n"
    return body


def send_admin_notification_sync(sheet_tab: str, summary: str, fields: dict[str, str]) -> bool:
    """Notify the configured admin address that a new row was added to a sheet."""
    s = get_settings()
    to_email = (s.ADMIN_NOTIFY_EMAIL or "").strip()
    if not to_email:
        logger.info("Skipping admin notification (ADMIN_NOTIFY_EMAIL empty).")
        return False
    return _send_sync(
        to_email=to_email,
        subject=f"[Havlo] New entry — {sheet_tab}",
        html_body=_admin_notice_html(sheet_tab, summary, fields),
        plain_body=_admin_notice_plain(sheet_tab, summary, fields),
    )


async def send_admin_notification(sheet_tab: str, summary: str, fields: dict[str, str]) -> bool:
    return await asyncio.to_thread(send_admin_notification_sync, sheet_tab, summary, fields)


async def send_inbox_notification(
    to_email: str,
    first_name: str,
    sender_name: str,
    snippet: str,
    inbox_url: str,
) -> bool:
    return await asyncio.to_thread(
        send_inbox_notification_sync, to_email, first_name, sender_name, snippet, inbox_url
    )


def diagnostics() -> dict:
    """Expose minimal config status (no secret material) for /diag endpoints."""
    s = get_settings()
    region = (getattr(s, "SENDGRID_REGION", "") or "").strip().lower() or "global"
    return {
        "configured": _is_configured(),
        "from_set": bool(s.EMAIL_FROM),
        "from_name_set": bool(s.EMAIL_FROM_NAME),
        "reply_to_set": bool(s.EMAIL_REPLY_TO),
        "support_email_set": bool(s.SUPPORT_EMAIL),
        "key_present": bool(s.SENDGRID_API_KEY),
        "region": region,
        "host": _resolve_sendgrid_host(),
        "from_email": s.EMAIL_FROM or None,
    }


def is_configured() -> bool:
    return _is_configured()


def send_test_email(to_email: str) -> bool:
    """Used by /diag/email/test to verify SendGrid credentials end-to-end."""
    return _send_sync(
        to_email=to_email,
        subject="Havlo email test",
        html_body="<p>This is a Havlo email integration test. If you can read this, SendGrid is wired up correctly.</p>",
        plain_body="This is a Havlo email integration test. If you can read this, SendGrid is wired up correctly.",
    )


# Sync helpers exposed for FastAPI BackgroundTasks (which prefer sync callables).
__all__ = [
    "send_welcome_email",
    "send_welcome_email_sync",
    "send_inbox_notification",
    "send_inbox_notification_sync",
    "send_test_email",
    "diagnostics",
    "is_configured",
]
