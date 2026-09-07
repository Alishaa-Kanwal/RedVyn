"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FiShield,
  FiHeart,
  FiClock,
  FiDroplet,
  FiGlobe,
  FiUserPlus,
  FiCheckCircle,
  FiActivity,
  FiUsers,
} from "react-icons/fi";
import { useInView } from "@/hooks/use-in-view";
import { AuthLink } from "@/components/auth-link";

const TRUST_FEATURES = [
  { icon: FiShield, title: "Secure & Private", desc: "Your data is encrypted and protected." },
  { icon: FiHeart, title: "Human First", desc: "Real people. Real calls. Real care." },
  { icon: FiClock, title: "Always On", desc: "24/7 coordination for emergencies." },
  { icon: FiDroplet, title: "Save Lives", desc: "Your timely help becomes new life." },
  { icon: FiGlobe, title: "Nationwide Impact", desc: "Building a stronger, healthier Pakistan." },
];

const STEPS = [
  { icon: FiUserPlus, title: "Register", desc: "Sign up as a donor, patient or hospital." },
  { icon: FiCheckCircle, title: "Verify", desc: "We verify your details for safety." },
  { icon: FiActivity, title: "Match", desc: "Our system matches the right donor." },
  { icon: FiUsers, title: "Connect", desc: "We contact & confirm with you." },
  { icon: FiHeart, title: "Save Lives", desc: "Your help is our precious life." },
];

// Path to the PNG in /public. Keep the file named exactly quote-banner.png.
const QUOTE_BANNER_SRC = "/quote-banner.png";

// A hand-rolled four-point "shine" sparkle (not a five-point react-icons
// star) so it reads as a twinkle rather than a rating star.
function Sparkle({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c.9 5.6 1.4 6.1 7 7-5.6.9-6.1 1.4-7 7-.9-5.6-1.4-6.1-7-7 5.6-.9 6.1-1.4 7-7Z" />
    </svg>
  );
}

