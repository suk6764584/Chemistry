import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemCard } from "@/components/item-card";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { inboxItems } from "@/lib/items/home";
import { useItems } from "@/lib/query";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const { user, isPending } = useCurrentUserState();
  const items = useItems(Boolean(user));

  if (!isPending && !user) return <RedirectToSignIn />;

  const list = inboxItems(items.data ?? []);

  return (
    <AppShell>
      <h1 className="text-xl font-semibold tracking-tight">수신함</h1>
      <p className="mt-1 text-sm text-muted">방금 넣었거나, 확인이 필요한 항목입니다.</p>
      <div className="mt-5 space-y-3">
        {isPending || items.isPending ? (
          <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        ) : list.length === 0 ? (
          <p className="text-sm text-subtle">비어 있습니다. 새 항목은 분석이 끝나면 홈으로 이동합니다.</p>
        ) : (
          list.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </AppShell>
  );
}
