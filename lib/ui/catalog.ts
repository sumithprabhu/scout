/**
 * The full 35-signal catalog — the taxonomy Scout advertises on the landing page
 * AND showcases on a company's detailed overview. Centralized here (was inline in
 * app/page.tsx) so the landing marquee and the company "Signal coverage" grid draw
 * from ONE source of truth.
 *
 * Each entry carries a `group` (for the coverage grid's sections) and, for the six
 * signals the shipped classifier actually produces today, a `core` field naming the
 * backend SignalType. A category with a `core` type "lights up" on a company page
 * the moment a matching SignalEvent is detected; the rest read as "monitoring".
 */
import {
  Tag, Package, Layers, Megaphone, Rocket, UserPlus, Plug, Trophy, FileText,
  ShieldCheck, Globe, Map, Code, Users, Gift, Calculator, Headphones, Scale,
  Calendar, Cpu, Target, LogIn, Building2, Newspaper, Percent, Sparkles,
  MessageSquare, LayoutGrid, Timer, Activity, Banknote, Share2, Eye, Database, Boxes,
  type LucideIcon,
} from "lucide-react";
import type { SignalType } from "@/lib/intel/types";

export type CategoryGroup =
  | "Pricing & Packaging"
  | "Product & Roadmap"
  | "Positioning & Messaging"
  | "Growth & Market"
  | "Trust & Proof"
  | "Community & Support";

export interface Category {
  name: string;
  desc: string;
  group: CategoryGroup;
  /** Set only for the 6 signals the shipped classifier produces today. */
  core?: SignalType;
}

/** Order is load-bearing: CAT_PALETTE and CAT_ICONS are indexed positionally. */
export const CATEGORIES: Category[] = [
  { name: "Price Changes", desc: "A plan’s price goes up or down.", group: "Pricing & Packaging", core: "pricing_change" },
  { name: "Plan & Bundle Changes", desc: "What’s included in each tier shifts: add-ons, bundling, new or removed plans.", group: "Pricing & Packaging" },
  { name: "Feature Moves", desc: "A feature gets added, removed, or pushed behind a pricier tier.", group: "Pricing & Packaging" },
  { name: "Messaging & Positioning Shifts", desc: "Homepage headline, tagline, or “who it’s for” changes.", group: "Positioning & Messaging", core: "positioning_shift" },
  { name: "Release Speed & Focus", desc: "How often they ship, and what themes they’re shipping around.", group: "Product & Roadmap", core: "changelog_entry" },
  { name: "Hiring Signals", desc: "Spikes in job openings for specific roles.", group: "Growth & Market", core: "hiring_spike" },
  { name: "New Integrations", desc: "Tools they now connect with.", group: "Growth & Market", core: "new_integration" },
  { name: "Customer Wins & Losses", desc: "New case studies, review-score shifts, customer-count changes.", group: "Trust & Proof" },
  { name: "Content Themes", desc: "What topics their blog and resources are pushing.", group: "Positioning & Messaging" },
  { name: "Trust Badges", desc: "New or dropped certifications: SOC 2, ISO, HIPAA, GDPR.", group: "Trust & Proof", core: "compliance_change" },
  { name: "New Markets", desc: "Countries, languages, or regions they now serve.", group: "Growth & Market" },
  { name: "Public Roadmap Moves", desc: "What they’ve promised is “coming soon.”", group: "Product & Roadmap" },
  { name: "Developer Platform Changes", desc: "New API endpoints, SDKs, or webhook support.", group: "Product & Roadmap" },
  { name: "New Partners", desc: "Who’s now listed as a partner or in their marketplace.", group: "Growth & Market" },
  { name: "Free Tools & Lead Magnets", desc: "New calculators, templates, or freebies for acquiring users.", group: "Growth & Market" },
  { name: "Pricing Calculator Changes", desc: "How they let you estimate your own cost.", group: "Pricing & Packaging" },
  { name: "Support Experience Changes", desc: "New support tiers, help-center overhaul, response-time claims.", group: "Community & Support" },
  { name: "Policy Changes", desc: "Terms of Service, privacy policy, or cancellation terms.", group: "Trust & Proof" },
  { name: "Event Calendar", desc: "New webinars or events, and who they’re targeting.", group: "Community & Support" },
  { name: "Tech Stack Signals", desc: "What technologies they mention in job posts or docs.", group: "Community & Support" },
  { name: "Competitor Callouts", desc: "When they start or stop naming you on a comparison page.", group: "Positioning & Messaging" },
  { name: "Trial & Sign-up Friction", desc: "Trial length, credit-card requirement, free-plan limits.", group: "Pricing & Packaging" },
  { name: "Logo Wall Changes", desc: "Customer logos added or dropped from the homepage.", group: "Trust & Proof" },
  { name: "Press Mentions", desc: "New “as seen in” media logos.", group: "Trust & Proof" },
  { name: "Limited-Time Offers", desc: "Discount banners and seasonal promos.", group: "Pricing & Packaging" },
  { name: "AI Feature Claims", desc: "New “powered by AI” or “copilot” messaging.", group: "Product & Roadmap" },
  { name: "Community Signals", desc: "New Discord/Slack links, community-size claims.", group: "Community & Support" },
  { name: "Showcase Growth", desc: "Templates, examples, or customer galleries expanding.", group: "Product & Roadmap" },
  { name: "Time-to-Value Claims", desc: "“Set up in 5 minutes”-style onboarding promises.", group: "Positioning & Messaging" },
  { name: "Reliability Claims", desc: "Uptime numbers and “enterprise-grade” messaging.", group: "Positioning & Messaging" },
  { name: "Funding Signals", desc: "New investor badges or “backed by” mentions.", group: "Trust & Proof" },
  { name: "Affiliate Program Changes", desc: "New commission terms or partner tiers.", group: "Growth & Market" },
  { name: "Accessibility Claims", desc: "New accessibility or inclusive-design statements.", group: "Positioning & Messaging" },
  { name: "Data Residency Options", desc: "Where they say your data is stored and hosted.", group: "Trust & Proof" },
  { name: "New Product Lines", desc: "Entirely new products or modules launched.", group: "Product & Roadmap" },
];

