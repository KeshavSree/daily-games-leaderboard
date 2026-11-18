import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Daily / Your circle. Your standings.",
  description: "A private daily games leaderboard.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
