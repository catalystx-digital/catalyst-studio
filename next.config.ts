import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";

const nextConfig: NextConfig = {
  // Externalize Prisma packages so they're not bundled into workflow steps.
  // The workflow SDK reads this to avoid bundling these packages into step code.
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    // Include the custom output path we use for Prisma client
    "@/lib/generated/prisma",
    "@/lib/prisma",
  ],
  eslint: {
    // Allow production builds to successfully complete even if
    // there are ESLint errors in the project.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TODO: Fix AI SDK type issues and remove this
    // Temporarily ignore TypeScript errors due to AI SDK version mismatch
    ignoreBuildErrors: true,
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.intelligencebank.com", pathname: "/**" },
      { protocol: "https", hostname: "bathurstcitycentre.qicre.com", pathname: "/**" },
      { protocol: "https", hostname: "www.qicre.com", pathname: "/**" },
      { protocol: "https", hostname: "qicre.com", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      { protocol: "https", hostname: "assets.mixkit.co", pathname: "/**" },
      { protocol: "https", hostname: "**.kc-usercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "www.toptal.com", pathname: "/**" },
      { protocol: "https", hostname: "www.google.com", pathname: "/**" },
      { protocol: "https", hostname: "www.facebook.com", pathname: "/**" },
      { protocol: "https", hostname: "linkedin.com", pathname: "/**" },
      { protocol: "https", hostname: "github.com", pathname: "/**" },
      { protocol: "https", hostname: "twitter.com", pathname: "/**" },
    ],
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      // Prevent jsdom from pulling `.next/browser/default-stylesheet.css`
      // during SSR (see `_output.txt` 2025-10-27 Bathurst import run).
      "isomorphic-dompurify": path.resolve(__dirname, "lib/studio/utils/safe-dompurify.ts"),
    };

    return config;
  },
};

const requireModule = createRequire(import.meta.url);
const config = process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN === "true"
  ? nextConfig
  : (requireModule("workflow/next") as typeof import("workflow/next")).withWorkflow(nextConfig);

export default config;
