// DOCKET security headers — served in production by the host (Vercel/netlify/etc.)
// via their headers config. This file is the single source of truth for the CSP
// so the deploy configs can import/duplicate it. Values are conservative: the app
// only connects to the wallet's own RPC (user-authorized), Google Fonts, and the
// explorer links open in new tabs (no connect needed).
//
// NOTE: wallet injection (window.ethereum) requires 'unsafe-eval'? No — it does
// not; it requires no CSP relaxation. connect-src stays tight.

export const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  // RPC failover list mirrors frontend/src/lib/chain.js — the wallet's own RPC
  // (user-authorized via wallet_addEthereumChain) is also connectable.
  "connect-src 'self' https://sepolia.base.org https://base-sepolia-rpc.publicnode.com https://base-sepolia.drpc.org https://sepolia.basescan.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const securityHeaders = {
  'Content-Security-Policy': csp,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};
