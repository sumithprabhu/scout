import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

// Route group: every screen under (app) gets the shared chrome. The landing page
// (app/page.tsx) lives outside this group so it renders full-bleed marketing.
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
