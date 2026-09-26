import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemRow } from "@/components/item-card";
import { LoadError } from "@/components/load-error";
import { EmptyRow, ListGroup, PageTitle } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { inboxItems } from "@/lib/items/home";
import { useItems } from "@/lib/query";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const { user, isPending } = useSession();
  const items = useItems(Boolean(user));

  if (!isPending && !user) return <RedirectToSignIn />;

  const list = inboxItems(items.data ?? []);

  return (
    <AppShell>
      <PageTitle title="수신함" description="방금 넣었거나 확인이 필요한 항목이에요. 확인하면 홈으로 옮겨져요." />
      {isPending || items.isPending ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : items.isError ? (
        <LoadError onRetry={() => void items.refetch()} />
      ) : (
        <ListGroup>
          {list.length === 0 ? <EmptyRow>확인할 항목이 없어요.</EmptyRow> : list.map((item) => <ItemRow key={item.id} item={item} />)}
        </ListGroup>
      )}
    </AppShell>
  );
}
