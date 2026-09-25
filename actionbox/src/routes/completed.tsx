import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemCard } from "@/components/item-card";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useSession } from "@/lib/use-session";
import { doneItems } from "@/lib/items/home";
import { useItems } from "@/lib/query";
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
      <h1 className="pt-2 text-[24px] font-extrabold tracking-tight">완료 · 보관</h1>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-surface-3/70 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "h-10 rounded-md text-[14px] font-semibold",
              tab === t.key ? "bg-surface text-fg shadow-[var(--shadow-card)]" : "text-subtle",
            )}
          >
            {t.label} <span className="tabular-nums">{doneItems(all, t.key).length}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {isPending || items.isPending ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : items.isError ? (
          <LoadError onRetry={() => void items.refetch()} />
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[14px] text-subtle">
            {current.empty}
          </p>
        ) : (
          list.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </AppShell>
  );
}
