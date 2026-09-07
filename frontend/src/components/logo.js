import { cn } from "@/lib/utils";

/**
 * Recreates the RedVyn wordmark from the brand board in code: "Red" in the
 * brand red, "Vyn" in near-black/near-white depending on theme, with a
 * small blood-drop accent standing in for the heart-shaped V notch. Swap
 * this out for the real logo SVG/PNG whenever it's exported — every call
 * site just imports <Logo />, so the swap is one file.
 */
export function Logo({ className, tagline = false, dark = false }) {
  return (
    <span className={cn("inline-flex flex-col leading-none select-none", className)}>
      <span
        className="flex items-baseline font-serif text-2xl font-bold tracking-tight sm:text-[26px]"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        <span className="text-primary">Red</span>
        <span className={dark ? "text-white" : "text-foreground"}>Vyn</span>
        <DropAccent className="ml-0.5 h-3 w-2.5 translate-y-0.5" />
      </span>
      {tagline && (
        <span
          className={cn(
            "mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] sm:text-[10px]",
            dark ? "text-white/60" : "text-muted-foreground"
          )}
        >
          Right Donor. <span className="text-primary">Real Lives.</span>
        </span>
      )}
    </span>
  );
}

function DropAccent({ className }) {
  return (
    <svg viewBox="0 0 24 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 0C12 0 2 14.5 2 21.5C2 27.3 6.5 32 12 32C17.5 32 22 27.3 22 21.5C22 14.5 12 0 12 0Z"
        fill="currentColor"
        className="text-primary"
      />
    </svg>
  );
}