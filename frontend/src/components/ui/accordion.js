"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { FiPlus } from "react-icons/fi";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }) {
  return (
    <AccordionPrimitive.Item
      className={cn("rounded-2xl border border-border bg-card", className)}
      {...props}
    />
  );
}

export function AccordionTrigger({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium text-foreground sm:px-6 sm:py-5 sm:text-base",
          className
        )}
        {...props}
      >
        {children}
        <FiPlus
          className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-data-[state=open]:rotate-45"
          aria-hidden="true"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden text-sm text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("px-5 pb-4 sm:px-6 sm:pb-5", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}