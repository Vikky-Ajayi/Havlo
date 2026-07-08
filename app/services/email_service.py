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
import base64
import html as _html_lib
import logging
import time
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import quote

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


_EMAIL_PREVIEW_TEMPLATES = (
    "welcome",
    "inbox-notice",
    "admin-notice",
    "custom-offer-confirmation",
    "custom-offer-status",
    "product-access-magic-link",
    "stale-report-ready",
    "stale-agent-notification",
)


def _frontend_base_url(*, preview: bool = False, override: str | None = None) -> str:
    if override and override.strip():
        return override.strip().rstrip("/")

    configured = (get_settings().FRONTEND_URL or "").strip().rstrip("/")
    if preview:
        if configured and ("localhost" in configured or "127.0.0.1" in configured):
            return "http://localhost:5001"
        return configured or "http://localhost:5001"

    if configured and "localhost" not in configured and "127.0.0.1" not in configured:
        return configured
    return "https://www.heyhavlo.com"


def _email_asset_url(
    asset_path: str,
    *,
    preview: bool = False,
    frontend_base_url: str | None = None,
) -> str:
    clean_path = asset_path.lstrip("/")
    encoded_path = "/".join(quote(part) for part in clean_path.split("/"))
    return f"{_frontend_base_url(preview=preview, override=frontend_base_url)}/{encoded_path}"


def _email_brand(frontend_base_url: str | None = None, *, preview: bool = False) -> dict[str, str]:
    s = get_settings()
    support_email = (s.SUPPORT_EMAIL or "hello@heyhavlo.com").strip()
    phone_display = (s.EMAIL_SUPPORT_PHONE_DISPLAY or "+44 292 1819 1819").strip()
    phone_link = (s.EMAIL_SUPPORT_PHONE_LINK or "+4429218191819").strip().replace(" ", "")
    hero_url = (s.EMAIL_HERO_IMAGE_URL or "").strip() or _email_asset_url(
        "email-assets/havlo-email-hero.png",
        preview=preview,
        frontend_base_url=frontend_base_url,
    )
    return {
        "support_email": support_email,
        "support_email_escaped": _html_lib.escape(support_email),
        "phone_display": phone_display,
        "phone_link": f"tel:{_html_lib.escape(phone_link)}",
        "facebook_url": (s.EMAIL_SOCIAL_FACEBOOK_URL or "https://www.facebook.com/profile.php?id=61586495581183").strip(),
        "instagram_url": (s.EMAIL_SOCIAL_INSTAGRAM_URL or "https://www.instagram.com/heyhavlo/").strip(),
        "x_url": (s.EMAIL_SOCIAL_X_URL or "https://x.com/heyhavlo?s=21").strip(),
        "logo_url": _email_asset_url(
            "Havlo Black Transparent.png",
            preview=preview,
            frontend_base_url=frontend_base_url,
        ),
        "hero_url": hero_url,
        "icon_facebook_url": _email_asset_url(
            "email-assets/icon-facebook.svg",
            preview=preview,
            frontend_base_url=frontend_base_url,
        ),
        "icon_instagram_url": _email_asset_url(
            "email-assets/icon-instagram.svg",
            preview=preview,
            frontend_base_url=frontend_base_url,
        ),
        "icon_x_url": _email_asset_url(
            "email-assets/icon-x.svg",
            preview=preview,
            frontend_base_url=frontend_base_url,
        ),
    }


def _email_social_buttons_html(brand: dict[str, str]) -> str:
    socials = (
        ("Facebook", brand["facebook_url"], brand["icon_facebook_url"]),
        ("Instagram", brand["instagram_url"], brand["icon_instagram_url"]),
        ("X", brand["x_url"], brand["icon_x_url"]),
    )
    buttons = []
    for label, href, icon_url in socials:
        buttons.append(
            f'<a href="{_html_lib.escape(href)}" target="_blank" rel="noopener noreferrer" '
            'style="display:inline-block;margin-left:10px;width:32px;height:32px;border:1px solid rgba(17,17,17,0.14);'
            'border-radius:8px;background:#FFFFFF;text-decoration:none;text-align:center;line-height:32px;">'
            f'<img src="{icon_url}" alt="{label}" width="16" height="16" '
            'style="display:inline-block;vertical-align:middle;margin-top:7px;" /></a>'
        )
    return "".join(buttons)


def _email_button_html(url: str, label: str, *, accent: str = "#000000", text_color: str = "#FFFFFF") -> str:
    return (
        f'<a href="{_html_lib.escape(url)}" '
        f'style="display:inline-block;background:{accent};color:{text_color};text-decoration:none;'
        'padding:14px 28px;border-radius:8px;font-weight:700;font-size:14px;line-height:18px;">'
        f"{_html_lib.escape(label)}</a>"
    )


