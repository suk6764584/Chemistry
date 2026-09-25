import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemCard } from "@/components/item-card";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { doneItems } from "@/lib/items/home";
import { useItems } from "@/lib/query";

export const Route = createFileRoute("/completed")({ component: CompletedPage });

function CompletedPage() {
  const { user, isPending } = useCurrentUserState();
  const items = useItems(Boolean(user));

  if (!isPending && !user) return <RedirectToSignIn />;

  const list = doneItems(items.data ?? []);

  return (
    <AppShell>
      <h1 className="text-xl font-semibold tracking-tight">완료 · 보관</h1>
      <p className="mt-1 text-sm text-muted">처리했거나 넣어 둔 항목입니다.</p>
      <div className="mt-5 space-y-3">
        {isPending || items.isPending ? (
          <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        ) : list.length === 0 ? (
          <p className="text-sm text-subtle">완료한 항목이 없습니다.</p>
        ) : (
          list.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </AppShell>
  );
}
