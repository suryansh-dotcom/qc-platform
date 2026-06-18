import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QC Platform",
  description: "Quality Control operations console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-obsidian antialiased">{children}</body>
    </html>
  );
}
