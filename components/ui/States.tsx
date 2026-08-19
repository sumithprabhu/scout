import type { ReactNode } from "react";

/** Loading skeleton block (uses the .skeleton shimmer in globals.css). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

/** A stack of card-shaped skeletons for feed loading. */
export function FeedSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card/95 p-4 shadow-card">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 !bg-black/5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3 !bg-black/5" />
              <Skeleton className="h-4 w-3/4 !bg-black/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state with an icon glyph, title, hint, and optional action. */
export function EmptyState({
  icon = "◎",
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-elevated/40 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-pastel text-2xl text-brand-ink">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
