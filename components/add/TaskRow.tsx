"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export type TaskStatus = "pending" | "running" | "done" | "failed";

/**
 * Live status row for the discovery pipeline — a spinner while running, a
 * checkmark when done, an X on failure. This is where we make the backend's work
 * VISIBLE instead of a blank spinner: each real phase (scrape homepage, classify
 * with Nova) gets its own row that resolves independently.
 */
export function TaskRow({
  status,
  title,
  detail,
  children,
}: {
  status: TaskStatus;
  title: string;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-hairline bg-elevated/70 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <div className="flex-1">
          <div
            className={`text-sm font-medium ${
              status === "pending" ? "text-ink-muted" : "text-ink"
            }`}
          >
            {title}
          </div>
          {detail && <div className="mt-0.5 text-xs text-ink-muted">{detail}</div>}
        </div>
      </div>
      {children && <div className="mt-3 pl-8">{children}</div>}
    </motion.div>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "running") {
    return (
      <span className="flex h-5 w-5 items-center justify-center">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10B981]/15 text-[#10B981]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444]/15 text-[#EF4444]">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return <span className="flex h-5 w-5 items-center justify-center"><span className="h-2 w-2 rounded-full bg-hairline" /></span>;
}
