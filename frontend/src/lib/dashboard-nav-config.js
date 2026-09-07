import {
  LayoutDashboard,
  Briefcase,
  AlertCircle,
  Droplet,
  Users,
  Building2,
  Phone,
  CalendarDays,
  FileText,
  Settings,
} from "lucide-react";

/**
 * Dashboard navigation config per role.
 */
export const NAV = {
  admin: [
    { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/admin/cases", label: "Cases", icon: Briefcase },
    { href: "/dashboard/admin/emergency", label: "Emergency", icon: AlertCircle },
    { href: "/dashboard/admin/donors", label: "Donors", icon: Droplet },
    { href: "/dashboard/admin/patients", label: "Patients", icon: Users },
    { href: "/dashboard/admin/hospitals", label: "Hospitals", icon: Building2 },
    { href: "/dashboard/admin/calls", label: "Calls", icon: Phone },
    { href: "/dashboard/admin/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/dashboard/admin/reports", label: "Reports", icon: FileText },
    { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
  ],
  donor: [
    { href: "/dashboard/donor", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/donor/offers", label: "My Offers", icon: Droplet },
    { href: "/dashboard/donor/settings", label: "Settings", icon: Settings },
  ],
  guardian: [
    { href: "/dashboard/guardian", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/guardian/patients", label: "My Patients", icon: Users },
    { href: "/dashboard/guardian/cases", label: "My Cases", icon: Briefcase },
    { href: "/dashboard/guardian/settings", label: "Settings", icon: Settings },
  ],
  hospital: [
    { href: "/dashboard/hospital", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/hospital/cases", label: "Cases", icon: Briefcase },
    { href: "/dashboard/hospital/patients", label: "Patients", icon: Users },
    { href: "/dashboard/hospital/donors", label: "Donors", icon: Droplet },
    { href: "/dashboard/hospital/settings", label: "Settings", icon: Settings },
  ],
};

export function navForRole(role) {
  return NAV[role] || NAV.donor;
}
