import { useState, type ReactNode } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { authEnabled, signOut } from "./client";
import { resolveSignInGateState } from "./sign-in-gate";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

/**
 * Auth state components — plain wrappers around `useCurrentUserState()`.
 *
 * With auth on, visitors are signed out until they authenticate — in the sandbox
 * live preview too, which does real sign-in. The shared dev user appears only
 * when auth is disabled (`VITE_AUTH_ENABLED=false`, the shipped default).
 * While the session is still resolving, gates that care about signed-out state
 * render nothing so there's no signed-out flash on hard reload.
 */

/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
export const SIGN_IN_PATH = "/login";

/** Render children only when a user is present (real session, or the disabled-auth dev user). */
export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

/**
 * Render children only once we KNOW the visitor is signed out (`isPending` has
 * cleared and there is no user). Hidden while the session is still loading.
 */
export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

/**
 * Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
 * `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
 * session loading, which feels like a second "Loading…" on /login.
 *
 * Guard routes by waiting out `isPending` first (see `use-current-user`), then
 * render this.
 */
export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function SignInGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const state = resolveSignInGateState({ isPending, hasUser: user !== null });
  if (state === "pending") return null;
  if (state === "signed_in") return <>{children}</>;
  return <>{fallback ?? <RedirectToSignIn />}</>;
}

/**
 * Signed-in identity chip with settings and sign-out. Sign-out is only shown
 * when auth is enabled (the disabled-auth dev user has nothing to sign out of).
 */
export function UserButton() {
  const user = useCurrentUser();
  // Sign-out can take a moment (and can fail when deployed), so the control
  // shows it is working and cannot be fired twice.
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "계정";
  const canSignOut = authEnabled;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="계정 메뉴"
        className="grid size-9 place-items-center overflow-hidden rounded-full bg-surface-3 text-small font-semibold"
      >
        {user.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" className="size-9 object-cover" />
        ) : (
          label.charAt(0).toUpperCase()
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute top-11 right-0 z-50 w-60 rounded-xl bg-surface p-2 shadow-float"
          >
            <p className="truncate px-3 pt-2 pb-1 text-body font-semibold">{label}</p>
            {user.primaryEmail && user.primaryEmail !== label ? (
              <p className="truncate px-3 pb-2 text-small text-muted">{user.primaryEmail}</p>
            ) : null}
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-11 w-full items-center rounded-md px-3 text-body font-medium active:bg-surface-2"
            >
              설정
            </Link>
            {canSignOut && (
              <button
                type="button"
                role="menuitem"
                disabled={signingOut}
                onClick={() => {
                  setSigningOut(true);
                  // Success navigates away; on failure re-enable so it can be retried.
                  void signOut().catch(() => setSigningOut(false));
                }}
                className="h-11 w-full rounded-md px-3 text-left text-body font-medium text-danger active:bg-surface-2 disabled:opacity-50"
              >
                {signingOut ? "로그아웃 중…" : "로그아웃"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
