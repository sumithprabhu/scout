/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Mongoose ships optional native deps it never actually loads in our path.
    // Mark it external so Next's server bundler doesn't try to trace/bundle them.
    // (In Next 15 this key is renamed to the top-level `serverExternalPackages`.)
    serverComponentsExternalPackages: ["mongoose"],
  },
};

export default nextConfig;
