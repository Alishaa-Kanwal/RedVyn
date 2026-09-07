"use client";

import { Phone, Mail, MessageCircle, HelpCircle } from "lucide-react";

const HELPLINE = process.env.NEXT_PUBLIC_HELPLINE ?? "+92 300 1234567";
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@redvyn.org";

export default function GuardianHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">We are here to help you 24/7.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HelpCard
          icon={Phone}
          title="24/7 Helpline"
          value={HELPLINE}
          href={`tel:${HELPLINE.replace(/\s/g, "")}`}
        />
        <HelpCard
          icon={Mail}
          title="Email Support"
          value={SUPPORT_EMAIL}
          href={`mailto:${SUPPORT_EMAIL}`}
        />
        <HelpCard
          icon={MessageCircle}
          title="WhatsApp"
          value="Coming soon"
          href="#"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">Frequently Asked Questions</h2>
        <ul className="mt-4 space-y-4">
          <Faq question="How do I request blood for my patient?" answer="Tap the red 'I Need Blood' button on the dashboard. Guardian self-service requests are not backend-supported yet, so the button will notify you once the feature ships." />
          <Faq question="Where does the transfusion data come from?" answer="Dates and status are pulled from real case records created by the RedVyn operations team." />
          <Faq question="Can I confirm a donation?" answer="Yes — the operations team will share a family confirmation link with you when a donor is assigned." />
          <Faq question="Who can see this dashboard?" answer="Only the guardian linked to the patient, after signing in with a verified email and password." />
        </ul>
      </div>
    </div>
  );
}

function HelpCard({ icon: Icon, title, value, href }) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="font-semibold text-foreground">{value}</p>
      </div>
    </a>
  );
}

function Faq({ question, answer }) {
  return (
    <li className="flex gap-3">
      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-semibold text-foreground">{question}</p>
        <p className="mt-1 text-xs text-muted-foreground">{answer}</p>
      </div>
    </li>
  );
}
