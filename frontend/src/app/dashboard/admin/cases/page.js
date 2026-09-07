"use client";

import { CasesRegistry } from "@/components/dashboard/cases-registry";

// Admin sees every case but does not raise them — a case belongs to the hospital or
// guardian who needs the blood.
export default function AdminCasesPage() {
  return <CasesRegistry />;
}
