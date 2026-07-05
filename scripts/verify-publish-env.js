#!/usr/bin/env node

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2"]);

function isPrivateIp(hostname) {
  return (
    /^10\./.test(hostname) ||
    /^127\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  );
}

function fail(message) {
  console.error(`Publish check failed: ${message}`);
  process.exit(1);
}

// Demo login presets must never reach store builds. The flag is fail-open in
// LoginScreen (any value except "0" keeps presets), so require eas.json to
// pin it off for the production profile instead of trusting the local env.
const easConfig = require("../eas.json");
const productionDemoLogins = easConfig?.build?.production?.env?.EXPO_PUBLIC_ENABLE_DEMO_LOGINS;

if (productionDemoLogins !== "0") {
  fail(
    'eas.json must set build.production.env.EXPO_PUBLIC_ENABLE_DEMO_LOGINS to "0" so store builds do not ship demo login presets.',
  );
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!apiUrl) {
  fail("EXPO_PUBLIC_API_URL is required. Set it to the deployed HTTPS backend URL.");
}

let parsed;
try {
  parsed = new URL(apiUrl);
} catch {
  fail(`EXPO_PUBLIC_API_URL must be a valid URL. Received: ${apiUrl}`);
}

if (parsed.protocol !== "https:") {
  fail("EXPO_PUBLIC_API_URL must use https:// for publishable builds.");
}

if (LOCAL_HOSTS.has(parsed.hostname) || isPrivateIp(parsed.hostname)) {
  fail("EXPO_PUBLIC_API_URL cannot point to localhost, an emulator host, or a private LAN IP.");
}

console.log(`Publish check passed: ${parsed.origin}`);
