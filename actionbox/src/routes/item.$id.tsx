import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemDetail } from "@/components/item-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useItem } from "@/lib/query";

export const Route = createFileRoute("/item/$id")({ component: ItemPage });

function ItemPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const item = useItem(id, Boolean(user));

  if (!isPending && !user) return <RedirectToSignIn />;

  return (
    <AppShell>
      <Link to="/" className="mb-4 inline-flex h-11 items-center text-sm text-muted">
        홈으로
      </Link>
      {item.isPending || isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : item.data ? (
        <ItemDetail item={item.data} />
      ) : (
        <p className="text-sm text-muted">항목을 찾을 수 없습니다.</p>
      )}
    </AppShell>
  );
}
