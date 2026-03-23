import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias['@beastleague/shared'] = path.resolve(__dirname, '../shared/src/index.ts');
    return config;
  },
};

export default nextConfig;
