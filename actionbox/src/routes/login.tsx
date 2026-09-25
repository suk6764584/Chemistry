import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useSession } from "@/lib/use-session";
import { useDraftSnapshot } from "@/lib/items/drafts";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useSession();
  const hasDraft = Boolean(useDraftSnapshot());
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
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
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
        if (err) throw new Error(err.message || "가입에 실패했습니다.");
      } else {
        const { error: err } = await authClient.signIn.email({ email: email.trim(), password });
        if (err) throw new Error(err.message || "로그인에 실패했습니다.");
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <Link to="/" className="flex h-14 items-center gap-2 self-start">
        <Logo className="size-7" />
        <span className="text-[17px] font-extrabold tracking-tight">ActionBox</span>
      </Link>

      <div className="mt-8">
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">
          저장한 것을
          <br />
          제때 꺼내 쓰세요
        </h1>
        <p className="mt-2 text-[15px] text-muted">로그인하면 넣은 항목이 이 계정에만 저장돼요.</p>
      </div>

      {hasDraft ? (
        <p className="mt-5 rounded-lg bg-primary-soft px-4 py-3 text-[14px] font-medium text-primary">
          입력하신 내용은 이 기기에 보관해 두었어요. 로그인하면 홈에서 바로 저장할 수 있어요.
        </p>
      ) : null}

      <form
        className="mt-7 space-y-4"
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
          {mode === "up" ? <p className="text-[13px] text-subtle">8자 이상으로 정해 주세요.</p> : null}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "처리 중…" : mode === "up" ? "가입하고 시작하기" : "로그인"}
        </Button>
        <button
          type="button"
          className="h-11 w-full text-[14px] font-semibold text-muted"
          onClick={() => {
            setMode(mode === "up" ? "in" : "up");
            setError(null);
          }}
        >
          {mode === "up" ? "이미 계정이 있어요 · 로그인" : "처음이에요 · 이메일로 가입"}
        </button>
      </form>

      {authEnabled ? (
        <div className="mt-6 space-y-2.5">
          <div className="flex items-center gap-3 text-[13px] text-subtle">
            <span className="h-px flex-1 bg-line" />
            또는
            <span className="h-px flex-1 bg-line" />
          </div>
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() =>
                void signIn(p.providerId, { callbackURL: "/" }).catch((e: unknown) =>
                  setError(e instanceof Error ? e.message : "로그인에 실패했습니다."),
                )
              }
            >
              {p.label}로 계속하기
            </Button>
          ))}
        </div>
      ) : null}
    </main>
  );
}
