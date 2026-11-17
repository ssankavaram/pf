/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Media falls back to the original hosts until `npm run fetch-assets` has copied it locally.
    remotePatterns: [
      { protocol: "https", hostname: "framerusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};
export default nextConfig;
