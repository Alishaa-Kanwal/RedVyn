"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { Navbar } from "@/components/navbar";
import { ParticleWaves } from "./particle-waves";

export function AuthLayout({ children, title, subtitle }) {
  return (
    <>
      <Navbar />
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
        <ParticleWaves />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-block">
              <Logo className="justify-center" />
            </Link>
            <h1 className="mt-6 font-serif text-2xl font-bold text-foreground sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-xl shadow-black/5 backdrop-blur-sm sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </>
  );
}
