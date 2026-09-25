import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ItemCard } from "@/components/item-card";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useSession } from "@/lib/use-session";
import { describeFilters, filterItems, parseSearchQuery } from "@/lib/items/search";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/items/types";
import { useItems } from "@/lib/query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search")({ component: SearchPage });

const EXAMPLES = ["10월에 끝나는 쿠폰", "다음 주 행사", "지난달 저장한 서울 맛집", "자동차 관련해서 저장한 것"];

function SearchPage() {
  const { user, isPending } = useSession();
  const items = useItems(Boolean(user));
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<Category | "all">("all");

  const parsed = useMemo(() => parseSearchQuery(q), [q]);
  const searching = q.trim().length > 0 || chip !== "all";
  const results = useMemo(
    () => (searching ? filterItems(items.data ?? [], parsed, chip) : []),
    [searching, items.data, parsed, chip],
  );
  const conditions = describeFilters(chip === "all" ? parsed : { ...parsed, categories: [chip] });

  if (!isPending && !user) return <RedirectToSignIn />;

  return (
    <AppShell>
      <h1 className="pt-2 text-[24px] font-extrabold tracking-tight">검색</h1>

      <form className="relative mt-4" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예) 10월에 끝나는 쿠폰"
          aria-label="검색어"
          className="h-12 w-full rounded-lg border border-line bg-surface pr-12 pl-11 text-base placeholder:text-subtle focus:border-primary focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {q ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => setQ("")}
            className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-subtle"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </form>

      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip active={chip === "all"} onClick={() => setChip("all")}>
          전체
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={chip === c} onClick={() => setChip(chip === c ? "all" : c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      {!searching ? (
        <div className="mt-6 space-y-3">
          <p className="px-0.5 text-[13px] font-semibold text-subtle">이렇게 찾아보세요</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQ(ex)}
                className="h-10 rounded-full bg-surface px-3.5 text-[14px] font-medium shadow-[var(--shadow-card)] active:bg-surface-2"
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="px-0.5 pt-2 text-[13px] leading-snug text-subtle">
            문장 속 날짜(‘10월’, ‘다음 주’, ‘지난달’)와 유형(‘쿠폰’, ‘맛집’, ‘행사’)을 필터로 바꾸고, 나머지 단어로 찾아요.
            뜻이 비슷한 말까지 찾는 AI 검색은 아직 지원하지 않아요.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          {conditions.length ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {conditions.map((c) => (
                <span key={c.key} className="inline-flex h-7 items-center rounded-full bg-primary-soft px-2.5 text-[13px] font-semibold text-primary">
                  {c.label}
                </span>
              ))}
            </div>
          ) : null}
          {isPending || items.isPending ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : items.isError ? (
            <LoadError onRetry={() => void items.refetch()} />
          ) : results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[14px] text-subtle">
              맞는 항목이 없어요. 단어를 줄여 보세요.
            </p>
          ) : (
            <>
              <p className="mb-2.5 px-0.5 text-[13px] font-semibold text-subtle">{results.length}개</p>
              <div className="space-y-2.5">
                {results.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 shrink-0 rounded-full px-3.5 text-[14px] font-semibold",
        active ? "bg-fg text-surface" : "bg-surface text-muted shadow-[var(--shadow-card)]",
      )}
    >
      {children}
    </button>
  );
}
