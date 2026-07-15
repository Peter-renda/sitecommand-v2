/**
 * Shared classification for email-provider OAuth failures.
 *
 * When a stored refresh token is revoked or expired the provider's token
 * endpoint replies with `invalid_grant`. That state is permanent — the only
 * fix is for the user to re-run the OAuth connect flow — so the token helpers
 * tag the thrown Error with a recognizable marker. API routes detect the
 * marker and return an actionable "please reconnect" response instead of a
 * generic 500 (which the Link-Emails modal was silently rendering as an empty
 * "No messages found in inbox.").
 *
 * Common causes of invalid_grant: the user revoked access, a password change,
 * ~6-month inactivity, or — for an OAuth app still in "Testing" publishing
 * status — Google's 7-day refresh-token expiry.
 */

export type EmailAuthProvider = "outlook" | "gmail";

const RECONNECT_MARKER = "EMAIL_RECONNECT_REQUIRED";

/** Raw token-endpoint error body indicates a permanently dead refresh token. */
export function isInvalidGrant(body: string): boolean {
  return /invalid_grant/i.test(body);
}

/** Builds an Error flagged so callers can prompt the user to reconnect. */
export function reconnectRequiredError(provider: EmailAuthProvider): Error {
  return new Error(`${RECONNECT_MARKER}:${provider}`);
}

/** True when an error message was produced by reconnectRequiredError. */
export function isReconnectRequired(message: string): boolean {
  return message.includes(RECONNECT_MARKER);
}

/** Extracts the provider from a reconnect-required error message. */
export function reconnectProvider(message: string): EmailAuthProvider | null {
  const m = message.match(/EMAIL_RECONNECT_REQUIRED:(outlook|gmail)/);
  return (m?.[1] as EmailAuthProvider) ?? null;
}

/** User-facing message for an expired/revoked connection. */
export function reconnectMessage(provider: EmailAuthProvider | null): string {
  const label = provider === "outlook" ? "Outlook" : "Gmail";
  return `Your ${label} connection has expired. Please reconnect your account.`;
}
