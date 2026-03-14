import type { Metadata } from "next";
import { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Providers } from "./providers";
import "./globals.css";
import { DM_Mono, DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans"
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "nora",
  description: "A Shelby-powered social feed"
};

const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem("nora.theme");
    if (t !== "light" && t !== "dark") t = "dark";
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`.trim();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${dmMono.variable}`}>
        <script suppressHydrationWarning>{themeInitScript}</script>
        <Providers>
          <AuthGate>{children}</AuthGate>
        </Providers>
      </body>
    </html>
  );
}
