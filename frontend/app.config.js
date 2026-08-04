/**
 * Dynamic Expo config — reads the app display name from a single constant.
 *
 * Infrastructure identifiers (slug, bundleIdentifier, scheme) are intentionally
 * hardcoded — changing them would break OTA updates, deep links, and app store
 * listings.
 *
 * To rebrand: change APP_NAME here AND in src/config/app.ts (the runtime source).
 */

const APP_NAME = "JobSyte";

module.exports = {
  expo: {
    name: APP_NAME,
    slug: "sitekeeper",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.sitekeeper.app",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.sitekeeper.app",
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      name: APP_NAME,
      shortName: APP_NAME,
      themeColor: "#ffffff",
      backgroundColor: "#ffffff",
    },
    plugins: [
      "@react-native-community/datetimepicker",
      [
        "expo-image-picker",
        {
          photosPermission: `${APP_NAME} needs access to your photos to upload job media.`,
          cameraPermission: `${APP_NAME} needs access to your camera to take photos for jobs.`,
        },
      ],
    ],
    scheme: "sitekeeper",
  },
};
