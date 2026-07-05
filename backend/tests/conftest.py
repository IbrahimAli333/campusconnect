from collections.abc import Iterator

import pytest

from app.core.login_rate_limit import ip_rate_limiter, login_rate_limiter


@pytest.fixture(autouse=True)
def reset_login_rate_limiter() -> Iterator[None]:
    login_rate_limiter.reset()
    ip_rate_limiter.reset()
    yield
    login_rate_limiter.reset()
    ip_rate_limiter.reset()
