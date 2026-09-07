// Sentry's Metro wrapper emits the source maps that turn minified production
// stack traces back into real file/line numbers. It is a no-op without a DSN.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
