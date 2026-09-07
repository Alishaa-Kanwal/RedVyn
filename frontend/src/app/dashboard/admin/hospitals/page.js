"use client";

import { RegistryPage } from "@/components/dashboard/registry-page";
import { HospitalCreateForm, HospitalEditForm } from "@/components/dashboard/registry-forms";
import { formatDate, isAdmin } from "@/lib/registry-config";

const config = {
  title: "Hospitals",
  entityName: "Hospital",
  basePath: "/api/hospitals",
  detailKey: "hospital",
  initialFilters: {},
  canCreate: isAdmin,
  canEdit: isAdmin,
  filters: [
    { key: "q", type: "search", placeholder: "Search hospitals..." },
    { key: "city", type: "text", placeholder: "City" },
  ],
  columns: [
    { key: "name", header: "Name" },
    { key: "city", header: "City/Area" },
    {
      key: "deskInfo",
      header: "Contact",
      render: (item) => item.deskInfo ?? "—",
    },
  ],
  detailTitle: (item) => item.name || "Hospital",
  detailFields: [
    { label: "Name", key: "name" },
    { label: "City", key: "city" },
    { label: "Desk Info", key: "deskInfo" },
    {
      label: "Coordinates",
      render: (item) => `${item.lat ?? "—"}, ${item.lon ?? "—"}`,
    },
    { label: "Created", key: "createdAt", format: formatDate },
  ],
  CreateForm: HospitalCreateForm,
  EditForm: HospitalEditForm,
};

export default function AdminHospitalsPage() {
  return <RegistryPage config={config} />;
}
