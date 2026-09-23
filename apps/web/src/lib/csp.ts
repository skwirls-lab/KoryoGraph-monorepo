/**
 * Content-Security-Policy for every page (set per request in the proxy with a fresh nonce; Next adds the
 * nonce to its own scripts). Only the public trial form (/s/…, embedded by the widget) may be framed.
 */
export function contentSecurityPolicy(nonce: string, path: string, env: { supabaseUrl: string; dev: boolean }): string {
  const supa = env.supabaseUrl.replace(/\/$/, "");
  const supaWs = supa.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${env.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supa}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supa} ${supaWs} https://api.stripe.com${env.dev ? " ws: wss:" : ""}`,
    `media-src 'self' blob: ${supa}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${path.startsWith("/s/") ? "*" : "'self'"}`,
  ].join("; ");
}
