import { useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/app-shell";
import { ConsentChecklist, hasAllConsent, NO_CONSENT } from "@/components/consent";
import { Button } from "@/components/ui/button";
import { acceptTerms } from "@/lib/account/server";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useAccountStatus } from "@/lib/query";
import { SITE } from "@/lib/site";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/agree")({
  head: () => ({ meta: [{ title: "약관 동의 · ActionBox" }] }),
  component: Agree,
});

/**
 * Where signed-in people land when they have no agreement on record (social
 * sign-in, or a sign-up whose consent write failed) or the documents changed.
 */
function Agree() {
  const { user, isPending } = useSession();
  const status = useAccountStatus(Boolean(user));
  const qc = useQueryClient();
  const nav = useNavigate();
  const [consent, setConsent] = useState(NO_CONSENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending || (user && status.isPending)) {
    return <main className="grid min-h-dvh place-items-center bg-surface" />;
  }
  if (!user) return <Navigate to="/login" />;
  if (status.data && !status.data.needsConsent) return <Navigate to="/" />;

  const updated = Boolean(status.data?.termsVersion);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await acceptTerms({
        data: { termsVersion: SITE.termsVersion, privacyVersion: SITE.privacyVersion, ageConfirmed: consent.age },
      });
      await qc.invalidateQueries({ queryKey: ["account-status"] });
      await nav({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-10">
      <div className="flex h-13 items-center gap-2">
        <Logo className="size-6" />
        <span className="text-body font-bold tracking-tight">ActionBox</span>
      </div>

      <div className="mt-8">
        <h1 className="text-display font-bold">{updated ? "약관이 바뀌었어요" : "시작하기 전에 확인해 주세요"}</h1>
        <p className="mt-2 text-body text-muted">
          {updated
            ? "바뀐 이용약관과 개인정보 처리방침을 확인하고 동의하면 계속 이용할 수 있어요."
            : "서비스를 이용하려면 아래 항목에 동의가 필요해요."}
        </p>
      </div>

      <div className="mt-7 space-y-4">
        <ConsentChecklist value={consent} onChange={setConsent} />
        {error ? <p className="px-1 text-small text-danger">{error}</p> : null}
        <Button size="lg" className="w-full" disabled={busy || !hasAllConsent(consent)} onClick={() => void submit()}>
          {busy ? "처리 중…" : "동의하고 시작하기"}
        </Button>
      </div>

      <div className="mt-auto space-y-1 pt-10 text-center text-small text-muted">
        {/* Same rule as UserButton: a gate session signs straight back in. */}
        {authEnabled && !hasGateSessionMarker() ? (
          <button type="button" className="hit-area font-semibold" onClick={() => void signOut("/login").catch(() => undefined)}>
            로그아웃
          </button>
        ) : null}
        <p>
          동의하지 않으면{" "}
          <Link to="/settings" className="font-semibold underline underline-offset-2">
            회원 탈퇴
          </Link>
          할 수 있어요.
        </p>
      </div>
    </main>
  );
}
