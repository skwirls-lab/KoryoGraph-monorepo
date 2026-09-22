/** Surfaces and how a signed-in user lands on one. Shared by the proxy, layouts and login. */
export const SURFACES = ["desk", "mat", "home"] as const;
export type Surface = (typeof SURFACES)[number];

export const PROTECTED_PREFIXES = ["/desk", "/mat", "/home"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The first surface the permission set can open, in desk → mat → home order. */
export function landingSurface(permissions: readonly string[]): Surface | null {
  for (const s of SURFACES) if (permissions.includes(`${s}.access`)) return s;
  return null;
}

/** Safe post-login redirect: only same-site relative paths. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

const HOST_SURFACES: Record<string, Surface> = { desk: "desk", app: "mat", home: "home" };

/** desk.<root> → desk, app.<root> → mat, home.<root> → home; anything else → null (public). */
export function surfaceForHost(host: string, rootDomain: string): Surface | null {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  const root = rootDomain.toLowerCase();
  if (!root || root === "localhost" || h === root || !h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  return HOST_SURFACES[sub] ?? null;
}

/** Paths served identically on every host (never prefixed by a surface rewrite). */
export function isSharedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/kiosk") ||
    pathname.startsWith("/sign/") ||
    pathname.startsWith("/widget/") ||
    ["/login", "/signup", "/forgot-password", "/reset-password", "/welcome"].includes(pathname)
  );
}
