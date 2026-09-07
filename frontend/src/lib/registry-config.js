import { z } from "zod";

export const BLOOD_GROUPS = [
  { value: "A_POS", label: "A+" },
  { value: "A_NEG", label: "A-" },
  { value: "B_POS", label: "B+" },
  { value: "B_NEG", label: "B-" },
  { value: "AB_POS", label: "AB+" },
  { value: "AB_NEG", label: "AB-" },
  { value: "O_POS", label: "O+" },
  { value: "O_NEG", label: "O-" },
];

export const DONOR_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "opted_out", label: "Opted out" },
  { value: "blocked", label: "Blocked" },
];

export const PATIENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "opted_out", label: "Opted out" },
  { value: "blocked", label: "Blocked" },
];

export const CASE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "matching", label: "Matching" },
  { value: "awaiting_response", label: "Awaiting Response" },
  { value: "partially_filled", label: "Partially Filled" },
  { value: "filled", label: "Filled" },
  { value: "in_progress", label: "In Progress" },
  { value: "confirmed", label: "Confirmed" },
  { value: "closed", label: "Closed" },
  { value: "pending_review", label: "Pending Review" },
  { value: "escalating", label: "Escalating" },
  { value: "broadcasting", label: "Broadcasting" },
  { value: "fallback_bloodbank", label: "Blood Bank Fallback" },
  { value: "unfilled", label: "Unfilled" },
];

export const CASE_TYPES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "emergency", label: "Emergency" },
];

export const LANGUAGES = [
  { value: "ur", label: "Urdu" },
  { value: "en", label: "English" },
];

const coord = z.coerce.number().min(-180).max(180);

export const donorCreateSchema = z.object({
  firstName: z.string().min(1, "Name is required").max(80),
  phone: z.string().min(6, "Phone is too short").max(20),
  bloodGroup: z.enum([
    "A_POS",
    "A_NEG",
    "B_POS",
    "B_NEG",
    "AB_POS",
    "AB_NEG",
    "O_POS",
    "O_NEG",
  ]),
  city: z.string().min(1, "City is required").max(80),
  lat: coord,
  lon: coord,
  language: z.enum(["ur", "en"]),
  lastDonationAt: z.string().optional(),
});

export const patientCreateSchema = z.object({
  firstName: z.string().min(1, "Name is required").max(80),
  guardianPhone: z.string().min(6, "Phone is too short").max(20),
  bloodGroup: z.enum([
    "A_POS",
    "A_NEG",
    "B_POS",
    "B_NEG",
    "AB_POS",
    "AB_NEG",
    "O_POS",
    "O_NEG",
  ]),
  homeHospitalId: z.string().min(1, "Hospital is required"),
  intervalDaysEstimate: z.coerce.number().int().min(7).max(60),
  lastTransfusionAt: z.string().optional(),
});

export const hospitalCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  city: z.string().min(1, "City is required").max(80),
  lat: coord,
  lon: coord,
  deskInfo: z.string().min(1, "Desk info is required").max(200),
});

export const hospitalUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(80).optional(),
  lat: z.coerce.number().min(-180).max(180).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  deskInfo: z.string().min(1).max(200).optional(),
});

// hospitalId is optional on purpose: a hospital caller has it forced to itself, and a
// guardian falls back to the patient's home hospital. Only admin ever picks one.
export const caseCreateSchema = z.object({
  patientId: z.string().min(1, "Choose a patient"),
  hospitalId: z.string().optional(),
  type: z.enum(["scheduled", "emergency"]),
  unitsRequired: z.coerce.number().int().min(1, "At least 1 unit").max(10),
  neededAt: z.string().min(1, "Needed-by time is required"),
  window: z.string().min(1, "Window is required").max(40),
  radiusMeters: z.coerce.number().int().min(1000).max(50000),
});

export function bloodLabel(group) {
  if (!group) return "—";
  return group.replace("_POS", "+").replace("_NEG", "-");
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isOps(role) {
  return role === "admin";
}

export function isAdmin(role) {
  return role === "admin";
}