export function HowItWorks() {
  const [gridRef, gridInView] = useInView({ threshold: 0.2 });
  const [stepsRef, stepsInView] = useInView({ threshold: 0.2 });

  // Drives the sequential "chase" glow on the process-step circles.
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="how-it-works" className="bg-background">
      {/* Quote banner */}
      <div className="relative mx-4 overflow-hidden rounded-[2rem] bg-card sm:mx-6 lg:mx-8">
        {/* mobile: stacked, no overlay */}
        <div className="flex flex-col sm:hidden">
          <img
            src={QUOTE_BANNER_SRC}
            alt="Child holding a teddy bear, looking out a window"
            className="h-56 w-full object-cover object-right"
          />

          <div className="flex flex-col gap-3 p-6">
            <p className="font-serif text-xl font-medium leading-snug text-foreground">
              <span className="text-primary">❝</span>{" "}
              Because someone cared, I&apos;m still here today.
              <br />
              Thank you. <span className="text-primary">❞</span>
            </p>

            <span className="text-sm font-medium text-muted-foreground">
              — Thalassemia Warrior
            </span>
          </div>
        </div>

        {/* sm and up: image at natural ratio, text flex-centered, 260px left gap */}
        <div className="relative hidden sm:block">
          <img
            src={QUOTE_BANNER_SRC}
            alt="Child holding a teddy bear, looking out a window"
            className="h-auto w-full"
          />

          <div className="absolute inset-0 flex flex-col justify-center gap-5 pl-[260px] pr-6 lg:gap-6">
            <p className="max-w-[360px] font-serif text-2xl font-medium leading-snug text-foreground lg:max-w-[420px] lg:text-4xl">
              <span className="text-primary">❝</span>{" "}
              Because someone cared, I&apos;m still here today.
              <br />
              Thank you. <span className="text-primary">❞</span>
            </p>

            <span className="text-base font-medium text-muted-foreground lg:text-lg">
              — Thalassemia Warrior
            </span>
          </div>
        </div>
      </div>

      {/* Trust features — diamond icon badges on a gentle zig-zag rhythm,
          twin gold sparkles twinkling in on hover. */}
      <div
        ref={gridRef}
        className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-14 px-4 py-20 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-8"
      >
        {TRUST_FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 24 }}
            animate={gridInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: i * 0.1, ease: "easeOut" }}
            className={`group flex flex-col items-center gap-4 text-center ${
              i % 2 === 1 ? "sm:mt-8" : ""
            }`}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 3 + i * 0.3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative h-16 w-16"
            >
              {/* rotated diamond, straightens + lifts on hover */}
              <div className="absolute inset-0 rotate-45 rounded-2xl bg-gradient-to-br from-primary to-red-950 shadow-xl shadow-primary/25 transition-transform duration-500 ease-out group-hover:rotate-0 group-hover:scale-110">
                <div className="absolute inset-[3px] rounded-xl bg-white/10" />
              </div>

              {/* icon stays upright, centered on top of the diamond */}
              <span className="absolute inset-0 flex items-center justify-center text-white">
                <feature.icon className="h-6 w-6 transition-transform duration-500 ease-out group-hover:scale-110" />
              </span>

              {/* larger sparkle, top-right */}
              <motion.span
                animate={{
                  scale: [0.85, 1.15, 0.85],
                  rotate: [0, 12, 0],
                }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="pointer-events-none absolute -right-3 -top-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              >
                <Sparkle className="h-6 w-6 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
              </motion.span>

              {/* smaller sparkle, bottom-left, slightly offset in time */}
              <motion.span
                animate={{
                  scale: [1, 0.7, 1],
                  rotate: [0, -10, 0],
                }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.35,
                }}
                className="pointer-events-none absolute -bottom-2 -left-2 opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
              >
                <Sparkle className="h-4 w-4 text-amber-300 drop-shadow-[0_0_5px_rgba(252,211,77,0.65)]" />
              </motion.span>
            </motion.div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-1 max-w-[9rem] text-xs text-muted-foreground">
                {feature.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Process steps. Sequential chase glow in vivid red. */}
      <div className="mx-auto max-w-6xl px-4 pb-16 text-center sm:px-6 lg:px-8">
        <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
          How RedVyn Works
        </h2>

        <p className="mt-2 text-muted-foreground">
          Simple steps. Real impact.
        </p>

        <div
          ref={stepsRef}
          className="relative mt-12 grid grid-cols-2 gap-y-10 sm:grid-cols-5 sm:gap-4"
        >
          {/* connecting line, desktop only, sits behind the icons */}
          <div className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-border sm:block" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              animate={stepsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.18 }}
              className="relative flex flex-col items-center gap-3"
            >
              <span
                className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background text-primary transition-all duration-700 ease-[cubic-bezier(0.45,0,0.2,1)]"
                style={{
                  transform: i === activeStep ? "scale(1.15)" : "scale(1)",
                  borderColor:
                    i === activeStep ? "rgb(239,68,68)" : undefined,
                  boxShadow:
                    i === activeStep
                      ? "0 0 0 8px rgba(239,68,68,0.14), 0 0 34px 10px rgba(239,68,68,0.65), 0 0 60px 18px rgba(239,68,68,0.25)"
                      : "0 0 0 0 rgba(239,68,68,0)",
                }}
              >
                <step.icon className="h-6 w-6" />
              </span>

              <h3 className="text-sm font-semibold text-foreground">
                {step.title}
              </h3>

              <p className="max-w-[9rem] text-xs text-muted-foreground">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA banner. Instead of sliding the whole wave sideways (which
          reads as a rigid band moving, not water), the path itself
          morphs between several wave states — each anchor point's
          x-position stays fixed while its y (height) rises and falls
          independently over time. That's what makes it look like
          swelling/receding tide rather than one shape scrolling past. */}
      <div className="relative overflow-hidden bg-primary pb-14 pt-24 sm:pt-32">
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="absolute -top-px left-0 h-24 w-full text-background sm:h-32"
          aria-hidden="true"
        >
          <motion.path
            fill="currentColor"
            initial={false}
            animate={{
              d: [
                "M0,45 C130,5 210,10 300,42 C370,66 400,88 480,72 C540,60 560,30 640,38 C760,50 820,95 940,68 C1020,50 1050,15 1150,28 C1260,42 1300,80 1400,60 C1420,56 1430,50 1440,45 L1440,0 L0,0 Z",
                "M0,55 C130,85 210,92 300,58 C370,30 400,12 480,25 C540,40 560,68 640,62 C760,48 820,8 940,35 C1020,48 1050,82 1150,70 C1260,55 1300,18 1400,38 C1420,44 1430,50 1440,55 L1440,0 L0,0 Z",
                "M0,50 C130,20 210,35 300,55 C370,75 400,60 480,45 C540,50 560,48 640,52 C760,65 820,40 940,55 C1020,60 1050,35 1150,48 C1260,60 1300,50 1400,48 C1420,50 1430,50 1440,50 L1440,0 L0,0 Z",
                "M0,45 C130,5 210,10 300,42 C370,66 400,88 480,72 C540,60 560,30 640,38 C760,50 820,95 940,68 C1020,50 1050,15 1150,28 C1260,42 1300,80 1400,60 C1420,56 1430,50 1440,45 L1440,0 L0,0 Z",
              ],
            }}
            transition={{
              duration: 16,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.33, 0.66, 1],
            }}
          />
        </svg>

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <p className="font-serif text-2xl font-bold text-white sm:text-3xl">
            Be someone&apos;s reason to live.
            <br />
            Join RedVyn today.
          </p>

          <AuthLink
            href="/dashboard"
            fallback="/auth/signup"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-primary shadow-lg transition-transform hover:-translate-y-0.5"
          >
            Get Started →
          </AuthLink>
        </div>
      </div>
    </section>
  );
}