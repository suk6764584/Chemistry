import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, CalendarPlus, Check, ChevronRight, Inbox, MapPin, Pin } from "lucide-react";
import { CaptureButtons, useCapture } from "@/components/add-sheet";
import { CategoryPill } from "@/components/category";
import { ItemCard } from "@/components/item-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { clearDraft, loadDraft, useDraftSnapshot, type Draft } from "@/lib/items/drafts";
import { groupHomeItems, inboxItems } from "@/lib/items/home";
import type { Category, Item } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { formatDateWithWeekday, todayISO } from "@/lib/utils";

const SECTION_LIMIT = 5;

function Section({ title, hint, items, empty }: { title: string; hint: string; items: Item[]; empty: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, SECTION_LIMIT);
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-baseline gap-1.5 px-0.5">
        <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
        <span className="text-[16px] font-bold text-primary tabular-nums">{items.length}</span>
        <span className="ml-auto truncate pl-2 text-[12px] text-subtle">{hint}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[14px] text-subtle">{empty}</p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {items.length > SECTION_LIMIT ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 h-11 w-full rounded-md text-[14px] font-semibold text-muted active:bg-surface-3"
        >
          {expanded ? "접기" : `${items.length - SECTION_LIMIT}개 더 보기`}
        </button>
      ) : null}
    </section>
  );
}

const DRAFT_SUBJECT: Record<Draft["kind"], string> = { image: "사진이", url: "링크가", text: "메모가" };

function DraftBanner({ signedIn }: { signedIn: boolean }) {
  const raw = useDraftSnapshot();
  const capture = useCapture();
  const draft = useMemo(() => (raw ? loadDraft() : null), [raw]);
  if (!draft) return null;
  const preview = draft.kind === "image" ? null : draft.value.slice(0, 80);
  return (
    <div className="rounded-xl bg-primary-soft p-4" role="status">
      <p className="text-[15px] font-bold text-primary">
        {signedIn ? `아직 저장되지 않은 ${DRAFT_SUBJECT[draft.kind]} 있어요` : `로그인하면 입력한 ${DRAFT_SUBJECT[draft.kind]} 저장돼요`}
      </p>
      {preview ? <p className="mt-0.5 truncate text-[14px] text-muted">{preview}</p> : null}
      <div className="mt-3 flex gap-2">
        {signedIn ? (
          <Button size="sm" onClick={() => capture.resume(draft)}>
            지금 저장
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link to="/login">로그인</Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => clearDraft()}>
          버리기
        </Button>
      </div>
    </div>
  );
}

function FirstRun() {
  const { seed } = useItemMutations();
  return (
    <div className="space-y-6 pt-2">
      <Headline />
      <CaptureButtons />
      <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="text-[15px] font-semibold">어떻게 정리되는지 먼저 볼까요?</p>
        <p className="mt-0.5 text-[13px] text-subtle">쿠폰, 행사, 맛집 등 예시 6개를 넣어요. 하나씩 지울 수 있어요.</p>
        <Button
          variant="secondary"
          className="mt-3 w-full"
          disabled={seed.isPending}
          onClick={() => seed.mutate()}
        >
          {seed.isPending ? "넣는 중…" : "예시 넣어보기"}
        </Button>
        {seed.isError ? <p className="mt-2 text-sm text-danger">예시를 넣지 못했어요. 다시 시도해 주세요.</p> : null}
      </div>
    </div>
  );
}

function Headline() {
  return (
    <div>
      <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">
        저장만 해두고
        <br />
        잊어버리셨나요?
      </h1>
      <p className="mt-2 text-[15px] text-muted">넣어 두면 날짜와 할 일을 찾아, 필요할 때 꺼내 드려요.</p>
    </div>
  );
}

export function HomeSignedIn({ items, loading }: { items: Item[]; loading: boolean }) {
  const grouped = groupHomeItems(items);
  const inbox = inboxItems(items);
  const hasAnything = items.some((i) => i.status === "active" || i.status === "inbox");

  return (
    <div className="space-y-7">
      <DraftBanner signedIn />
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : !hasAnything ? (
        <FirstRun />
      ) : (
        <>
          <div className="space-y-3">
            <p className="px-0.5 text-[13px] font-semibold text-subtle">{formatDateWithWeekday(todayISO())}</p>
            {inbox.length ? (
              <Link
                to="/inbox"
                className="flex h-14 items-center gap-3 rounded-xl bg-surface px-4 shadow-[var(--shadow-card)] active:bg-surface-2"
              >
                <Inbox className="size-5 text-primary" aria-hidden />
                <span className="flex-1 text-[15px] font-semibold">확인할 항목 {inbox.length}개</span>
                <ChevronRight className="size-4 text-subtle" aria-hidden />
              </Link>
            ) : null}
          </div>
          <Section title="지금 할 것" hint="기한 임박 · 오늘 하기로 한 것" items={grouped.now} empty="지금 급한 건 없어요." />
          <Section title="곧 만료" hint="쿠폰 · 행사 · 예약 · 마감" items={grouped.expiring} empty="날짜가 있는 항목이 없어요." />
          <Section title="나중에" hint="읽을거리 · 장소 · 구매 후보" items={grouped.later} empty="나중에 볼 항목이 없어요." />
        </>
      )}
    </div>
  );
}

const EXAMPLES: {
  category: Category;
  title: string;
  meta: string;
  actions: { icon: typeof Check; label: string }[];
}[] = [
  {
    category: "coupon",
    title: "스타벅스 아메리카노",
    meta: "10월 31일까지",
    actions: [
      { icon: Check, label: "사용완료" },
      { icon: BellRing, label: "알림" },
    ],
  },
  {
    category: "event",
    title: "서울 AI 박람회",
    meta: "10월 18일 14:00 · COEX",
    actions: [
      { icon: CalendarPlus, label: "캘린더" },
      { icon: BellRing, label: "알림" },
    ],
  },
  {
    category: "place",
    title: "을지면옥",
    meta: "서울 중구",
    actions: [
      { icon: MapPin, label: "지도" },
      { icon: Pin, label: "가볼 곳" },
    ],
  },
];

export function HomeGuest() {
  return (
    <div className="space-y-7 pt-2">
      <DraftBanner signedIn={false} />
      <Headline />
      <CaptureButtons />
      <section aria-label="정리 예시" className="space-y-2.5">
        <div className="flex items-baseline justify-between px-0.5">
          <h2 className="text-[17px] font-bold tracking-tight">이렇게 정리돼요</h2>
          <span className="text-[12px] text-subtle">예시 화면</span>
        </div>
        {EXAMPLES.map((ex) => (
          <div key={ex.title} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]" aria-hidden>
            <CategoryPill category={ex.category} />
            <p className="mt-2.5 text-[17px] font-bold tracking-tight">{ex.title}</p>
            <p className="mt-1 text-[14px] text-muted">{ex.meta}</p>
            <div className="mt-3 flex gap-2">
              {ex.actions.map((a, i) => (
                <span
                  key={a.label}
                  className={`inline-flex h-11 items-center gap-1.5 rounded-md px-3.5 text-[14px] font-semibold ${i === 0 ? "bg-primary-soft text-primary" : "bg-surface-2"}`}
                >
                  <a.icon className="size-4" aria-hidden />
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        ))}
        <Button size="lg" className="mt-2 w-full" asChild>
          <Link to="/login">로그인하고 시작하기</Link>
        </Button>
      </section>
    </div>
  );
}
