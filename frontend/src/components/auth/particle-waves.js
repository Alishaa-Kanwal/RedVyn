"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const PATHS = {
  "top-right": [
    [0.66, -0.06],
    [0.76, 0.14],
    [0.83, 0.32],
    [0.9, 0.48],
    [0.96, 0.62],
    [1.06, 0.74],
  ],

  "bottom-left": [
    [-0.06, 0.27],
    [0.04, 0.44],
    [0.14, 0.58],
    [0.24, 0.74],
    [0.31, 0.88],
    [0.38, 1.06],
  ],
};

function catmullRom(points, t) {
  const n = points.length - 1;

  const scaled = t * n;
  const seg = Math.min(Math.floor(scaled), n - 1);
  const localT = scaled - seg;

  const p0 = points[Math.max(seg - 1, 0)];
  const p1 = points[seg];
  const p2 = points[Math.min(seg + 1, n)];
  const p3 = points[Math.min(seg + 2, n)];

  const t2 = localT * localT;
  const t3 = t2 * localT;

  function axis(i) {
    return (
      0.5 *
      (
        2 * p1[i] +
        (-p0[i] + p2[i]) * localT +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) *
          t2 +
        (-p0[i] +
          3 * p1[i] -
          3 * p2[i] +
          p3[i]) *
          t3
      )
    );
  }

  return {
    x: axis(0),
    y: axis(1),
  };
}

function pointAt(points, width, height, t) {
  const p = catmullRom(
    points,
    Math.min(Math.max(t, 0), 1)
  );

  return {
    x: p.x * width,
    y: p.y * height,
  };
}

function tangentAt(points, width, height, t) {
  const eps = 0.001;

  const a = pointAt(
    points,
    width,
    height,
    Math.max(t - eps, 0)
  );

  const b = pointAt(
    points,
    width,
    height,
    Math.min(t + eps, 1)
  );

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const length = Math.hypot(dx, dy) || 1;

  return {
    nx: -dy / length,
    ny: dx / length,
  };
}

/* -------------------------------------------------------
   PARTICLE TYPES
------------------------------------------------------- */

const TYPE_WEIGHTS = [
  { type: "dark", weight: 0.5 },
  { type: "light", weight: 0.38 },
  { type: "glitter", weight: 0.12 },
];

function pickType() {
  const random = Math.random();

  let accumulated = 0;

  for (const { type, weight } of TYPE_WEIGHTS) {
    accumulated += weight;

    if (random <= accumulated) {
      return type;
    }
  }

  return "dark";
}

/* -------------------------------------------------------
   PARTICLE CREATION
------------------------------------------------------- */

function makeParticles(count) {
  const particles = [];

  for (let i = 0; i < count; i++) {
    const type = pickType();

    const sizeRoll = Math.random();

    const radius =
      type === "glitter"
        ? sizeRoll * 2.5 + 2
        : sizeRoll < 0.25
        ? Math.random() * 0.8 + 0.4
        : sizeRoll < 0.7
        ? Math.random() * 1.3 + 1
        : Math.random() * 2 + 2;

    particles.push({
      progress: Math.random(),

      /*
       * Slower movement produces a calm,
       * elegant flowing effect.
       */
      speed:
        (Math.random() * 0.006 + 0.003) *
        (Math.random() < 0.5 ? 1 : 0.75),

      /*
       * Particles are distributed around
       * the main wave.
       */
      baseOffset:
        (Math.random() * 2 - 1) * 18,

      jitterAmp:
        Math.random() * 2 + 0.5,

      jitterSeed:
        Math.random() * Math.PI * 2,

      /*
       * Slight phase variation.
       */
      wavePhase:
        Math.random() * Math.PI * 2,

      radius,

      seed:
        Math.random() * Math.PI * 2,

      twinkleSpeed:
        Math.random() * 3 + 1.5,

      type,
    });
  }

  return particles;
}

/* -------------------------------------------------------
   SMOOTH WAVE

   This creates the large:

       CREST
          /\
         /  \
        /    \
   ----/------\----
       \      /
        \    /
         \  /
          \/
       TROUGH

   motion that you described.
------------------------------------------------------- */

function waveShape(t, time, particle) {
  /*
   * Lower frequency = longer,
   * smoother crests and troughs.
   */
  const frequency = 2.2;

  /*
   * Height of the wave.
   */
  const amplitude = 42;

  /*
   * Speed at which the wave travels.
   */
  const speed = 0.65;

  const phase =
    t * Math.PI * 2 * frequency -
    time * speed +
    particle.wavePhase * 0.15;

  /*
   * Main large wave.
   */
  const mainWave =
    Math.sin(phase) * amplitude;

  /*
   * Very subtle secondary wave so
   * the particles don't look perfectly
   * computer-generated.
   */
  const secondaryWave =
    Math.sin(
      phase * 0.5 +
        time * 0.35 +
        particle.wavePhase
    ) * 8;

  return mainWave + secondaryWave;
}

