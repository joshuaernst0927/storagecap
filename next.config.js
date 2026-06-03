/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pdfjs-dist has an optional canvas dep that breaks client bundle without this
      config.resolve.alias.canvas = false
    }
    return config
  },
}

module.exports = nextConfig
