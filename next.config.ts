import type { NextConfig } from "next";

function getR2RemotePatterns() {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!endpoint || !bucketName) {
    return [];
  }

  try {
    const endpointUrl = new URL(endpoint);
    const basePath = endpointUrl.pathname.replace(/\/$/, "");
    const pathname = `${basePath}/${bucketName}/**`;
    const remotePattern = {
      protocol: endpointUrl.protocol.replace(":", "") as "http" | "https",
      hostname: endpointUrl.hostname,
      port: endpointUrl.port,
      pathname,
    };

    return [remotePattern];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' blob:",
              "img-src 'self' blob: data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: getR2RemotePatterns(),
  },
};

export default nextConfig;
