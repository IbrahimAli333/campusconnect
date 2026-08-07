"""AI opportunity assistant backed by the Claude API.

Given a natural-language request ("I want a research project about
electricity"), the assistant reads the app's own open posts and returns the
ids of the best matches plus a short reply written in the user's language.
It never searches the web — only content posted on Unibridge.
"""
from __future__ import annotations

import json
import logging

import anthropic

from app.core.config import get_settings

logger = logging.getLogger(__name__)

ASSISTANT_MODEL = "claude-opus-5"

# Matching is a routine ranking task over a small corpus; low effort keeps
# latency and cost down without hurting quality on this shape of problem.
ASSISTANT_EFFORT = "low"
MAX_OUTPUT_TOKENS = 8000
REQUEST_TIMEOUT_SECONDS = 60.0

SYSTEM_PROMPT = (
    "You are the in-app assistant for Unibridge, a campus network where "
    "students, teachers, mentors, and employers post opportunities (startup, "
    "research, internship, job, and project posts). The user describes what "
    "they are looking for; you pick the best matching posts FROM THE PROVIDED "
    "LIST ONLY. Never invent posts and never reference anything outside the "
    "list. Reply in the same language the user wrote in (Azerbaijani, "
    "English, or Russian). Keep the reply to two or three sentences: say what "
    "you found and why it fits. If nothing fits, say so plainly and suggest "
    "what the user could search for instead. List the matching post ids in "
    "match_ids, best match first, at most five."
)

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "match_ids": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["reply", "match_ids"],
    "additionalProperties": False,
}


class AssistantError(Exception):
    """The assistant could not produce an answer."""


def assistant_enabled() -> bool:
    return bool(get_settings().anthropic_api_key)


def _post_line(post: dict) -> str:
    skills = ", ".join(post.get("required_skills") or []) or "none listed"
    return (
        f"id={post['id']} | type={post['type']} | title={post['title']} | "
        f"posted by {post['owner']} | skills: {skills}\n"
        f"  {post['description']}"
    )


def find_matching_posts(query: str, posts: list[dict]) -> dict:
    """Return {"reply": str, "match_ids": [int]} for the user's query.

    ``posts`` entries carry id/type/title/description/required_skills/owner.
    Raises AssistantError on any API failure so the route can map it to 502.
    """
    settings = get_settings()
    client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=1,
    )

    corpus = "\n".join(_post_line(post) for post in posts) or "(no open posts)"
    user_message = (
        f"Open posts on Unibridge right now:\n{corpus}\n\n"
        f"User request: {query}"
    )

    try:
        response = client.beta.messages.create(
            model=ASSISTANT_MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            # Safety classifiers on this model can decline benign requests;
            # the server-side fallback reruns those on another Claude model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            output_config={
                "effort": ASSISTANT_EFFORT,
                "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
            },
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as error:
        logger.warning("Assistant request failed: %s", error)
        raise AssistantError("The assistant is temporarily unavailable.") from error

    if response.stop_reason == "refusal":
        raise AssistantError("The assistant could not answer this request.")

    text = "".join(
        block.text for block in response.content if block.type == "text"
    )
    try:
        parsed = json.loads(text)
        reply = str(parsed["reply"])
        match_ids = [int(post_id) for post_id in parsed["match_ids"]]
    except (ValueError, KeyError, TypeError) as error:
        logger.warning("Assistant returned unparseable output: %r", text[:200])
        raise AssistantError("The assistant returned an invalid answer.") from error

    return {"reply": reply, "match_ids": match_ids}
