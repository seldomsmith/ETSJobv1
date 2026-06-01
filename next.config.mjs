/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    optimizeFonts: false, // Disables static font fetching which can fail in secure Codespaces
    transpilePackages: ['mapbox-gl'],
};

export default nextConfig;

