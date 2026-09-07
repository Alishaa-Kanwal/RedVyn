"use client";

import Link from "next/link";
import { useAuth, dashboardPath } from "@/components/auth-provider";

/**
 * A Link that routes authenticated users to their dashboard and unauthenticated
 * users to the requested auth flow. Used by every CTA on the landing site.
 */
export function AuthLink({ href, fallback, children, ...props }) {
  const { user, loading } = useAuth();

  const destination = !loading && user ? dashboardPath(user.role) : fallback ?? href;

  return (
    <Link href={destination} {...props}>
      {children}
    </Link>
  );
}
