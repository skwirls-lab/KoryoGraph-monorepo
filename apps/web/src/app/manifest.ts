import type { MetadataRoute } from "next";

/** Home (the family app) installs as a PWA; it opens straight to the family's Home. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KoryoGraph Home",
    short_name: "KoryoGraph",
    description: "Your martial arts school: schedule, progress, billing and messages.",
    id: "/home",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e11d48",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
