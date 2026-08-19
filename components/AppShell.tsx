"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * App chrome: a dark top rail (one step darker than the canvas for subtle
 * layering) with the brand mark, primary nav, and the primary "Track a company"
 * action. Purple is used ONLY here (brand/nav highlight/primary button) — never
 * on data. The workspace below sits on the near-black canvas with a soft glow.
 */
const NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/portfolio", label: "Portfolio" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white shadow-[0_2px_10px_-2px_rgba(110,86,240,0.7)]">
        {/* radar sweep glyph */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6" opacity="0.55" />
          <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.6" opacity="0.8" />
          <path d="M12 12L19 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.6" fill="white" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Radar</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-hairline bg-chrome/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-pastel text-brand-ink"
                      : "text-ink-muted hover:text-ink hover:bg-black/[0.04]"
                  }`}
                >
                  <span className="relative">
                    {item.label}
                    {active && (
                      <span className="absolute -bottom-[7px] left-0 right-0 h-[2px] rounded-full bg-brand" />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <Link
              href="/add"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white shadow-[0_2px_12px_-2px_rgba(110,86,240,0.6)] transition-transform hover:-translate-y-px active:translate-y-0"
            >
              <span className="text-base leading-none">+</span> Track a company
            </Link>
          </div>
        </div>
      </header>
      <main className="canvas-glow min-h-[calc(100vh-3.5rem)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-12">{children}</div>
      </main>
    </div>
  );
}
