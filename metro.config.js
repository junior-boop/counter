const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads its wa-sqlite engine as a .wasm module.
config.resolver.assetExts.push("wasm");

module.exports = config;