/* -------------------------------------------------------
   DRAW STREAM
------------------------------------------------------- */

function drawStream(
  ctx,
  points,
  width,
  height,
  particles,
  time,
  reduced
) {
  for (const particle of particles) {
    /*
     * Move particle forward through the path.
     */
    const t = reduced
      ? particle.progress
      : (
          particle.progress +
          time * particle.speed
        ) % 1;

    /*
     * Base curved path.
     */
    const base = pointAt(
      points,
      width,
      height,
      t
    );

    /*
     * Perpendicular direction.
     *
     * This is what allows the particles
     * to move through the crests and troughs.
     */
    const { nx, ny } = tangentAt(
      points,
      width,
      height,
      t
    );

    /*
     * Main smooth wave displacement.
     */
    const wave = reduced
      ? 0
      : waveShape(
          t,
          time,
          particle
        );

    /*
     * Keep particles distributed around
     * the main wave instead of forming one
     * single line.
     */
    const laneOffset =
      particle.baseOffset * 0.55;

    /*
     * Tiny organic movement.
     */
    const jitter = reduced
      ? 0
      : Math.sin(
          time * 0.8 +
            particle.jitterSeed
        ) * 1.5;

    /*
     * Fade the wave near the endpoints.
     */
    const taper =
      Math.sin(
        Math.max(t, 0.001) *
          Math.PI
      );

    const offset =
      (
        wave +
        laneOffset +
        jitter
      ) * taper;

    /*
     * Final particle position.
     */
    const x =
      base.x +
      nx * offset;

    const y =
      base.y +
      ny * offset;

    /* ---------------------------------------------------
       PARTICLE APPEARANCE
    --------------------------------------------------- */

    let color;
    let glow;
    let opacity;

    if (particle.type === "glitter") {
      const twinkle = reduced
        ? 0.9
        : 0.5 +
          0.5 *
            Math.sin(
              time *
                particle.twinkleSpeed +
                particle.seed
            );

      opacity =
        0.55 +
        twinkle * 0.45;

      color =
        `rgba(255, 210, 210, ${opacity})`;

      glow =
        10 +
        twinkle * 12;
    } else if (particle.type === "light") {
      opacity =
        0.5 +
        0.25 *
          Math.sin(
            time * 0.8 +
              particle.seed
          );

      color =
        `rgba(248, 113, 113, ${opacity})`;

      glow = 5;
    } else {
      opacity =
        0.35 +
        0.2 *
          Math.sin(
            time * 0.6 +
              particle.seed
          );

      color =
        `rgba(153, 27, 27, ${opacity})`;

      glow = 2;
    }

    /*
     * Draw particle.
     */
    ctx.save();

    ctx.shadowColor = color;
    ctx.shadowBlur = glow;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      particle.radius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = color;

    ctx.fill();

    ctx.restore();

    /*
     * White glitter center.
     */
    if (particle.type === "glitter") {
      ctx.beginPath();

      ctx.arc(
        x,
        y,
        particle.radius * 0.35,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(255, 255, 255, 0.9)";

      ctx.fill();
    }
  }
}

/* -------------------------------------------------------
   PARTICLE WAVES COMPONENT
------------------------------------------------------- */

export function ParticleWaves({
  className,
}) {
  const canvasRef = useRef(null);

  const reduced =
    useReducedMotion();

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    let raf = null;

    let width = 0;
    let height = 0;

    let streams = {};

    /* ---------------------------------------------------
       RESIZE
    --------------------------------------------------- */

    function resize() {
      width =
        window.innerWidth;

      height =
        window.innerHeight;

      canvas.width =
        width * dpr;

      canvas.height =
        height * dpr;

      canvas.style.width =
        `${width}px`;

      canvas.style.height =
        `${height}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      /*
       * Keep the exact same corner
       * stream positions.
       */
      streams = {
        "top-right":
          makeParticles(220),

        "bottom-left":
          makeParticles(220),
      };
    }

    /* ---------------------------------------------------
       ANIMATION
    --------------------------------------------------- */

    function draw(timestamp) {
      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      const time =
        timestamp * 0.001;

      drawStream(
        ctx,
        PATHS["top-right"],
        width,
        height,
        streams["top-right"],
        time,
        reduced
      );

      drawStream(
        ctx,
        PATHS["bottom-left"],
        width,
        height,
        streams["bottom-left"],
        time,
        reduced
      );

      if (!reduced) {
        raf =
          requestAnimationFrame(draw);
      }
    }

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    raf =
      requestAnimationFrame(draw);

    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }

      window.removeEventListener(
        "resize",
        resize
      );
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "pointer-events-none fixed inset-0",
        className
      )}
      aria-hidden="true"
    />
  );
}