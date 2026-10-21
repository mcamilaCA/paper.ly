import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "paper.ly",
  description: "The latest papers on any topic, filtered by where the researchers are.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
