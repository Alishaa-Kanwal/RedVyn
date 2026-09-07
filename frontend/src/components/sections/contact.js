"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiPhone, FiMessageCircle, FiMail, FiMapPin, FiCheck } from "react-icons/fi";
import { cn } from "@/lib/utils";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name."),
  email: z.string().email("Enter a valid email address."),
  subject: z.string().min(3, "Please add a short subject."),
  message: z.string().min(10, "Message should be at least 10 characters."),
});

const CONTACT_INFO = [
  { icon: FiPhone, label: "Call Us", value: process.env.NEXT_PUBLIC_HELPLINE ?? "+92 300 1234567" },
  { icon: FiMessageCircle, label: "WhatsApp", value: process.env.NEXT_PUBLIC_WHATSAPP ?? "+92 300 1234567" },
  { icon: FiMail, label: "Email Us", value: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@redvyn.org" },
  { icon: FiMapPin, label: "Office", value: process.env.NEXT_PUBLIC_OFFICE_ADDRESS ?? "Lahore, Pakistan" },
];

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(contactSchema) });

  // Wire this up to your real backend/API route (e.g. POST /api/contact)
  // once it exists — this just simulates a network round trip for now.
  async function onSubmit(values) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    console.log("Contact form submitted:", values);
    setSubmitted(true);
    reset();
  }

  return (
    <section id="contact" className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">Contact Us</h2>
          <p className="mt-2 text-muted-foreground">We&apos;re here to help you 24/7.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-16">
          <div className="flex flex-col gap-5">
            {CONTACT_INFO.map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Your Name" error={errors.name?.message}>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="Your Name"
                  className={inputClass(errors.name)}
                />
              </Field>
              <Field label="Your Email" error={errors.email?.message}>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="Your Email"
                  className={inputClass(errors.email)}
                />
              </Field>
            </div>

            <Field label="Subject" error={errors.subject?.message}>
              <input
                {...register("subject")}
                type="text"
                placeholder="Subject"
                className={inputClass(errors.subject)}
              />
            </Field>

            <Field label="Your Message" error={errors.message?.message}>
              <textarea
                {...register("message")}
                rows={5}
                placeholder="Your Message"
                className={inputClass(errors.message)}
              />
            </Field>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send Message"}
            </button>

            {submitted && (
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <FiCheck className="h-4 w-4" /> Message sent — we&apos;ll get back to you soon.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="sr-only">{label}</span>
      {children}
      {error && <span className="text-xs font-medium text-primary">{error}</span>}
    </label>
  );
}

function inputClass(error) {
  return cn(
    "w-full rounded-xl border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary",
    error ? "border-primary" : "border-border"
  );
}