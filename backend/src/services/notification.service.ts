import { logEvent } from "./event.service";

/**
 * Outreach/notification surface.
 *
 * v1 has no SMS/WhatsApp gateway yet, so every notification is recorded as an
 * Event (the §4.1 message-bus stand-in). When a real gateway lands, only this
 * service changes; callers stay the same.
 */
export async function notifyFallbackBloodBank({
  caseId,
  bloodGroup,
}: {
  caseId: string;
  bloodGroup: string;
}): Promise<void> {
  // In v1 this is a new recipient type logged to the audit trail. A real
  // gateway integration would send to the configured blood-bank contact here.
  await logEvent("notification.fallback_bloodbank", { caseId }, { bloodGroup });
}
