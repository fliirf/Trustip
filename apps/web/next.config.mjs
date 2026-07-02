/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@trustip/config",
    "@trustip/database",
    "@trustip/stellar",
    "@trustip/validators",
    "@trustip/ui"
  ]
};

export default nextConfig;
