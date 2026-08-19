"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { domainOf } from "@/lib/ui/format";

/**
 * A real company logo for the DASHBOARD (never the public landing — see the
 * initials-only Avatar there). Resolves the favicon from the company's domain via
 * Google's favicon service, and falls back to the deterministic initials Avatar if
 * there's no domain or the image fails to load — so a tile is never broken.
 */
export function CompanyLogo({
  name,
  url,
  domain,
  size = 36,
}: {
  name: string;
  url?: string | null;
  domain?: string;
  size?: number;
}) {
  const d = domain ?? domainOf(url);
  const [failed, setFailed] = useState(false);

  if (!d || failed) return <Avatar name={name} size={size} />;

  const inner = Math.round(size * 0.64);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-hairline-light"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${d}&sz=64`}
        alt={`${name} logo`}
        width={inner}
        height={inner}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ objectFit: "contain" }}
      />
    </span>
  );
}
