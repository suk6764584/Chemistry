import { useState, useSyncExternalStore } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "새 비밀번호 · ActionBox" }] }),
  // The emailed link lands here via Better Auth with `?token=` (or `?error=INVALID_TOKEN`).
  validateSearch: (s: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof s.token === "string" ? s.token : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: ResetPassword,
});

const subscribeToNothing = () => () => {};

function ResetPassword() {
  const { token, error: linkError } = Route.useSearch();
  // The form is client-only: submitted before hydration, the browser's native
  // GET submit would reload this page without the token.
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("8자 이상으로 정해 주세요.");
      return;
    }
    if (password !== confirm) {
      setError("두 비밀번호가 달라요.");
      return;
    }
    setBusy(true);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (!err) setDone(true);
    else if (err.code === "INVALID_TOKEN") setExpired(true);
    else setError("바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  };

  if (!token || linkError || expired) {
    return (
      <AuthPage title="링크를 쓸 수 없어요">
        <p className="mt-2 text-body text-muted">링크가 만료됐거나 이미 사용됐어요. 재설정 링크를 다시 받아 주세요.</p>
        <Button asChild size="lg" className="mt-7 w-full">
          <Link to="/forgot-password">링크 다시 받기</Link>
        </Button>
      </AuthPage>
    );
  }

  if (done) {
    return (
      <AuthPage title="비밀번호를 바꿨어요">
        <p className="mt-2 text-body text-muted" role="status">
          새 비밀번호로 로그인해 주세요. 다른 기기에 로그인돼 있었다면 보안을 위해 몇 분 안에 로그아웃돼요.
        </p>
        <Button asChild size="lg" className="mt-7 w-full">
          <Link to="/login">로그인하기</Link>
        </Button>
      </AuthPage>
    );
  }

  if (!hydrated) return <AuthPage title="새 비밀번호 정하기">{null}</AuthPage>;

  return (
    <AuthPage title="새 비밀번호 정하기">
      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-password">새 비밀번호</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="px-1 text-small text-muted">8자 이상으로 정해 주세요.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? <p className="px-1 text-small text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "바꾸는 중…" : "비밀번호 바꾸기"}
        </Button>
      </form>
    </AuthPage>
  );
}
