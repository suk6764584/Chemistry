import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronDown, ChevronRight, Inbox, ListPlus, Pin, X } from "lucide-react";
import { CaptureButtons, useCapture } from "@/components/add-sheet";
import { ItemRow } from "@/components/item-card";
import { Button } from "@/components/ui/button";
import { EmptyRow, ListGroup, SectionHeader } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { clearDraft, loadDraft, useDraftSnapshot, type Draft } from "@/lib/items/drafts";
import { groupHomeItems, inboxItems } from "@/lib/items/home";
import type { Item } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { formatDateWithWeekday, todayISO } from "@/lib/utils";

const SECTION_LIMIT = 5;

function Section({ title, items, empty }: { title: string; items: Item[]; empty: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, SECTION_LIMIT);
  return (
    <section aria-label={title}>
      <SectionHeader title={title} count={items.length} />
      <ListGroup>
        {items.length === 0 ? <EmptyRow>{empty}</EmptyRow> : shown.map((item) => <ItemRow key={item.id} item={item} />)}
        {items.length > SECTION_LIMIT ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="row-divider-text flex h-12 w-full items-center justify-center gap-1 text-small font-medium text-muted active:bg-surface-2"
          >
            {expanded ? "접기" : `${items.length - SECTION_LIMIT}개 더 보기`}
            <ChevronDown className={expanded ? "size-4 rotate-180" : "size-4"} aria-hidden />
          </button>
        ) : null}
      </ListGroup>
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
    <ListGroup className="flex items-center gap-3 py-3 pr-2 pl-4">
      <div className="min-w-0 flex-1" role="status">
        <p className="text-body font-semibold">
          {signedIn ? `아직 저장되지 않은 ${DRAFT_SUBJECT[draft.kind]} 있어요` : `로그인하면 입력한 ${DRAFT_SUBJECT[draft.kind]} 저장돼요`}
        </p>
        {preview ? <p className="truncate text-small text-muted">{preview}</p> : null}
      </div>
      {signedIn ? (
        <Button size="sm" onClick={() => capture.resume(draft)}>
          지금 저장
        </Button>
      ) : (
        <Button size="sm" asChild>
          <Link to="/login">로그인</Link>
        </Button>
      )}
      <button
        type="button"
        aria-label="버리기"
        onClick={() => clearDraft()}
        className="grid size-10 shrink-0 place-items-center rounded-full text-subtle active:bg-surface-2"
      >
        <X className="size-5" aria-hidden />
      </button>
    </ListGroup>
  );
}

function Headline() {
  return (
    <div className="px-1 pt-4 pb-6">
      <h1 className="text-display font-bold">
        저장만 해두고
        <br />
        잊어버리셨나요?
      </h1>
      <p className="mt-2 text-body text-muted">넣어 두면 날짜와 할 일을 찾아, 필요할 때 꺼내 드려요.</p>
    </div>
  );
}

function FirstRun() {
  const { seed } = useItemMutations();
  return (
    <div className="space-y-8">
      <div>
        <Headline />
        <CaptureButtons />
      </div>
      <section aria-label="예시">
        <SectionHeader title="먼저 둘러보기" />
        <ListGroup>
          <button
            type="button"
            disabled={seed.isPending}
            onClick={() => seed.mutate()}
            className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2 disabled:opacity-60"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface-2" aria-hidden>
              <ListPlus className="size-5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">{seed.isPending ? "넣는 중…" : "예시 넣어보기"}</span>
              <span className="block text-small text-muted">쿠폰·행사·맛집 등 6개. 하나씩 지울 수 있어요.</span>
            </span>
            <ChevronRight className="size-5 text-subtle" aria-hidden />
          </button>
        </ListGroup>
        {seed.isError ? <p className="mt-2 px-1 text-small text-danger">예시를 넣지 못했어요. 다시 시도해 주세요.</p> : null}
      </section>
    </div>
  );
}

export function HomeSignedIn({ items, loading }: { items: Item[]; loading: boolean }) {
  const grouped = groupHomeItems(items);
  const inbox = inboxItems(items);
  const hasAnything = items.some((i) => i.status === "active" || i.status === "inbox");

  return (
    <div className="space-y-8">
      <DraftBanner signedIn />
      {loading ? (
        <div className="space-y-3 pt-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : !hasAnything ? (
        <FirstRun />
      ) : (
        <>
          <div className="space-y-4">
            <p className="px-1 pt-2 text-small font-medium text-muted">{formatDateWithWeekday(todayISO())}</p>
            {inbox.length ? (
              <ListGroup>
                <Link to="/inbox" className="flex min-h-14 items-center gap-3 px-4 active:bg-surface-2">
                  <Inbox className="size-5 text-primary" aria-hidden />
                  <span className="flex-1 text-body font-medium">확인할 항목 {inbox.length}개</span>
                  <ChevronRight className="size-5 text-subtle" aria-hidden />
                </Link>
              </ListGroup>
            ) : null}
          </div>
          <Section title="지금 할 것" items={grouped.now} empty="지금 급한 건 없어요." />
          <Section title="곧 만료" items={grouped.expiring} empty="날짜가 있는 항목이 없어요." />
          <Section title="나중에" items={grouped.later} empty="나중에 볼 항목이 없어요." />
        </>
      )}
    </div>
  );
}

const EXAMPLES: { title: string; meta: string; action: string; icon: typeof Bell }[] = [
  { title: "스타벅스 아메리카노", meta: "쿠폰/마감 · 10.31까지", action: "사용완료", icon: Bell },
  { title: "서울 AI 박람회", meta: "일정 · 10.18 14:00 · COEX", action: "캘린더", icon: Bell },
  { title: "을지면옥", meta: "장소 · 서울 중구", action: "지도", icon: Pin },
];

export function HomeGuest() {
  return (
    <div className="space-y-8">
      <DraftBanner signedIn={false} />
      <div>
        <Headline />
        <CaptureButtons />
      </div>
      <section aria-label="정리 예시">
        <SectionHeader title="이렇게 정리돼요" />
        <ListGroup>
          {EXAMPLES.map((ex) => (
            <div key={ex.title} className="row-divider-text flex min-h-18 items-center gap-3 px-4 py-3" aria-hidden>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold">{ex.title}</p>
                <p className="truncate text-small text-muted">{ex.meta}</p>
              </div>
              <ex.icon className="size-5 text-subtle" />
              <span className="h-8 rounded-full bg-surface-2 px-3.5 text-small leading-8 font-semibold text-primary">
                {ex.action}
              </span>
            </div>
          ))}
        </ListGroup>
        <p className="mt-2 px-1 text-small text-muted">예시 화면이에요. 로그인하면 내 항목으로 채워져요.</p>
      </section>
      <Button size="lg" className="w-full" asChild>
        <Link to="/login">로그인하고 시작하기</Link>
      </Button>
    </div>
  );
}
