import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemRow } from "@/components/item-card";
import { LoadError } from "@/components/load-error";
import { EmptyRow, ListGroup, PageTitle } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { doneItems } from "@/lib/items/home";
import { useItems } from "@/lib/query";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/completed")({ component: CompletedPage });

const TABS = [
  { key: "completed", label: "완료", empty: "완료한 항목이 없어요." },
  { key: "archived", label: "보관", empty: "보관한 항목이 없어요." },
] as const;

function CompletedPage() {
  const { user, isPending } = useSession();
  const items = useItems(Boolean(user));
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("completed");

  if (!isPending && !user) return <RedirectToSignIn />;

  const all = items.data ?? [];
  const current = TABS.find((t) => t.key === tab)!;
  const list = doneItems(all, tab);

  return (
    <AppShell>
      <PageTitle title="완료 · 보관" />
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-surface-3/70 p-0.5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "h-10 rounded-seg text-small font-semibold transition-colors",
              tab === t.key ? "bg-surface text-fg shadow-card" : "text-muted",
            )}
          >
            {t.label} <span className="tabular-nums">{doneItems(all, t.key).length}</span>
          </button>
        ))}
      </div>
      {isPending || items.isPending ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : items.isError ? (
        <LoadError onRetry={() => void items.refetch()} />
      ) : (
        <ListGroup>
          {list.length === 0 ? <EmptyRow>{current.empty}</EmptyRow> : list.map((item) => <ItemRow key={item.id} item={item} />)}
        </ListGroup>
      )}
    </AppShell>
  );
}