/** 10-color rotation, indexed by category position (kept identical to the landing). */
export const CAT_PALETTE: { accent: string; bg: string; text: string }[] = [
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

/** One distinct icon per category, in CATEGORIES order. */
export const CAT_ICONS: LucideIcon[] = [
  Tag, Package, Layers, Megaphone, Rocket, UserPlus, Plug, Trophy, FileText,
  ShieldCheck, Globe, Map, Code, Users, Gift, Calculator, Headphones, Scale,
  Calendar, Cpu, Target, LogIn, Building2, Newspaper, Percent, Sparkles,
  MessageSquare, LayoutGrid, Timer, Activity, Banknote, Share2, Eye, Database, Boxes,
];

/** Section order for the coverage grid. */
export const GROUP_ORDER: CategoryGroup[] = [
  "Pricing & Packaging",
  "Product & Roadmap",
  "Positioning & Messaging",
  "Growth & Market",
  "Trust & Proof",
  "Community & Support",
];

export interface CatalogEntry extends Category {
  index: number;
  accent: string;
  bg: string;
  text: string;
  Icon: LucideIcon;
}

/** CATEGORIES joined with their palette + icon, so consumers get everything at once. */
export const CATALOG: CatalogEntry[] = CATEGORIES.map((c, i) => ({
  ...c,
  index: i,
  ...CAT_PALETTE[i % CAT_PALETTE.length],
  Icon: CAT_ICONS[i % CAT_ICONS.length],
}));

/** Core SignalType -> the catalog entry it "lights up". */
export const CORE_TO_ENTRY: Partial<Record<SignalType, CatalogEntry>> = CATALOG.reduce(
  (acc, e) => {
    if (e.core) acc[e.core] = e;
    return acc;
  },
  {} as Partial<Record<SignalType, CatalogEntry>>
);

export const TOTAL_SIGNALS = CATEGORIES.length;
/** How many of the catalog signals the shipped classifier produces today. */
export const LIVE_SIGNALS = CATEGORIES.filter((c) => c.core).length;
