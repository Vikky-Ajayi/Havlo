"""
Resend email service.

Used for:
- Welcome email on user registration
- New unread inbox message notification email
- Admin / agent notification emails
- StaleListings report-ready emails

Like every other integration in this codebase, the service is fully optional:
when RESEND_API_KEY / EMAIL_FROM are not configured the helpers log a warning
and return False. They never raise, so the API request that triggered the
email cannot fail because of an email problem.

Sending is performed in a worker thread (the Resend SDK is sync), and is
always called from a FastAPI BackgroundTask so the user-facing HTTP response
is sent before Resend is contacted.
"""
from __future__ import annotations

import asyncio
import html as _html_lib
import logging
import time
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

# Retry policy — short, bounded, sync-safe.
_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF_S = (1, 3, 6)


def _is_configured() -> bool:
    s = get_settings()
    return bool(s.RESEND_API_KEY and s.EMAIL_FROM)


def _send_sync(to_email: str, subject: str, html_body: str, plain_body: str) -> bool:
    """Synchronous send with bounded retries. Always returns a bool, never raises.

    Retries on transient errors (HTTP 429 rate-limit, HTTP 5xx, network/timeout).
    Permanent 4xx failures (other than 429) are not retried.
    """
    if not _is_configured():
        logger.warning(
            "Skipping email to %s — Resend is not configured (RESEND_API_KEY=%s, EMAIL_FROM=%s).",
            to_email,
            "set" if get_settings().RESEND_API_KEY else "MISSING",
            get_settings().EMAIL_FROM or "MISSING",
        )
        return False

    try:
        import resend  # type: ignore[import]
    except ImportError:
        logger.warning("resend package not installed — email is disabled.")
        return False

    s = get_settings()
    resend.api_key = s.RESEND_API_KEY

    from_name = (s.EMAIL_FROM_NAME or "Havlo").strip()
    from_field = f"{from_name} <{s.EMAIL_FROM}>"

    params: dict = {
        "from": from_field,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
        "text": plain_body,
    }
    if s.EMAIL_REPLY_TO:
        params["reply_to"] = s.EMAIL_REPLY_TO

    last_error: Optional[str] = None
    for attempt in range(1, _RETRY_ATTEMPTS + 1):
        try:
            result = resend.Emails.send(params)
            email_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
            if email_id:
                logger.info(
                    "Email delivered to %s (subject=%r, id=%s, attempt=%d)",
                    to_email, subject, email_id, attempt,
                )
                return True
            # Unexpected response without an id
            logger.error(
                "Resend returned no id for %s (attempt %d/%d): %s",
                to_email, attempt, _RETRY_ATTEMPTS, result,
            )
            last_error = f"no_id result={result}"
            # Treat as transient — may be a brief API hiccup
        except Exception as exc:  # noqa: BLE001
            status_code = getattr(exc, "status_code", None)
            body = getattr(exc, "body", None)
            try:
                body_preview = (
                    body.decode("utf-8", "replace") if isinstance(body, (bytes, bytearray))
                    else str(body or "")
                )[:500]
            except Exception:
                body_preview = str(exc)[:500]
            transient = (
                status_code is None
                or status_code == 429
                or (isinstance(status_code, int) and 500 <= status_code < 600)
            )
            logger.error(
                "Resend %s for %s (attempt %d/%d, from=%s): status=%s body=%s exc=%s",
                "transient error" if transient else "permanent error",
                to_email, attempt, _RETRY_ATTEMPTS, s.EMAIL_FROM,
                status_code if status_code is not None else "n/a",
                body_preview, exc,
            )
            last_error = f"status={status_code} body={body_preview!r}" if status_code else str(exc)
            if not transient:
                return False

        if attempt < _RETRY_ATTEMPTS:
            time.sleep(_RETRY_BACKOFF_S[attempt - 1])

    logger.error(
        "Resend send permanently failed for %s after %d attempts: %s",
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
    return {
        "configured": _is_configured(),
        "from_set": bool(s.EMAIL_FROM),
        "from_name_set": bool(s.EMAIL_FROM_NAME),
        "reply_to_set": bool(s.EMAIL_REPLY_TO),
        "support_email_set": bool(s.SUPPORT_EMAIL),
        "key_present": bool(s.RESEND_API_KEY),
        "from_email": s.EMAIL_FROM or None,
        "provider": "resend",
    }


def is_configured() -> bool:
    return _is_configured()


def send_test_email(to_email: str) -> bool:
    """Used by /diag/email/test to verify Resend credentials end-to-end."""
    return _send_sync(
        to_email=to_email,
        subject="Havlo email test",
        html_body="<p>This is a Havlo email integration test. If you can read this, Resend is wired up correctly.</p>",
        plain_body="This is a Havlo email integration test. If you can read this, Resend is wired up correctly.",
    )


def send_stale_listing_report_ready_sync(
    to_email: str,
    first_name: str,
    reference: str,
) -> bool:
    """Send a report-ready notification to the homeowner."""
    report_url = f"https://heyhavlo.com/stale-listings/report/{reference}"
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your StaleListings Report is Ready</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background:#000000;padding:24px 32px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">StaleListings</span>
        <span style="color:#9ca3af;font-size:13px;margin-left:8px;">by HAVLO</span>
      </td></tr>
      <tr><td style="padding:40px 32px;">
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">Your report is ready, {_html_lib.escape(first_name)}.</h1>
        <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">Your StaleListings property assessment has been reviewed and your personalised report is now available. Click below to view your full report, including your listing score, key findings, and prioritised action plan.</p>
        <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">Reference: <strong style="color:#111827;">{_html_lib.escape(reference)}</strong></p>
        <div style="margin:32px 0;">
          <a href="{report_url}" style="background:#000000;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:15px;display:inline-block;">View My Report →</a>
        </div>
        <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">If the button doesn't work, copy and paste this link into your browser:<br><a href="{report_url}" style="color:#6d28d9;">{report_url}</a></p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">© 2026 Havlo Ltd. All rights reserved. StaleListings is a service by Havlo.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""

    plain_body = (
        f"Hi {first_name},\n\n"
        f"Your StaleListings property assessment report is ready.\n\n"
        f"Reference: {reference}\n\n"
        f"View your report here:\n{report_url}\n\n"
        f"© 2026 Havlo Ltd. StaleListings by Havlo."
    )

    return _send_sync(
        to_email=to_email,
        subject=f"[StaleListings] Your report is ready — {reference}",
        html_body=html_body,
        plain_body=plain_body,
    )


async def send_stale_listing_report_ready(
    to_email: str,
    first_name: str,
    reference: str,
) -> bool:
    return await asyncio.to_thread(
        send_stale_listing_report_ready_sync, to_email, first_name, reference
    )


def send_stale_listing_agent_notification_sync(
    first_name: str,
    last_name: str,
    email: str,
    reference: str,
    package: str,
    property_address: str,
    listing_url: str,
) -> bool:
    """Notify the admin agent that a new AI report is ready for review."""
    s = get_settings()
    to_email = (s.ADMIN_NOTIFY_EMAIL or "").strip()
    if not to_email:
        logger.info("Skipping agent notification (ADMIN_NOTIFY_EMAIL empty).")
        return False

    frontend_url = getattr(s, "FRONTEND_URL", None) or "https://heyhavlo.com"
    admin_url = f"{frontend_url.rstrip('/')}/dashboard/stale-listings"

    package_labels = {
        "quick_insight": "Quick Insight (£79.99)",
        "professional_review": "Professional Review (£299.99)",
        "premium_strategy": "Premium Strategy (£1,499.99)",
    }
    package_label = package_labels.get(package, package)

    rows_html = ""
    fields = {
        "Client": f"{first_name} {last_name}",
        "Email": email,
        "Reference": reference,
        "Package": package_label,
        "Property Address": property_address or "Not provided",
        "Listing URL": listing_url or "Not provided",
    }
    for i, (k, v) in enumerate(fields.items()):
        bg = "#f9fafb" if i % 2 == 0 else "#ffffff"
        rows_html += f"""<tr style="background:{bg};">
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;width:38%;border-bottom:1px solid #f0f0f0;">{_html_lib.escape(k)}</td>
          <td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #f0f0f0;">{_html_lib.escape(v)}</td>
        </tr>"""

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New StaleListings Assessment</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background:#000000;padding:24px 32px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">StaleListings</span>
        <span style="color:#9ca3af;font-size:13px;margin-left:8px;">by HAVLO</span>
      </td></tr>
      <tr><td style="padding:32px 32px 16px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New assessment needs review</h1>
        <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">A new StaleListings assessment has been submitted and the AI report has been generated. Please review and approve before sending to the client.</p>
      </td></tr>
      <tr><td style="padding:0 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          {rows_html}
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 32px;">
        <a href="{admin_url}" style="background:#000000;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:14px;display:inline-block;">
          Review in Dashboard →
        </a>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Reference: {_html_lib.escape(reference)} · Sent automatically when an AI report is generated.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""

    plain_body = (
        f"New StaleListings assessment needs review.\n\n"
        f"Client: {first_name} {last_name}\n"
        f"Email: {email}\n"
        f"Reference: {reference}\n"
        f"Package: {package_label}\n"
        f"Property: {property_address or 'Not provided'}\n\n"
        f"Review in dashboard: {admin_url}\n"
    )

    return _send_sync(
        to_email=to_email,
        subject=f"[StaleListings] New assessment needs review — {reference}",
        html_body=html_body,
        plain_body=plain_body,
    )


async def send_stale_listing_agent_notification(
    first_name: str,
    last_name: str,
    email: str,
    reference: str,
    package: str,
    property_address: str,
    listing_url: str,
) -> bool:
    return await asyncio.to_thread(
        send_stale_listing_agent_notification_sync,
        first_name, last_name, email, reference, package, property_address, listing_url,
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
