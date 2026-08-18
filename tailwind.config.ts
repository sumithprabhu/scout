import type { Config } from "tailwindcss";

/**
 * Design system for the company-intelligence UI.
 *
 * DIRECTION (Attio/Linear/Cron, not Grafana): a deep near-black navy CANVAS with
 * off-white content CARDS floating on top. Accent color is reserved for
 * meaningful data (signal types, status) — never chrome decoration. Signal-type
 * colors themselves live in lib/ui/signals.ts as hex (applied via inline style)
 * so Tailwind's purge can never drop a dynamically-chosen pill color.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/ui/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vibrant LIGHT theme. `canvas` is a soft tinted page background; `card`
        // is pure white floating on it; `ink` is the single dark text color used
        // everywhere. The `ink`/`ink-muted`/`elevated`/`chrome`/`hairline`
        // token names are kept (screens reference them) but now hold light values.
        canvas: "#F4F5FA", // soft cool-white page background
        chrome: "#FFFFFF", // nav/rail — white, with a hairline border
        elevated: "#FFFFFF", // inputs / task rows / subtle surfaces (often /40–/70)
        hairline: "#E4E6EE", // borders/dividers
        "on-dark": "#1B1C22", // (legacy alias) primary text — dark ink
        "on-dark-muted": "#6A6C79", // (legacy alias) secondary text
        card: "#FFFFFF", // content card
        "card-2": "#F3F4F8", // nested/secondary light surface
        ink: "#1B1C22", // primary text
        "ink-muted": "#6A6C79", // secondary text
        "hairline-light": "#ECEDF3", // borders/dividers on cards
        // Brand (purple) — logo, primary buttons, nav highlight ONLY
        brand: "#6E56F0",
        "brand-ink": "#5B44D1",
        "brand-pastel": "#EDE9FF",
        // ---- Scout landing palette (from the provided template; light, minty) ----
        "ink-soft": "#3a4038",
        muted: "#5b6158",
        faint: "#8b9088",
        paper: "#ffffff",
        lime: "#89ff75",
        mint: "#dcedeb",
        "mint-card": "#d9ece4",
        lav: "#e7e3f7",
        teal: "#24eca0",
        purple: {
          DEFAULT: "#bf8efd",
          hover: "#ad74fb",
          line: "#d4caf5",
          deep: "#6a3df0",
        },
        line: "#e3e6e2",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Inter",
          "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem", xl2: "1.5rem", pill: "999px" },
      fontSize: {
        hero: ["clamp(3rem, 7vw, 6rem)", { lineHeight: "0.98", letterSpacing: "-0.03em" }],
        display: ["clamp(2.25rem, 4.5vw, 4rem)", { lineHeight: "1.0", letterSpacing: "-0.025em" }],
        section: ["clamp(2rem, 4vw, 3.5rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
      },
      boxShadow: {
        // Flatter light-theme elevation — cards lean on the hairline border, with
        // just a whisper of shadow (Linear-like), not a floating drop shadow.
        card: "0 1px 2px rgba(17,24,39,0.04)",
        "card-hover": "0 2px 4px rgba(17,24,39,0.05), 0 10px 28px -16px rgba(17,24,39,0.16)",
        pop: "0 8px 30px -14px rgba(31,26,74,0.18)",
        // Softer floating shadow for the Scout landing panels.
        soft: "0 1px 2px rgba(24,30,21,0.04), 0 18px 50px -18px rgba(24,30,21,0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        marquee: "marquee 34s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
