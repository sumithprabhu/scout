/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Mongoose ships optional native deps it never actually loads in our path.
    // Mark it external so Next's server bundler doesn't try to trace/bundle them.
    // (In Next 15 this key is renamed to the top-level `serverExternalPackages`.)
    serverComponentsExternalPackages: ["mongoose"],
  },
  env: {
    // True ONLY for an actual Vercel *production* deploy (VERCEL_ENV is set by
    // Vercel's build environment and is absent locally — including a local
    // `next build`, so `npm run dev`/`next start` never trip this). Baked into
    // the client bundle at build time via Next's `env` map, so both middleware
    // (server) and the landing page (client) read the exact same value with no
    // Vercel dashboard configuration required. Used to temporarily lock the app
    // behind the landing page for the first few days after launch.
    NEXT_PUBLIC_BETA_GATE: process.env.VERCEL_ENV === "production" ? "1" : "0",
  },
};

export default nextConfig;
