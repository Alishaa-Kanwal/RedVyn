"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

// Fixed star field inside the track (only rendered/animated in dark mode).
// Hand-placed rather than randomized so they don't jump around on re-render.
const STARS = [
  { top: "22%", left: "16%", size: 2, delay: 0 },
  { top: "60%", left: "10%", size: 1.5, delay: 0.3 },
  { top: "34%", left: "30%", size: 1.5, delay: 0.6 },
  { top: "70%", left: "26%", size: 1, delay: 0.15 },
];

/**
 * A day/night pill toggle built on next-themes. Track color, the star
 * field, the cloud, and the sun/moon glyph all key off `resolvedTheme`, so
 * everything crossfades together on click rather than just swapping an
 * icon. A one-shot diagonal sheen replays across the track on every toggle
 * for a bit of snap.
 *
 * Renders a static placeholder until mounted to avoid a hydration
 * mismatch (the server doesn't know the client's stored theme yet).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 w-16 rounded-full bg-muted" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      whileTap={{ scale: 0.93 }}
      className="relative h-8 w-16 overflow-hidden rounded-full border border-border shadow-inner"
      animate={{
        background: isDark
          ? "linear-gradient(135deg, #0c0c14, #181826)"
          : "linear-gradient(135deg, #cfeaff, #eef8ff)",
      }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {/* twinkling stars, dark mode only */}
      <AnimatePresence>
        {isDark &&
          STARS.map((star, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0.35, 1], scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                opacity: { duration: 2, repeat: Infinity, repeatType: "mirror", delay: star.delay },
                scale: { duration: 0.3 },
              }}
              className="absolute rounded-full bg-white"
              style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
            />
          ))}
      </AnimatePresence>

      {/* drifting cloud, light mode only */}
      <AnimatePresence>
        {!isDark && (
          <motion.svg
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 0.9, x: [0, 3, 0] }}
            exit={{ opacity: 0, x: -6 }}
            transition={{
              opacity: { duration: 0.4 },
              x: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            }}
            viewBox="0 0 24 24"
            className="absolute bottom-1 left-1.5 h-3 w-5 text-white"
            fill="currentColor"
          >
            <path d="M6 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 15 8.06 4.5 4.5 0 0 1 18 18H6Z" />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* one-shot sheen that sweeps across the track on every toggle */}
      <motion.span
        key={resolvedTheme}
        initial={{ x: "-120%", opacity: 0.5 }}
        animate={{ x: "220%", opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 skew-x-[-20deg] bg-white/40"
      />

      {/* sliding knob carrying the sun/moon glyph */}
      <motion.span
        animate={{ left: isDark ? 36 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute top-1 flex h-6 w-6 items-center justify-center rounded-full"
        style={{
          background: isDark
            ? "radial-gradient(circle at 35% 30%, #ffffff, #e7e7f0 65%, #c7c7d8)"
            : "radial-gradient(circle at 35% 30%, #fff6c0, #ffd24c 60%, #ff9d1f)",
          boxShadow: isDark
            ? "0 0 10px 2px hsl(var(--primary) / 0.45)"
            : "0 0 12px 3px rgba(255, 170, 40, 0.55)",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.svg
              key="moon"
              initial={{ rotate: -100, opacity: 0, scale: 0.4 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 100, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.4, ease: "backOut" }}
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              style={{ color: "hsl(var(--primary))" }}
              fill="currentColor"
            >
              <path d="M20.742 13.045a8.088 8.088 0 0 1-2.077.273c-4.508 0-8.16-3.653-8.16-8.16 0-1.313.312-2.554.865-3.653a.75.75 0 0 0-.978-1.007A10.5 10.5 0 1 0 22.5 15.75a.75.75 0 0 0-1.007-.978c-.235.11-.478.202-.751.273Z" />
            </motion.svg>
          ) : (
            <motion.svg
              key="sun"
              initial={{ rotate: 100, opacity: 0, scale: 0.4 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -100, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.4, ease: "backOut" }}
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-amber-600"
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="5" />
              <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </g>
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>
    </motion.button>
  );
}