"""Fire-and-forget push delivery through the Expo Push API.

Delivery runs as a FastAPI background task after the triggering response is
sent, and every failure is logged instead of raised, so a push problem can
never fail the request that produced it.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from fastapi import BackgroundTasks
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.push_token import PushToken


logger = logging.getLogger("app.push")

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_TIMEOUT_SECONDS = 10.0


def _post_expo_push(messages: list[dict[str, Any]]) -> dict[str, Any]:
    response = httpx.post(
        EXPO_PUSH_API_URL,
        json=messages,
        timeout=EXPO_PUSH_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def _prune_dead_tokens(tokens: list[str]) -> None:
    """Delete tokens Expo reported as DeviceNotRegistered.

    Runs in the delivery background task, after the request session has
    closed, so it opens its own short-lived session.
    """
    if not tokens:
        return

    try:
        with SessionLocal() as db:
            db.execute(delete(PushToken).where(PushToken.token.in_(tokens)))
            db.commit()
        logger.info("Pruned %d unregistered push token(s)", len(tokens))
    except Exception:
        logger.exception("Failed to prune %d dead push token(s)", len(tokens))


def _deliver_expo_pushes(messages: list[dict[str, Any]]) -> None:
    try:
        result = _post_expo_push(messages)
    except Exception:
        logger.exception(
            "Failed to deliver %d push notification(s) via the Expo Push API",
            len(messages),
        )
        return

    tickets = result.get("data", []) if isinstance(result, dict) else []
    dead_tokens: list[str] = []
    for message, ticket in zip(messages, tickets):
        if isinstance(ticket, dict) and ticket.get("status") == "error":
            error_code = (ticket.get("details") or {}).get("error")
            logger.error(
                "Expo push to %s failed: %s (%s)",
                message.get("to"),
                ticket.get("message"),
                error_code,
            )
            token = message.get("to")
            if error_code == "DeviceNotRegistered" and isinstance(token, str):
                dead_tokens.append(token)

    _prune_dead_tokens(dead_tokens)


def queue_push_to_users(
    db: Session,
    background_tasks: BackgroundTasks,
    user_ids: list[int],
    title: str,
    body: str,
    data: Optional[dict[str, Any]] = None,
) -> None:
    """Queue a push to every registered device of the given users.

    Tokens are read before the request finishes (the session closes with it);
    actual delivery happens in the background.
    """
    if not user_ids:
        return

    tokens = db.scalars(
        select(PushToken.token).where(PushToken.user_id.in_(user_ids))
    ).all()
    if not tokens:
        return

    messages: list[dict[str, Any]] = [
        {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            **({"data": data} if data else {}),
        }
        for token in tokens
    ]
    background_tasks.add_task(_deliver_expo_pushes, messages)
