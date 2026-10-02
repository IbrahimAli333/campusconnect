// Public legal pages (GitHub Pages, served from docs/). The terms version the
// user must accept comes from the backend on the signed-in user, so bumping it
// server-side never needs an app update.
export const LEGAL_DOCS_BASE_URL = "https://ibrahimali333.github.io/campusconnect";
export const TERMS_URL = `${LEGAL_DOCS_BASE_URL}/terms.html`;
export const PRIVACY_POLICY_URL = `${LEGAL_DOCS_BASE_URL}/privacy-policy.html`;
export const CHILD_SAFETY_URL = `${LEGAL_DOCS_BASE_URL}/child-safety.html`;
export const DELETE_ACCOUNT_URL = `${LEGAL_DOCS_BASE_URL}/delete-account.html`;
export const OPEN_SOURCE_LICENSES_URL = `${LEGAL_DOCS_BASE_URL}/open-source-licenses.html`;

// University students and staff only; mirrors MINIMUM_AGE in
// backend/app/core/legal.py.
export const MINIMUM_AGE = 18;

export interface SignupConsent {
  accept_terms: boolean;
  confirm_age: boolean;
}
