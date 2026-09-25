import { CaptureBar } from "@/components/add-sheet";
import { ItemCard } from "@/components/item-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupHomeItems } from "@/lib/items/home";
import type { Item } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";

function Section({
  title,
  hint,
  items,
  empty,
}: {
  title: string;
  hint?: string;
  items: Item[];
  empty?: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      {items.length === 0 ? (
        empty ? <p className="text-sm text-subtle">{empty}</p> : null
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export function HomeSignedIn({ items, loading }: { items: Item[]; loading: boolean }) {
  const { seed } = useItemMutations();
  const grouped = groupHomeItems(items);
  const empty = !loading && items.filter((i) => i.status !== "completed" && i.status !== "archived").length === 0;

  return (
    <div className="space-y-8">
      <CaptureBar signedIn />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : empty ? (
        <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="font-medium">아직 저장된 항목이 없습니다.</p>
          <p className="mt-1 text-sm text-muted">스크린샷, 링크, 메모를 넣으면 여기서 다음 행동을 보여줍니다.</p>
          <Button
            className="mt-4 w-full"
            variant="secondary"
            disabled={seed.isPending}
            onClick={() => seed.mutate()}
          >
            {seed.isPending ? "넣는 중…" : "예시 항목 넣기"}
          </Button>
        </div>
      ) : (
        <>
          <Section
            title="지금 할 것"
            hint="기한이 가깝거나 오늘로 지정한 항목"
            items={grouped.now}
            empty="지금은 급한 일이 없습니다."
          />
          <Section
            title="곧 만료"
            hint="쿠폰, 행사, 신청 기한"
            items={grouped.expiring}
            empty="날짜가 있는 항목이 없습니다."
          />
          <Section
            title="나중에"
            hint="읽을거리, 장소, 구매 후보"
            items={grouped.later}
            empty="나중에 볼 항목이 없습니다."
          />
        </>
      )}
    </div>
  );
}

export function HomeGuest() {
  return (
    <div className="space-y-8">
      <CaptureBar signedIn={false} />
      <section className="space-y-3">
        <h2 className="text-base font-semibold">이렇게 바뀝니다</h2>
        <Example
          kind="쿠폰"
          title="스타벅스 아메리카노"
          meta="10월 31일까지"
          actions={["사용완료", "알림"]}
        />
        <Example
          kind="일정"
          title="서울 AI 박람회"
          meta="10월 18일 14:00 · COEX"
          actions={["캘린더", "알림"]}
        />
        <Example
          kind="장소"
          title="을지면옥"
          meta="서울 중구"
          actions={["지도", "가볼 곳"]}
        />
      </section>
    </div>
  );
}

function Example({
  kind,
  title,
  meta,
  actions,
}: {
  kind: string;
  title: string;
  meta: string;
  actions: string[];
}) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium text-accent">{kind}</p>
      <p className="mt-1 font-semibold">{title}</p>
      <p className="text-sm text-muted">{meta}</p>
      <div className="mt-3 flex gap-2">
        {actions.map((a) => (
          <span key={a} className="rounded-sm bg-surface-2 px-3 py-2 text-sm text-muted">
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}
