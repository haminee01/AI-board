import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Docker 정적 배포 시 사용. 개발 시에는 주석 처리 권장 */
  // output: "export",
  reactStrictMode: true,
  // Konva가 Node 빌드에서 'canvas'를 require하므로 서버 번들에서 제외
  serverExternalPackages: ["konva", "react-konva", "canvas"],
  webpack: (config, { isServer }) => {
    if (isServer && Array.isArray(config.externals)) {
      config.externals.push("canvas");
    }
    return config;
  },
};

export default nextConfig;
