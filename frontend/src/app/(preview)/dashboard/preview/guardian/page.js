"use client";

import { GuardianDashboard } from "@/components/dashboard/guardian/guardian-dashboard";

/**
 * Dev/preview Guardian dashboard overview.
 *
 * Reachable at /dashboard/preview/guardian. Requires a real guardian login;
 * the shell will redirect to /auth/signin if the user is not authenticated.
 */
export default function GuardianPreviewPage() {
  return <GuardianDashboard />;
}
