"use client";

import { GuardianShell } from "@/components/dashboard/guardian/guardian-shell";

/**
 * Dev/preview layout for the Guardian dashboard.
 *
 * This route is intentionally separate from the production /dashboard/guardian
 * shell because guardian self-service login is still treated as a preview
 * feature while the backend completes the guardian-facing API surface.
 *
 * The shell reuses the existing ThemeProvider and AuthProvider from the root
 * layout and does not introduce a second theme or fetch wrapper.
 */
export default function GuardianPreviewLayout({ children }) {
  return <GuardianShell>{children}</GuardianShell>;
}
