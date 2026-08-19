"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";

/**
 * App chrome: a white top rail (hairline border, blurred) carrying the Scout
 * three-bar mark, primary nav, and the "Track a company" action. Purple is the
 * brand accent (mark / nav highlight / primary button) — never used on data.
 * The workspace below sits on the soft canvas with a colored glow, matching the
 * landing page's light, minty aesthetic.
 */
const NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/portfolio", label: "Portfolio" },
];

/** The three ascending bars — Scout's "salute" mark, solid violet. */
function ScoutMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="6" width="4" height="15" rx="2" fill="#6a3df0" />
      <rect x="10" y="3" width="4" height="18" rx="2" fill="#6a3df0" />
      <rect x="16.5" y="5" width="4" height="16" rx="2" fill="#6a3df0" />
    </svg>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Scout home">
      <ScoutMark size={22} />
      <span className="text-[17px] font-extrabold tracking-tight text-ink">Scout</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-hairline bg-chrome/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Wordmark />
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
              <Plus size={15} strokeWidth={2.5} /> Track a company
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
