"""Plain-text moderation alert emails over SMTP.

Inert unless UNIVERSITY_PORTAL_MODERATION_ALERT_EMAIL and the SMTP settings
are configured (e.g. Gmail with an app password). Sending runs as a
background task and every failure is logged, never raised, so an email
problem cannot fail the report that triggered it.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from fastapi import BackgroundTasks

from app.core.config import get_settings

logger = logging.getLogger("app.email_alerts")
SMTP_TIMEOUT_SECONDS = 15


def email_alerts_enabled() -> bool:
    settings = get_settings()
    return bool(settings.moderation_alert_email and settings.smtp_host and settings.smtp_from)


def _send(subject: str, body: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = settings.moderation_alert_email
    message.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
            smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except Exception:
        logger.exception("Failed to send moderation alert email")


def queue_moderation_email(background_tasks: BackgroundTasks, subject: str, body: str) -> None:
    if email_alerts_enabled():
        background_tasks.add_task(_send, subject, body)
