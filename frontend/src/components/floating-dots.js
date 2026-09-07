"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Renders a drifting network of dots connected by lines, entirely in code
 * (no image asset). Built on <canvas> rather than one DOM node per dot,
 * since a few dozen animated absolutely positioned divs would repaint far
 * more expensively than one canvas.
 *
 * Colors are fixed (not read from --primary) so the network stays visible
 * regardless of how light the theme's primary color is set. Dots have a
 * constant soft glow plus an individual twinkle cycle, and occasionally
 * flare brighter like a blinking star.
 *
 * pinRefs (optional): an array of refs to real DOM nodes. On mount, that
 * many particles are flagged as "pin carriers" — drawn bigger and always
 * glowing — and every frame their live x/y (as % of the canvas) is written
 * directly onto the corresponding ref's style.top/left. This lets a parent
 * pin element ride an actual moving dot instead of being placed near an
 * approximate position.
 *
 * pinAvoidRatio (optional, 0–1): when set, pin-carrier particles are kept
 * out of a circular zone at the canvas's center, sized as this fraction of
 * the canvas's shorter side. Used so pins never drift across a centered
 * visual (like a hero illustration) sitting on top of the canvas. Applies
 * only to pin-carrier particles.
 *
 * pinSides (optional): an array parallel to pinRefs. Each entry is -1
 * (confine that pin carrier to the left half of the canvas), 1 (right
 * half), or 0/undefined (no constraint). The centerline acts as a wall —
 * the particle bounces off it like it does the canvas edges — so a pin
 * assigned -1 can drift and bob freely within the left half but never
 * cross to the right, and vice versa. Used to guarantee a balanced spread
 * of pins on both sides of a centered visual rather than leaving it to
 * chance, since slow-drifting particles can otherwise linger on one side
 * for a long stretch.
 */
