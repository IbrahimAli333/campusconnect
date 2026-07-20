const STORE_BUILD_PROFILES = new Set(["preview", "production"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2"]);

const baseConfig = {
  name: "Unibridge",
  slug: "campusconnect",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "campusconnect",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#F8FAFC",
  },
  ios: {
    bundleIdentifier: "com.unibridge.app",
    buildNumber: "1",
    supportsTablet: true,
    infoPlist: {
      // HTTPS-only networking qualifies for the standard exemption; declaring
      // it here skips the export-compliance prompt on every TestFlight upload.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.unibridge.app",
    versionCode: 1,
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: ["expo-web-browser", "expo-notifications"],
  extra: {
    productName: "Unibridge",
    eas: {
      projectId: "c351705a-ec41-4b43-9a35-bac8a0e80a26",
    },
  },
};

function isPrivateIp(hostname) {
  return (
    /^10\./.test(hostname) ||
    /^127\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  );
}

function assertProductionApiUrl(value, profile) {
  if (!value) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is required for the ${profile} EAS build profile. Use the HTTPS URL of the deployed backend API.`,
    );
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL must be a valid URL. Received: ${value}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_API_URL must use https:// for store-ready builds.");
  }

  if (LOCAL_HOSTS.has(parsed.hostname) || isPrivateIp(parsed.hostname)) {
    throw new Error("EXPO_PUBLIC_API_URL cannot point to localhost, an emulator host, or a private LAN IP for store-ready builds.");
  }
}

module.exports = () => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (process.env.EAS_BUILD === "true" && STORE_BUILD_PROFILES.has(profile)) {
    assertProductionApiUrl(apiUrl, profile);
  }

  return {
    ...baseConfig,
    extra: {
      ...baseConfig.extra,
      apiUrlConfigured: Boolean(apiUrl),
      buildProfile: profile ?? "local",
    },
  };
};
