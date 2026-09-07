"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiMenu, FiX } from "react-icons/fi";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { AuthLink } from "@/components/auth-link";

const LINKS = [
  { href: "#home", label: "Home" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#for-hospitals", label: "For Hospitals" },
  { href: "#about", label: "About Us" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 shadow-sm backdrop-blur-lg border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[76px] sm:px-6 lg:px-8">
        <a href="#home" className="shrink-0">
          <Logo />
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="relative text-sm font-medium text-foreground/80 transition-colors hover:text-primary after:absolute after:-bottom-1 after:left-0 after:h-[1.5px] after:w-0 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 lg:flex">
          <ThemeToggle />
          <AuthLink
            href="/auth/signin"
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            Sign In
          </AuthLink>
          <Button asChild>
            <AuthLink href="/dashboard" fallback="/auth/signup">Get Started</AuthLink>
          </Button>
        </div>

        <div className="flex items-center gap-3 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted"
          >
            <FiMenu className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-[70] flex w-[80%] max-w-sm flex-col bg-card shadow-2xl lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-5 sm:h-[76px]">
                <a href="#home" onClick={() => setOpen(false)}>
                  <Logo />
                </a>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-5 py-6">
                <ul className="flex flex-col gap-1">
                  {LINKS.map((link, i) => (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i + 0.1 }}
                    >
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-xl px-3 py-3.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-primary"
                      >
                        {link.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              <div className="border-t border-border p-5">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * LINKS.length + 0.1 }}
                  className="flex flex-col gap-3"
                >
                  <Button variant="outline" asChild className="w-full" onClick={() => setOpen(false)}>
                    <AuthLink href="/auth/signin">Sign In</AuthLink>
                  </Button>
                  <Button asChild className="w-full" onClick={() => setOpen(false)}>
                    <AuthLink href="/dashboard" fallback="/auth/signup">
                      Get Started
                    </AuthLink>
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
