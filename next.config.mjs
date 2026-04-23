const isProduction = process.env.NODE_ENV === "production";
const extraFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS?.trim();
const frameAncestors = extraFrameAncestors ? `'self' ${extraFrameAncestors}` : "'self'";

function buildContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' blob:${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src 'self' https: blob: data:${isProduction ? "" : " ws: wss:"}`,
    "media-src 'self' data: blob: https:",
    "worker-src 'self' blob:",
    "frame-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  ...(!extraFrameAncestors
    ? [
        {
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        },
      ]
    : []),
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.VERCEL ? undefined : "standalone",
  transpilePackages: ["mathml2omml", "pptxgenjs"],
  serverExternalPackages: [],
  experimental: {
    proxyClientMaxBodySize: "200mb"
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
