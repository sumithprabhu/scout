"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Plus, Rss, LayoutGrid, Menu, X } from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { fetchCompanies, type CompanyDTO } from "@/lib/ui/api";

/**
 * App chrome as a persistent LEFT SIDEBAR — the same layout as the landing page's
 * product mock (mint active states, hairline dividers, a tracked-companies quick
 * list), promoted to the real app. Purple is the brand accent (mark + primary
 * button); mint is the nav highlight. The workspace sits on the soft canvas glow.
 */
const NAV = [
  { href: "/feed", label: "Feed", Icon: Rss },
  { href: "/portfolio", label: "Portfolio", Icon: LayoutGrid },
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

function SidebarContent({ pathname, companies }: { pathname: string; companies: CompanyDTO[] }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 px-2.5 py-1" aria-label="Scout home">
        <ScoutMark size={22} />
        <span className="text-[17px] font-extrabold tracking-tight text-ink">Scout</span>
      </Link>

      <Link
        href="/add"
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_-2px_rgba(110,86,240,0.6)] transition-transform hover:-translate-y-px active:translate-y-0"
      >
        <Plus size={15} strokeWidth={2.5} /> Track a company
      </Link>

      <nav className="mt-5 space-y-1">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold transition-colors ${
                active ? "bg-mint text-ink" : "text-muted hover:bg-mint/60 hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={2} className={active ? "text-purple-deep" : "opacity-70"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {companies.length > 0 && (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2 px-2.5 text-[10.5px] font-bold uppercase tracking-wider text-faint">
            Companies
          </div>
          <div className="space-y-0.5">
            {companies.map((c) => {
              const active = pathname === `/companies/${c.companyId}`;
              return (
                <Link
                  key={c.companyId}
                  href={`/companies/${c.companyId}`}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
                    active ? "bg-mint font-semibold text-ink" : "text-muted hover:bg-mint/60 hover:text-ink"
                  }`}
                >
                  <CompanyLogo name={c.name} url={c.rootUrl} size={22} />
                  <span className="truncate">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 rounded-lg bg-mint/70 px-3 py-2 text-[11.5px] text-ink/70">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
          Beta · free while we build
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCompanies()
      .then((r) => alive && setCompanies(r.companies))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // close the mobile drawer on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-white/90 px-4 py-5 backdrop-blur-xl md:flex">
        <SidebarContent pathname={pathname} companies={companies} />
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-xl md:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-ink">
          <Menu size={20} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <ScoutMark size={20} />
          <span className="text-[16px] font-extrabold tracking-tight text-ink">Scout</span>
        </Link>
        <Link href="/add" className="ml-auto inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">
          <Plus size={14} strokeWidth={2.5} /> Track
        </Link>
      </header>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-line bg-white px-4 py-5 shadow-pop">
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 text-ink-muted">
              <X size={18} />
            </button>
            <SidebarContent pathname={pathname} companies={companies} />
          </aside>
        </div>
      )}

      {/* workspace — fixed-height column; each page owns its header + scroll region */}
      <div className="md:pl-[248px]">
        <main className="canvas-glow flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden md:h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
