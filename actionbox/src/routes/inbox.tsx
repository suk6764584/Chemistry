import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ItemRow } from "@/components/item-card";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { EmptyRow, ListGroup, PageTitle } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { inboxItems } from "@/lib/items/home";
import { isAiOff } from "@/lib/items/types";
import { useItemMutations, useItems } from "@/lib/query";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const { user, isPending } = useSession();
  const items = useItems(Boolean(user));
  const { setMany } = useItemMutations();

  if (!isPending && !user) return <RedirectToSignIn />;

  const list = inboxItems(items.data ?? []);
  // Items still being read are left alone; everything else is saved and can be confirmed as is.
  const confirmable = list.filter((i) => i.analysis_status !== "pending").map((i) => i.id);
  const aiOff = list.some(isAiOff);

  const confirmAll = () =>
    setMany.mutate(
      { ids: confirmable, status: "active" },
      {
        onSuccess: () =>
          toast(`${confirmable.length}개를 확인했어요 · 홈에 넣었어요`, {
            duration: 8000,
            action: { label: "되돌리기", onClick: () => setMany.mutate({ ids: confirmable, status: "inbox" }) },
          }),
        onError: () => toast.error("확인하지 못했어요. 다시 시도해 주세요."),
      },
    );

  return (
    <AppShell>
      <PageTitle title="수신함" description="방금 넣었거나 확인이 필요한 항목이에요. 확인하면 홈으로 옮겨져요." />
      {isPending || items.isPending ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : items.isError ? (
        <LoadError onRetry={() => void items.refetch()} />
      ) : (
        <div className="space-y-3">
          {confirmable.length > 1 || aiOff ? (
            <div className="flex items-center gap-3 px-1">
              <p className="min-w-0 flex-1 text-small text-muted">
                {aiOff ? "지금은 자동 분석이 꺼져 있어 메모 속 날짜만 찾아요." : null}
              </p>
              {confirmable.length > 1 ? (
                <Button size="sm" variant="outline" className="text-primary" disabled={setMany.isPending} onClick={confirmAll}>
                  모두 확인
                </Button>
              ) : null}
            </div>
          ) : null}
          <ListGroup>
            {list.length === 0 ? <EmptyRow>확인할 항목이 없어요.</EmptyRow> : list.map((item) => <ItemRow key={item.id} item={item} />)}
          </ListGroup>
        </div>
      )}
    </AppShell>
  );
}
