import type { Request, Response } from "express";
import { z } from "zod";
import * as settings from "../../services/settings.service";

export const systemSettingsSchema = z.object({
  orgName: z.string().max(120).optional(), orgTagline: z.string().max(200).optional(), primaryContact: z.string().max(80).optional(),
  email: z.string().email().max(254).or(z.literal("")).optional(), timezone: z.string().max(80).optional(), language: z.string().max(20).optional(),
  dateFormat: z.string().max(30).optional(), timeFormat: z.string().max(10).optional(), itemsPerPage: z.coerce.number().int().min(1).max(100).optional(),
});
export const preferenceSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(), newEmergencyCase: z.boolean().optional(), donorConfirmed: z.boolean().optional(),
  missedCalls: z.boolean().optional(), caseEscalation: z.boolean().optional(), dailySummary: z.boolean().optional(), autoLogoutMinutes: z.coerce.number().int().min(15).max(240).optional(),
});

const frontendGeneralSchema = z.object({
  organizationName: z.string().max(120).optional(),
  organizationTagline: z.string().max(200).optional(),
  primaryContact: z.string().max(80).optional(),
  email: z.string().email().max(254).or(z.literal("")).optional(),
  timezone: z.string().max(80).optional(),
  language: z.string().max(20).optional(),
  dateFormat: z.string().max(30).optional(),
  timeFormat: z.string().max(10).optional(),
  systemTheme: z.enum(["light", "dark", "system"]).optional(),
  itemsPerPage: z.coerce.number().int().min(1).max(100).optional(),
});

const frontendNotificationsSchema = z.object({
  newEmergencyCase: z.boolean().optional(),
  donorConfirmed: z.boolean().optional(),
  missedCalls: z.boolean().optional(),
  caseEscalation: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
});

const frontendSessionsSchema = z.object({
  autoLogoutMinutes: z.coerce.number().int().min(15).max(240).optional(),
  activeSessions: z.coerce.number().int().min(0).optional(),
});

const settingsPayloadSchema = z.object({
  general: frontendGeneralSchema.optional(),
  notifications: frontendNotificationsSchema.optional(),
  sessions: frontendSessionsSchema.optional(),
});

function mapSettingsToFrontend(system: Awaited<ReturnType<typeof settings.getSystemSettings>>, preference: Awaited<ReturnType<typeof settings.getUserPreference>>) {
  return {
    general: {
      organizationName: system.orgName ?? "",
      organizationTagline: system.orgTagline ?? "",
      primaryContact: system.primaryContact ?? "",
      email: system.email ?? "",
      timezone: system.timezone ?? "",
      language: system.language ?? "",
      dateFormat: system.dateFormat ?? "",
      timeFormat: system.timeFormat ?? "",
      systemTheme: (preference.theme as "light" | "dark" | "system") ?? "system",
      itemsPerPage: system.itemsPerPage ?? 10,
    },
    notifications: {
      newEmergencyCase: preference.newEmergencyCase ?? true,
      donorConfirmed: preference.donorConfirmed ?? true,
      missedCalls: preference.missedCalls ?? true,
      caseEscalation: preference.caseEscalation ?? true,
      dailySummary: preference.dailySummary ?? false,
    },
    sessions: {
      autoLogoutMinutes: preference.autoLogoutMinutes ?? 30,
      // Auth is stateless JWT; no session store exists.
      activeSessions: 0,
    },
  };
}

export async function getSettings(req: Request, res: Response) {
  const [system, preference] = await Promise.all([
    settings.getSystemSettings(),
    settings.getUserPreference(req.user!.sub),
  ]);
  res.json(mapSettingsToFrontend(system, preference));
}

export async function patchSettings(req: Request, res: Response) {
  const parsed = settingsPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    res.status(400).json({ error: `${first?.path.join(".") ?? "body"}: ${first?.message}` });
    return;
  }

  const { general, notifications, sessions } = parsed.data;
  const userId = req.user!.sub;

  if (general) {
    await settings.updateSystemSettings(
      {
        orgName: general.organizationName,
        orgTagline: general.organizationTagline,
        primaryContact: general.primaryContact,
        email: general.email,
        timezone: general.timezone,
        language: general.language,
        dateFormat: general.dateFormat,
        timeFormat: general.timeFormat,
        itemsPerPage: general.itemsPerPage,
      },
      userId,
    );
  }

  const preferenceUpdate = {
    ...(general?.systemTheme && { theme: general.systemTheme }),
    ...(notifications && {
      newEmergencyCase: notifications.newEmergencyCase,
      donorConfirmed: notifications.donorConfirmed,
      missedCalls: notifications.missedCalls,
      caseEscalation: notifications.caseEscalation,
      dailySummary: notifications.dailySummary,
    }),
    ...(sessions?.autoLogoutMinutes && { autoLogoutMinutes: sessions.autoLogoutMinutes }),
  };

  if (Object.keys(preferenceUpdate).length > 0) {
    await settings.updateUserPreference(userId, preferenceUpdate);
  }

  const [system, preference] = await Promise.all([
    settings.getSystemSettings(),
    settings.getUserPreference(userId),
  ]);

  res.json(mapSettingsToFrontend(system, preference));
}

export async function getPreferences(req: Request, res: Response) { res.json({ preferences: await settings.getUserPreference(req.user!.sub) }); }
export async function patchPreferences(req: Request, res: Response) { res.json({ preferences: await settings.updateUserPreference(req.user!.sub, req.body) }); }
