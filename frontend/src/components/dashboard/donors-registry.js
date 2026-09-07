"use client";

import { RegistryPage } from "./registry-page";
import { DonorCreateForm } from "./registry-forms";
import { StatusPill } from "./status-pill";
import {
  BLOOD_GROUPS,
  DONOR_STATUSES,
  bloodLabel,
  formatDate,
  isOps,
} from "@/lib/registry-config";

const config = {
  title: "Donors",
  entityName: "Donor",
  basePath: "/api/donors",
  detailKey: "donor",
  initialFilters: {},
  canCreate: isOps,
  canChangeStatus: isOps,
  canReveal: isOps,
  reveal: { type: "phone", label: "Phone" },
  statusField: "status",
  statusOptions: DONOR_STATUSES,
  filters: [
    { key: "q", type: "search", placeholder: "Search donors..." },
    { key: "status", type: "select", label: "Status", options: DONOR_STATUSES },
    { key: "bloodGroup", type: "select", label: "Blood Group", options: BLOOD_GROUPS },
    { key: "city", type: "text", placeholder: "City" },
  ],
  columns: [
    { key: "firstName", header: "Name" },
    {
      key: "bloodGroup",
      header: "Blood Group",
      render: (item) => bloodLabel(item.bloodGroup),
    },
    { key: "city", header: "Area/City" },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusPill status={item.status} />,
    },
    {
      key: "reliabilityScore",
      header: "Reliability",
      render: (item) => item.reliabilityScore ?? "—",
    },
  ],
  detailTitle: (item) => item.firstName || "Donor",
  detailFields: [
    { label: "Name", key: "firstName" },
    { label: "Blood Group", key: "bloodGroup", format: bloodLabel },
    { label: "City", key: "city" },
    { label: "Status", key: "status", render: (item) => <StatusPill status={item.status} /> },
    { label: "Reliability Score", key: "reliabilityScore" },
    { label: "Language", key: "language" },
    { label: "Last Donation", key: "lastDonationAt", format: formatDate },
    { label: "Next Eligible", key: "nextEligibleAt", format: formatDate },
    { label: "Created", key: "createdAt", format: formatDate },
  ],
  CreateForm: DonorCreateForm,
};

/**
 * Shared by admin and hospital. The config gates create/status/reveal behind isOps, so a
 * hospital gets the same table read-only — and the backend scopes the rows it returns to
 * donors that have engaged with that hospital's own cases.
 */
export function DonorsRegistry() {
  return <RegistryPage config={config} />;
}
