import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artisan’s Codex",
  description:
    "Discover recipes, track materials, check crafting requirements, plan upgrades, and see what your character can create.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
