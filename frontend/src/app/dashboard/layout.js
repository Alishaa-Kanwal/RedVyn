"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LogOut,
  Menu,
  X,
  Loader2,
  Search,
  History,
  Bell,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { navForRole } from "@/lib/dashboard-nav-config";
import { cn } from "@/lib/utils";

function isActiveRoute(pathname, href, overviewHref) {
  return pathname === href || (href !== overviewHref && pathname.startsWith(`${href}/`));
}

export default function DashboardLayout({ children }) {
  const { user, loading, signout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/signin");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const role = user.role;
  const items = navForRole(role);
  const overviewHref = items[0].href;
  const activeItem =
    items.find((item) => isActiveRoute(pathname, item.href, overviewHref)) ||
    items[0];
  const displayName = user.name || role;
  const roleLabel = role === "admin" ? "Operations Team" : role;

  async function handleSignout() {
    await signout();
    toast.success("Signed out");
    router.replace("/auth/signin");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — forced dark palette so it stays dark in both themes */}
      <aside className="dark fixed inset-y-0 left-0 z-50 hidden w-64 flex-col bg-background text-foreground lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <Link href="/">
            <Logo dark />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={isActiveRoute(pathname, item.href, overviewHref)}
              />
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{roleLabel}</p>
            </div>
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

        {/* Top bar */}
        <TopBar
          title={activeItem?.label || "Overview"}
          user={user}
          roleLabel={roleLabel}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          onSignout={handleSignout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
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
              className="dark fixed inset-y-0 left-0 z-50 flex w-[78%] max-w-xs flex-col bg-background text-foreground lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
                <Logo dark />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-4 py-6">
                <ul className="flex flex-col gap-1">
                  {items.map((item, i) => (
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
                            : "text-foreground hover:bg-white/10",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </nav>
              <div className="border-t border-white/10 p-4">
                <Button
                  variant="outline"
                  className="w-full border-white/10 text-foreground hover:bg-white/10 hover:text-foreground"
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
            : "text-foreground hover:bg-white/10",
        )}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    </li>
  );
}

function TopBar({ title, user, roleLabel, profileOpen, setProfileOpen, onSignout }) {
  const { resolvedTheme, setTheme } = useTheme();
  const displayName = user?.name || user?.role || "User";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search */}
        <div className="hidden items-center rounded-full border border-border bg-background px-3 py-2 sm:flex">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search here..."
            className="ml-2 w-40 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none lg:w-56"
          />
        </div>

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
        >
          <History className="h-5 w-5" />
        </button>

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </button>

        {/* Profile chip */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-border bg-background p-1 pl-1 pr-3 transition-colors hover:bg-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-foreground">{displayName}</p>
              <p className="text-[10px] capitalize leading-tight text-muted-foreground">{roleLabel}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
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
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-lg"
                >
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">{roleLabel}</p>
                    </div>
                  </div>

                  <div className="my-1 border-t border-border" />

                  <button
                    type="button"
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
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

                  <button
                    type="button"
                    onClick={onSignout}
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
    </header>
  );
}
