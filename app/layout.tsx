import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { DESCRIPTION, THEME_COLOR, TITLE } from "@/lib/site";
import "./globals.css";
import "./game.css";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: "INNEV8 ICT Federation" }],
  icons: {
    icon: [
      { url: "/assets/img/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/img/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/assets/img/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

// Without JavaScript the splash can't dismiss itself, so skip it and show the content as-is.
const NO_JS_STYLES = "<style>.splash{display:none}.reveal{opacity:1!important;transform:none!important}</style>";

export default function RootLayout({ children }: LayoutProps<"/">) {
  preload("/assets/fonts/montserrat-var.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/assets/fonts/poppins-400.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/assets/img/tunnel-1200.webp", { as: "image", fetchPriority: "high" });

  return (
    <html lang="en-PH">
      <body>
        <noscript dangerouslySetInnerHTML={{ __html: NO_JS_STYLES }} />
        {children}
      </body>
    </html>
  );
}
