import type { DiffDetail } from "@/lib/ui/api";
import { renderValue } from "@/lib/ui/format";
import { signalStyle } from "@/lib/ui/signals";

/**
 * Git-diff-style old->new comparison. Struck-through old value in a muted red
 * tone; new value in the SIGNAL's accent color (so the diff is color-coded to
 * the same hue as the pill — reinforcing "orange = pricing" etc.).
 */
export function DiffView({ diff, signalType }: { diff?: DiffDetail; signalType: string }) {
  const changes = diff?.changes ?? [];
  const accent = signalStyle(signalType).accent;

  if (changes.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-ink-muted">
        No structured field-level detail was recorded for this change.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline-light bg-card-2">
      {changes.slice(0, 12).map((c, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(90px,150px)_1fr] gap-3 border-b border-hairline-light px-3 py-2.5 last:border-b-0"
        >
          <div className="truncate font-mono text-[11px] leading-5 text-ink-muted" title={c.path}>
            {c.path || "/"}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {c.op === "added" ? (
              <>
                <OpTag label="added" color={accent} />
                <span className="font-medium" style={{ color: accent }}>
                  {renderValue(c.newValue)}
                </span>
              </>
            ) : c.op === "removed" ? (
              <>
                <OpTag label="removed" color="#B91C1C" />
                <span className="text-[#B91C1C]/80 line-through decoration-[#B91C1C]/40">
                  {renderValue(c.oldValue)}
                </span>
              </>
            ) : (
              <>
                <span className="text-[#B91C1C]/75 line-through decoration-[#B91C1C]/40">
                  {renderValue(c.oldValue)}
                </span>
                <span className="text-ink-muted">→</span>
                <span className="font-semibold" style={{ color: accent }}>
                  {renderValue(c.newValue)}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
      {changes.length > 12 && (
        <div className="px-3 py-2 text-[11px] text-ink-muted">
          +{changes.length - 12} more field changes
        </div>
      )}
    </div>
  );
}

function OpTag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {label}
    </span>
  );
}
