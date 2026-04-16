"""Session booking with SumUp payment and Calendly redirect."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import Payment, PaymentStatus, SessionBooking, User
from app.schemas.schemas import (
    BookSessionRequest,
    BookSessionResponse,
    PaymentStatusResponse,
)
from app.services import google_sheets, sumup_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bookings", tags=["Session Bookings"])


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

    # Create SumUp checkout
    try:
        checkout = await sumup_service.create_checkout(
            amount=settings.SESSION_FEE_AMOUNT,
            currency=settings.SESSION_FEE_CURRENCY,
            description=f"Havlo Advisory Session — {payload.first_name} {payload.last_name}",
            reference=reference,
            redirect_url=f"{settings.FRONTEND_URL}/dashboard?payment=session&ref={reference}",
        )
    except Exception as exc:
        logger.error("SumUp checkout failed: %s", exc)
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
        amount=settings.SESSION_FEE_AMOUNT,
        currency=settings.SESSION_FEE_CURRENCY,
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
        amount=settings.SESSION_FEE_AMOUNT,
        currency=settings.SESSION_FEE_CURRENCY,
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
