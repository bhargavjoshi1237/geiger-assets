/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  transpilePackages: ["@geiger/ui"],
  basePath: isProd ? '/assets' : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/assets' : '',
  },
  // Asset media is delivered by our own variant route, not /_next/image. The
  // loader passes every non-asset src through untouched — see the file.
  images: {
    // Only three variants exist server-side, so the default ladder emits a
    // srcSet of eight candidates collapsing onto two URLs -- and lands an
    // ordinary desktop preview pane on poster (1920). Aligning the ladder to
    // the variants keeps a 60vw preview on preview (1024).
    deviceSizes: [256, 1024, 1920],
    loader: 'custom',
    loaderFile: './lib/media/image-loader.js',
  },
};

export default nextConfig;
