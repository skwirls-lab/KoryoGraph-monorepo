"use client";

import { useEffect, useState } from "react";
import { Button } from "@koryo/ui/components/ui/button";

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

/** Registers the Home service worker (offline shell + push) and offers "Install app" when the browser allows. */
export function HomePwa() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (!prompt) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => void prompt.prompt().then(() => setPrompt(null))}>Install app</Button>
  );
}
