/**
 * Better Auth for THIS app (server-only): email/password sign-in, sessions in
 * the app's own Postgres (PGLite locally), cookies on the app's own origin.
 *
 * Deployed, it needs three env vars:
 *   - `DATABASE_URL`         the Postgres connection string
 *   - `BETTER_AUTH_SECRET`   a long random string (signs cookies/tokens)
 *   - `BETTER_AUTH_URL`      the public origin, e.g. https://actionbox.example.com
 * Without the last two a real deployment refuses to start (see below) instead
 * of issuing sessions that break across server instances.
 *
 * NEVER import this from client code — it pulls in `pg` and server-only Better
 * Auth internals. The client uses `@/lib/auth/client`; components read the user
 * via `@/lib/auth/use-current-user`; server functions get a verified id via
 * `@/lib/auth/middleware`.
 */
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled, emailAndPasswordOptions } from "./email-password";
import { pgliteDialect } from "./pglite-dialect";

// Kick (and share) PGLite bootstrap as soon as the auth server module loads.
void ensureDbReady();

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const databaseUrl = env("DATABASE_URL");
const explicitBaseURL = env("BETTER_AUTH_URL");
const explicitSecret = env("BETTER_AUTH_SECRET");

if (databaseUrl && (!explicitSecret || !explicitBaseURL)) {
  throw new Error(
    "[auth] DATABASE_URL is set, so this is a real deployment: BETTER_AUTH_SECRET and BETTER_AUTH_URL must be set too.",
  );
}

/**
 * Local dev secret: must outlive module reloads, because PGLite (and its session
 * rows) lives on `globalThis` — an HMR re-eval must not mint a new secret and
 * invalidate every session mid-dev. Process restart clears both together.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
function localDevSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

// Explicit off-switch: `VITE_AUTH_ENABLED=false` forces auth off (shared dev user,
// local only — `verify.server.ts` refuses it once a real database is configured).
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

/** True when real sign-in is enforced. */
export const authConfigured = !authDisabled;

// Local `npm run dev` / `vite preview`. Browsers may send Origin as any of these
// for the same server — trusting only `localhost` rejects `127.0.0.1` and breaks
// email/password with "Invalid origin".
const LOCAL_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];
const baseURL = explicitBaseURL ?? {
  allowedHosts: ["localhost", "127.0.0.1", "[::1]"],
  protocol: "auto" as const,
  fallback: "http://localhost:8080",
};

// Origins Better Auth accepts on credentialed POSTs (sign-up/sign-in, …).
// Missing entries here surface as FORBIDDEN "Invalid origin".
const trustedOrigins: string[] = explicitBaseURL ? [explicitBaseURL, ...LOCAL_ORIGINS] : LOCAL_ORIGINS;

// Real Postgres when `DATABASE_URL` is set (deployed), else the app's embedded
// PGLite via a Kysely dialect — so Better Auth persists to the SAME DB as app
// data. Schema: `migrations/0001_auth.sql`.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Session token cookie name. */
export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

export const auth = betterAuth({
  baseURL,
  secret: explicitSecret ?? localDevSecret(),
  database,

  // CSRF / origin check for credentialed auth POSTs (email sign-up/sign-in, …).
  trustedOrigins,

  // Cache the session in the short-lived signed `session_data` cookie so reads
  // (incl. the client's `/get-session`) skip the DB — this shrinks the "loading"
  // window and reduces auth flicker.
  session: { cookieCache: { enabled: true, maxAge: 300 } },

  // Email/password (+ reset by email) — options live in `./email-password`.
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true, ...emailAndPasswordOptions } } : {}),

  // `__Host-` prefixed cookies: the browser REFUSES any same-named cookie that
  // carries a `Domain` attribute, so a sibling subdomain cannot "toss" a parent-
  // domain session cookie onto this app. `__Host-` requires Secure +
  // Path=/ + no Domain; Better Auth otherwise uses `__Secure-` (which permits
  // Domain), so we drop its auto prefix (`useSecureCookies: false`) and set
  // Secure + the names ourselves. (Browsers allow Secure cookies on
  // `http://localhost`, so local dev still works.)
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-grok-auth.session_data" },
      account_data: { name: "__Host-grok-auth.account_data" },
      dont_remember: { name: "__Host-grok-auth.dont_remember" },
    },
  },

  plugins: [
    // Accept `Authorization: Bearer <session-token>` as an alternative to the
    // cookie (only when that header is present; the cookie path is unaffected).
    bearer(),

    // Bridges Better Auth's Set-Cookie into TanStack Start responses. MUST be
    // last so it runs after every other plugin's hooks.
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
