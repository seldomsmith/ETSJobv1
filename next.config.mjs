/** @type {import('next').NextConfig} */
const nextConfig = {
    optimizeFonts: false, // Disables static font fetching which can fail in secure Codespaces
    transpilePackages: ['mapbox-gl'],
};

export default nextConfig;

