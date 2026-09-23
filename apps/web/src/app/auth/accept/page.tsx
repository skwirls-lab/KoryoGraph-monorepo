"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@koryo/db/browser";
import { safeNext } from "@/lib/surfaces";

/**
 * Landing for Supabase invite links, which carry the new session in the URL fragment (implicit flow) rather
 * than a PKCE code: the fragment never reaches the server, so it's read here, the session is stored in
 * cookies, and the invitee continues (to /welcome, where they accept the invitation).
 */
export default function AcceptLink() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = safeNext(new URLSearchParams(window.location.search).get("next"), "/auth/landing");
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    const outcome: Promise<string | null> = hash.get("error")
      ? Promise.resolve(hash.get("error_description") ?? "This link has expired.")
      : !access || !refresh
        ? Promise.resolve("This link is incomplete or has already been used.")
        : createBrowserClient().auth.setSession({ access_token: access, refresh_token: refresh })
          .then(({ error: e }) => (e ? "This link has expired. Ask your school to send a new invitation." : null));
    void outcome.then((problem) => {
      if (problem) { setError(problem); return; }
      history.replaceState(null, "", window.location.pathname);
      router.replace(next);
      router.refresh();
    });
  }, [router]);
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
      {error ? <p role="alert">{error} <a href="/login">Sign in</a></p> : <p role="status">Signing you in…</p>}
    </main>
  );
}
