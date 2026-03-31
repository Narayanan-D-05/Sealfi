/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack, isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    
    // Silence WalletConnect & MetaMask warnings for optional peer dependencies
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(pino-pretty|@react-native-async-storage\/async-storage|react-native)$/,
      })
    );
    
    return config;
  },
};

module.exports = nextConfig;
