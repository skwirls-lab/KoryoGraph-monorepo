import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieToSet } from "@koryo/db/server";
import { contentSecurityPolicy } from "@/lib/csp";
import { isProtectedPath, isSharedPath, surfaceForHost } from "@/lib/surfaces";

/**
 * Next 16 proxy (formerly middleware), §3.3:
 *  1. host → surface rewrite (desk./app./home. subdomains; path prefixes work directly in dev),
 *  2. request id on every request,
 *  3. Supabase session refresh (cookies rewritten on both the forwarded request and the response),
 *  4. unauthenticated /desk|/mat|/home → /login?next=…
 *  5. Content-Security-Policy with a per-request nonce (lib/csp.ts).
 * Authorisation per surface (desk.access …) is enforced in each surface layout (403 page).
 */
export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const url = request.nextUrl;
  const surface = surfaceForHost(request.headers.get("host") ?? "", process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "");
  const prefix = surface ? `/${surface}` : null;

  let targetPath = url.pathname;
  if (prefix && !isSharedPath(url.pathname) && !url.pathname.startsWith(prefix)) {
    targetPath = url.pathname === "/" ? prefix : `${prefix}${url.pathname}`;
  }
  const rewrite = targetPath !== url.pathname;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, url.pathname, { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", dev: process.env.NODE_ENV !== "production" });

  const build = (): NextResponse => {
    const forwarded = new Headers(request.headers);
    forwarded.set("x-request-id", requestId);
    forwarded.set("x-kg-path", targetPath);
    // Next reads the nonce from the request's CSP header and applies it to its scripts.
    forwarded.set("x-nonce", nonce);
    forwarded.set("content-security-policy", csp);
    const init = { request: { headers: forwarded } };
    const res = rewrite
      ? NextResponse.rewrite(new URL(`${targetPath}${url.search}`, request.url), init)
      : NextResponse.next(init);
    res.headers.set("x-request-id", requestId);
    res.headers.set("content-security-policy", csp);
    return res;
  };

  let response = build();
  let pending: CookieToSet[] = [];

  const supabase = createServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      for (const { name, value } of cookies) request.cookies.set(name, value);
      pending = cookies;
      response = build();
      for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
    },
  });

  // Verifies the JWT and refreshes an expired session (writes cookies via setAll).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && isProtectedPath(targetPath)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${url.pathname}${url.search}`);
    const redirect = NextResponse.redirect(login);
    for (const { name, value, options } of pending) redirect.cookies.set(name, value, options);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)",
  ],
};
