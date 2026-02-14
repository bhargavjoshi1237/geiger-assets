/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  basePath: isProd ? '/assets' : '',
  assetPrefix: isProd ? '/assets/' : '',
}

module.exports = nextConfig
