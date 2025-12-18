import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // whatsapp-web.js 需要在服務器端運行，不能被 bundled
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer', 'qrcode'],

  webpack: (config, { isServer }) => {
    if (isServer) {
      // 將這些包標記為外部依賴
      config.externals = config.externals || [];
      config.externals.push({
        'whatsapp-web.js': 'commonjs whatsapp-web.js',
        'puppeteer': 'commonjs puppeteer',
      });
    }
    return config;
  },
};

export default nextConfig;
