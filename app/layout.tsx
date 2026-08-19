import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Radar — Company Intelligence",
  description:
    "Track public signals about any company — pricing, hiring, positioning, compliance, integrations, changelog — classified and summarized by AI as they change.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-canvas text-ink antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
