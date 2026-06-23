import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: [
    '192.168.1.3',
    '192.168.1.3:3001',
    'http://192.168.1.3:3001',
  ],
};

export default nextConfig;