def _email_phone_banner_html(brand: dict[str, str], eyebrow: str, headline: str) -> str:
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 26px 0;background:#060606;border-radius:0;">
      <tr>
        <td style="padding:22px 20px;background:
            linear-gradient(135deg, #000000 0%, #000000 14%, #2a2a2a 14%, #2a2a2a 28%, #000000 28%, #000000 100%);
            text-align:center;">
          <p style="margin:0 0 10px 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.4px;color:#FFFFFF;text-transform:uppercase;">
            {_html_lib.escape(eyebrow)}
          </p>
          <a href="{brand["phone_link"]}" style="color:#FFFFFF;text-decoration:none;font-size:18px;line-height:24px;font-weight:800;">
            {_html_lib.escape(headline)}
          </a>
        </td>
      </tr>
    </table>
    """


def _email_arrow_list_html(items: Iterable[str]) -> str:
    rows: list[str] = []
    for item in items:
        rows.append(
            "<tr>"
            '<td valign="top" width="26" style="padding:6px 8px 10px 0;font-size:26px;line-height:24px;color:#8C133B;font-weight:700;">'
            "&#8594;</td>"
            f'<td style="padding:6px 0 10px 0;font-size:15px;line-height:24px;color:#556274;">{_html_lib.escape(item)}</td>'
            "</tr>"
        )
    return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">" + "".join(rows) + "</table>"


def _product_access_magic_link_html(
    email: str,
    scope_label: str,
    magic_link: str,
    *,
    first_name: str = "",
) -> str:
    brand = _email_brand()
    safe_name = _html_lib.escape(first_name.strip() or "there")
    safe_scope = _html_lib.escape(scope_label)
    safe_email = _html_lib.escape(email)
    body_html = f"""
    <tr>
      <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
        <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi {safe_name},</p>
        <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Sign in easily without a password.</h1>
        <p class="havlo-body-copy" style="margin:0 0 14px 0;">
          Use the secure magic link below to access your <strong style="color:#111111;">{safe_scope}</strong> updates with the email address
          <strong style="color:#111111;">{safe_email}</strong>.
        </p>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px 18px 48px;font-family:Arial,Helvetica,sans-serif;">
        <div style="text-align:left;margin-bottom:16px;">{_email_button_html(magic_link, "Sign in with magic link", accent="#000000", text_color="#FFFFFF")}</div>
        <p class="havlo-body-copy" style="margin:0 0 10px 0;font-size:13px;line-height:22px;">This link expires in 30 minutes and can only be used once.</p>
        <p class="havlo-body-copy" style="margin:0;font-size:13px;line-height:22px;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="{_html_lib.escape(magic_link)}" style="color:#3247E5;text-decoration:none;">{_html_lib.escape(magic_link)}</a></p>
      </td>
    </tr>
    """
    return _email_shell_html(
        title=f"{scope_label} sign in link",
        preheader=f"Use this secure magic link to access your {scope_label} updates.",
        body_html=body_html,
        brand=brand,
        show_hero=True,
    )


def _password_reset_otp_html(
    email: str,
    otp_code: str,
    *,
    first_name: str = "",
) -> str:
    brand = _email_brand()
    safe_name = _html_lib.escape(first_name.strip() or "there")
    safe_email = _html_lib.escape(email)
    safe_code = _html_lib.escape(otp_code)
    body_html = f"""
    <tr>
      <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
        <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi {safe_name},</p>
        <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Use this code to reset your password.</h1>
        <p class="havlo-body-copy" style="margin:0 0 16px 0;">
          Enter the one-time code below in Havlo to continue resetting the password for
          <strong style="color:#111111;"> {safe_email}</strong>.
        </p>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px 18px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#FFF4FD;border-left:4px solid #8C133B;border-radius:10px;">
          <tr>
            <td align="center" style="padding:18px 20px;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:10px;color:#111111;">
              {safe_code}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
        <p class="havlo-body-copy" style="margin:0 0 12px 0;">This code expires in 15 minutes and can only be used once.</p>
        <p class="havlo-body-copy" style="margin:0;font-size:13px;line-height:22px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </td>
    </tr>
    """
    return _email_shell_html(
        title="Reset your Havlo password",
        preheader="Use this one-time code to reset your Havlo password.",
        body_html=body_html,
        brand=brand,
        show_hero=True,
    )


def _email_value_table_html(fields: dict[str, str]) -> str:
    rows = []
    for index, (key, value) in enumerate(fields.items()):
        bg = "#F8F8F8" if index % 2 == 0 else "#FFFFFF"
        rows.append(
            f"<tr style=\"background:{bg};\">"
            f"<td style=\"padding:11px 14px;font-size:13px;line-height:18px;font-weight:700;color:#111111;border-bottom:1px solid #ECECEC;\">{_html_lib.escape(str(key))}</td>"
            f"<td style=\"padding:11px 14px;font-size:13px;line-height:18px;color:#4F5A68;border-bottom:1px solid #ECECEC;\">{_html_lib.escape(str(value))}</td>"
            "</tr>"
        )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="border:1px solid #ECECEC;border-radius:10px;overflow:hidden;">'
        + "".join(rows)
        + "</table>"
    )


def _email_shell_html(
    *,
    title: str,
    preheader: str,
    body_html: str,
    brand: dict[str, str],
    show_hero: bool = True,
) -> str:
    hero_html = ""
    if show_hero:
        hero_html = f"""
        <tr>
          <td class="havlo-pad-x" style="padding:18px 48px 0 48px;">
            <img src="{brand["hero_url"]}" alt="Havlo property illustration" width="508"
                 style="display:block;width:100%;max-width:508px;height:auto;" />
          </td>
        </tr>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{_html_lib.escape(title)}</title>
<style>
  body {{ margin:0; padding:0; background:#F4F4F4; }}
  table {{ border-collapse:collapse; }}
  img {{ border:0; outline:none; text-decoration:none; display:block; }}
  a {{ color:#3247E5; text-decoration:none; }}
  .havlo-card {{ width:600px; max-width:600px; }}
  .havlo-pad-x {{ padding-left:48px; padding-right:48px; }}
  .havlo-body-copy {{ font-size:15px; line-height:28px; color:#556274; }}
  .havlo-heading {{ font-size:28px; line-height:36px; font-weight:800; letter-spacing:-0.8px; color:#556274; }}
  .havlo-subheading {{ font-size:16px; line-height:24px; color:#556274; }}
  @media only screen and (max-width: 620px) {{
    .havlo-card {{ width:100% !important; max-width:100% !important; }}
    .havlo-pad-x {{ padding-left:16px !important; padding-right:16px !important; }}
    .havlo-heading {{ font-size:24px !important; line-height:32px !important; }}
    .havlo-body-copy {{ font-size:14px !important; line-height:24px !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif;color:#111111;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F4F4F4;">
  {_html_lib.escape(preheader)}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F4F4">
  <tr>
    <td align="center" style="padding:42px 16px 22px;">
      <table role="presentation" class="havlo-card" cellpadding="0" cellspacing="0" border="0"
             style="background:#FFFFFF;border:1px solid rgba(207,207,206,0.24);width:600px;max-width:600px;">
        <tr>
          <td class="havlo-pad-x" style="padding:34px 48px 0 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left">
                  <img src="{brand["logo_url"]}" alt="Havlo" width="137" style="display:block;width:137px;max-width:100%;height:auto;" />
                </td>
                <td align="right" style="white-space:nowrap;">
                  {_email_social_buttons_html(brand)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        {hero_html}
        {body_html}
      </table>

      <table role="presentation" class="havlo-card" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" style="padding:18px 16px 8px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:22px;color:#556274;">
            If you ever need support, we're always here:
            <a href="mailto:{brand["support_email_escaped"]}" style="color:#3247E5;text-decoration:none;">{brand["support_email_escaped"]}</a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 16px 24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#556274;">
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


def preview_template_names() -> list[str]:
    return list(_EMAIL_PREVIEW_TEMPLATES)


_PUBLIC_DIR = Path(__file__).resolve().parents[2] / "havlo_frontend" / "public"


def _asset_data_uri(public_relative_path: str) -> str:
    file_path = _PUBLIC_DIR / public_relative_path
    if not file_path.exists():
        return ""
    suffix = file_path.suffix.lower()
    mime = {
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
    }.get(suffix, "application/octet-stream")
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _inline_preview_assets(html: str, frontend_base_url: str | None = None) -> str:
    preview_brand = _email_brand(frontend_base_url, preview=True)
    default_brand = _email_brand()
    replacements = {}
    for brand in (preview_brand, default_brand):
        replacements[brand["logo_url"]] = _asset_data_uri("Havlo Black Transparent.png")
        replacements[brand["hero_url"]] = _asset_data_uri("email-assets/havlo-email-hero.png")
        replacements[brand["icon_facebook_url"]] = _asset_data_uri("email-assets/icon-facebook.svg")
        replacements[brand["icon_instagram_url"]] = _asset_data_uri("email-assets/icon-instagram.svg")
        replacements[brand["icon_x_url"]] = _asset_data_uri("email-assets/icon-x.svg")
    rendered = html
    for old, new in replacements.items():
        if old and new:
            rendered = rendered.replace(old, new)
    return rendered


def render_email_preview(template_name: str, frontend_base_url: str | None = None) -> str:
    key = (template_name or "").strip().lower()
    brand = _email_brand(frontend_base_url, preview=True)
    if key == "welcome":
        html = _welcome_html("First Name", brand["support_email"])
    elif key == "inbox-notice":
        html = _inbox_notice_html(
            "First Name",
            "Havlo Property Expert",
            "Based on what you shared, the next step is a short conversation with one of our property experts.",
            "https://www.heyhavlo.com/dashboard/messages",
        )
    elif key == "admin-notice":
        html = _admin_notice_html(
            "Buy Abroad Enquiries",
            "A new Havlo lead has been captured and added to the sheet.",
            {
                "Name": "First Name Last Name",
                "Email": "lead@example.com",
                "Country": "Portugal",
                "Timeline": "Within 6 months",
            },
        )
    elif key == "custom-offer-confirmation":
        html = _email_shell_html(
            title="CustomOffer submission received",
            preheader="Your CustomOffer proposal has been submitted.",
            brand=brand,
            show_hero=True,
            body_html=f"""
            <tr>
              <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
                <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi First Name,</p>
                <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Your proposal has been submitted.</h1>
                <p class="havlo-body-copy" style="margin:0 0 14px 0;">Your CustomOffer proposal for <strong style="color:#111111;">14 Ashford Road, Bristol BS3 4TH</strong> has been securely delivered for homeowner review.</p>
                <p style="margin:0 0 18px 0;font-size:14px;line-height:24px;color:#556274;">Reference: <strong style="color:#111111;">CO-1A2B3C</strong></p>
              </td>
            </tr>
            <tr><td class="havlo-pad-x" style="padding:0 48px 0 48px;">{_email_phone_banner_html(brand, "Call us here", brand["phone_display"])}</td></tr>
            <tr>
              <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
                <div style="text-align:left;margin-bottom:18px;">{_email_button_html("https://www.heyhavlo.com/custom-offers/status/CO-1A2B3C", "View proposal status")}</div>
                <p class="havlo-body-copy" style="margin:0;">We'll notify you if the homeowner chooses to engage.</p>
              </td>
            </tr>
            """,
        )
    elif key == "custom-offer-status":
        html = _email_shell_html(
            title="CustomOffer status update",
            preheader="Your CustomOffer status has changed.",
            brand=brand,
            show_hero=True,
            body_html=f"""
            <tr>
              <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
                <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi First Name,</p>
                <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Your proposal status has changed.</h1>
                <p class="havlo-body-copy" style="margin:0 0 14px 0;">Your CustomOffer submission <strong style="color:#111111;">CO-1A2B3C</strong> is now marked as <strong style="color:#111111;">Seller reviewing proposal</strong>.</p>
              </td>
            </tr>
            <tr>
              <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
                <div style="text-align:left;margin-bottom:18px;">{_email_button_html("https://www.heyhavlo.com/custom-offers/status/CO-1A2B3C", "View proposal status")}</div>
                <p class="havlo-body-copy" style="margin:0;">We'll keep you updated as soon as anything changes on the seller side.</p>
              </td>
            </tr>
            """,
        )
    elif key == "product-access-magic-link":
        html = _product_access_magic_link_html(
            "first.last@example.com",
            "Stale Listings",
            "https://www.heyhavlo.com/stale-listings/access?token=preview-token",
            first_name="First Name",
        )
    elif key == "stale-report-ready":
        html = _email_shell_html(
            title="Your StaleListings report is ready",
            preheader="Your StaleListings property assessment report is ready.",
            brand=brand,
            show_hero=True,
            body_html=f"""
            <tr>
              <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
                <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi First Name,</p>
                <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Your report is ready.</h1>
                <p class="havlo-body-copy" style="margin:0 0 14px 0;">Your StaleListings property assessment has been reviewed and your personalised report is now available.</p>
                <p style="margin:0 0 18px 0;font-size:14px;line-height:24px;color:#556274;">Reference: <strong style="color:#111111;">SL-Q44816</strong></p>
              </td>
            </tr>
            <tr>
              <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
                <div style="text-align:left;margin-bottom:18px;">{_email_button_html("https://www.heyhavlo.com/stale-listings/report/SL-Q44816", "View my report")}</div>
                <p class="havlo-body-copy" style="margin:0;">Inside your report you'll find your listing score, key findings, and a prioritised action plan.</p>
              </td>
            </tr>
            """,
        )
    elif key == "stale-agent-notification":
        html = _email_shell_html(
            title="New StaleListings assessment",
            preheader="A new StaleListings assessment needs review.",
            brand=brand,
            show_hero=False,
            body_html=f"""
            <tr>
              <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
                <p style="margin:0 0 10px 0;font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.6px;color:#8C133B;text-transform:uppercase;">Internal alert</p>
                <h1 class="havlo-heading" style="margin:0 0 10px 0;color:#556274;">New assessment needs review</h1>
                <p class="havlo-body-copy" style="margin:0 0 18px 0;">A new StaleListings assessment has been submitted and the AI report has been generated.</p>
              </td>
            </tr>
            <tr>
              <td class="havlo-pad-x" style="padding:0 48px 14px 48px;">{_email_value_table_html({"Client": "Jane Seller", "Email": "jane@example.com", "Reference": "SL-Q44816", "Package": "Professional Review (GBP 299.99)"})}</td>
            </tr>
            <tr>
              <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
                <div style="text-align:left;margin-bottom:18px;">{_email_button_html("https://www.heyhavlo.com/dashboard/stale-listings", "Review in dashboard")}</div>
                <p class="havlo-body-copy" style="margin:0;">Reference: SL-Q44816 - Sent automatically when an AI report is generated.</p>
              </td>
            </tr>
            """,
        )
    else:
        raise KeyError(key)

    return _inline_preview_assets(html, frontend_base_url)


# ────────────────────────────────────────────────────────────────────────────
# Welcome email — matches the Figma design supplied by the product team.
# ────────────────────────────────────────────────────────────────────────────

_WELCOME_HERO_URL = (
    "https://api.builder.io/api/v1/image/assets/TEMP/"
    "64884eb598f4215081379f41efe3ccc7f5caa687?width=1016"
)


def _welcome_html(first_name: str, support_email: str) -> str:
    safe_name = _html_lib.escape(first_name or "there")
    brand = _email_brand()
    brand["support_email"] = support_email or brand["support_email"]
    brand["support_email_escaped"] = _html_lib.escape(brand["support_email"])

    body_html = f"""
    <tr>
      <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
        <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi {safe_name},</p>
        <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Welcome to Havlo, the future of property is here.</h1>
        <p class="havlo-body-copy" style="margin:0 0 12px 0;">
          We're excited to have you join a new kind of property platform — one built to connect opportunity across borders, simplify selling, and unlock global buying power.
        </p>
        <p class="havlo-body-copy" style="margin:0 0 16px 0;">
          At Havlo, we bring together estate agents, homeowners, and international buyers in one seamless place designed for speed, visibility, and trust.
        </p>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid #F4D4F6;background:#FEEFFF;border-radius:10px;">
          <tr>
            <td style="padding:14px 16px 16px 16px;">
              <p style="margin:0 0 10px 0;font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.6px;color:#A0049A;text-transform:uppercase;">Whether you're</p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:24px;color:#111111;"><strong>An estate agent</strong> looking to expand your reach and attract serious, qualified buyers</p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:24px;color:#111111;"><strong>A homeowner</strong> ready to sell your property with maximum exposure</p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:24px;color:#111111;"><strong>A buyer searching</strong> for your next home abroad with confidence and ease</p>
              <p style="margin:0;font-size:14px;line-height:24px;color:#111111;">Havlo is built to make it happen — faster and smarter.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:18px 48px 0 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#070707;border-radius:10px;">
          <tr>
            <td style="padding:16px;">
              <p style="margin:0 0 12px 0;font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.6px;color:#FFFFFF;text-transform:uppercase;">Why Havlo?</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background:#1A1A1A;border-radius:10px;">
                <tr>
                  <td width="38" align="center" style="padding:10px 0 10px 10px;">
                    <div style="width:28px;height:28px;border-radius:999px;background:#B018B2;color:#FFFFFF;font-size:15px;line-height:28px;text-align:center;">&#127760;</div>
                  </td>
                  <td style="padding:12px 14px;font-size:14px;line-height:22px;color:#FFFFFF;">Global property exposure, without the complexity</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background:#1A1A1A;border-radius:10px;">
                <tr>
                  <td width="38" align="center" style="padding:10px 0 10px 10px;">
                    <div style="width:28px;height:28px;border-radius:999px;background:#B018B2;color:#FFFFFF;font-size:15px;line-height:28px;text-align:center;">&#8634;</div>
                  </td>
                  <td style="padding:12px 14px;font-size:14px;line-height:22px;color:#FFFFFF;">A streamlined experience for international transactions</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1A1A1A;border-radius:10px;">
                <tr>
                  <td width="38" align="center" style="padding:10px 0 10px 10px;">
                    <div style="width:28px;height:28px;border-radius:999px;background:#B018B2;color:#FFFFFF;font-size:15px;line-height:28px;text-align:center;">&#9650;</div>
                  </td>
                  <td style="padding:12px 14px;font-size:14px;line-height:22px;color:#FFFFFF;">More visibility for listings, more opportunities for deals</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:22px 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
        <p class="havlo-body-copy" style="margin:0 0 14px 0;">
          We're not just another property platform — we're building a global bridge for real estate. Your journey starts here, and we're excited to be part of it.
        </p>
        <p style="margin:0 0 14px 0;font-size:16px;line-height:26px;color:#111111;font-weight:700;">Welcome to the future of property.</p>
        <p style="margin:0 0 6px 0;font-size:15px;line-height:24px;color:#556274;">Warm regards,</p>
        <p style="margin:0;font-size:15px;line-height:24px;color:#111111;font-weight:700;">The Havlo Team.</p>
      </td>
    </tr>
    """
    return _email_shell_html(
        title="Welcome to Havlo",
        preheader="Welcome to Havlo — the future of property is here.",
        body_html=body_html,
        brand=brand,
        show_hero=True,
    )
    safe_support = _html_lib.escape(support_email or "hello@heyhavlo.com")

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
    support_email = s.SUPPORT_EMAIL or "hello@heyhavlo.com"
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
    snippet_safe = _html_lib.escape((snippet or "").strip()) or "You have a new message in your Havlo inbox."
    brand = _email_brand()
    body_html = f"""
    <tr>
      <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
        <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi {name_safe},</p>
        <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">You have a new message waiting.</h1>
        <p class="havlo-body-copy" style="margin:0 0 16px 0;">
          <strong style="color:#111111;">{sender_safe}</strong> just sent you a new message on Havlo. We've pulled the key preview below so you can pick it up quickly.
        </p>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px 22px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#FFF4FD;border-left:4px solid #8C133B;border-radius:10px;">
          <tr>
            <td style="padding:16px 18px;font-size:15px;line-height:26px;color:#556274;">{snippet_safe}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
        {_email_phone_banner_html(brand, "Open your inbox", "Need help? Call +44 292 1819 1819")}
        <div style="text-align:left;">{_email_button_html(inbox_url, "Open inbox")}</div>
        <p class="havlo-body-copy" style="margin:20px 0 0 0;font-size:13px;line-height:22px;">
          You're receiving this because message notifications are enabled for your Havlo account.
        </p>
      </td>
    </tr>
    """
    return _email_shell_html(
        title="You have a new message",
        preheader="A new Havlo inbox message is waiting for you.",
        body_html=body_html,
        brand=brand,
        show_hero=True,
    )

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

def _admin_notice_html(
    sheet_tab: str,
    summary: str,
    fields: dict[str, str],
    *,
    source_label: str = "",
    property_url: str = "",
) -> str:
    brand = _email_brand()

    # Build the fields table, stripping internal-only keys
    display_fields = {k: v for k, v in fields.items() if k not in ("_property_url", "_source_label")}
    rows = _email_value_table_html(display_fields)

    source_badge = ""
    if source_label:
        safe_src = _html_lib.escape(source_label)
        source_badge = (
            f'<p style="margin:0 0 14px 0;">'
            f'<span style="display:inline-block;background:#f3f0ff;color:#7c3aed;font-size:11px;'
            f'font-weight:800;letter-spacing:0.06em;text-transform:uppercase;padding:4px 12px;'
            f'border-radius:999px;border:1px solid #ddd6fe;">Source: {safe_src}</span>'
            f'</p>'
        )

    property_btn = ""
    if property_url:
        safe_url = _html_lib.escape(property_url)
        property_btn = (
            f'<tr><td class="havlo-pad-x" style="padding:0 48px 18px 48px;">'
            f'{_email_button_html(property_url, "View Property on Havlo →", accent="#b100df", text_color="#FFFFFF")}'
            f'</td></tr>'
        )

    body_html = f"""
    <tr>
      <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
        <p style="margin:0 0 10px 0;font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.6px;color:#8C133B;text-transform:uppercase;">Internal alert</p>
        <h1 class="havlo-heading" style="margin:0 0 10px 0;color:#111111;">New enquiry: {_html_lib.escape(sheet_tab)}</h1>
        {source_badge}
        <p class="havlo-body-copy" style="margin:0 0 18px 0;">{_html_lib.escape(summary)}</p>
      </td>
    </tr>
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px 14px 48px;">{rows}</td>
    </tr>
    {property_btn}
    <tr>
      <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
        <p class="havlo-body-copy" style="margin:0;font-size:13px;line-height:22px;color:#aaa;">
          Sent automatically when a Havlo website form writes a row to your Google Sheet.
        </p>
      </td>
    </tr>
    """
    return _email_shell_html(
        title=f"New enquiry: {sheet_tab}",
        preheader=f"New form submission via {source_label or sheet_tab}.",
        body_html=body_html,
        brand=brand,
        show_hero=False,
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


def _admin_notice_plain(
    sheet_tab: str,
    summary: str,
    fields: dict[str, str],
    *,
    source_label: str = "",
    property_url: str = "",
) -> str:
    body = f"New enquiry: {sheet_tab}\n"
    if source_label:
        body += f"Source: {source_label}\n"
    body += f"{summary}\n\n"
    for k, v in fields.items():
        if k.startswith("_"):
            continue
        body += f"  {k}: {v}\n"
    if property_url:
        body += f"\nView property on Havlo:\n{property_url}\n"
    body += "\nSent automatically when a Havlo website form writes a row to your Google Sheet.\n"
    return body


def send_admin_notification_sync(
    sheet_tab: str,
    summary: str,
    fields: dict[str, str],
    *,
    source_label: str = "",
    property_url: str = "",
) -> bool:
    """Notify the configured admin address that a new row was added to a sheet."""
    s = get_settings()
    to_email = (s.ADMIN_NOTIFY_EMAIL or "").strip()
    if not to_email:
        logger.info("Skipping admin notification (ADMIN_NOTIFY_EMAIL empty).")
        return False
    return _send_sync(
        to_email=to_email,
        subject=f"[Havlo] New enquiry — {source_label or sheet_tab}",
        html_body=_admin_notice_html(sheet_tab, summary, fields, source_label=source_label, property_url=property_url),
        plain_body=_admin_notice_plain(sheet_tab, summary, fields, source_label=source_label, property_url=property_url),
    )


async def send_admin_notification(
    sheet_tab: str,
    summary: str,
    fields: dict[str, str],
    *,
    source_label: str = "",
    property_url: str = "",
) -> bool:
    return await asyncio.to_thread(
        send_admin_notification_sync, sheet_tab, summary, fields,
        source_label=source_label, property_url=property_url,
    )


def send_custom_offer_buyer_confirmation_sync(
    to_email: str,
    first_name: str,
    reference: str,
    status_url: str,
    property_address: str,
) -> bool:
    safe_name = _html_lib.escape(first_name or "there")
    safe_reference = _html_lib.escape(reference)
    safe_property = _html_lib.escape(property_address or "your selected property")
    safe_status_url = _html_lib.escape(status_url)
    brand = _email_brand()
    html_body = _email_shell_html(
        title="CustomOffer submission received",
        preheader="Your CustomOffer proposal has been submitted.",
        brand=brand,
        show_hero=True,
        body_html=f"""
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
            <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi {safe_name},</p>
            <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Your proposal has been submitted.</h1>
            <p class="havlo-body-copy" style="margin:0 0 14px 0;">
              Your CustomOffer proposal for <strong style="color:#111111;">{safe_property}</strong> has been securely delivered for homeowner review.
            </p>
            <p style="margin:0 0 18px 0;font-size:14px;line-height:24px;color:#556274;">Reference: <strong style="color:#111111;">{safe_reference}</strong></p>
          </td>
        </tr>
        <tr>
          <td class="havlo-pad-x" style="padding:0 48px 0 48px;">{_email_phone_banner_html(brand, "Call us here", brand["phone_display"])}</td>
        </tr>
        <tr>
          <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
            <div style="text-align:left;margin-bottom:18px;">{_email_button_html(status_url, "View proposal status")}</div>
            <p class="havlo-body-copy" style="margin:0 0 12px 0;">We'll notify you if the homeowner chooses to engage.</p>
            <p class="havlo-body-copy" style="margin:0;font-size:13px;line-height:22px;">Seller responses are not guaranteed, and submission fees are non-refundable once outreach has started.</p>
          </td>
        </tr>
        """,
    )
    plain_body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Your CustomOffer proposal has been submitted for {property_address or 'your selected property'}.\n"
        f"Reference: {reference}\n\n"
        f"Track status here:\n{status_url}\n"
    )
    return _send_sync(
        to_email=resolved_to_email,
        subject=f"[CustomOffer] Proposal submitted - {reference}",
        html_body=html_body,
        plain_body=plain_body,
    )
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CustomOffer submission received</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background:#000000;padding:24px 32px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">CustomOffer</span>
        <span style="color:#a3a3a3;font-size:13px;margin-left:8px;">by HAVLO</span>
      </td></tr>
      <tr><td style="padding:34px 32px;">
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#111827;">Your proposal has been submitted.</h1>
        <p style="margin:0 0 16px;color:#4b5563;line-height:1.6;">Hi {safe_name}, your CustomOffer proposal for <strong style="color:#111827;">{safe_property}</strong> has been securely delivered for homeowner review.</p>
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Reference: <strong style="color:#111827;">{safe_reference}</strong></p>
        <div style="margin:28px 0;">
          <a href="{safe_status_url}" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:14px;">View proposal status</a>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">We will notify you if the homeowner chooses to engage. Seller responses are not guaranteed, and submission fees are non-refundable once outreach has started.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""
    plain_body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Your CustomOffer proposal has been submitted for {property_address or 'your selected property'}.\n"
        f"Reference: {reference}\n\n"
        f"Track status here:\n{status_url}\n"
    )
    return _send_sync(
        to_email=to_email,
        subject=f"[CustomOffer] Proposal submitted - {reference}",
        html_body=html_body,
        plain_body=plain_body,
    )


async def send_custom_offer_buyer_confirmation(
    to_email: str,
    first_name: str,
    reference: str,
    status_url: str,
    property_address: str,
) -> bool:
    return await asyncio.to_thread(
        send_custom_offer_buyer_confirmation_sync,
        to_email,
        first_name,
        reference,
        status_url,
        property_address,
    )


def send_custom_offer_status_update_sync(
    to_email: str,
    first_name: str,
    reference: str,
    status_label: str,
    status_url: str,
) -> bool:
    safe_name = _html_lib.escape(first_name or "there")
    safe_reference = _html_lib.escape(reference)
    safe_status = _html_lib.escape(status_label)
    safe_status_url = _html_lib.escape(status_url)
    brand = _email_brand()
    html_body = _email_shell_html(
        title="CustomOffer status update",
        preheader="Your CustomOffer status has changed.",
        brand=brand,
        show_hero=True,
        body_html=f"""
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
            <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi {safe_name},</p>
            <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Your proposal status has changed.</h1>
            <p class="havlo-body-copy" style="margin:0 0 12px 0;">
              Your CustomOffer submission <strong style="color:#111111;">{safe_reference}</strong> is now marked as <strong style="color:#111111;">{safe_status}</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
            <div style="text-align:left;margin-bottom:18px;">{_email_button_html(status_url, "View proposal status")}</div>
            <p class="havlo-body-copy" style="margin:0;">We'll keep you updated as soon as anything changes on the seller side.</p>
          </td>
        </tr>
        """,
    )
    plain_body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Your CustomOffer submission {reference} is now marked as {status_label}.\n\n"
        f"Track status here:\n{status_url}\n"
    )
    return _send_sync(
        to_email=to_email,
        subject=f"[CustomOffer] Status update - {reference}",
        html_body=html_body,
        plain_body=plain_body,
    )
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CustomOffer status update</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background:#000000;padding:24px 32px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">CustomOffer</span>
        <span style="color:#a3a3a3;font-size:13px;margin-left:8px;">by HAVLO</span>
      </td></tr>
      <tr><td style="padding:34px 32px;">
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#111827;">Your proposal status has changed.</h1>
        <p style="margin:0 0 16px;color:#4b5563;line-height:1.6;">Hi {safe_name}, your CustomOffer submission <strong style="color:#111827;">{safe_reference}</strong> is now marked as <strong style="color:#111827;">{safe_status}</strong>.</p>
        <div style="margin:28px 0;">
          <a href="{safe_status_url}" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:14px;">View proposal status</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""
    plain_body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Your CustomOffer submission {reference} is now marked as {status_label}.\n\n"
        f"Track status here:\n{status_url}\n"
    )
    return _send_sync(
        to_email=to_email,
        subject=f"[CustomOffer] Status update - {reference}",
        html_body=html_body,
        plain_body=plain_body,
    )


async def send_custom_offer_status_update(
    to_email: str,
    first_name: str,
    reference: str,
    status_label: str,
    status_url: str,
) -> bool:
    return await asyncio.to_thread(
        send_custom_offer_status_update_sync,
        to_email,
        first_name,
        reference,
        status_label,
        status_url,
    )


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
        "preview_templates": preview_template_names(),
        "social_links": {
            "facebook": s.EMAIL_SOCIAL_FACEBOOK_URL,
            "instagram": s.EMAIL_SOCIAL_INSTAGRAM_URL,
            "x": s.EMAIL_SOCIAL_X_URL,
        },
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


def send_product_access_magic_link_sync(
    to_email: str,
    *,
    scope_label: str,
    magic_link: str,
    first_name: str = "",
) -> bool:
    plain_body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Use this secure magic link to access your {scope_label} updates:\n"
        f"{magic_link}\n\n"
        "This link expires in 30 minutes and can only be used once.\n"
    )
    return _send_sync(
        to_email=to_email,
        subject=f"[{scope_label}] Your secure sign-in link",
        html_body=_product_access_magic_link_html(to_email, scope_label, magic_link, first_name=first_name),
        plain_body=plain_body,
    )


async def send_product_access_magic_link(
    to_email: str,
    *,
    scope_label: str,
    magic_link: str,
    first_name: str = "",
) -> bool:
    return await asyncio.to_thread(
        send_product_access_magic_link_sync,
        to_email,
        scope_label=scope_label,
        magic_link=magic_link,
        first_name=first_name,
    )


def send_password_reset_otp_sync(
    to_email: str,
    otp_code: str,
    *,
    first_name: str = "",
) -> bool:
    plain_body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Use this one-time code to reset your Havlo password for {to_email}:\n\n"
        f"{otp_code}\n\n"
        "This code expires in 15 minutes and can only be used once.\n"
    )
    return _send_sync(
        to_email=to_email,
        subject="[Havlo] Your password reset code",
        html_body=_password_reset_otp_html(to_email, otp_code, first_name=first_name),
        plain_body=plain_body,
    )


async def send_password_reset_otp(
    to_email: str,
    otp_code: str,
    *,
    first_name: str = "",
) -> bool:
    return await asyncio.to_thread(
        send_password_reset_otp_sync,
        to_email,
        otp_code,
        first_name=first_name,
    )


def send_stale_listing_report_ready_sync(
    to_email: str,
    first_name: str,
    reference: str,
) -> bool:
    """Send a report-ready notification to the homeowner."""
    report_url = f"https://heyhavlo.com/stale-listings/report/{reference}"
    brand = _email_brand()
    html_body = _email_shell_html(
        title="Your StaleListings report is ready",
        preheader="Your StaleListings property assessment report is ready.",
        brand=brand,
        show_hero=True,
        body_html=f"""
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
            <p class="havlo-subheading" style="margin:0 0 12px 0;">Hi {_html_lib.escape(first_name)},</p>
            <h1 class="havlo-heading" style="margin:0 0 12px 0;color:#556274;">Your report is ready.</h1>
            <p class="havlo-body-copy" style="margin:0 0 14px 0;">
              Your StaleListings property assessment has been reviewed and your personalised report is now available.
            </p>
            <p style="margin:0 0 18px 0;font-size:14px;line-height:24px;color:#556274;">Reference: <strong style="color:#111111;">{_html_lib.escape(reference)}</strong></p>
          </td>
        </tr>
        <tr>
          <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
            <div style="text-align:left;margin-bottom:18px;">{_email_button_html(report_url, "View my report")}</div>
            <p class="havlo-body-copy" style="margin:0 0 10px 0;">Inside your report you'll find your listing score, key findings, and a prioritised action plan.</p>
            <p class="havlo-body-copy" style="margin:0;font-size:13px;line-height:22px;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="{_html_lib.escape(report_url)}" style="color:#3247E5;text-decoration:none;">{_html_lib.escape(report_url)}</a></p>
          </td>
        </tr>
        """,
    )
    plain_body = (
        f"Hi {first_name},\n\n"
        f"Your StaleListings property assessment report is ready.\n\n"
        f"Reference: {reference}\n\n"
        f"View your report here:\n{report_url}\n\n"
        "© 2026 Havlo Ltd. StaleListings by Havlo."
    )
    return _send_sync(
        to_email=to_email,
        subject=f"[StaleListings] Your report is ready — {reference}",
        html_body=html_body,
        plain_body=plain_body,
    )
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
    review_url: str | None = None,
    to_email: str | None = None,
) -> bool:
    """Notify the admin agent that a new AI report is ready for review."""
    s = get_settings()
    resolved_to_email = (to_email or s.ADMIN_NOTIFY_EMAIL or "").strip()
    if not resolved_to_email:
        logger.info("Skipping agent notification (ADMIN_NOTIFY_EMAIL empty).")
        return False

    frontend_url = getattr(s, "FRONTEND_URL", None) or "https://heyhavlo.com"
    admin_url = (review_url or f"{frontend_url.rstrip('/')}/dashboard/stale-listings").strip()

    package_labels = {
        "quick_insight": "Quick Insight (£79.99)",
        "professional_review": "Professional Review (£299.99)",
        "premium_strategy": "Premium Strategy (£1,499.99)",
    }
    package_label = package_labels.get(package, package)
    brand = _email_brand()

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

    html_body = _email_shell_html(
        title="New StaleListings assessment",
        preheader="A new StaleListings assessment needs review.",
        brand=brand,
        show_hero=False,
        body_html=f"""
        <tr>
          <td class="havlo-pad-x" style="padding:24px 48px 0 48px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 10px 0;font-size:12px;line-height:16px;font-weight:800;letter-spacing:0.6px;color:#8C133B;text-transform:uppercase;">Internal alert</p>
            <h1 class="havlo-heading" style="margin:0 0 10px 0;color:#556274;">New assessment needs review</h1>
            <p class="havlo-body-copy" style="margin:0 0 18px 0;">
              A new StaleListings assessment has been submitted and the AI report has been generated. Review it in the dashboard before sending it to the client.
            </p>
          </td>
        </tr>
        <tr>
          <td class="havlo-pad-x" style="padding:0 48px 14px 48px;">{_email_value_table_html(fields)}</td>
        </tr>
        <tr>
          <td class="havlo-pad-x" style="padding:0 48px 34px 48px;font-family:Arial,Helvetica,sans-serif;">
            <div style="text-align:left;margin-bottom:18px;">{_email_button_html(admin_url, "Review in dashboard")}</div>
            <p class="havlo-body-copy" style="margin:0;font-size:13px;line-height:22px;">Reference: {_html_lib.escape(reference)} · Sent automatically when an AI report is generated.</p>
          </td>
        </tr>
        """,
    )
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
        to_email=resolved_to_email,
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
    "send_product_access_magic_link",
    "send_product_access_magic_link_sync",
    "send_password_reset_otp",
    "send_password_reset_otp_sync",
    "send_test_email",
    "diagnostics",
    "is_configured",
]
