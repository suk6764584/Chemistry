import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useAuthFeatures } from "@/lib/query";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "비밀번호 찾기 · ActionBox" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const features = useAuthFeatures();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("가입한 이메일을 입력해 주세요.");
      return;
    }
    setBusy(true);
    const { error: err } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setBusy(false);
    if (err) setError("요청하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    else setSent(true);
  };

  return (
    <AuthPage title="비밀번호 찾기">
      {features.isPending ? null : !features.data?.passwordResetEmail ? (
        <p className="mt-2 text-body text-muted">
          지금은 이메일로 비밀번호를 재설정할 수 없어요.
          {SITE.supportEmail ? (
            <>
              {" "}
              <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-primary">
                {SITE.supportEmail}
              </a>
              로 문의해 주세요.
            </>
          ) : null}
        </p>
      ) : sent ? (
        <p className="mt-2 text-body text-muted" role="status">
          가입된 이메일이면 비밀번호 재설정 링크를 보냈어요. 메일함(스팸함 포함)을 확인해 주세요. 링크는 1시간 동안
          유효해요.
        </p>
      ) : (
        <>
          <p className="mt-2 text-body text-muted">가입한 이메일로 새 비밀번호를 정할 수 있는 링크를 보내 드려요.</p>
          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
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
            {error ? <p className="px-1 text-small text-danger">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "보내는 중…" : "재설정 링크 받기"}
            </Button>
          </form>
        </>
      )}
      <Link to="/login" className="mt-6 flex h-11 items-center justify-center text-small font-semibold text-muted">
        로그인으로 돌아가기
      </Link>
    </AuthPage>
  );
}
