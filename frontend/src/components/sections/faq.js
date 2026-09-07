"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { AuthLink } from "@/components/auth-link";

const FAQS = [
  {
    q: "Who can register on RedVyn?",
    a: "Anyone eligible to donate blood, as well as patients and their families, and hospitals looking to coordinate donor outreach.",
  },
  {
    q: "Is my data safe with RedVyn?",
    a: "Yes. Phone numbers and health details are encrypted at rest, access is logged, and donor and patient records are never shown to each other beyond what's needed to coordinate a donation.",
  },
  {
    q: "How does RedVyn match donors?",
    a: "A matching engine ranks eligible, compatible donors by blood group, proximity to the hospital, and reliability history, then reaches out in parallel or in sequence depending on urgency.",
  },
  {
    q: "Is RedVyn a blood bank?",
    a: "No. RedVyn coordinates people, it does not collect, store, test or transport blood. All screening and crossmatching remain the responsibility of the hospital or blood bank.",
  },
  {
    q: "How can hospitals use RedVyn?",
    a: "Hospitals can call our line to raise a case, or use the operations console to track live cases, donor responses, and case status end to end.",
  },
  {
    q: "Is the service free?",
    a: "Yes, RedVyn is free for donors, patients, and families. Partnership terms for hospitals are discussed directly with our team.",
  },
];

export function FAQ() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-muted-foreground">Everything you need to know.</p>
        </div>

        <Accordion type="single" collapsible className="mt-10 flex flex-col gap-3">
          {FAQS.map((item, i) => (
            <AccordionItem
              key={item.q}
              value={`item-${i}`}
              className="rounded-2xl border border-border bg-card px-1 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10"
            >
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-6 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-semibold text-foreground">Still have questions?</p>
            <p className="text-sm text-muted-foreground">We&apos;re here to help.</p>
          </div>
          <AuthLink
            href="/dashboard"
            fallback="/auth/signup"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5"
          >
            Get Started →
          </AuthLink>
        </div>
      </div>
    </section>
  );
}