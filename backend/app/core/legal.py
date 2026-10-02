"""Versioning for the Terms of Service / Privacy Policy that users accept.

Bump CURRENT_TERMS_VERSION whenever docs/terms.html or
docs/privacy-policy.html changes materially. Every user whose stored
acceptance differs (including users who never accepted) is asked to accept
again on their next app launch.
"""

# Matches the "Version" line printed at the top of docs/terms.html and
# docs/privacy-policy.html.
CURRENT_TERMS_VERSION = "2026-10-02"

# The audience is university students and staff, so accounts are adults-only.
MINIMUM_AGE = 18

PUBLIC_DOCS_BASE_URL = "https://ibrahimali333.github.io/campusconnect"
TERMS_URL = f"{PUBLIC_DOCS_BASE_URL}/terms.html"
PRIVACY_POLICY_URL = f"{PUBLIC_DOCS_BASE_URL}/privacy-policy.html"

CONSENT_REQUIRED_DETAIL = (
    "Accept the Terms of Service and Privacy Policy and confirm you are "
    f"{MINIMUM_AGE} or older to create an account."
)
