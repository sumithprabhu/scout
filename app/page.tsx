"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, ArrowUpRight, Menu, X, Radar as RadarIcon,
  Tag, Package, Layers, Megaphone, Rocket, UserPlus, Plug, Trophy, FileText,
  ShieldCheck, Globe, Map, Code, Users, Gift, Calculator, Headphones, Scale,
  Calendar, Cpu, Target, LogIn, Building2, Newspaper, Percent, Sparkles,
  MessageSquare, LayoutGrid, Timer, Activity, Banknote, Share2, Eye, Database, Boxes,
  Bell, Check,
  type LucideIcon,
} from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { SignalPill, StatusPill } from "@/components/ui/Pill";
import { InsightCard } from "@/components/company/InsightCard";
import { SignalMix } from "@/components/company/SignalMix";
import { SignalCoverage } from "@/components/company/SignalCoverage";
import { SignalCard } from "@/components/feed/SignalCard";
import {
  fetchGlobalEvents, fetchCompanies, fetchCompanyPages,
  type SignalEventDTO, type CompanyDTO, type TrackedPageDTO,
} from "@/lib/ui/api";
import { SIGNAL_ORDER, signalStyle, PAGE_TYPE_LABELS } from "@/lib/ui/signals";
import { timeAgo, renderValue, domainOf, hostPath } from "@/lib/ui/format";

const BRAND = "Scout";

