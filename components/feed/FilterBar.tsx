"use client";

import { SIGNAL_ORDER, signalStyle } from "@/lib/ui/signals";
import type { CompanyDTO } from "@/lib/ui/api";

/**
 * Filter chips that reuse the SIGNAL palette — the same color that tags a signal
 * in the feed also tints its filter chip, so filtering feels like the same
 * visual language, not a separate control. Company filter is a compact select.
 */
export function FilterBar({
  activeSignal,
  onSignal,
  companies,
  activeCompany,
  onCompany,
  counts,
}: {
  activeSignal: string | null;
  onSignal: (t: string | null) => void;
  companies?: CompanyDTO[];
  activeCompany?: string | null;
  onCompany?: (id: string | null) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Chip active={activeSignal === null} onClick={() => onSignal(null)} accent="#6E56F0" label="All signals" />
      {SIGNAL_ORDER.map((t) => {
        const s = signalStyle(t);
        const n = counts?.[t];
        if (counts && !n) return null; // hide types with no events (when counts provided)
        return (
          <Chip
            key={t}
            active={activeSignal === t}
            onClick={() => onSignal(activeSignal === t ? null : t)}
            accent={s.accent}
            bg={s.bg}
            text={s.text}
            label={n != null ? `${s.label} ${n}` : s.label}
          />
        );
      })}

      {companies && onCompany && (
        <div className="ml-auto">
          <select
            value={activeCompany ?? ""}
            onChange={(e) => onCompany(e.target.value || null)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-sm text-ink outline-none focus:border-brand/60"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  accent,
  bg,
  text,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent: string;
  bg?: string;
  text?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
      style={
        active
          ? { backgroundColor: bg ?? "#EDE9FF", color: text ?? "#5B44D1" }
          : { backgroundColor: "#FFFFFF", color: "#6A6C79", boxShadow: "inset 0 0 0 1px #E4E6EE" }
      }
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      {label}
    </button>
  );
}
