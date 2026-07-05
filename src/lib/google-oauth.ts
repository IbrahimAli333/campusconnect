// University SSO stays hidden until an OAuth client ID is provisioned for the
// build. Direct member access on process.env is required for Expo to inline
// the value at bundle time (no optional chaining).
export const GOOGLE_OAUTH_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
