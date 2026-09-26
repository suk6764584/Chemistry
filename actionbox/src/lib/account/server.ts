import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { SITE } from "@/lib/site";

export type AccountStatus = {
  needsConsent: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
};

// Housekeeping that the privacy policy promises (expired sessions and reset
// tokens, usage counts older than 35 days). Runs opportunistically, at most
// every 10 minutes per server instance.
const globalRef = globalThis as typeof globalThis & { __lastHousekeeping__?: number };
async function housekeeping() {
  const now = Date.now();
  if (globalRef.__lastHousekeeping__ && now - globalRef.__lastHousekeeping__ < 10 * 60_000) return;
  globalRef.__lastHousekeeping__ = now;
  const sql = await getSql();
  await sql.query(`delete from "session" where "expiresAt" < now()`);
  await sql.query(`delete from "verification" where "expiresAt" < now()`);
  await sql.query(`delete from ai_usage where day < (now() at time zone 'Asia/Seoul')::date - 35`);
}

/** Has the signed-in user agreed to the current terms and privacy policy? */
export const getAccountStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AccountStatus> => {
    const sql = await getSql();
    const rows = await sql.query<{ terms_version: string; privacy_version: string }>(
      `select terms_version, privacy_version from consent_log
       where user_id = $1 order by agreed_at desc limit 1`,
      [context.userId],
    );
    try {
      await housekeeping();
    } catch {
      // Cleanup failing must never block the app.
    }
    const last = rows[0];
    return {
      needsConsent: !last || last.terms_version !== SITE.termsVersion || last.privacy_version !== SITE.privacyVersion,
      termsVersion: last?.terms_version ?? null,
      privacyVersion: last?.privacy_version ?? null,
    };
  });

export const acceptTerms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { termsVersion: string; privacyVersion: string; ageConfirmed: boolean }) => input)
  .handler(async ({ context, data }) => {
    if (data.ageConfirmed !== true) throw new Error("만 14세 이상만 가입할 수 있어요.");
    if (data.termsVersion !== SITE.termsVersion || data.privacyVersion !== SITE.privacyVersion) {
      throw new Error("약관이 새로 바뀌었어요. 화면을 새로고침한 뒤 다시 확인해 주세요.");
    }
    const sql = await getSql();
    await sql.query(
      `insert into consent_log (id, user_id, terms_version, privacy_version, age_confirmed)
       values ($1, $2, $3, $4, true)`,
      [crypto.randomUUID(), context.userId, data.termsVersion, data.privacyVersion],
    );
    return { ok: true as const };
  });

/**
 * 회원 탈퇴: remove everything the user owns, then the account itself
 * (sessions and linked logins cascade with the user row).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { confirm: boolean }) => input)
  .handler(async ({ context, data }) => {
    if (data.confirm !== true) throw new Error("탈퇴 안내를 확인해 주세요.");
    const sql = await getSql();
    const userId = context.userId;
    await sql.query(`delete from items where user_id = $1`, [userId]);
    await sql.query(`delete from ai_usage where user_id = $1`, [userId]);
    await sql.query(`delete from consent_log where user_id = $1`, [userId]);
    await sql.query(`delete from "verification" where "value" = $1`, [userId]);
    await sql.query(`delete from "user" where "id" = $1`, [userId]);
    // Expire the auth cookies in this same response: the signed session cache
    // cookie would otherwise keep vouching for the deleted user for minutes.
    try {
      const { auth } = await import("@/lib/auth/server");
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      if (request) await auth.api.signOut({ headers: request.headers });
    } catch {
      // The client signs out as well; the account is already gone either way.
    }
    return { ok: true as const };
  });

/** Which optional, externally-backed features are configured on this deployment. */
export const getAuthFeatures = createServerFn({ method: "GET" }).handler(async () => {
  const { mailConfigured } = await import("@/lib/mail.server");
  return { passwordResetEmail: mailConfigured() };
});
