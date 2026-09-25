import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center bg-bg" />;
  }
  if (user) return <Navigate to="/" />;

  const submitEmail = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0] || "사용자",
        });
        if (err) throw new Error(err.message || "가입에 실패했습니다.");
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message || "로그인에 실패했습니다.");
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center bg-bg px-6 py-10">
      <Link to="/" className="mb-10 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-sm bg-accent text-accent-fg">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
            <rect x="4" y="6" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M8 12h8M13 9.5 16 12l-3 2.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="font-semibold">ActionBox</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">저장한 것을 다시 꺼내 씁니다</h1>
      <p className="mt-2 text-sm text-muted">로그인하면 항목은 이 계정에만 저장됩니다.</p>

      <div className="mt-8 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
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
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitEmail();
            }}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button className="w-full" disabled={busy} onClick={() => void submitEmail()}>
          {busy ? "처리 중…" : mode === "up" ? "가입하고 시작" : "이메일로 로그인"}
        </Button>
        <button
          type="button"
          className="h-11 w-full text-sm text-muted"
          onClick={() => {
            setMode(mode === "up" ? "in" : "up");
            setError(null);
          }}
        >
          {mode === "up" ? "이미 계정이 있나요? 로그인" : "처음인가요? 이메일로 가입"}
        </button>
      </div>

      {authEnabled ? (
        <div className="mt-8 space-y-3">
          <p className="text-center text-xs text-subtle">또는</p>
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
            >
              {p.label}로 계속
            </Button>
          ))}
        </div>
      ) : null}
    </main>
  );
}
