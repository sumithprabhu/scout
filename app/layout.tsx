import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Scout · Company Intelligence",
  description:
    "Watch any company. Miss nothing. Scout tracks a company's public pages (pricing, hiring, positioning, compliance, integrations, changelog) and tells you in one line what changed, the moment it changes.",
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
