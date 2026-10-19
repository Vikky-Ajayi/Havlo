"""Session booking with SumUp payment and Calendly redirect, and the Buy
Abroad consultation deposit through Flutterwave (/bookings/buy-abroad/...)."""
from __future__ import annotations

import hmac
import logging
import math
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import Payment, PaymentStatus, SessionBooking, User
from app.schemas.schemas import (
    BookSessionRequest,
    BuyAbroadCheckoutRequest,
    BuyAbroadCheckoutResponse,
    BuyAbroadVerifyRequest,
    BuyAbroadVerifyResponse,
    BookSessionResponse,
    PaymentStatusResponse,
)
from app.services import currency_rates, flutterwave_service, google_sheets, sumup_service
from app.services.flutterwave_service import FlutterwaveError
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bookings", tags=["Session Bookings"])


# The advisory session popup's fee (after onboarding; paid through SumUp).
# GBP because SumUp only accepts the merchant account's own currency; a
# checkout in any other currency is refused.
SESSION_FEE_AMOUNT = 99.99
SESSION_FEE_CURRENCY = "GBP"

# The Buy Abroad consultation deposit (the basket, paid through
# Flutterwave): US$99.99. Shown as $99.99 in
# havlo_frontend/src/pages/BuyAbroadUkMarketplace.tsx (CONSULTATION_FEE).
BUY_ABROAD_FEE_AMOUNT = 99.99
BUY_ABROAD_FEE_CURRENCY = "USD"
# Flutterwave's "Pay with Bank Transfer" only takes Naira, so a buyer who
# picks Bank Transfer pays the deposit converted to NGN at the day's rate
# (rounded up to the naira). Card payments stay in USD.
BANK_TRANSFER_CURRENCY = "NGN"


async def buy_abroad_charge(payment_method: str | None) -> tuple[float, str, str | None]:
    """(amount, currency, Flutterwave payment_options) for the deposit by
    this payment method. Raises 503 when Naira can't be priced right now."""
    if payment_method == "bank":
        rate = await currency_rates.usd_rate(BANK_TRANSFER_CURRENCY)
        if not rate:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Bank transfer is unavailable for a moment. Please try again shortly, or pay by card.",
            )
        return float(math.ceil(BUY_ABROAD_FEE_AMOUNT * rate)), BANK_TRANSFER_CURRENCY, "banktransfer"
    return BUY_ABROAD_FEE_AMOUNT, BUY_ABROAD_FEE_CURRENCY, "card"


