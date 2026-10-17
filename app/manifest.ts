import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME, DESCRIPTION, THEME_COLOR } from "@/lib/site";

/** The installed app (Add to Home Screen / Install app): its name, icon and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    categories: ["games", "entertainment"],
    icons: [
      { src: "/assets/img/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/assets/img/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/assets/img/app/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/assets/img/app/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
