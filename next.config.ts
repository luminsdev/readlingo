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
  images: {
    remotePatterns: getR2RemotePatterns(),
  },
};

export default nextConfig;
