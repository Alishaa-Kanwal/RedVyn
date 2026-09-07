"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FiZap, FiUserCheck, FiActivity, FiGlobe } from "react-icons/fi";
import { useInView } from "@/hooks/use-in-view";
import { AuthLink } from "@/components/auth-link";

const FEATURES = [
  {
    icon: FiZap,
    title: "Faster Response",
    desc: "Reach eligible donors in minutes during critical situations.",
  },
  {
    icon: FiUserCheck,
    title: "Verified Donors",
    desc: "We verify and confirm donors before connecting.",
  },
  {
    icon: FiActivity,
    title: "Real-Time Updates",
    desc: "Track case progress in real-time on our dashboard.",
  },
  {
    icon: FiGlobe,
    title: "Nationwide Network",
    desc: "Access to thousands of active donors across Pakistan.",
  },
];

export function ForHospitals() {
  const [ref, inView] = useInView({ threshold: 0.2 });

  return (
    <section id="for-hospitals" className="bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
            For Hospitals
          </h2>
          <p className="mt-2 text-muted-foreground">Your trusted partner in saving lives.</p>
        </div>

        <div ref={ref} className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 flex flex-col gap-5 lg:order-1">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground sm:text-base">
                    {feature.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6 }}
            className="order-1 relative h-80 sm:h-[26rem] lg:order-2 lg:-mr-10 lg:h-[30rem] xl:-mr-20"
          >
            <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/40 bg-white/20 shadow-xl backdrop-blur-md">
              <Image
                src="/doctor.png"
                alt="Doctor caring for a young patient in a hospital bed"
                fill
                className="object-contain object-bottom"
                priority
              />
            </div>
          </motion.div>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-3xl bg-primary px-6 py-8 sm:px-10">
          <div className="flex flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
            <p className="text-lg font-semibold text-white sm:text-xl">
              Partner with RedVyn and never face a blood shortage again.
            </p>
            <AuthLink
              href="/dashboard"
              fallback="/auth/signup?role=hospital"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary shadow-md transition-transform hover:-translate-y-0.5"
            >
              Partner With Us →
            </AuthLink>
          </div>
        </div>
      </div>
    </section>
  );
}