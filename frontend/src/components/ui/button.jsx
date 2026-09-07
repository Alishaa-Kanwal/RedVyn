import { cloneElement } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold font-sans transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border border-border bg-transparent text-foreground hover:border-primary hover:text-primary hover:-translate-y-0.5 active:translate-y-0",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        white:
          "bg-white text-primary shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Renders a <button> by default. Pass asChild to instead clone the props
 * onto a single child element (e.g. a Next.js <Link>) so the same styles
 * work as a link.
 */
export function Button({ className, variant, size, asChild = false, children, ...props }) {
  if (asChild) {
    // Minimal "asChild" behavior without a Slot dependency: clone the
    // single child and merge classes/props onto it (e.g. a Next.js <Link>).
    return cloneElement(children, {
      ...props,
      className: cn(buttonVariants({ variant, size }), className, children.props.className),
    });
  }

  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}