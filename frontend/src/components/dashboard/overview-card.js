"use client";

/**
 * The stat card the three role overviews share. It was copied into each of them, and each
 * copy was fed `user.donor` / `user.patient` / `user.hospital` — none of which /api/auth/me
 * returns, so every card rendered "—". The pages now fetch their own record; this is just
 * the shell.
 */
export function OverviewCard({ icon: Icon, title, value, loading }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs text-muted-foreground">{title}</p>
      {loading ? (
        <div className="mt-2 h-5 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-1 text-lg font-semibold text-foreground">{value || "—"}</p>
      )}
    </div>
  );
}
