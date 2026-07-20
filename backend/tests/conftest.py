from collections.abc import Iterator

import pytest

from app.core.action_rate_limit import ALL_ACTION_LIMITERS
from app.core.login_rate_limit import (
    ip_rate_limiter,
    login_rate_limiter,
    registration_rate_limiter,
)


@pytest.fixture(autouse=True)
def reset_rate_limiters() -> Iterator[None]:
    def _reset_all() -> None:
        login_rate_limiter.reset()
        ip_rate_limiter.reset()
        registration_rate_limiter.reset()
        for limiter in ALL_ACTION_LIMITERS:
            limiter.reset()

    _reset_all()
    yield
    _reset_all()
