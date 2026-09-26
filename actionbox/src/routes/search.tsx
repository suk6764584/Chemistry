import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpLeft, Search, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ItemRow } from "@/components/item-card";
import { LoadError } from "@/components/load-error";
import { EmptyRow, ListGroup, PageTitle } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { describeFilters, filterItems, parseSearchQuery } from "@/lib/items/search";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/items/types";
import { useItems } from "@/lib/query";
import { useSession } from "@/lib/use-session";
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
  const conditions = describeFilters(chip === "all" ? parsed : { ...parsed, categories: [chip], hintWords: [] });

  if (!isPending && !user) return <RedirectToSignIn />;

  return (
    <AppShell>
      <PageTitle title="검색" />

      <form className="relative" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예) 10월에 끝나는 쿠폰"
          aria-label="검색어"
          className="h-12 w-full rounded-md bg-surface pr-12 pl-12 text-body shadow-card placeholder:text-subtle focus:shadow-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
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

      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="유형 필터">
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
        <section className="mt-6" aria-label="검색 예시">
          <p className="mb-2 px-1 text-small font-medium text-muted">이렇게 찾아보세요</p>
          <ListGroup>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQ(ex)}
                className="row-divider-text flex min-h-13 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
              >
                <Search className="size-4 shrink-0 text-subtle" aria-hidden />
                <span className="flex-1 text-body">{ex}</span>
                <ArrowUpLeft className="size-4 shrink-0 text-subtle" aria-hidden />
              </button>
            ))}
          </ListGroup>
          <p className="mt-3 px-1 text-small text-muted">
            문장 속 날짜(‘10월’, ‘다음 주’, ‘지난달’)와 유형(‘쿠폰’, ‘맛집’, ‘행사’)을 필터로 바꾸고, 나머지 단어로 찾아요.
            뜻이 비슷한 말까지 찾는 AI 검색은 아직 지원하지 않아요.
          </p>
        </section>
      ) : (
        <section className="mt-5" aria-label="검색 결과">
          {conditions.length ? (
            <div className="mb-3 flex flex-wrap gap-1.5 px-1" aria-label="적용된 조건">
              {conditions.map((c) => (
                <span key={c.key} className="inline-flex h-7 items-center rounded-full bg-surface-3/70 px-2.5 text-small font-medium text-fg">
                  {c.label}
                </span>
              ))}
            </div>
          ) : null}
          {isPending || items.isPending ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : items.isError ? (
            <LoadError onRetry={() => void items.refetch()} />
          ) : (
            <>
              <p className="mb-2 px-1 text-small font-medium text-muted">{results.length}개</p>
              <ListGroup>
                {results.length === 0 ? (
                  <EmptyRow>맞는 항목이 없어요. 단어를 줄여 보세요.</EmptyRow>
                ) : (
                  results.map((item) => <ItemRow key={item.id} item={item} />)
                )}
              </ListGroup>
            </>
          )}
        </section>
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
        "h-9 shrink-0 rounded-full px-3.5 text-small font-semibold transition-colors",
        active ? "bg-fg text-surface" : "bg-surface text-muted shadow-card",
      )}
    >
      {children}
    </button>
  );
}