export function FloatingDots({
  density = 75,
  className = "",
  pinRefs = [],
  pinAvoidRatio = 0,
  pinSides = [],
}) {
  const canvasRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const pinRefsRef = useRef(pinRefs);
  const pinSidesRef = useRef(pinSides);

  useEffect(() => {
    pinRefsRef.current = pinRefs;
  }, [pinRefs]);

  useEffect(() => {
    pinSidesRef.current = pinSides;
  }, [pinSides]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width, height, dpr;
    let particles = [];
    let animationId;
    let frame = 0;
    let cx = 0;
    let cy = 0;
    let avoidRadius = 0;

    function isDark() {
      return document.documentElement.classList.contains("dark");
    }

    // Pushes a particle to just outside the center exclusion circle,
    // preserving its current direction from center (or picking a random
    // one if it's sitting exactly on center).
    function pushOutsideAvoidZone(p) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = dist > 0.001 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
      p.x = cx + Math.cos(angle) * (avoidRadius + 8);
      p.y = cy + Math.sin(angle) * (avoidRadius + 8);
    }

    // Flips a particle's x across the centerline if it's on the wrong
    // side of its assigned half, preserving distance from center (so it
    // stays consistent with the avoid-zone check above).
    function enforceSide(p) {
      if (!p.side) return;
      const dx = p.x - cx;
      if (dx * p.side < 0) p.x = cx + p.side * Math.abs(dx);
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cx = width / 2;
      cy = height / 2;
      avoidRadius = Math.min(width, height) * pinAvoidRatio;

      const count = Math.round((width * height) / (18000 / (density / 55)));
      particles = Array.from({ length: Math.max(24, count) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 1.1,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.008 + Math.random() * 0.016,
        flare: 0,
        flareTarget: 0,
        isPin: false,
        side: 0,
      }));

      // Spread the "pin carrier" particles out so they don't all end up
      // clustered together — pick evenly-spaced indices across the array
      // rather than the first N — and tag each with its assigned side.
      const pinCount = pinRefsRef.current.length;
      const sides = pinSidesRef.current;
      for (let i = 0; i < pinCount; i++) {
        const idx = Math.floor((i + 0.5) * (particles.length / pinCount));
        if (particles[idx]) {
          particles[idx].isPin = true;
          particles[idx].side = sides[i] || 0;
        }
      }

      // Make sure no pin carrier spawns inside the exclusion zone or on
      // the wrong side of its assigned half.
      for (const p of particles) {
        if (!p.isPin) continue;
        if (avoidRadius > 0) {
          const dist = Math.hypot(p.x - cx, p.y - cy);
          if (dist < avoidRadius) pushOutsideAvoidZone(p);
        }
        enforceSide(p);
      }
    }

    function step() {
      const dark = isDark();
      const dotColor = dark ? "#ff5c5c" : "#7a0f0f";
      const lineColor = dark ? "#ff5c5c" : "#8a1f1f";

      ctx.clearRect(0, 0, width, height);

      const linkDistance = Math.min(150, width / 5);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          // Confine pin carriers to their assigned half: the centerline
          // acts as a wall, same idea as the canvas edges above.
          if (p.isPin && p.side === 1 && p.x < cx) {
            p.x = cx;
            p.vx = Math.abs(p.vx);
          } else if (p.isPin && p.side === -1 && p.x > cx) {
            p.x = cx;
            p.vx = -Math.abs(p.vx);
          }

          // Keep pin carriers out of the center exclusion zone by
          // reflecting them off it like an invisible circular wall.
          if (p.isPin && avoidRadius > 0) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < avoidRadius) {
              const nx = dist > 0.001 ? dx / dist : 1;
              const ny = dist > 0.001 ? dy / dist : 0;
              p.x = cx + nx * avoidRadius;
              p.y = cy + ny * avoidRadius;
              const dot = p.vx * nx + p.vy * ny;
              p.vx -= 2 * dot * nx;
              p.vy -= 2 * dot * ny;
            }
          }

          p.twinklePhase += p.twinkleSpeed;

          const flareChance = p.isPin ? 0.02 : 0.006;
          if (p.flareTarget === 0 && Math.random() < flareChance) {
            p.flareTarget = 1;
          }
          if (p.flareTarget > 0) {
            p.flare += (1 - p.flare) * 0.09;
            if (p.flare > 0.96) p.flareTarget = -1;
          } else if (p.flareTarget < 0) {
            p.flare += (0 - p.flare) * 0.05;
            if (p.flare < 0.04) {
              p.flare = 0;
              p.flareTarget = 0;
            }
          }
        }

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDistance) {
            const base = dark ? 0.32 : 0.26;
            ctx.globalAlpha = (1 - dist / linkDistance) * base;
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const twinkle = 0.5 + 0.5 * Math.sin(p.twinklePhase);
        const baseAlpha = dark ? 0.6 : 0.7;
        const pinBoost = p.isPin ? 0.25 : 0;
        const alpha = Math.min(1, baseAlpha + pinBoost + twinkle * 0.3 + p.flare * 0.5);
        const sizeMult = p.isPin ? 1.8 : 1;
        const radius = p.r * sizeMult * (1 + twinkle * 0.25 + p.flare * 1.1);

        ctx.globalAlpha = alpha;
        ctx.shadowBlur = (dark ? 6 : 3) + (p.isPin ? 6 : 0) + twinkle * 4 + p.flare * 16;
        ctx.shadowColor = dotColor;
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Update pin DOM nodes directly (bypassing React state) every other
      // frame — smooth enough to track drift, cheap enough not to thrash
      // React's render cycle.
      frame++;
      if (frame % 2 === 0) {
        let pinIndex = 0;
        for (const p of particles) {
          if (!p.isPin) continue;
          const ref = pinRefsRef.current[pinIndex];
          if (ref && ref.current) {
            ref.current.style.top = `${(p.y / height) * 100}%`;
            ref.current.style.left = `${(p.x / width) * 100}%`;
          }
          pinIndex++;
        }
      }

      animationId = requestAnimationFrame(step);
    }

    resize();
    step();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [density, reducedMotion, pinAvoidRatio]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}