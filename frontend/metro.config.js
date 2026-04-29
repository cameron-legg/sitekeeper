// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Zustand v5's ESM build uses `import.meta` which Metro doesn't support.
// Force Metro to resolve the CJS build by preferring the `react-native`
// and `default` export conditions over `import` (ESM).
config.resolver.unstable_conditionNames = [
  "react-native",
  "browser",
  "require",
];

module.exports = config;
