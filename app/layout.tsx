import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spool: video to GIF, MP4 and more",
  description:
    "Drop in a video, pick a look, set the speed. Spool exports GIF, MP4, WebM, WebP and APNG in your browser. Nothing is uploaded.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
