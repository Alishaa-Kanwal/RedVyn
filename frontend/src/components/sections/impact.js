"use client";

import { motion } from "framer-motion";
import { FiUsers, FiHeart, FiActivity, FiClock, FiHome, FiMapPin } from "react-icons/fi";
import { useInView } from "@/hooks/use-in-view";

const STATS = [
  { icon: FiUsers, value: "12,480+", label: "Active Donors" },
  { icon: FiHeart, value: "3,600+", label: "Lives Supported" },
  { icon: FiActivity, value: "98%", label: "Response Rate" },
  { icon: FiClock, value: "24/7", label: "Service Availability" },
  { icon: FiHome, value: "820+", label: "Hospitals Connected" },
  { icon: FiMapPin, value: "35+", label: "Cities Covered" },
];

export function Impact() {
  const [ref, inView] = useInView({ threshold: 0.15 });

  return (
    <section className="bg-muted/40 py-20">
      {/* max-w keeps this narrower than other sections at rest, but the grid
          itself reflows from 1 -> 2 -> 3 columns so it never feels cramped
          or overly sparse at any viewport width. */}
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">Our Impact</h2>
        <p className="mt-2 text-muted-foreground">Real numbers. Real lives.</p>

        <div ref={ref} className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <stat.icon className="h-5 w-5" />
              </span>
              <span className="font-serif text-xl font-bold text-foreground sm:text-2xl">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground sm:text-sm">{stat.label}</span>
            </motion.div>
          ))}
        </div>

        <blockquote className="mt-10 rounded-2xl border border-primary/15 bg-primary/5 p-6 text-left sm:p-8">
          <p className="font-serif text-lg italic text-foreground sm:text-xl">
            &ldquo;RedVyn reached us in just 15 minutes. They saved my
            child&apos;s life.&rdquo;
          </p>
          <footer className="mt-3 text-sm font-medium text-muted-foreground">
            — Parent of a Thalassemia Patient
          </footer>
        </blockquote>
      </div>
    </section>
  );
}