import { initials, avatarColor } from "@/lib/ui/format";

/** Company logo tile — deterministic pastel color + initials. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const c = avatarColor(name);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: c.bg,
        color: c.text,
        fontSize: size * 0.4,
      }}
    >
      {initials(name)}
    </span>
  );
}
