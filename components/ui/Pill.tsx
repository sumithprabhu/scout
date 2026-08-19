import type { ReactNode } from "react";
import { signalStyle, statusStyle, type SignalStyle } from "@/lib/ui/signals";

/**
 * Soft pastel-background pill with bold, same-hue-darker text (the Attio status
 * pattern). Never a gray badge. Colors come from inline style so they survive
 * Tailwind purge regardless of which signal is chosen at runtime.
 */
export function Pill({
  style,
  children,
  dot = true,
  size = "sm",
}: {
  style: SignalStyle;
  children?: ReactNode;
  dot?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${
        size === "md" ? "px-3 py-1 text-[13px]" : "px-2.5 py-0.5 text-xs"
      }`}
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {dot && (
        <span
          className="inline-block rounded-full"
          style={{ width: 6, height: 6, backgroundColor: style.accent }}
        />
      )}
      {children ?? style.label}
    </span>
  );
}

export function SignalPill({ type, size = "sm" }: { type: string; size?: "sm" | "md" }) {
  return <Pill style={signalStyle(type)} size={size} />;
}

export function StatusPill({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  return <Pill style={statusStyle(status)} size={size} />;
}
