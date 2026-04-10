import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@fieldwork/core',
    '@fieldwork/scenarios',
    '@fieldwork/rubric',
    '@fieldwork/ui',
  ],
};

export default config;
