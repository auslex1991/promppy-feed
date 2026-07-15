import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "promppy_admin";

/**
 * The cookie value a logged-in admin carries: a hash of the configured
 * password (never the password itself). Returns null when ADMIN_PASSWORD is
 * unset — in that state the admin surface is closed, not open.
 */
export function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update(`promppy-admin:${pw}`).digest("hex");
}

export function tokenValid(provided: string | undefined | null): boolean {
  const expected = expectedToken();
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordValid(pw: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Server-component check: is the current request an authenticated admin? */
export async function isAdmin(): Promise<boolean> {
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return tokenValid(c);
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}
