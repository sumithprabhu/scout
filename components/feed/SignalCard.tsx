"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { SignalEventDTO } from "@/lib/ui/api";
import { SignalPill } from "@/components/ui/Pill";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { DiffView } from "./DiffView";
import { severityStyle, signalStyle } from "@/lib/ui/signals";
import { timeAgo } from "@/lib/ui/format";

/**
 * The core feed unit: an off-white card floating on the dark canvas. The Nova
 * one-liner is the HEADLINE (the product's value), with company + signal pill as
 * metadata. A thin left rail in the signal's accent color makes the feed
 * scannable by category at a glance. Expands into the old->new diff.
 */
export function SignalCard({ event, index = 0, domain }: { event: SignalEventDTO; index?: number; domain?: string }) {
  const [open, setOpen] = useState(false);
  const sev = severityStyle(event.severity);
  const accent = signalStyle(event.signalType).accent;
  const hasDiff = (event.diffDetail?.changes?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.25), ease: [0.16, 1, 0.3, 1] }}
      className="group overflow-hidden rounded-2xl border border-hairline-light bg-card shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex">
        {/* signal-colored accent rail */}
        <div className="w-1.5 shrink-0" style={{ backgroundColor: accent }} />
        <button
          onClick={() => hasDiff && setOpen((v) => !v)}
          className={`flex-1 px-5 py-4 text-left ${hasDiff ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="flex items-center gap-2.5">
            <CompanyLogo name={event.companyName ?? "?"} domain={domain} size={28} />
            <Link
              href={`/companies/${event.companyId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-ink hover:text-brand-ink"
            >
              {event.companyName ?? "Unknown"}
            </Link>
            <SignalPill type={event.signalType} />
            <span className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
              <span className="flex items-center gap-1" title={`${sev.label} severity`}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sev.dot }} />
              </span>
              {timeAgo(event.detectedAt)}
              {hasDiff && (
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-ink-muted/70">
                  ▾
                </motion.span>
              )}
            </span>
          </div>
          <p className="mt-2 pr-2 text-[15px] font-medium leading-snug text-ink">{event.summary}</p>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && hasDiff && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-hairline-light bg-card px-4 py-3">
              <DiffView diff={event.diffDetail} signalType={event.signalType} />
              <div className="mt-2.5 flex justify-end">
                <Link
                  href={`/companies/${event.companyId}`}
                  className="text-xs font-semibold text-brand-ink hover:underline"
                >
                  View {event.companyName} →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
