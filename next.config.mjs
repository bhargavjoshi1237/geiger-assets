/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  basePath: isProd ? '/assets' : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/assets' : '',
  },
};

export default nextConfig;
