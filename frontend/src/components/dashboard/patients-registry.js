"use client";

import { RegistryPage } from "./registry-page";
import { PatientCreateForm } from "./registry-forms";
import { StatusPill } from "./status-pill";
import {
  BLOOD_GROUPS,
  PATIENT_STATUSES,
  bloodLabel,
  formatDate,
  isOps,
} from "@/lib/registry-config";

const config = {
  title: "Patients",
  entityName: "Patient",
  basePath: "/api/patients",
  detailKey: "patient",
  initialFilters: {},
  canCreate: isOps,
  canChangeStatus: isOps,
  canReveal: isOps,
  reveal: { type: "guardian", label: "Guardian Phone" },
  statusField: "status",
  statusOptions: PATIENT_STATUSES,
  filters: [
    { key: "q", type: "search", placeholder: "Search patients..." },
    { key: "status", type: "select", label: "Status", options: PATIENT_STATUSES },
    { key: "bloodGroup", type: "select", label: "Blood Group", options: BLOOD_GROUPS },
  ],
  columns: [
    { key: "firstName", header: "Name" },
    {
      key: "bloodGroup",
      header: "Blood Group",
      render: (item) => bloodLabel(item.bloodGroup),
    },
    {
      key: "homeHospital",
      header: "Hospital",
      render: (item) => item.homeHospital?.name ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusPill status={item.status} />,
    },
    {
      key: "guardian",
      header: "Guardian",
      render: (item) => item.guardian?.name ?? "—",
    },
    {
      key: "condition",
      header: "Condition",
      render: (item) => item.condition?.replace(/_/g, " ") ?? "—",
    },
  ],
  detailTitle: (item) => item.firstName || "Patient",
  detailFields: [
    { label: "Name", key: "firstName" },
    { label: "Blood Group", key: "bloodGroup", format: bloodLabel },
    { label: "Condition", key: "condition", format: (v) => v?.replace(/_/g, " ") },
    { label: "Hospital", key: "homeHospital", render: (item) => item.homeHospital?.name ?? "—" },
    {
      label: "Guardian",
      key: "guardian",
      render: (item) =>
        item.guardian ? `${item.guardian.name} · ${item.guardian.email}` : "No guardian account",
    },
    { label: "Interval Days", key: "intervalDaysEstimate" },
    { label: "Last Transfusion", key: "lastTransfusionAt", format: formatDate },
    { label: "Predicted Next", key: "predictedNextAt", format: formatDate },
    { label: "Status", key: "status", render: (item) => <StatusPill status={item.status} /> },
    { label: "Created", key: "createdAt", format: formatDate },
  ],
  CreateForm: PatientCreateForm,
};

/**
 * Shared by admin and hospital. Admin sees every patient; a hospital sees only the
 * patients homed at it — scoped server-side, not by hiding rows here.
 */
export function PatientsRegistry() {
  return <RegistryPage config={config} />;
}
