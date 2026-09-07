"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  User,
  CalendarDays,
  ClipboardList,
  History,
  MessageSquare,
  Trophy,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Guardian preview navigation. These labels intentionally match the Guardian
 * screenshot: Dashboard, My Patient, Upcoming Transfusions, Requests, History,
 * Messages, Milestones, Help Center.
 */
export const GUARDIAN_NAV = [
  { href: "/dashboard/preview/guardian", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/preview/guardian/patient", label: "My Patient", icon: User },
  { href: "/dashboard/preview/guardian/upcoming", label: "Upcoming Transfusions", icon: CalendarDays },
  { href: "/dashboard/preview/guardian/requests", label: "Requests", icon: ClipboardList },
  { href: "/dashboard/preview/guardian/history", label: "History", icon: History },
  { href: "/dashboard/preview/guardian/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/preview/guardian/milestones", label: "Milestones", icon: Trophy },
  { href: "/dashboard/preview/guardian/help", label: "Help Center", icon: HelpCircle },
];

function isActiveRoute(pathname, href, overviewHref) {
  return pathname === href || (href !== overviewHref && pathname.startsWith(`${href}/`));
}

export function GuardianShell({ children }) {
  const { user, loading, signout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/signin?from=/dashboard/preview/guardian");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = user.name || "Guardian";
  const overviewHref = GUARDIAN_NAV[0].href;
  const activeItem =
    GUARDIAN_NAV.find((item) => isActiveRoute(pathname, item.href, overviewHref)) || GUARDIAN_NAV[0];

  async function handleSignout() {
    await signout();
    toast.success("Signed out");
    router.replace("/auth/signin");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="flex flex-col gap-1">
            {GUARDIAN_NAV.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={isActiveRoute(pathname, item.href, overviewHref)}
              />
            ))}
          </ul>
        </nav>

        <div className="border-t border-border p-4">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {resolvedTheme === "dark" ? (
              <>
                <Sun className="h-4 w-4" /> Light mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" /> Dark mode
              </>
            )}
          </button>

          {/* Profile chip */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-2 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">Guardian</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setProfileOpen(false)}
                    className="fixed inset-0 z-40 hidden lg:block"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-2xl border border-border bg-card p-2 shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={handleSignout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Mobile header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/">
            <Logo />
          </Link>
          <div className="w-10" />
        </header>

        <main className="relative flex-1 p-4 sm:p-6 lg:p-8">
          {/* Decorative background accent */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <svg
              className="absolute -right-16 -top-16 h-96 w-96 text-primary/[0.04]"
              viewBox="0 0 200 200"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M-20 200C40 120 100 180 200 60"
                stroke="currentColor"
                strokeWidth="24"
                strokeLinecap="round"
              />
            </svg>
            <svg
              className="absolute -bottom-24 -right-24 h-96 w-96 text-primary/[0.03]"
              viewBox="0 0 200 200"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0 120C60 60 140 180 220 20"
                stroke="currentColor"
                strokeWidth="20"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[78%] max-w-xs flex-col border-r border-border bg-card lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-5">
                <Logo />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-4 py-6">
                <ul className="flex flex-col gap-1">
                  {GUARDIAN_NAV.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 + 0.1 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors",
                          isActiveRoute(pathname, item.href, overviewHref)
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </nav>
              <div className="border-t border-border p-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSignout}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ item, active }) {
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    </li>
  );
}
