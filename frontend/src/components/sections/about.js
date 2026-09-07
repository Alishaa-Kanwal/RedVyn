"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FiTarget, FiEye, FiHeart, FiAward } from "react-icons/fi";
import { useInView } from "@/hooks/use-in-view";

const VALUES = [
  { icon: FiTarget, title: "Our Mission", desc: "To ensure no patient suffers due to unavailability of blood." },
  { icon: FiEye, title: "Our Vision", desc: "A Pakistan where every patient gets blood on time." },
  { icon: FiHeart, title: "Our Value", desc: "Compassion, trust, transparency." },
  { icon: FiAward, title: "Our Promise", desc: "Right donor. Right time. Real lives." },
];

export function About() {
  const [ref, inView] = useInView({ threshold: 0.2 });

  return (
    <section id="about" className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
              About RedVyn
            </h2>
            <p className="mt-2 text-base font-medium text-primary">
              Built on humanity. Driven by technology.
            </p>
            <p className="mt-5 text-muted-foreground">
              RedVyn is a coordination platform that connects eligible
              donors to patients in need through intelligent matching,
              human calls, and real-time coordination.
            </p>
            <p className="mt-3 font-medium text-foreground">
              We are not a blood bank. We are a bridge between hope and
              help.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="group relative mx-auto flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72"
          >
            <div className="relative h-48 w-48 transition-transform duration-300 group-hover:scale-105 sm:h-64 sm:w-64">
              <Image
                src="/hand-drop.png"
                alt="Hands cupped together holding a glowing blood drop"
                fill
                className="object-contain drop-shadow-[0_0_0px_rgba(220,38,38,0)] transition-all duration-300 group-hover:drop-shadow-[0_0_18px_rgba(220,38,38,0.35)]"
                priority
              />
            </div>
          </motion.div>
        </div>

        <div ref={ref} className="mt-16 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {VALUES.map((value, i) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <value.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">{value.title}</h3>
              <p className="text-xs text-muted-foreground">{value.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="relative mt-16 h-64 overflow-hidden rounded-3xl sm:h-72">
          <Image
            src="/family.png"
            alt="A couple watching the sunset together, holding a heart-shaped balloon"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <p className="absolute bottom-8 left-8 max-w-md text-lg font-medium text-white sm:text-xl">
            Together, we can create a healthier, stronger Pakistan.
          </p>
        </div>
      </div>
    </section>
  );
}