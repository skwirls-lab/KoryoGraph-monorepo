"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { markNotificationsRead, removePushSubscription, savePushSubscription } from "@/server/actions/notifications";

/** Marks everything shown as read once the page has been seen. */
export function MarkRead({ unread }: { unread: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!unread) return;
    const t = setTimeout(() => void markNotificationsRead().then(() => router.refresh()), 1500);
    return () => clearTimeout(t);
  }, [unread, router]);
  return null;
}

const urlB64 = (s: string) => {
  const b = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "off" | "on" | "denied">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!vapidKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { queueMicrotask(() => setState("unsupported")); return; }
    void navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(Notification.permission === "denied" ? "denied" : s ? "on" : "off"));
  }, [vapidKey]);
  if (!vapidKey) return <p className="text-sm text-fg-muted">Push notifications aren&apos;t set up on this server yet — new messages from your school appear here.</p>;
  if (state === "unsupported") return <p className="text-sm text-fg-muted">This browser can&apos;t receive push notifications. On iPhone, add KoryoGraph to your Home Screen first.</p>;
  if (state === "denied") return <p className="text-sm text-fg-muted">Notifications are blocked for this site in your browser settings.</p>;
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={pending || state === "unknown"} onClick={() => start(async () => {
        setError(null);
        const reg = await navigator.serviceWorker.ready;
        if (state === "on") {
          const s = await reg.pushManager.getSubscription();
          if (s) { await removePushSubscription({ endpoint: s.endpoint }); await s.unsubscribe(); }
          setState("off");
          return;
        }
        if ((await Notification.requestPermission()) !== "granted") { setState("denied"); return; }
        const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(vapidKey) });
        const j = s.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const r = await savePushSubscription({ endpoint: j.endpoint, keys: j.keys, userAgent: navigator.userAgent });
        if (r.ok) setState("on"); else { setError(r.error); await s.unsubscribe(); }
      })}>{state === "on" ? "Turn off push notifications" : "Turn on push notifications"}</Button>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
