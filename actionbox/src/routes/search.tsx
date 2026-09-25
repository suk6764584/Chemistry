import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ItemCard } from "@/components/item-card";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { filterItems, parseSearchQuery } from "@/lib/items/search";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/items/types";
import { useItems } from "@/lib/query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search")({ component: SearchPage });

function SearchPage() {
  const { user, isPending } = useCurrentUserState();
  const items = useItems(Boolean(user));
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<Category | "all">("all");

  const parsed = useMemo(() => parseSearchQuery(q), [q]);
  const results = useMemo(
    () => filterItems(items.data ?? [], parsed, chip),
    [items.data, parsed, chip],
  );

  if (!isPending && !user) return <RedirectToSignIn />;

  return (
    <AppShell>
      <h1 className="text-xl font-semibold tracking-tight">검색</h1>
      <p className="mt-1 text-sm text-muted">제목, 장소, 날짜로 찾습니다.</p>
      <div className="mt-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="지난달 서울 맛집, 10월 쿠폰…"
        />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={chip === "all"} onClick={() => setChip("all")}>
          전체
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={chip === c} onClick={() => setChip(c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {items.isPending ? (
          <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        ) : results.length === 0 ? (
          <p className="text-sm text-subtle">맞는 항목이 없습니다.</p>
        ) : (
          results.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 shrink-0 rounded-full px-3 text-sm font-medium",
        active ? "bg-accent text-accent-fg" : "bg-surface text-muted shadow-[var(--shadow-card)]",
      )}
    >
      {children}
    </button>
  );
}
