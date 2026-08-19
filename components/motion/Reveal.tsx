"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-triggered reveal (fade + rise). Fires once when the element enters the
 * viewport. Used to give the landing page motion as you scroll, without being
 * gratuitous. `delay` staggers siblings.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const child: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

/** Staggered container: children with `RevealItem` animate in sequence. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={child}>
      {children}
    </motion.div>
  );
}

/** Word-by-word headline reveal ("slow text appearing"). */
export function AnimatedHeading({ text, className, highlight }: { text: string; className?: string; highlight?: string }) {
  const words = text.split(" ");
  return (
    <motion.h1
      className={className}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
      initial="hidden"
      animate="show"
    >
      {words.map((w, i) => {
        const isHi = highlight && w.replace(/[.,]/g, "") === highlight.replace(/[.,]/g, "");
        return (
          <motion.span
            key={i}
            className="inline-block"
            variants={{ hidden: { opacity: 0, y: 24, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }}
          >
            <span className={isHi ? "bg-gradient-to-r from-brand to-[#9F8CFF] bg-clip-text text-transparent" : undefined}>
              {w}
            </span>
            {i < words.length - 1 && " "}
          </motion.span>
        );
      })}
    </motion.h1>
  );
}
