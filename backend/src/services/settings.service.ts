import { prisma } from "../db";
import { logEvent } from "./event.service";

const SETTINGS_ID = "singleton";

export type SystemSettingsInput = {
  orgName?: string; orgTagline?: string; primaryContact?: string; email?: string;
  timezone?: string; language?: string; dateFormat?: string; timeFormat?: string; itemsPerPage?: number;
};

export type PreferenceInput = {
  theme?: string; newEmergencyCase?: boolean; donorConfirmed?: boolean; missedCalls?: boolean;
  caseEscalation?: boolean; dailySummary?: boolean; autoLogoutMinutes?: number;
};

export function getSystemSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, orgName: "", orgTagline: "", primaryContact: "", email: "", timezone: "", language: "", dateFormat: "", timeFormat: "" },
  });
}

export async function updateSystemSettings(input: SystemSettingsInput, userId: string) {
  const settings = await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: input,
    create: { id: SETTINGS_ID, orgName: input.orgName ?? "", orgTagline: input.orgTagline ?? "", primaryContact: input.primaryContact ?? "", email: input.email ?? "", timezone: input.timezone ?? "", language: input.language ?? "", dateFormat: input.dateFormat ?? "", timeFormat: input.timeFormat ?? "", itemsPerPage: input.itemsPerPage ?? 10 },
  });
  await logEvent("settings.updated", { userId });
  return settings;
}

export function getUserPreference(userId: string) {
  return prisma.userPreference.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function updateUserPreference(userId: string, input: PreferenceInput) {
  const preference = await prisma.userPreference.upsert({ where: { userId }, update: input, create: { userId, ...input } });
  await logEvent("settings.updated", { userId });
  return preference;
}
