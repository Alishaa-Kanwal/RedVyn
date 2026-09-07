const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Thin fetch wrapper that always sends/receives JSON and includes credentials
 * so the backend's HTTP-only `redvyn_token` cookie travels with every request.
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  let body = null;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    body = await res.json();
  }

  if (!res.ok) {
    const error = new Error(body?.error || `Request failed with ${res.status}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return { status: res.status, body };
}

export const authApi = {
  me() {
    return apiFetch("/api/auth/me");
  },
  signin(data) {
    // Unified sign-in: admin, donor (email/phone), guardian and hospital (email).
    return apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify(data) });
  },
  signup(data) {
    return apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(data) });
  },
  donorSignup(data) {
    return apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(data) });
  },
  guardianSignup(data) {
    return apiFetch("/api/auth/guardian/register", { method: "POST", body: JSON.stringify(data) });
  },
  hospitalSignup(data) {
    return apiFetch("/api/auth/hospital/register", { method: "POST", body: JSON.stringify(data) });
  },
  signout() {
    return apiFetch("/api/auth/logout", { method: "POST" });
  },
};

/**
 * Planned settings persistence surface.
 *
 * GET /api/settings is expected to return:
 * {
 *   general: { organizationName, organizationTagline, primaryContact, email,
 *             timezone, language, dateFormat, timeFormat, systemTheme, itemsPerPage },
 *   notifications: { newEmergencyCase, donorConfirmed, missedCalls,
 *                    caseEscalation, dailySummary },
 *   sessions: { autoLogoutMinutes, activeSessions }
 * }
 *
 * PATCH /api/settings accepts a partial update of the same shape.
 *
 * TODO: The backend routes do not exist yet. This client is wired against the
 * planned contract; implement the endpoints on the backend before releasing
 * settings persistence.
 */
export const settingsApi = {
  get() {
    return apiFetch("/api/settings");
  },
  update(data) {
    return apiFetch("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
  },
};

/**
 * Case creation, open to hospitals and guardians as well as admin. The backend pins
 * the case to the caller's own hospital / linked patient, so `hospitalId` here is a
 * hint the server is free to overrule — never a way to raise a case against someone else.
 */
export const casesApi = {
  create(data) {
    return apiFetch("/api/cases", { method: "POST", body: JSON.stringify(data) });
  },
  // Dry-run the lineup: who would be paged, before anyone actually is.
  matchPreview({ patientId, hospitalId, radiusMeters }) {
    const q = new URLSearchParams({ patientId });
    if (hospitalId) q.set("hospitalId", hospitalId);
    if (radiusMeters) q.set("radiusMeters", String(radiusMeters));
    return apiFetch(`/api/cases/match-preview?${q}`);
  },
  myPatients() {
    return apiFetch("/api/patients/me");
  },
  // §3.9 closure: the requester types back the code the donor was given at the desk.
  confirm(id, code) {
    return apiFetch(`/api/cases/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },
};

/** The logged-in donor's request inbox. */
export const offersApi = {
  mine() {
    return apiFetch("/api/donors/me/offers");
  },
  respond(id, action, reason = "") {
    return apiFetch(`/api/donors/me/offers/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    });
  },
};

/**
 * The signed-in account's own record. Narrower than /auth/me on purpose: the server
 * decides which fields each role may change, so anything not in its per-role schema is
 * silently rejected rather than saved.
 */
export const profileApi = {
  get() {
    return apiFetch("/api/auth/profile");
  },
  update(data) {
    return apiFetch("/api/auth/profile", { method: "PATCH", body: JSON.stringify(data) });
  },
};
