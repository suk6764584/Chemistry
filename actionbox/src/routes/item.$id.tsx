import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemDetail } from "@/components/item-detail";
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
    <AppShell back>
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
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <div className="rounded-xl bg-surface p-5 text-center shadow-[var(--shadow-card)]">
          <p className="text-[15px] font-semibold">
            {item.isError ? "항목을 불러오지 못했어요" : "항목을 찾을 수 없어요"}
          </p>
          <p className="mt-1 text-[13px] text-subtle">
            {item.isError ? "인터넷 연결을 확인해 주세요." : "삭제되었거나 다른 계정의 항목이에요."}
          </p>
          <Link to="/" className="mt-3 inline-flex h-11 items-center rounded-md bg-surface-2 px-4 text-[14px] font-semibold">
            홈으로
          </Link>
        </div>
      )}
    </AppShell>
  );
}