@router.post("/session", response_model=BookSessionResponse, status_code=status.HTTP_201_CREATED)
async def book_session(
    payload: BookSessionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookSessionResponse:
    """
    1. Create a session booking record (pending payment)
    2. Create a SumUp checkout for the session fee
    3. Return the checkout URL — frontend redirects user to pay
    4. After payment, /bookings/session/{booking_id}/status returns Calendly link
    """
    settings = get_settings()
    reference = f"HAVLO-SESSION-{uuid.uuid4().hex[:12].upper()}"

    # Read fee from settings — Railway may inject as string, so cast.
    amount = SESSION_FEE_AMOUNT
    currency = SESSION_FEE_CURRENCY

    redirect_url = None
    if settings.FRONTEND_URL:
        redirect_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}"
            f"/dashboard?payment=success&ref={reference}"
        )

    logger.info(
        "Session checkout requested ref=%s amount=%.2f currency=%s",
        reference, amount, currency,
    )

    # Create SumUp checkout
    try:
        checkout = await sumup_service.create_checkout(
            amount=amount,
            currency=currency,
            description=f"Havlo Advisory Session — {payload.first_name} {payload.last_name}",
            reference=reference,
            redirect_url=redirect_url,
        )
    except SumUpError as exc:
        # The full SumUp response goes to the logs; the customer gets a
        # plain message rather than the raw JSON.
        logger.error("SumUp checkout failed: %s body=%s", exc, exc.body)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't start your payment. Please try again, or contact us if it keeps happening.",
        )
    except Exception as exc:
        logger.exception("Unexpected error creating SumUp checkout: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway unavailable. Please try again.",
        )

    checkout_id = checkout.get("id", "")
    checkout_url = checkout.get("checkout_url", "")

    # Save booking
    booking = SessionBooking(
        user_id=current_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_country_code=payload.phone_country_code,
        phone_number=payload.phone_number,
        email=payload.email,
        preferred_date=payload.preferred_date,
        preferred_time=payload.preferred_time,
        sumup_checkout_id=checkout_id,
        sumup_checkout_url=checkout_url,
        payment_status=PaymentStatus.pending,
        calendly_url=settings.CALENDLY_LINK,
    )
    db.add(booking)

    # Save payment record
    payment = Payment(
        user_id=current_user.id,
        checkout_id=checkout_id,
        amount=amount,
        currency=currency,
        status=PaymentStatus.pending,
        reference_type="session_booking",
        reference_id=str(booking.id) if booking.id else reference,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(booking)

    # Update payment reference_id with actual booking id
    payment.reference_id = str(booking.id)
    await db.commit()

    user_dict = {
        "id": str(current_user.id),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": payload.email,
        "phone_country_code": payload.phone_country_code,
        "phone_number": payload.phone_number,
    }
    booking_dict = {
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": payload.email,
        "phone_country_code": payload.phone_country_code,
        "phone_number": payload.phone_number,
        "preferred_date": payload.preferred_date,
        "preferred_time": payload.preferred_time,
        "checkout_id": checkout_id,
        "payment_status": "pending",
    }
    background_tasks.add_task(google_sheets.record_session_booking, user_dict, booking_dict)

    return BookSessionResponse(
        booking_id=str(booking.id),
        checkout_url=checkout_url,
        checkout_id=checkout_id,
        amount=amount,
        currency=currency,
        message="Session booking created. Complete payment to confirm.",
    )


@router.get("/session/{booking_id}/status", response_model=PaymentStatusResponse)
async def get_session_payment_status(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentStatusResponse:
    """
    Poll payment status for a session booking.
    Returns Calendly link when payment is confirmed.
    """
    try:
        booking_uuid = uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid booking ID.")

    result = await db.execute(
        select(SessionBooking).where(
            SessionBooking.id == booking_uuid,
            SessionBooking.user_id == current_user.id,
        )
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    # If already confirmed, return immediately
    if booking.payment_status == PaymentStatus.completed:
        return PaymentStatusResponse(
            checkout_id=booking.sumup_checkout_id or "",
            status="PAID",
            paid=True,
            redirect_url=booking.calendly_url,
        )

    # Poll SumUp
    if booking.sumup_checkout_id:
        try:
            checkout_data = await sumup_service.get_checkout_status(booking.sumup_checkout_id)
            sumup_status = checkout_data.get("status", "PENDING").upper()
            paid = sumup_status == "PAID"

            if paid and booking.payment_status != PaymentStatus.completed:
                booking.payment_status = PaymentStatus.completed
                # Update the payment record too
                payment_result = await db.execute(
                    select(Payment).where(Payment.checkout_id == booking.sumup_checkout_id)
                )
                payment = payment_result.scalar_one_or_none()
                if payment:
                    payment.status = PaymentStatus.completed
                await db.commit()

            return PaymentStatusResponse(
                checkout_id=booking.sumup_checkout_id,
                status=sumup_status,
                paid=paid,
                redirect_url=booking.calendly_url if paid else None,
            )
        except Exception as exc:
            logger.error("SumUp status poll failed: %s", exc)

    return PaymentStatusResponse(
        checkout_id=booking.sumup_checkout_id or "",
        status="PENDING",
        paid=False,
    )


@router.get("/session/{booking_id}/checkout-page")
async def get_session_checkout_page(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return checkout widget payload for a session booking."""
    try:
        booking_uuid = uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid booking ID.")

    result = await db.execute(
        select(SessionBooking).where(
            SessionBooking.id == booking_uuid,
            SessionBooking.user_id == current_user.id,
        )
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    return {
        "checkout_id": booking.sumup_checkout_id,
        "amount": SESSION_FEE_AMOUNT,
        "currency": SESSION_FEE_CURRENCY,
        "description": f"Havlo Advisory Session - {current_user.first_name} {current_user.last_name}",
    }


# ── Buy Abroad consultation deposit (Flutterwave) ─────────────────────────
# The basket (/buyabroad/basket) sends the buyer to Flutterwave's hosted
# checkout; Flutterwave sends them back to /buyabroad/consultation, which
# calls /bookings/buy-abroad/verify before showing the "your advisor is
# ready" popup. The webhook marks the booking paid too, in case the buyer
# never makes it back to the site.

FLUTTERWAVE_PROVIDER = "flutterwave"


async def _buy_abroad_booking(db: AsyncSession, tx_ref: str) -> SessionBooking | None:
    return (await db.execute(
        select(SessionBooking).where(
            SessionBooking.payment_provider == FLUTTERWAVE_PROVIDER,
            SessionBooking.provider_reference == tx_ref,
        )
    )).scalar_one_or_none()


async def _confirm_buy_abroad_payment(db: AsyncSession, tx_ref: str) -> tuple[SessionBooking | None, bool, str]:
    """Ask Flutterwave about this reference and mark the booking paid if the
    payment went through. Returns (booking, paid, Flutterwave's status)."""
    booking = await _buy_abroad_booking(db, tx_ref)
    if booking is None:
        return None, False, "not_found"
    if booking.payment_status == PaymentStatus.completed:
        return booking, True, "successful"
    payment = (await db.execute(select(Payment).where(Payment.checkout_id == tx_ref))).scalar_one_or_none()
    transaction = await flutterwave_service.verify_by_reference(tx_ref)
    flw_status = str((transaction or {}).get("status") or "pending").lower()
    # Checked against what this booking was charged: US$ by card, or the
    # Naira amount quoted for a bank transfer.
    paid = flutterwave_service.payment_confirmed(
        transaction,
        tx_ref=tx_ref,
        amount=payment.amount if payment else BUY_ABROAD_FEE_AMOUNT,
        currency=payment.currency if payment else BUY_ABROAD_FEE_CURRENCY,
    )
    if paid:
        booking.payment_status = PaymentStatus.completed
        if payment:
            payment.status = PaymentStatus.completed
        await db.commit()
        logger.info("Buy Abroad deposit paid tx_ref=%s booking=%s", tx_ref, booking.id)
    return booking, paid, flw_status


@router.post("/buy-abroad/checkout", response_model=BuyAbroadCheckoutResponse, status_code=status.HTTP_201_CREATED)
async def create_buy_abroad_checkout(
    payload: BuyAbroadCheckoutRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BuyAbroadCheckoutResponse:
    """A booking for the consultation deposit and its Flutterwave payment
    link; the frontend sends the buyer there."""
    settings = get_settings()
    if not flutterwave_service.is_configured():
        logger.error("Buy Abroad checkout requested but FLUTTERWAVE_SECRET_KEY is not set.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payments are unavailable right now. Please try again shortly or contact us.",
        )
    tx_ref = f"HAVLO-BA-{uuid.uuid4().hex[:16].upper()}"
    frontend = (settings.FRONTEND_URL or "https://www.heyhavlo.com").rstrip("/")
    phone = f"{payload.phone_country_code}{payload.phone_number}".strip() if payload.phone_number else ""
    full_name = f"{payload.first_name} {payload.last_name}".strip()
    amount, currency, payment_options = await buy_abroad_charge(payload.payment_method)
    try:
        checkout_url = await flutterwave_service.create_payment(
            tx_ref=tx_ref,
            amount=amount,
            currency=currency,
            redirect_url=f"{frontend}/buyabroad/consultation",
            customer={"email": str(payload.email), "name": full_name, **({"phonenumber": phone} if phone else {})},
            title="Havlo Buy Abroad",
            description="Consultation deposit (refundable)",
            payment_options=payment_options,
        )
    except FlutterwaveError as exc:
        logger.error("Flutterwave checkout failed: %s body=%s", exc, exc.body)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't start your payment. Please try again, or contact us if it keeps happening.",
        )

    booking = SessionBooking(
        user_id=current_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name or "-",
        phone_country_code=payload.phone_country_code or "+44",
        phone_number=payload.phone_number or "-",
        email=str(payload.email),
        preferred_date="",
        preferred_time="",
        payment_provider=FLUTTERWAVE_PROVIDER,
        provider_reference=tx_ref,
        payment_status=PaymentStatus.pending,
        calendly_url=settings.CALENDLY_LINK,
    )
    db.add(booking)
    await db.flush()
    db.add(Payment(
        user_id=current_user.id,
        checkout_id=tx_ref,
        amount=amount,
        currency=currency,
        status=PaymentStatus.pending,
        reference_type="buy_abroad_consultation",
        reference_id=str(booking.id),
    ))
    await db.commit()

    background_tasks.add_task(
        google_sheets.record_session_booking,
        {
            "id": str(current_user.id), "first_name": payload.first_name, "last_name": payload.last_name,
            "email": str(payload.email), "phone_country_code": payload.phone_country_code,
            "phone_number": payload.phone_number,
        },
        {
            "first_name": payload.first_name, "last_name": payload.last_name, "email": str(payload.email),
            "phone_country_code": payload.phone_country_code, "phone_number": payload.phone_number,
            "preferred_date": "", "preferred_time": "", "checkout_id": tx_ref, "payment_status": "pending",
        },
    )
    return BuyAbroadCheckoutResponse(
        booking_id=str(booking.id),
        checkout_url=checkout_url,
        tx_ref=tx_ref,
        amount=amount,
        currency=currency,
    )


@router.post("/buy-abroad/verify", response_model=BuyAbroadVerifyResponse)
async def verify_buy_abroad_payment(
    payload: BuyAbroadVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> BuyAbroadVerifyResponse:
    """Back from Flutterwave: has this deposit been paid? Checked with
    Flutterwave, never from the redirect's own ?status=."""
    try:
        booking, paid, flw_status = await _confirm_buy_abroad_payment(db, payload.tx_ref.strip())
    except FlutterwaveError as exc:
        logger.error("Flutterwave verify failed for %s: %s body=%s", payload.tx_ref, exc, exc.body)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't confirm your payment just now. Please refresh this page in a moment.",
        )
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")
    return BuyAbroadVerifyResponse(
        paid=paid, status=flw_status, calendly_url=booking.calendly_url if paid else None
    )


@router.post("/flutterwave/webhook")
async def flutterwave_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Flutterwave's payment notifications (set this URL and the secret hash
    in the Flutterwave dashboard). Only signals a check: the payment is
    confirmed with Flutterwave's API before anything is marked paid."""
    expected = (get_settings().FLUTTERWAVE_WEBHOOK_HASH or "").strip()
    received = (request.headers.get("verif-hash") or "").strip()
    if not expected or not hmac.compare_digest(expected, received):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature.")
    try:
        body = await request.json()
    except ValueError:
        return {"ok": True}
    data = body.get("data") if isinstance(body, dict) else None
    tx_ref = str((data or {}).get("tx_ref") or (body or {}).get("txRef") or "").strip()
    if not tx_ref.startswith("HAVLO-BA-"):
        return {"ok": True}
    try:
        await _confirm_buy_abroad_payment(db, tx_ref)
    except FlutterwaveError as exc:
        logger.error("Flutterwave webhook verify failed for %s: %s", tx_ref, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Verification failed; retry.")
    return {"ok": True}
