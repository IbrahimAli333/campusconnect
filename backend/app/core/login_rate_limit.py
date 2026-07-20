from __future__ import annotations

import threading
import time
from collections import deque


class LoginRateLimiter:
    """In-memory fixed-window limiter for failed login attempts.

    Suitable for a single-instance deployment; move to a shared store
    (e.g. Redis) if the API ever runs on more than one instance.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 900) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, attempts: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while attempts and attempts[0] < cutoff:
            attempts.popleft()

    def is_blocked(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            attempts = self._failures.get(key)
            if attempts is None:
                return False
            self._prune(attempts, now)
            if not attempts:
                del self._failures[key]
                return False
            return len(attempts) >= self.max_attempts

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            attempts = self._failures.setdefault(key, deque())
            self._prune(attempts, now)
            attempts.append(now)

    def record_success(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._failures.clear()


# Targeted brute force: 5 failures per (client IP, email) in 15 minutes.
# Keying on the IP as well means an attacker spamming a victim's email cannot
# lock the real user out from their own address.
login_rate_limiter = LoginRateLimiter()

# Password spraying: one address rotating through many emails. The threshold
# is deliberately generous because campus NAT can put a whole building behind
# one IP; the per-(IP, email) limiter above stays the tight one.
ip_rate_limiter = LoginRateLimiter(max_attempts=50, window_seconds=900)

# Bulk account creation: every registration attempt from an address counts,
# successful or not, so one host cannot flood the user table while a shared
# campus IP still has room for a handful of real signups.
registration_rate_limiter = LoginRateLimiter(max_attempts=10, window_seconds=3600)
