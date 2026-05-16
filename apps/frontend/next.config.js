/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid corrupted dev chunks under heavy FS sync (e.g. iCloud) or partial `.next` deletes.
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
