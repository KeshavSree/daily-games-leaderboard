import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Daily/",
  description: "Daily/",
  openGraph: { title: "Daily/", description: "Daily/", siteName: "Daily/" },
  twitter: { card: "summary", title: "Daily/", description: "Daily/" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
