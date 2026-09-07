"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FloatingDots } from "@/components/floating-dots";
import { Button } from "@/components/ui/button";
import { AuthLink } from "@/components/auth-link";

const STATS = [
  { value: "12K+", label: "Active Donors" },
  { value: "3.6K+", label: "Lives Supported" },
  { value: "98%", label: "Response Rate" },
  { value: "24/7", label: "Always On" },
];

const CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Faisalabad",
  "Rawalpindi",
  "Multan",
  "Peshawar",
  "Quetta",
];

const PIN_COUNT = 4;

// Fraction of the visual box's shorter side that pins should steer clear
// of, so they never drift across the drop itself.
const PIN_AVOID_RATIO = 0.34;

// Path to the PNG in /public. Keep the file named exactly blood-drop.png.
const DROP_IMAGE_SRC = "/blood-drop.png";

export function Hero() {
  // One ref per pin, handed to FloatingDots so it can write live dot
  // coordinates straight onto these nodes — created once and stable across
  // re-renders.
  const pinRefs = useRef(
    Array.from({ length: PIN_COUNT }, () => ({ current: null }))
  );

  // Alternate left/right so pins are never all clustered on one side of
  // the drop: even indices are confined to the left half of the box, odd
  // indices to the right half. FloatingDots enforces this as a boundary.
  const pinSides = useMemo(
    () => Array.from({ length: PIN_COUNT }, (_, i) => (i % 2 === 0 ? -1 : 1)),
    []
  );

  return (
    <section id="home" className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      <FloatingDots className="opacity-90" density={65} />
      {/* soft radial wash so text stays readable over the dot field */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_75%)]" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center lg:text-left"
        >
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            ❤ Saving Lives, Together
          </span>
          <h1 className="font-serif text-4xl font-bold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
            Right Donor.
            <br />
            Right Time.
            <br />
            <span className="text-primary">Real Lives.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base text-muted-foreground sm:text-lg lg:mx-0">
            RedVyn connects patients with eligible donors when every minute
            counts.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button size="lg" asChild>
              <AuthLink href="/dashboard" fallback="/auth/signup?role=guardian">
                I Need Blood
              </AuthLink>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <AuthLink href="/dashboard" fallback="/auth/signup?role=donor">
                I Want to Donate →
              </AuthLink>
            </Button>
          </div>
        </motion.div>

        {/* Dedicated network box: its own FloatingDots instance, sized to
            match exactly where the pins live, with pinRefs wired in so a
            handful of its dots literally carry the pins as they drift.
            pinAvoidRatio keeps those dots out of the circle where the drop
            sits; pinSides keeps two of them left of center and two right. */}
        <div className="relative mx-auto h-[34rem] w-[34rem] sm:h-[38rem] sm:w-[38rem]">
          <FloatingDots
            density={55}
            pinRefs={pinRefs.current}
            pinAvoidRatio={PIN_AVOID_RATIO}
            pinSides={pinSides}
          />

          {pinRefs.current.map((r, i) => (
            <MapPin key={i} ref={r} index={i} delay={i * 0.3} />
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.img
              src={DROP_IMAGE_SRC}
              alt="RedVyn blood drop"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 h-96 w-96 object-contain drop-shadow-2xl sm:h-[32rem] sm:w-[32rem]"
            />
          </motion.div>
        </div>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="stats-glow grid grid-cols-2 gap-6 rounded-3xl border border-border bg-card/70 p-6 shadow-xl shadow-black/5 backdrop-blur-md dark:border-primary/30 sm:grid-cols-4 sm:p-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-serif text-2xl font-bold text-primary sm:text-3xl">
                {stat.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes statsGlow {
          0%,
          100% {
            box-shadow: 0 0 0px 0px transparent;
          }
          50% {
            box-shadow: 0 0 40px -6px hsl(var(--primary) / 0.55);
          }
        }
        .dark .stats-glow {
          animation: statsGlow 3.5s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}

/**
 * A pin that rides an actual dot from the network canvas: its top/left are
 * written directly by FloatingDots every frame (via the forwarded ref), so
 * this component never manages its own position — only its look, its
 * visibility, its current city, and its hover choreography.
 *
 * Visibility runs on a self-scheduling loop: fade in, stay for a random
 * few seconds, fade out, wait a random gap, then reappear — like beacons
 * lighting up across the network. Each time it comes back, it also rolls
 * a new city (never repeating the one it just showed), so the label reads
 * differently on every appearance without needing a hover.
 *
 * On appearance: a one-shot radar ping fires automatically and the pin
 * pops in with a springy, slightly overshooting drop-in rather than a
 * flat fade — reads as "a new signal just came online".
 *
 * Hover adds a second, brighter ripple burst and a little wiggle on top
 * of all that.
 */
const MapPin = forwardRef(function MapPin({ index, delay }, ref) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [city, setCity] = useState(
    () => CITIES[Math.floor(Math.random() * CITIES.length)]
  );

  useEffect(() => {
    let toggleId;
    let cancelled = false;

    function nextCity(current) {
      if (CITIES.length <= 1) return CITIES[0];
      let candidate = current;
      while (candidate === current) {
        candidate = CITIES[Math.floor(Math.random() * CITIES.length)];
      }
      return candidate;
    }

    // Self-scheduling show/hide loop. Each call sets the current
    // visibility (rolling a new city on every reveal) and arms its own
    // next flip directly — it never depends on React state to re-run, so
    // nothing external can cancel a pending flip mid-cycle.
    function loop(nextVisible) {
      if (nextVisible) setCity((c) => nextCity(c));
      setVisible(nextVisible);
      const showFor = 2800 + Math.random() * 3200; // 2.8s–6s visible
      const hideFor = 1800 + Math.random() * 3200; // 1.8s–5s hidden
      const wait = nextVisible ? showFor : hideFor;
      toggleId = setTimeout(() => {
        if (!cancelled) loop(!nextVisible);
      }, wait);
    }

    // stagger each pin's very first appearance so they don't sync up
    const initialDelay = setTimeout(() => {
      loop(true);
    }, delay * 1000 + Math.random() * 800);

    return () => {
      cancelled = true;
      clearTimeout(toggleId);
      clearTimeout(initialDelay);
    };
  }, [delay]);

  return (
    // This outer element is intentionally a plain div, not motion.div:
    // FloatingDots writes top/left onto it every frame via `ref`, and it
    // also carries the Tailwind translate-x/y classes that center the pin
    // on that coordinate. A motion.div here would fight that transform
    // (framer-motion writes its own inline transform for animated
    // properties like scale, which overrides the Tailwind one). The fade
    // animation itself lives one level down instead.
    <div
      ref={ref}
      style={{ top: "50%", left: "50%", pointerEvents: visible ? "auto" : "none" }}
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.5, y: visible ? 0 : -8 }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* automatic radar ping whenever the pin comes online */}
        <AnimatePresence>
          {visible && (
            <motion.span
              key={`ping-${city}`}
              initial={{ scale: 0.4, opacity: 0.65 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
            />
          )}
        </AnimatePresence>

        {/* one-shot ripple burst on hover start */}
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0.6 }}
              animate={{ scale: 2.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
            />
          )}
        </AnimatePresence>

        {/* ambient pulsing glow, brighter on hover */}
        <motion.span
          animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0.05, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeInOut" }}
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/50 blur-md transition-all duration-300"
          style={{
            height: hovered ? "3rem" : "2rem",
            width: hovered ? "3rem" : "2rem",
          }}
        />

        {/* city label — visible whenever the pin is, crossfades to a new
            city on every appearance so the change is easy to notice
            without needing to hover */}
        <AnimatePresence mode="wait">
          {visible && (
            <motion.div
              key={city}
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.85 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute -top-[3.1rem] left-1/2 z-30 -translate-x-1/2"
            >
              <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary to-red-950 px-3 py-1.5 shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.7)]">
                <motion.span
                  initial={{ x: "-120%" }}
                  animate={{ x: "220%" }}
                  transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.5, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 skew-x-[-20deg] bg-white/25"
                />
                <span className="relative flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/90" />
                  {city}
                </span>
              </div>
              <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 bg-red-950" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* the pin itself */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, delay, ease: "easeInOut" }}
          whileHover={{ scale: 1.25, rotate: [0, -6, 6, 0] }}
          className="relative"
        >
          <svg width="30" height="38" viewBox="0 0 34 44" fill="none">
            <defs>
              <linearGradient id={`pinGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="#4a0000" />
              </linearGradient>
            </defs>
            <path
              d="M17 0C7.6 0 0 7.6 0 17c0 11.9 14.3 25.7 15 26.3a2.7 2.7 0 0 0 4 0C19.7 42.7 34 28.9 34 17 34 7.6 26.4 0 17 0Z"
              fill={`url(#pinGradient-${index})`}
            />
            {/* glassy highlight for a less flat look than a solid fill */}
            <path
              d="M9 8C11.5 5 14 3.5 17 3.5c1.6 0 3.1.35 4.4 1-2.8-.2-6.4 1-8.6 3.4C10.6 10 9.6 12 9.2 14 8.3 12.3 8 10 9 8Z"
              fill="white"
              opacity="0.25"
            />
            <circle cx="17" cy="17" r="6.5" fill="white" />
            <circle cx="17" cy="17" r="6.5" fill={`url(#pinGradient-${index})`} opacity="0.15" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
});