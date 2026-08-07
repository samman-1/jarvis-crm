import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/config/brand";

/**
 * Makes the CRM installable to a phone's home screen.
 *
 * It is used standing outside a client's office, so opening it should be one
 * tap from the home screen rather than finding a browser tab. `standalone`
 * drops the browser chrome, which also gives back the ~90px of vertical space
 * the address bar was eating on the hours grid.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} · ${BRAND.tagline}`,
    short_name: BRAND.name,
    description: `${BRAND.company} internal client and team tracking.`,
    start_url: "/en/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0a08",
    theme_color: "#0b0a08",
    lang: "en",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-any-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
