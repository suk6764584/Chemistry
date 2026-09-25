import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemDetail } from "@/components/item-detail";
import { Button } from "@/components/ui/button";
import { ListGroup } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useSession } from "@/lib/use-session";
import { useItem } from "@/lib/query";

export const Route = createFileRoute("/item/$id")({
  validateSearch: (search: Record<string, unknown>): { edit?: boolean } =>
    search.edit === true || search.edit === "true" ? { edit: true } : {},
  component: ItemPage,
});

function ItemPage() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user, isPending } = useSession();
  const item = useItem(id, Boolean(user));

  if (!isPending && !user) return <RedirectToSignIn />;

  return (
    <AppShell detail>
      {item.data ? (
        <ItemDetail
          key={`${item.data.id}-${edit ? "edit" : "view"}`}
          item={item.data}
          startEditing={edit}
          onEditingChange={(editing) => {
            if (!editing && edit) void navigate({ search: {}, replace: true });
          }}
        />
      ) : item.isPending || isPending ? (
        <div className="space-y-4 pt-1">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : (
        <ListGroup className="mt-4 px-5 py-6 text-center">
          <p className="text-body font-semibold">{item.isError ? "항목을 불러오지 못했어요" : "항목을 찾을 수 없어요"}</p>
          <p className="mt-1 text-small text-muted">
            {item.isError ? "인터넷 연결을 확인해 주세요." : "삭제되었거나 다른 계정의 항목이에요."}
          </p>
          <Button variant="secondary" size="sm" className="mt-4" asChild>
            <Link to="/">홈으로</Link>
          </Button>
        </ListGroup>
      )}
    </AppShell>
  );
}
