import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ListGroup, PageTitle } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { deleteMyAccount } from "@/lib/account/server";
import { authEnabled, signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { clearDraft } from "@/lib/items/drafts";
import { SAMPLE_NOTE } from "@/lib/items/types";
import { useItemMutations, useItems } from "@/lib/query";
import { SITE } from "@/lib/site";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "설정 · 다람" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isPending } = useSession();
  const items = useItems(Boolean(user));
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { clearSamples } = useItemMutations();
  const sampleCount = (items.data ?? []).filter((i) => i.analysis_note === SAMPLE_NOTE).length;

  if (!isPending && !user) return <RedirectToSignIn />;
  const canSignOut = authEnabled;

  return (
    // Reachable from /agree, so it must not bounce back there.
    <AppShell detail requireConsent={false}>
      <PageTitle title="설정" />
      <div className="space-y-6">
        <ListGroup>
          <Row title="계정" value={user?.primaryEmail ?? user?.displayName ?? ""} />
        </ListGroup>

        {sampleCount ? (
          <ListGroup>
            <button
              type="button"
              disabled={clearSamples.isPending}
              onClick={() =>
                clearSamples.mutate(undefined, {
                  onSuccess: () => toast(`예시 ${sampleCount}개를 지웠어요`),
                  onError: () => toast.error("지우지 못했어요. 다시 시도해 주세요."),
                })
              }
              className="flex min-h-13 w-full items-center gap-3 px-4 text-left active:bg-surface-2 disabled:opacity-60"
            >
              <span className="flex-1 text-body">예시 항목 모두 지우기</span>
              <span className="text-small text-muted">{sampleCount}개</span>
            </button>
          </ListGroup>
        ) : null}

        <ListGroup>
          <LinkRow to="/terms" title="이용약관" />
          <LinkRow to="/privacy" title="개인정보 처리방침" strong />
          <LinkRow to="/contact" title="문의하기" />
          <Row title="버전" value={SITE.appVersion} />
        </ListGroup>

        <ListGroup>
          {canSignOut ? (
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
              className="row-divider-text flex min-h-13 w-full items-center px-4 text-left text-body active:bg-surface-2 disabled:opacity-50"
            >
              {signingOut ? "로그아웃 중…" : "로그아웃"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="row-divider-text flex min-h-13 w-full items-center px-4 text-left text-body text-danger active:bg-surface-2"
          >
            회원 탈퇴
          </button>
        </ListGroup>
      </div>

      <DeleteAccountSheet open={deleting} onOpenChange={setDeleting} itemCount={items.data?.length} />
    </AppShell>
  );
}

function Row({ title, value }: { title: string; value: ReactNode }) {
  return (
    <div className="row-divider-text flex min-h-13 items-center gap-3 px-4">
      <span className="text-body">{title}</span>
      <span className="ml-auto min-w-0 truncate text-body text-muted">{value}</span>
    </div>
  );
}

function LinkRow({ to, title, strong }: { to: "/terms" | "/privacy" | "/contact"; title: string; strong?: boolean }) {
  return (
    <Link to={to} className="row-divider-text flex min-h-13 items-center gap-3 px-4 active:bg-surface-2">
      <span className={strong ? "flex-1 text-body font-semibold" : "flex-1 text-body"}>{title}</span>
      <ChevronRight className="size-5 text-subtle" aria-hidden />
    </Link>
  );
}

function DeleteAccountSheet({
  open,
  onOpenChange,
  itemCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number | undefined;
}) {
  const qc = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteMyAccount({ data: { confirm: true } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "탈퇴하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    // The account is gone. Drop everything this device still holds for it.
    clearDraft();
    qc.clear();
    await signOut("/").catch(() => {
      window.location.href = "/";
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title="회원 탈퇴"
      onClosed={() => {
        setConfirmed(false);
        setError(null);
      }}
    >
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-small text-fg">
        <li>
          저장한 항목{itemCount !== undefined ? ` ${itemCount}개` : ""}와 사진, 계정 정보, 약관 동의 기록이 바로 삭제돼요.
        </li>
        <li>삭제한 정보는 되돌릴 수 없어요.</li>
        <li>데이터베이스 백업에 남은 사본은 개인정보 처리방침에 적힌 보관 기간이 지나면 함께 삭제돼요.</li>
      </ul>
      <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-md bg-surface-2 px-4 text-body">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="size-5 shrink-0 cursor-pointer accent-danger"
        />
        안내를 확인했어요
      </label>
      {error ? <p className="mt-3 px-1 text-small text-danger">{error}</p> : null}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button variant="danger" size="lg" disabled={!confirmed || busy} onClick={() => void submit()}>
          {busy ? "삭제 중…" : "탈퇴하기"}
        </Button>
      </div>
    </Sheet>
  );
}
