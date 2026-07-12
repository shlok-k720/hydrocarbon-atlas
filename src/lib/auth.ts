export const AUTH_SESSION_STORAGE_KEY = "hydrocarbon-auth-session";
export const BROWSER_ID_STORAGE_KEY = "hydrocarbon-browser-id";

export type AuthSession =
  | {
      profileMode: "guest";
      browserId: string;
      username: null;
    }
  | {
      profileMode: "account";
      browserId: string;
      username: string;
    };

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    candidate.profileMode === "guest" &&
    typeof candidate.browserId === "string" &&
    candidate.username === null
  ) {
    return true;
  }

  if (
    candidate.profileMode === "account" &&
    typeof candidate.browserId === "string" &&
    typeof candidate.username === "string"
  ) {
    return true;
  }

  return false;
}

export function buildQuizSearchParams(session: AuthSession) {
  const params = new URLSearchParams({
    profileMode: session.profileMode,
    browserId: session.browserId,
  });

  if (session.profileMode === "account") {
    params.set("username", session.username);
  }

  return params.toString();
}

export function buildQuizIdentityPayload(session: AuthSession) {
  if (session.profileMode === "account") {
    return {
      profileMode: session.profileMode,
      browserId: session.browserId,
      username: session.username,
    };
  }

  return {
    profileMode: session.profileMode,
    browserId: session.browserId,
  };
}

export async function hashPassword(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}