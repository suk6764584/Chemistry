import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemCard } from "@/components/item-card";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useSession } from "@/lib/use-session";
import { inboxItems } from "@/lib/items/home";
import { useItems } from "@/lib/query";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const { user, isPending } = useSession();
  const items = useItems(Boolean(user));

  if (!isPending && !user) return <RedirectToSignIn />;

  const list = inboxItems(items.data ?? []);

  return (
    <AppShell>
      <h1 className="pt-2 text-[24px] font-extrabold tracking-tight">수신함</h1>
      <p className="mt-1 text-[14px] text-muted">방금 넣었거나 확인이 필요한 항목이에요. 확인하면 홈으로 옮겨져요.</p>
      <div className="mt-5 space-y-2.5">
        {isPending || items.isPending ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : items.isError ? (
          <LoadError onRetry={() => void items.refetch()} />
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[14px] text-subtle">
            확인할 항목이 없어요.
          </p>
        ) : (
          list.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </AppShell>
  );
}