export default function ScoutLanding() {
  const [events, setEvents] = useState<SignalEventDTO[]>([]);
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  useEffect(() => {
    fetchGlobalEvents({ limit: 6 }).then((d) => setEvents(d.events)).catch(() => {});
    fetchCompanies().then((d) => setCompanies(d.companies)).catch(() => {});
  }, []);
  return (
    <main className="min-h-screen bg-mint">
      <Navbar />
      <Hero events={events} companies={companies} />
      {/* smooth mint -> lavender transition */}
      <div aria-hidden className="h-24 bg-gradient-to-b from-mint to-lav" />
      <ValueBlocks />
      <DarkBand events={events} />
      {/* smooth lavender -> mint transition */}
      <div aria-hidden className="h-24 bg-gradient-to-b from-lav to-mint" />
      <SignalTypes />
      <Stats />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ------------------------------- navbar ------------------------------- */
/* Scout mark — three ascending bars (75% · 90% · 80%), the "scout salute" */
function ScoutMark({ size = 26, variant = "solid" }: { size?: number; variant?: string }) {
  const V = "#6a3df0", T = "#24eca0", C = "#F97316", B = "#6E56F0", L = "#9F8CFF";
  let f: [string, string, string] = [V, V, V];
  if (variant === "teal") f = [V, T, V];
  else if (variant === "coral") f = [V, C, V];
  else if (variant === "multi") f = [V, T, C];
  else if (variant === "gradient") f = [`url(#sg-${size})`, `url(#sg-${size})`, `url(#sg-${size})`];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {variant === "gradient" && (
        <defs>
          <linearGradient id={`sg-${size}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={V} /><stop offset="50%" stopColor={B} /><stop offset="100%" stopColor={L} />
          </linearGradient>
        </defs>
      )}
      <rect x="3.5" y="6" width="4" height="15" rx="2" fill={f[0]} />
      <rect x="10" y="3" width="4" height="18" rx="2" fill={f[1]} />
      <rect x="16.5" y="5" width="4" height="16" rx="2" fill={f[2]} />
    </svg>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label={`${BRAND} home`}>
      <ScoutMark size={24} />
      <span className="text-[20px] font-extrabold tracking-tight text-ink">{BRAND}</span>
    </Link>
  );
}

/* small "Beta" tag next to the wordmark, on the same line but bottom-aligned
   to it rather than vertically centered — the parent must be `flex items-end`
   (see Navbar/Footer usage). */
function BetaBadge() {
  return (
    <span className="rounded-full bg-purple/20 px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wide text-purple-deep">
      Beta
    </span>
  );
}

/* the "Pricing" nav/footer label itself, struck through in red + a "Free in
   beta" chip — used in place of the plain label wherever it says "Pricing" */
function PricingLabel() {
  return (
    <>
      <span className="line-through decoration-red-500 decoration-2">Pricing</span>
      <span className="rounded-full bg-purple/15 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-purple-deep">
        Free in beta
      </span>
    </>
  );
}

const MENUS = [["Product", "#product"], ["How it works", "#how"], ["Pricing", "#pricing"]];

function Navbar() {
  const [mobile, setMobile] = useState(false);
  const [showBar, setShowBar] = useState(true);
  return (
    <div className="sticky top-0 z-50">
      {/* announcement bar (dismissible) */}
      {showBar && (
        <div className="relative bg-purple px-10 py-2.5 text-center text-[13.5px] font-medium text-ink">
          <span className="font-bold">Now in beta. Free.</span>
          <span className="ml-2 hidden sm:inline">Track your first company in under a minute.</span>
          <button
            onClick={() => setShowBar(false)}
            aria-label="Dismiss announcement"
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink/60 transition-colors hover:bg-black/10 hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <header className="bg-mint/90 backdrop-blur-md">
        <nav className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-9">
            <div className="flex items-end gap-2">
              <Wordmark />
              <BetaBadge />
            </div>
            <ul className="hidden items-center gap-1 lg:flex">
              {MENUS.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-semibold text-ink transition-colors hover:text-ink/60">
                    {label === "Pricing" ? <PricingLabel /> : label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link href="/feed" className="rounded-pill border border-ink/25 bg-white/60 px-5 py-2.5 text-[15px] font-semibold text-ink transition-colors hover:bg-white">
              Sign in
            </Link>
            <Link href="/add" className="rounded-pill bg-ink px-5 py-2.5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-px">
              Start tracking free
            </Link>
          </div>

          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/20 lg:hidden" onClick={() => setMobile((v) => !v)} aria-label="Toggle menu">
            {mobile ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        {mobile && (
          <div className="border-t border-ink/10 px-5 py-4 lg:hidden">
            {MENUS.map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobile(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-semibold text-ink">
                {label === "Pricing" ? <PricingLabel /> : label}
              </a>
            ))}
            <div className="mt-3 flex gap-2">
              <Link href="/feed" className="flex-1 rounded-pill border border-ink/25 px-4 py-2.5 text-center text-[14px] font-semibold">Sign in</Link>
              <Link href="/add" className="flex-1 rounded-pill bg-ink px-4 py-2.5 text-center text-[14px] font-semibold text-white">Start free</Link>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

/* ------------------------------- hero ------------------------------- */
function Hero({ events, companies }: { events: SignalEventDTO[]; companies: CompanyDTO[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const go = (e: React.FormEvent) => { e.preventDefault(); router.push(value.trim() ? `/add?q=${encodeURIComponent(value.trim())}` : "/add"); };

  return (
    <section className="bg-mint">
      <div className="mx-auto max-w-[1100px] px-5 pt-14 text-center lg:pt-20">
        <h1 className="mx-auto max-w-4xl animate-fade-up text-hero font-extrabold text-ink">
          Watch any company. Miss nothing.
        </h1>
        <p className="mx-auto mt-6 max-w-lg animate-fade-up text-[18px] font-medium leading-relaxed text-ink/80 [animation-delay:80ms] lg:text-[20px]">
          Scout tracks a company’s public pages and tells you, in one line, every time something meaningful changes.
        </p>

        <form onSubmit={go} className="mx-auto mt-10 max-w-xl animate-fade-up rounded-pill bg-white/50 p-1.5 [animation-delay:140ms]">
          <div className="flex items-center gap-2 rounded-pill bg-white p-2 shadow-card">
            <Search className="ml-3 h-5 w-5 text-faint" />
            <input value={value} onChange={(e) => setValue(e.target.value)} className="flex-1 bg-transparent px-1 py-2.5 text-[15px] text-ink outline-none placeholder:text-faint" placeholder="Paste a company name or URL" />
            <button type="submit" className="rounded-pill bg-purple px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-purple-hover">
              Track it
            </button>
          </div>
        </form>
      </div>

      {/* product panel over pinstripe */}
      <div className="mt-16 px-5 pb-8">
        <FeedPanel events={events} companies={companies} />
      </div>
    </section>
  );
}

function FeedPanel({ events, companies: trackedCompanies }: { events: SignalEventDTO[]; companies: CompanyDTO[] }) {
  const [activeType, setActiveType] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"feed" | "portfolio">("feed");
  const [selectedCo, setSelectedCo] = useState<string | null>(null);
  // set when a sidebar "Companies" entry is clicked — swaps the whole main
  // content area for the real company-overview UI (InsightCard/SignalMix/
  // SignalCoverage), the same components the real dashboard's /companies/:id
  // page uses.
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const openCompany = trackedCompanies.find((c) => c.companyId === openCompanyId) ?? null;

  // real favicon per company name, resolved via the tracked companies' domains.
  // (globalThis.Map — the bare `Map` identifier is shadowed by the lucide icon
  // imported below for the signal-category cards.)
  const domainByName = useMemo(() => {
    const rootById = new globalThis.Map(trackedCompanies.map((c) => [c.companyId, c.rootUrl] as const));
    const m = new globalThis.Map<string, string | undefined>();
    for (const e of events) if (e.companyName) m.set(e.companyName, domainOf(rootById.get(e.companyId)));
    return m;
  }, [events, trackedCompanies]);

  const counts: Record<string, number> = {};
  for (const e of events) counts[e.signalType] = (counts[e.signalType] ?? 0) + 1;
  const present = SIGNAL_ORDER.filter((t) => counts[t]);
  const filtered = events.filter((e) => !activeType || e.signalType === activeType);

  // most-active company (for the right rail)
  const byCo: Record<string, number> = {};
  for (const e of events) if (e.companyName) byCo[e.companyName] = (byCo[e.companyName] ?? 0) + 1;
  const companies = Object.entries(byCo).sort((a, b) => b[1] - a[1]);
  const topCo = companies[0];

  // ---- auto-pilot demo cursor ----
  const panelRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 60, y: 120 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [clicking, setClicking] = useState(false);
  const lastInteraction = useRef(0);
  const onInteract = () => { lastInteraction.current = Date.now(); setCursorVisible((v) => (v ? false : v)); };

  // steps (rebuilt each render so closures read current data)
  const firstRowId = filtered[0]?.signalEventId ?? null;
  const coNames = companies.map(([n]) => n);
  const stepsRef = useRef<{ tour: string; act?: () => void; hold?: number }[]>([]);
  stepsRef.current = [
    { tour: "feed", act: () => { setView("feed"); setActiveType(null); setOpenId(null); setSelectedCo(null); }, hold: 1100 },
    { tour: "chip-pricing", act: () => setActiveType("pricing_change") },
    { tour: "chip-all", act: () => setActiveType(null), hold: 1100 },
    { tour: "row-0", act: () => setOpenId(firstRowId), hold: 2000 },
    { tour: "row-0", act: () => setOpenId(null) },
    { tour: "portfolio", act: () => { setView("portfolio"); setSelectedCo(null); }, hold: 1000 },
    { tour: "co-0", act: () => setSelectedCo(coNames[0] ?? null) },
    { tour: "co-1", act: () => setSelectedCo(coNames[1] ?? null) },
    { tour: "co-2", act: () => setSelectedCo(coNames[2] ?? null), hold: 1600 },
  ];

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const idle = () => Date.now() - lastInteraction.current >= 10000;
    (async () => {
      await sleep(2200);
      let i = 0;
      while (!cancelled) {
        while (!cancelled && !idle()) { setCursorVisible(false); await sleep(500); }
        if (cancelled) break;
        const container = panelRef.current;
        const steps = stepsRef.current;
        const step = steps[i % steps.length];
        const el = container?.querySelector(`[data-tour="${step.tour}"]`) as HTMLElement | null;
        if (container && el) {
          const cr = container.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          setCursorVisible(true);
          setCursor({ x: er.left - cr.left + Math.min(er.width, 46) / 2, y: er.top - cr.top + er.height / 2 });
          await sleep(900);
          if (!idle()) continue; // user grabbed control mid-move → retry after idle
          setClicking(true);
          step.act?.();
          await sleep(240);
          setClicking(false);
          await sleep(step.hold ?? 1300);
        }
        i++;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-10 h-[440px] bg-pinstripe opacity-70 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]" />
      <div ref={panelRef} onPointerDown={onInteract} onPointerMove={onInteract} className="relative mx-auto max-w-[1140px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-soft">
        {/* auto-pilot demo cursor */}
        {cursorVisible && (
          <motion.div className="pointer-events-none absolute left-0 top-0 z-40" animate={{ x: cursor.x, y: cursor.y }} transition={{ type: "spring", stiffness: 120, damping: 18, mass: 0.7 }}>
            <div className="relative -ml-1 -mt-1">
              <svg width="22" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-[0_2px_4px_rgba(106,61,240,0.45)]">
                <path d="M5 3 L18.5 12 L11.3 12.9 L14.6 19.6 L11.9 20.9 L8.6 14.2 L5 17.4 Z" fill="#6a3df0" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              {clicking && <span className="absolute -left-2 -top-2 h-8 w-8 rounded-full ring-2 ring-purple-deep/70 [animation:ping_0.6s_ease-out]" />}
            </div>
          </motion.div>
        )}

        {/* browser chrome */}
        <div className="flex items-center gap-3 border-b border-line bg-[#f4f5f2] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] text-faint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 10V8a6 6 0 1112 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2"/></svg>
            app.scout.io/feed
          </div>
          <div className="hidden gap-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-line" /><span className="h-2 w-2 rounded-full bg-line" />
          </div>
        </div>

        {/* app body */}
        <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr] lg:grid-cols-[210px_1fr_248px]">
          {/* sidebar — mirrors the real app's AppShell: logo, track-company
              action, Feed/Portfolio nav, then a clickable Companies list */}
          <aside className="hidden border-r border-line p-4 sm:block">
            <div className="mb-3.5 flex items-end gap-1.5 px-1">
              <ScoutMark size={17} />
              <span className="text-[14px] font-extrabold tracking-tight text-ink">Scout</span>
            </div>
            <button className="mb-3.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-deep px-2.5 py-1.5 text-[12px] font-semibold text-white">
              <span className="text-[13px] leading-none">+</span> Track a company
            </button>
            <SideItem label="Feed" icon="≡" active={!openCompanyId && view === "feed"} onClick={() => { setOpenCompanyId(null); setView("feed"); }} dataTour="feed" />
            <SideItem label="Portfolio" icon="◫" active={!openCompanyId && view === "portfolio"} onClick={() => { setOpenCompanyId(null); setView("portfolio"); }} dataTour="portfolio" />
            <div className="mt-5 mb-2 px-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">Companies</div>
            <div className="space-y-0.5">
              {trackedCompanies.map((c) => {
                const on = openCompanyId === c.companyId;
                return (
                  <button
                    key={c.companyId}
                    onClick={() => setOpenCompanyId(c.companyId)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors ${on ? "bg-mint font-semibold text-ink" : "text-muted hover:bg-mint/60"}`}
                  >
                    <CompanyLogo name={c.name} domain={domainOf(c.rootUrl)} size={18} />
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* main — fixed height, list scrolls internally */}
          <div className="flex h-[600px] min-w-0 flex-col p-5 sm:p-6">
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-ink">
                  {openCompany ? openCompany.name : view === "feed" ? "Signal Feed" : "Portfolio"}
                </h3>
                <span className="text-[12px] text-faint">
                  {openCompany
                    ? "Company overview"
                    : view === "feed"
                    ? "live · classified by AI"
                    : `${companies.length} companies tracked`}
                </span>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-[11.5px] font-semibold text-ink/70 sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" /> {events.length || 0} signals
              </span>
            </div>

            {openCompany ? (
              <CompanyOverviewPanel
                company={openCompany}
                events={events.filter((e) => e.companyId === openCompany.companyId)}
                onBack={() => setOpenCompanyId(null)}
              />
            ) : view === "feed" ? (
              <>
                {/* filter chips (interactive) */}
                <div className="mb-4 flex shrink-0 flex-wrap gap-1.5">
                  <FilterChip label="All" active={activeType === null} onClick={() => setActiveType(null)} dataTour="chip-all" />
                  {present.map((t) => {
                    const s = signalStyle(t);
                    const on = activeType === t;
                    return (
                      <button key={t} data-tour={t === "pricing_change" ? "chip-pricing" : undefined} onClick={() => setActiveType(on ? null : t)}
                        className="rounded-full px-2.5 py-1 text-[12px] font-semibold transition-all"
                        style={on ? { backgroundColor: s.bg, color: s.text } : { backgroundColor: "#fff", color: "#5b6158", boxShadow: "inset 0 0 0 1px #e3e6e2" }}>
                        {s.label} {counts[t]}
                      </button>
                    );
                  })}
                </div>

                {/* feed rows — scrollable, staggered load-in */}
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                  {events.length === 0 ? (
                    <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
                  ) : (
                    <motion.div key={activeType ?? "all"} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.09 } } }} className="space-y-2.5">
                      {filtered.map((e, ri) => (
                        <motion.div key={e.signalEventId} data-tour={ri === 0 ? "row-0" : undefined} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                          <FeedRow event={e} open={openId === e.signalEventId} onToggle={() => setOpenId(openId === e.signalEventId ? null : e.signalEventId)} domain={domainByName.get(e.companyName ?? "")} />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </>
            ) : (
              /* portfolio view — click a company to drill into its recent signals */
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="space-y-2">
                  {companies.map(([name, n], ci) => {
                    const max = Math.max(...Object.values(byCo), 1);
                    const open = selectedCo === name;
                    const coEvents = events.filter((e) => e.companyName === name);
                    return (
                      <motion.div key={name} data-tour={ci < 3 ? `co-${ci}` : undefined} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        className={`overflow-hidden rounded-xl border transition-colors ${open ? "border-purple bg-purple/[0.06]" : "border-line bg-white"}`}>
                        <button onClick={() => setSelectedCo(open ? null : name)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                          <FloatAvatar name={name} size={26} domain={domainByName.get(name)} />
                          <span className="text-[13px] font-semibold text-ink">{name}</span>
                          <div className="ml-auto flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-mint"><div className="h-full rounded-full bg-teal" style={{ width: `${(n / max) * 100}%` }} /></div>
                            <span className="w-4 text-right text-[12px] font-semibold text-ink/70">{n}</span>
                            <span className={`text-ink/40 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                          </div>
                        </button>
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                              <div className="space-y-2 border-t border-line/70 px-3.5 py-3">
                                <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Recent signals</div>
                                {coEvents.map((e) => (
                                  <div key={e.signalEventId} className="flex items-center gap-2">
                                    <SignalPill type={e.signalType} />
                                    <span className="truncate text-[12.5px] text-ink/80">{e.summary}</span>
                                    <span className="ml-auto shrink-0 text-[11px] text-faint">{timeAgo(e.detectedAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            )}
          </div>

          {/* right rail */}
          <aside className="hidden border-l border-line p-4 lg:block">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">This week</div>
            <div className="mt-3 rounded-xl border border-line p-3">
              <div className="text-[28px] font-extrabold leading-none text-ink">{events.length || 0}</div>
              <div className="text-[11.5px] text-muted">changes detected</div>
            </div>
            <div className="mt-4 space-y-2">
              {present.slice(0, 5).map((t) => {
                const s = signalStyle(t);
                const pct = events.length ? (counts[t] / events.length) * 100 : 0;
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="font-medium" style={{ color: s.text }}>{s.label}</span>
                      <span className="text-faint">{counts[t]}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mint">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.accent }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {topCo && (
              <div className="mt-5 rounded-xl border border-line p-3">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Most active</div>
                <div className="mt-2 flex items-center gap-2">
                  <FloatAvatar name={topCo[0]} size={22} domain={domainByName.get(topCo[0])} />
                  <span className="text-[13px] font-semibold text-ink">{topCo[0]}</span>
                  <span className="ml-auto text-[11.5px] text-faint">{topCo[1]}</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * The real company-overview UI (InsightCard + SignalMix + SignalCoverage +
 * tracked pages + signal history), reused as-is from the dashboard so clicking
 * a company in the demo panel's sidebar shows exactly what /companies/:id
 * shows in the real app — not a re-implemented mini version.
 */
function CompanyOverviewPanel({
  company,
  events,
  onBack,
}: {
  company: CompanyDTO;
  events: SignalEventDTO[];
  onBack: () => void;
}) {
  const [pages, setPages] = useState<TrackedPageDTO[] | null>(null);
  const [activeSignal, setActiveSignal] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPages(null);
    setActiveSignal(null);
    fetchCompanyPages(company.companyId)
      .then((d) => alive && setPages(d.pages))
      .catch(() => alive && setPages([]));
    return () => {
      alive = false;
    };
  }, [company.companyId]);

  const counts: Record<string, number> = {};
  for (const e of events) counts[e.signalType] = (counts[e.signalType] ?? 0) + 1;
  const filtered = events.filter((e) => !activeSignal || e.signalType === activeSignal);
  const domain = domainOf(company.rootUrl);

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
      <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
        ← Back
      </button>
      <div className="space-y-4 pb-2 text-[13px]">
        <InsightCard name={company.name} rootUrl={company.rootUrl} events={events} pagesCount={pages?.length} since={company.createdAt} />

        {events.length > 0 && <SignalMix counts={counts} />}

        <SignalCoverage counts={counts} activeSignal={activeSignal} onSelect={setActiveSignal} />

        <div>
          <h4 className="mb-2 text-[13px] font-semibold text-ink">Tracked pages</h4>
          {!pages ? (
            <div className="skeleton h-16 rounded-xl" />
          ) : pages.length === 0 ? (
            <p className="text-[12.5px] text-faint">No pages tracked yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {pages.map((p) => (
                <div key={p.trackedPageId} className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
                  <span className="w-20 shrink-0 text-[12px] font-medium text-ink">{PAGE_TYPE_LABELS[p.pageType] ?? p.pageType}</span>
                  <span className="flex-1 truncate font-mono text-[10.5px] text-faint" title={p.url}>{hostPath(p.url)}</span>
                  <StatusPill status={p.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[13px] font-semibold text-ink">Signal history</h4>
            {activeSignal && (
              <button onClick={() => setActiveSignal(null)} className="text-[11px] font-semibold text-purple-deep hover:underline">
                Clear filter
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="text-[12.5px] text-faint">No changes detected yet.</p>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((e, i) => (
                <SignalCard key={e.signalEventId} event={e} index={i} domain={domain} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SideItem({ label, active = false, icon, onClick, dataTour }: { label: string; active?: boolean; icon: string; onClick?: () => void; dataTour?: string }) {
  return (
    <button data-tour={dataTour} onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors ${active ? "bg-mint text-ink" : "text-muted hover:bg-mint/60"}`}>
      <span className="text-[13px] opacity-70">{icon}</span> {label}
    </button>
  );
}

/* company logo with a subtle, out-of-sync idle dangle (swings from the top) —
   real favicon when a domain is known, initials otherwise (CompanyLogo's own
   fallback) */
function FloatAvatar({ name, size, domain }: { name: string; size: number; domain?: string }) {
  const delay = (name.charCodeAt(0) % 10) * 0.3;
  return (
    <motion.span
      className="inline-block origin-top"
      animate={{ rotate: [0, -6, 0, 6, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <CompanyLogo name={name} domain={domain} size={size} />
    </motion.span>
  );
}

function FilterChip({ label, active, onClick, dataTour }: { label: string; active: boolean; onClick: () => void; dataTour?: string }) {
  return (
    <button data-tour={dataTour} onClick={onClick} className="rounded-full px-2.5 py-1 text-[12px] font-semibold transition-all"
      style={active ? { backgroundColor: "#181e15", color: "#fff" } : { backgroundColor: "#fff", color: "#5b6158", boxShadow: "inset 0 0 0 1px #e3e6e2" }}>
      {label}
    </button>
  );
}

function FeedRow({ event, open, onToggle, domain }: { event: SignalEventDTO; open: boolean; onToggle: () => void; domain?: string }) {
  const s = signalStyle(event.signalType);
  const changes = event.diffDetail?.changes ?? [];
  const hasDiff = changes.length > 0;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-card">
      <div className="flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: s.accent }} />
        <button onClick={() => hasDiff && onToggle()} className={`min-w-0 flex-1 px-3.5 py-3 text-left ${hasDiff ? "cursor-pointer" : "cursor-default"}`}>
          <div className="flex items-center gap-2">
            <FloatAvatar name={event.companyName ?? "?"} size={22} domain={domain} />
            <span className="text-[13px] font-semibold text-ink">{event.companyName}</span>
            <SignalPill type={event.signalType} />
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-faint">
              {timeAgo(event.detectedAt)}
              {hasDiff && <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>}
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-snug text-ink/90">{event.summary}</p>
        </button>
      </div>
      {open && hasDiff && (
        <div className="border-t border-line bg-[#f7f8f5] px-4 py-3">
          <div className="space-y-1.5">
            {changes.slice(0, 4).map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                <span className="font-mono text-[11px] text-faint">{c.path || "/"}</span>
                {c.op === "changed" ? (
                  <>
                    <span className="font-mono text-[#B91C1C]/80 line-through">{renderValue(c.oldValue)}</span>
                    <span className="text-faint">→</span>
                    <span className="font-mono font-semibold" style={{ color: s.text }}>{renderValue(c.newValue)}</span>
                  </>
                ) : c.op === "added" ? (
                  <>
                    <span className="rounded px-1 text-[10px] font-bold uppercase" style={{ backgroundColor: `${s.accent}22`, color: s.text }}>added</span>
                    <span className="font-mono font-medium" style={{ color: s.text }}>{renderValue(c.newValue)}</span>
                  </>
                ) : (
                  <>
                    <span className="rounded bg-[#B91C1C]/10 px-1 text-[10px] font-bold uppercase text-[#B91C1C]">removed</span>
                    <span className="font-mono text-[#B91C1C]/70 line-through">{renderValue(c.oldValue)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- value blocks (horizontal accordion) ------------------------- */
type Panel = {
  tab: string; title: string; desc: string; cta: [string, string] | null;
  bg: string; Icon: LucideIcon; Graphic: () => JSX.Element;
};
const PANELS: Panel[] = [
  {
    tab: "One feed",
    title: "See the whole company, not one metric.",
    desc: "Pricing, hiring, positioning, compliance, integrations, changelog. Every public signal in a single feed, with the context of what it means.",
    cta: ["Open the feed", "/feed"],
    bg: "#bf8efd",
    Icon: LayoutGrid,
    Graphic: FeedGraphic,
  },
  {
    tab: "Plain English",
    title: "One line. Not a diff.",
    desc: "Every change is diffed, then summarized in plain English by AI, so you read what happened in seconds, not a raw diff to decode.",
    cta: null,
    bg: "#d9ece4",
    Icon: Sparkles,
    Graphic: DiffGraphic,
  },
  {
    tab: "On autopilot",
    title: "Set it once. It runs itself.",
    desc: "Point Scout at a domain and it discovers the right pages, scrapes them on a schedule, and pushes new changes to your feed, with no dashboards to babysit.",
    cta: ["Track a company", "/add"],
    bg: "#ffffff",
    Icon: RadarIcon,
    Graphic: AutoGraphic,
  },
];

function ValueBlocks() {
  const [active, setActive] = useState(2); // third panel open by default
  return (
    <section id="product" className="bg-lav pb-16 pt-4">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        {/* desktop: horizontal accordion — hover a panel to expand it */}
        <div className="hidden h-[440px] gap-4 lg:flex">
          {PANELS.map((p, i) => {
            const on = active === i;
            const Graphic = p.Graphic;
            return (
              <div
                key={i}
                onMouseEnter={() => setActive(i)}
                className="relative min-w-0 basis-0 cursor-pointer overflow-hidden rounded-xl2 transition-[flex-grow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ flexGrow: on ? 3 : 1.5, backgroundColor: p.bg }}
              >
                <div className="flex h-full flex-col p-7">
                  {/* title + description: always visible */}
                  <h3 className="text-[22px] font-extrabold leading-tight text-ink">{p.title}</h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink/70">{p.desc}</p>

                  {/* graphic: only in the expanded region */}
                  <div className="mt-6 min-h-0 flex-1 overflow-hidden">
                    {on && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="h-full">
                        <Graphic />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* mobile: simple stacked cards */}
        <div className="space-y-4 lg:hidden">
          {PANELS.map((p, i) => {
            const Graphic = p.Graphic;
            return (
              <div key={i} className="rounded-xl2 p-7" style={{ backgroundColor: p.bg }}>
                <h3 className="text-[26px] font-extrabold leading-tight text-ink">{p.title}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink/70">{p.desc}</p>
                <div className="my-5 h-56"><Graphic /></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* animated mini graphics for the accordion panels */
function FeedGraphic() {
  const FEED: [string, string, string][] = [
    ["Vercel", "Pricing", "#F97316"], ["Linear", "Hiring", "#14B8A6"], ["Notion", "Compliance", "#EAB308"],
    ["Ramp", "Integration", "#3B82F6"], ["Stripe", "Positioning", "#EC4899"], ["Figma", "Changelog", "#10B981"],
  ];
  return (
    <div className="relative h-full overflow-hidden">
      <motion.div className="space-y-2" animate={{ y: ["0%", "-50%"] }} transition={{ duration: 11, repeat: Infinity, ease: "linear" }}>
        {[...FEED, ...FEED].map(([co, label, color], i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2.5 shadow-sm">
            <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[12px] font-bold text-ink">{co}</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${color}22`, color }}>{label}</span>
            <span className="ml-auto h-1.5 w-12 rounded-full bg-black/10" />
          </div>
        ))}
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#bf8efd] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#bf8efd] to-transparent" />
    </div>
  );
}

function DiffGraphic() {
  const news = ["$25", "$29", "$32"];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % news.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="max-w-sm rounded-xl bg-white p-4 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Detected change · Pricing</div>
      <div className="mt-2 flex items-center gap-2 font-mono text-[15px]">
        <span className="rounded bg-[#B91C1C]/10 px-1.5 py-0.5 text-[#B91C1C] line-through">$20</span>
        <span className="text-faint">→</span>
        <motion.span key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="rounded bg-[#F97316]/15 px-1.5 py-0.5 font-semibold text-[#C2410C]">{news[idx]}</motion.span>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-purple-deep"><Sparkles size={12} /> AI summary</div>
      <div className="mt-2 space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-purple-deep/15">
          <motion.div className="h-full rounded-full bg-purple-deep" animate={{ width: ["0%", "100%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
        </div>
        <div className="h-2 w-2/3 rounded-full bg-purple-deep/10" />
      </div>
      <p className="mt-3 text-[12px] leading-snug text-ink/80">Vercel raised the Pro plan, in one line, not a raw diff.</p>
    </div>
  );
}

function AutoGraphic() {
  const toasts: [string, string, string][] = [
    ["New signal detected", "Pricing", "#F97316"],
    ["Careers page updated", "Hiring", "#14B8A6"],
    ["New SOC 2 badge", "Compliance", "#EAB308"],
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border border-ink/10" />
        <div className="absolute inset-[20%] rounded-full border border-ink/10" />
        <div className="absolute inset-[40%] rounded-full border border-ink/10" />
        <motion.div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, rgba(36,236,160,0.5), transparent 90deg)" }} animate={{ rotate: 360 }} transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }} />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal" />
        <motion.span className="absolute left-[68%] top-[34%] h-2.5 w-2.5 rounded-full bg-purple-deep" animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.35, 1] }} />
      </div>
      <div className="w-full max-w-sm space-y-2">
        {toasts.map(([t, label, c], i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[12px] shadow-card"
            animate={{ opacity: [0, 1, 1, 0.35], x: [12, 0, 0, 0] }}
            transition={{ duration: 3.3, repeat: Infinity, delay: i * 1.05, times: [0, 0.18, 0.75, 1], ease: "easeOut" }}
          >
            <Bell size={13} className="shrink-0 text-purple-deep" />
            <span className="text-ink">{t}</span>
            <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: `${c}22`, color: c }}>{label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- dark band ------------------------- */
type DemoChange = { signalType: string; summary: string; diff: { old?: string; new?: string; added?: string } | null };

function diffFromDetail(dd?: SignalEventDTO["diffDetail"]): DemoChange["diff"] {
  const ch = dd?.changes?.[0];
  if (!ch) return null;
  const cut = (v: unknown) => renderValue(v).slice(0, 26);
  if (ch.op === "changed") return { old: cut(ch.oldValue), new: cut(ch.newValue) };
  if (ch.op === "added") return { added: cut(ch.newValue) };
  return null;
}

const FALLBACK_CHANGES: DemoChange[] = [
  { signalType: "pricing_change", summary: "Vercel raised the Pro plan from $20 to $25 and added an Enterprise tier.", diff: { old: "$20", new: "$25" } },
  { signalType: "compliance_change", summary: "Notion added HIPAA and ISO 27001 certifications to its trust page.", diff: { added: "HIPAA, ISO 27001" } },
  { signalType: "hiring_spike", summary: "Linear opened 8 new roles, including an Engineering Manager.", diff: { old: "11 roles", new: "19 roles" } },
];

function DarkBand({ events }: { events: SignalEventDTO[] }) {
  const items: DemoChange[] = events.length
    ? events.slice(0, 4).map((e) => ({ signalType: e.signalType, summary: e.summary, diff: diffFromDetail(e.diffDetail) }))
    : FALLBACK_CHANGES;
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 3800);
    return () => clearInterval(t);
  }, [items.length]);
  const cur = items[idx % items.length];
  const s = signalStyle(cur.signalType);
  return (
    <section className="bg-lav px-5 pb-16">
      <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-xl2 bg-ink">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] opacity-80"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #24eca0 0 2px, transparent 2px 7px), repeating-linear-gradient(90deg, transparent 0 12px, #bf8efd 12px 14px)",
            // fade the streaks in slowly from the bottom, fully gone by ~the top of this band (~34% up)
            maskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 55%, #000 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 55%, #000 100%)",
          }}
        />
        <div className="relative grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
          <div className="text-white">
            <h2 className="text-display font-extrabold leading-none">Signal,<br /> not noise.</h2>
            <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-white/70">
              Scout filters out formatting churn and reflows. You only hear about changes that actually mean something, like a price move, a new cert, or a hiring surge.
            </p>
            <Link href="/add" className="mt-7 inline-flex rounded-pill border border-white/40 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10">Start tracking free</Link>
          </div>
          <div className="rounded-2xl bg-[#0f130d] p-1.5">
            <div className="rounded-xl bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-bold text-ink">Detected change</div>
                <AnimatePresence mode="wait">
                  <motion.div key={`pill-${idx}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}>
                    <SignalPill type={cur.signalType} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="mt-3 min-h-[150px] rounded-lg border border-line p-4">
                <div className="text-[12px] text-muted">AI summary</div>
                <AnimatePresence mode="wait">
                  <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
                    <div className="mt-1 line-clamp-3 text-[15px] font-semibold leading-snug text-ink">{cur.summary}</div>
                    {cur.diff && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
                        {cur.diff.old !== undefined ? (
                          <>
                            <span className="rounded bg-[#B91C1C]/10 px-2 py-1 font-mono text-[#B91C1C] line-through">{cur.diff.old}</span>
                            <span className="text-faint">→</span>
                            <span className="rounded px-2 py-1 font-mono font-semibold" style={{ backgroundColor: `${s.accent}18`, color: s.text }}>{cur.diff.new}</span>
                          </>
                        ) : (
                          <span className="rounded px-2 py-1 font-mono font-semibold" style={{ backgroundColor: `${s.accent}18`, color: s.text }}>+ {cur.diff.added}</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              {/* progress dots */}
              <div className="mt-3 flex gap-1.5">
                {items.map((_, i) => (
                  <span key={i} className={`h-1 rounded-full transition-all duration-300 ${i === idx ? "w-5 bg-ink" : "w-1.5 bg-ink/20"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------- signal types (two-row marquee) ------------------------- */
const CATEGORIES: { name: string; desc: string }[] = [
  { name: "Price Changes", desc: "A plan’s price goes up or down." },
  { name: "Plan & Bundle Changes", desc: "What’s included in each tier shifts: add-ons, bundling, new or removed plans." },
  { name: "Feature Moves", desc: "A feature gets added, removed, or pushed behind a pricier tier." },
  { name: "Messaging & Positioning Shifts", desc: "Homepage headline, tagline, or “who it’s for” changes." },
  { name: "Release Speed & Focus", desc: "How often they ship, and what themes they’re shipping around." },
  { name: "Hiring Signals", desc: "Spikes in job openings for specific roles." },
  { name: "New Integrations", desc: "Tools they now connect with." },
  { name: "Customer Wins & Losses", desc: "New case studies, review-score shifts, customer-count changes." },
  { name: "Content Themes", desc: "What topics their blog and resources are pushing." },
  { name: "Trust Badges", desc: "New or dropped certifications: SOC 2, ISO, HIPAA, GDPR." },
  { name: "New Markets", desc: "Countries, languages, or regions they now serve." },
  { name: "Public Roadmap Moves", desc: "What they’ve promised is “coming soon.”" },
  { name: "Developer Platform Changes", desc: "New API endpoints, SDKs, or webhook support." },
  { name: "New Partners", desc: "Who’s now listed as a partner or in their marketplace." },
  { name: "Free Tools & Lead Magnets", desc: "New calculators, templates, or freebies for acquiring users." },
  { name: "Pricing Calculator Changes", desc: "How they let you estimate your own cost." },
  { name: "Support Experience Changes", desc: "New support tiers, help-center overhaul, response-time claims." },
  { name: "Policy Changes", desc: "Terms of Service, privacy policy, or cancellation terms." },
  { name: "Event Calendar", desc: "New webinars or events, and who they’re targeting." },
  { name: "Tech Stack Signals", desc: "What technologies they mention in job posts or docs." },
  { name: "Competitor Callouts", desc: "When they start or stop naming you on a comparison page." },
  { name: "Trial & Sign-up Friction", desc: "Trial length, credit-card requirement, free-plan limits." },
  { name: "Logo Wall Changes", desc: "Customer logos added or dropped from the homepage." },
  { name: "Press Mentions", desc: "New “as seen in” media logos." },
  { name: "Limited-Time Offers", desc: "Discount banners and seasonal promos." },
  { name: "AI Feature Claims", desc: "New “powered by AI” or “copilot” messaging." },
  { name: "Community Signals", desc: "New Discord/Slack links, community-size claims." },
  { name: "Showcase Growth", desc: "Templates, examples, or customer galleries expanding." },
  { name: "Time-to-Value Claims", desc: "“Set up in 5 minutes”-style onboarding promises." },
  { name: "Reliability Claims", desc: "Uptime numbers and “enterprise-grade” messaging." },
  { name: "Funding Signals", desc: "New investor badges or “backed by” mentions." },
  { name: "Affiliate Program Changes", desc: "New commission terms or partner tiers." },
  { name: "Accessibility Claims", desc: "New accessibility or inclusive-design statements." },
  { name: "Data Residency Options", desc: "Where they say your data is stored and hosted." },
  { name: "New Product Lines", desc: "Entirely new products or modules launched." },
];

// Rotating accent palette (accent / pastel bg / bold text) for the category cards.
const CAT_PALETTE: { accent: string; bg: string; text: string }[] = [
  { accent: "#F97316", bg: "#FFE8D6", text: "#C2410C" },
  { accent: "#14B8A6", bg: "#CFF3EC", text: "#0F766E" },
  { accent: "#EC4899", bg: "#FBDCEC", text: "#BE185D" },
  { accent: "#EAB308", bg: "#FAEEC4", text: "#A16207" },
  { accent: "#3B82F6", bg: "#DBE8FE", text: "#1D4ED8" },
  { accent: "#10B981", bg: "#D0F2E1", text: "#047857" },
  { accent: "#6366F1", bg: "#E4E4FB", text: "#4338CA" },
  { accent: "#8B5CF6", bg: "#EDE4FE", text: "#6D28D9" },
  { accent: "#F43F5E", bg: "#FFE0E6", text: "#BE123C" },
  { accent: "#06B6D4", bg: "#CFF3F7", text: "#0E7490" },
];

// One distinct icon per category, in CATEGORIES order.
const CAT_ICONS: LucideIcon[] = [
  Tag, Package, Layers, Megaphone, Rocket, UserPlus, Plug, Trophy, FileText,
  ShieldCheck, Globe, Map, Code, Users, Gift, Calculator, Headphones, Scale,
  Calendar, Cpu, Target, LogIn, Building2, Newspaper, Percent, Sparkles,
  MessageSquare, LayoutGrid, Timer, Activity, Banknote, Share2, Eye, Database, Boxes,
];

function CatCard({ name, desc, i }: { name: string; desc: string; i: number }) {
  const s = CAT_PALETTE[i % CAT_PALETTE.length];
  const Icon = CAT_ICONS[i % CAT_ICONS.length];
  return (
    <div className="group relative flex h-[132px] w-[320px] shrink-0 flex-col overflow-hidden rounded-xl2 border border-white/50 bg-white/25 p-5 shadow-soft backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:bg-white/35">
      {/* glass sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm ring-1 ring-white/60 transition-transform duration-200 group-hover:scale-105" style={{ color: s.accent }}>
          <Icon size={16} />
        </span>
        <h3 className="text-[15.5px] font-extrabold leading-tight text-ink">{name}</h3>
      </div>
      <p className="relative mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink/70">{desc}</p>
    </div>
  );
}

function SignalTypes() {
  const half = Math.ceil(CATEGORIES.length / 2);
  const row1 = CATEGORIES.slice(0, half);
  const row2 = CATEGORIES.slice(half);
  return (
    <section id="how" className="bg-mint py-20">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          {CATEGORIES.length} signal types <span className="text-faint">({CATEGORIES.length})</span>
        </p>
        <h2 className="mt-4 text-section font-extrabold uppercase text-ink">35 kinds of change.<br /> One feed.</h2>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
          From a $2 price bump to a new SOC 2 badge, Scout classifies 35 kinds of public change, so nothing a competitor does in the open slips past you.
        </p>
      </div>

      {/* two auto-scrolling rows: top drifts right, bottom drifts left; hover pauses.
          Constrained to the same content width as the rest of the page. */}
      <div className="relative mx-auto mt-10 max-w-[1240px] space-y-4 px-5 lg:px-8">
        <div className="overflow-hidden py-1">
          <div className="marquee-r flex w-max gap-4 hover:[animation-play-state:paused]" style={{ animationDuration: "95s" }}>
            {[...row1, ...row1].map((c, i) => <CatCard key={`r1-${i}`} name={c.name} desc={c.desc} i={i % row1.length} />)}
          </div>
        </div>
        <div className="overflow-hidden py-1">
          <div className="marquee-l flex w-max gap-4 hover:[animation-play-state:paused]" style={{ animationDuration: "105s" }}>
            {[...row2, ...row2].map((c, i) => <CatCard key={`r2-${i}`} name={c.name} desc={c.desc} i={(i % row2.length) + half} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------- stats ------------------------- */
const STATS: { value: string; label: string; caption: string; Icon: LucideIcon }[] = [
  { value: "6", label: "Signal types, one feed", caption: "More signal types means fewer blind spots.", Icon: Layers },
  { value: "5", label: "Page types, auto-found", caption: "Pricing, careers, trust and more, discovered for you with no URL hunting.", Icon: Map },
  { value: "1-line", label: "Plain-English summary", caption: "Every change explained in a sentence, not a raw diff.", Icon: Sparkles },
  { value: "0", label: "Manual checks", caption: "Scout watches on a schedule, so you never have to look.", Icon: Timer },
];

function Stats() {
  const [active, setActive] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight / 2;
      let best = 0, bestDist = Infinity;
      rowRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const d = Math.abs(center - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setActive(best);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  return (
    <section className="bg-mint py-20">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">What you get</p>
            <h2 className="mt-4 text-section font-extrabold uppercase text-ink">The full picture,<br /> in one place.</h2>
          </div>
          <Link href="/feed" className="rounded-pill border border-ink/25 px-6 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-white">See the feed</Link>
        </div>

        {/* moving spotlight: only the row nearest the viewport center is highlighted */}
        <div className="mt-12 space-y-4">
          {STATS.map((s, i) => {
            const on = active === i;
            const Icon = s.Icon;
            return (
              <div
                key={s.value + s.label}
                ref={(el) => { rowRefs.current[i] = el; }}
                className="grid items-center gap-8 lg:grid-cols-2"
              >
                <div className="flex h-[150px] overflow-hidden rounded-2xl border border-ink/10">
                  <div className={`flex w-1/3 items-center justify-center transition-colors duration-500 ${on ? "bg-teal" : "bg-white/50"}`}>
                    <Icon className={`h-14 w-14 transition-colors duration-500 ${on ? "text-ink" : "text-ink/20"}`} />
                  </div>
                  <div className={`flex w-2/3 flex-col justify-center px-8 transition-colors duration-500 ${on ? "bg-ink" : "bg-transparent"}`}>
                    <div className={`text-[64px] font-extrabold leading-none transition-colors duration-500 ${on ? "text-white" : "text-ink/20"}`}>{s.value}</div>
                    <div className={`mt-1.5 text-[16px] transition-colors duration-500 ${on ? "text-white/70" : "text-ink/30"}`}>{s.label}</div>
                  </div>
                </div>
                <p className={`text-[24px] font-bold leading-snug transition-colors duration-500 ${on ? "text-ink" : "text-ink/30"}`}>{s.caption}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- final CTA ------------------------- */
function FinalCTA() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const go = (e: React.FormEvent) => { e.preventDefault(); router.push(value.trim() ? `/add?q=${encodeURIComponent(value.trim())}` : "/add"); };
  return (
    <section id="pricing" className="bg-mint px-5 pb-20 pt-12">
      <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-xl2 bg-purple px-6 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 cta-texture opacity-40" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/20 blur-3xl" />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-display font-extrabold text-ink">Start tracking a company today</h2>
          <form onSubmit={go} className="mx-auto mt-8 max-w-xl rounded-pill bg-white/40 p-1.5">
            <div className="flex items-center gap-2 rounded-pill bg-white p-2 shadow-card">
              <Search className="ml-3 h-5 w-5 text-faint" />
              <input value={value} onChange={(e) => setValue(e.target.value)} className="flex-1 bg-transparent px-1 py-2.5 text-[15px] text-ink outline-none placeholder:text-faint" placeholder="Paste a company name or URL" />
              <button type="submit" className="rounded-pill bg-ink px-6 py-3 text-[15px] font-bold text-white transition-transform hover:-translate-y-px">Track it</button>
            </div>
          </form>
          <p className="mt-4 text-[13px] text-ink/60">Free while in beta · No credit card required</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------- footer ------------------------- */
function Footer() {
  const links = [
    ["Feed", "/feed"], ["Pricing", "#pricing"], ["How it works", "#how"], ["Privacy", "#"], ["Terms", "#"],
  ];
  return (
    <footer className="bg-mint">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="flex flex-col gap-6 border-t border-ink/10 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-end gap-2">
            <ScoutMark size={22} />
            <span className="text-[18px] font-extrabold tracking-tight text-ink">{BRAND}</span>
            <BetaBadge />
            <span className="text-[14px] text-muted">· Company intelligence</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-muted">
            {links.map(([l, href]) => (
              <Link key={l} href={href} className="flex items-center gap-1.5 transition-colors hover:text-ink">
                {l === "Pricing" ? <PricingLabel /> : l}
              </Link>
            ))}
          </div>
        </div>
        <p className="pb-10 text-[13px] text-faint">© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
      </div>
    </footer>
  );
}
