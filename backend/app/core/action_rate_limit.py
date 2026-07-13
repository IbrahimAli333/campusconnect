from __future__ import annotations

from fastapi import HTTPException, status

from app.core.login_rate_limit import LoginRateLimiter

# Per-user throttles on the spammable write endpoints. Every attempt counts
# (recorded up front, success or not), so validation errors cannot be used to
# probe without spending budget. Same single-instance caveat as the login
# limiters: state is in-memory and resets on deploy.
message_rate_limiter = LoginRateLimiter(max_attempts=20, window_seconds=60)
opportunity_rate_limiter = LoginRateLimiter(max_attempts=10, window_seconds=3600)
application_rate_limiter = LoginRateLimiter(max_attempts=20, window_seconds=3600)
report_rate_limiter = LoginRateLimiter(max_attempts=10, window_seconds=3600)
connection_rate_limiter = LoginRateLimiter(max_attempts=30, window_seconds=3600)

ALL_ACTION_LIMITERS = [
    message_rate_limiter,
    opportunity_rate_limiter,
    application_rate_limiter,
    report_rate_limiter,
    connection_rate_limiter,
]


def enforce_action_limit(limiter: LoginRateLimiter, user_id: int) -> None:
    """Raise 429 when the user exhausted their window, else record the attempt."""
    key = str(user_id)
    if limiter.is_blocked(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again later.",
            headers={"Retry-After": str(limiter.window_seconds)},
        )
    limiter.record_failure(key)
