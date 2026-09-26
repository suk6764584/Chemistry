import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/app-shell";
import { ConsentChecklist, hasAllConsent, NO_CONSENT } from "@/components/consent";
import { LegalFooter } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useSession } from "@/lib/use-session";
import { useDraftSnapshot } from "@/lib/items/drafts";
import { acceptTerms } from "@/lib/account/server";
import { useAuthFeatures } from "@/lib/query";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/login")({
  // Only known in-app destinations, so this can't become an open redirect.
  // `error` is set by the auth server when a Google sign-in comes back failed;
  // it is only ever mapped to fixed text, never shown as is.
  validateSearch: (s: Record<string, unknown>): { next?: "/settings"; error?: string } => ({
    next: s.next === "/settings" ? "/settings" : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: Login,
});

function socialErrorText(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "account_not_linked") return "이 이메일은 이미 이메일로 가입돼 있어요. 이메일과 비밀번호로 로그인해 주세요.";
  if (code === "access_denied") return "Google 로그인을 취소했어요.";
  return "Google 로그인에 실패했어요. 다시 시도해 주세요.";
}

/** The auth server answers in English; show people Korean. */
function authErrorText(err: { code?: string; message?: string }, fallback: string): string {
  const known: Record<string, string> = {
    PASSWORD_TOO_SHORT: "비밀번호는 8자 이상으로 정해 주세요.",
    PASSWORD_TOO_LONG: "비밀번호가 너무 길어요.",
    INVALID_EMAIL: "이메일 주소를 확인해 주세요.",
    INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호가 맞지 않아요.",
    USER_ALREADY_EXISTS: "이미 가입된 이메일이에요. 로그인해 주세요.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "이미 가입된 이메일이에요. 로그인해 주세요.",
  };
  return (err.code && known[err.code]) || fallback;
}

function Login() {
  const { next, error: socialError } = Route.useSearch();
  const { user, isPending } = useSession();
  const hasDraft = Boolean(useDraftSnapshot());
  const googleLogin = useAuthFeatures().data?.googleLogin ?? false;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [consent, setConsent] = useState(NO_CONSENT);
  const [error, setError] = useState<string | null>(() => socialErrorText(socialError));
  const [busy, setBusy] = useState(false);

  // Coming back from Google with the back button can restore this page as it
  // was left — mid-redirect, buttons disabled. Make it usable again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center bg-bg" />;
  }
  if (user) return <Navigate to={next ?? "/"} />;

  const submitEmail = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    if (mode === "up" && password.length < 8) {
      setError("비밀번호는 8자 이상으로 정해 주세요.");
      return;
    }
    if (mode === "up" && !hasAllConsent(consent)) {
      setError("필수 항목에 모두 동의해 주세요.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: email.split("@")[0] || "사용자",
        });
        if (err) throw new Error(authErrorText(err, "가입에 실패했습니다."));
        // If this doesn't land, the app asks for agreement again on the next screen.
        await acceptTerms({
          data: { termsVersion: SITE.termsVersion, privacyVersion: SITE.privacyVersion, ageConfirmed: consent.age },
        }).catch(() => undefined);
      } else {
        const { error: err } = await authClient.signIn.email({ email: email.trim(), password });
        if (err) throw new Error(authErrorText(err, "로그인에 실패했습니다."));
      }
      window.location.href = next ?? "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
      setBusy(false);
    }
  };

  // Leaves for Google and comes back signed in. First-timers land on /agree
  // for the same consent the email sign-up asks for.
  const submitGoogle = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next ?? "/",
      newUserCallbackURL: "/agree",
      errorCallbackURL: "/login",
    });
    if (err) {
      setError("Google 로그인에 실패했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-10">
      <Link to="/" className="flex h-13 items-center gap-2 self-start">
        <Logo className="size-6" />
        <span className="text-body font-bold tracking-tight">ActionBox</span>
      </Link>

      <div className="mt-10">
        <h1 className="text-display font-bold">
          저장한 것을
          <br />
          제때 꺼내 쓰세요
        </h1>
        <p className="mt-2 text-body text-muted">로그인하면 넣은 항목이 이 계정에만 저장돼요.</p>
      </div>

      {hasDraft ? (
        <p className="mt-5 rounded-md bg-primary-soft px-4 py-3 text-small font-medium text-primary">
          입력하신 내용은 이 기기에 보관해 두었어요. 로그인하면 홈에서 바로 저장할 수 있어요.
        </p>
      ) : null}

      {googleLogin ? (
        <div className="mt-7">
          <Button variant="outline" size="lg" className="w-full gap-2.5" disabled={busy} onClick={() => void submitGoogle()}>
            <GoogleLogo className="size-5" />
            Google로 계속하기
          </Button>
          <div className="mt-6 flex items-center gap-3 text-small text-muted" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            또는 이메일로
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      ) : null}

      <form
        className={googleLogin ? "mt-5 space-y-4" : "mt-7 space-y-4"}
        onSubmit={(e) => {
          e.preventDefault();
          void submitEmail();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "up" ? (
            <p className="px-1 text-small text-muted">8자 이상으로 정해 주세요.</p>
          ) : (
            <Link to="/forgot-password" className="hit-area ml-1 inline-block text-small font-medium text-muted">
              비밀번호를 잊으셨나요?
            </Link>
          )}
        </div>
        {mode === "up" ? <ConsentChecklist value={consent} onChange={setConsent} /> : null}
        {error ? <p className="px-1 text-small text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "처리 중…" : mode === "up" ? "가입하고 시작하기" : "로그인"}
        </Button>
        <button
          type="button"
          className="h-11 w-full text-small font-semibold text-muted"
          onClick={() => {
            setMode(mode === "up" ? "in" : "up");
            setError(null);
          }}
        >
          {mode === "up" ? "이미 계정이 있어요 · 로그인" : "처음이에요 · 이메일로 가입"}
        </button>
      </form>

      <LegalFooter className="mt-auto pt-10" />
    </main>
  );
}

/** Google's standard "G" mark, as its sign-in branding guidelines require. */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
