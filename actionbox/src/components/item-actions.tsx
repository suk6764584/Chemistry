import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Bell,
  BellRing,
  CalendarPlus,
  Check,
  ChevronRight,
  ExternalLink,
  MapPin,
  Pencil,
  Phone,
  Pin,
  RotateCcw,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { buildIcs, downloadIcs, googleCalendarUrl } from "@/lib/items/ics";
import { googleMapUrl, mapSearchQuery, naverMapUrl } from "@/lib/items/maps";
import { reminderOnPatch } from "@/lib/items/reminder";
import { keyDate, type ActionCode, type Category, type Item, type ItemPatch } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { cn, daysUntil, formatShortDate } from "@/lib/utils";

/** The buttons each card shows, by type — never the same row for every card. */
const CARD_ACTIONS: Record<Category, ActionCode[]> = {
  coupon: ["complete", "remind"],
  event: ["calendar", "remind"],
  place: ["map", "visit"],
  todo: ["complete", "today"],
  read: ["open", "complete"],
  buy: ["open", "archive"],
  reference: ["open", "archive"],
  other: ["complete"],
};

type ActionDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  run: () => void;
};

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function completeLabel(category: Category) {
  if (category === "coupon") return "사용완료";
  if (category === "place") return "다녀옴";
  if (category === "read") return "다 읽음";
  return "완료";
}

function openLabel(category: Category) {
  if (category === "read") return "읽기";
  if (category === "buy") return "상품 보기";
  return "링크 열기";
}

function useItemActions(item: Item) {
  const nav = useNavigate();
  const { patch } = useItemMutations();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const date = keyDate(item);
  const overdue = (daysUntil(date) ?? 0) < 0;
  const mapQuery = mapSearchQuery(item.location, item.address);
  const title = item.title || "제목 없음";

  const update = (next: ItemPatch, message: string, undo?: ItemPatch) => {
    patch.mutate(
      { id: item.id, patch: next },
      {
        onSuccess: () =>
          toast.success(message, {
            action: undo
              ? { label: "되돌리기", onClick: () => patch.mutate({ id: item.id, patch: undo }) }
              : undefined,
          }),
        onError: (e) => toast.error(e instanceof Error ? e.message : "저장하지 못했어요. 다시 시도해 주세요."),
      },
    );
  };

  const moveTo = (status: "completed" | "archived" | "active", message: string) =>
    update({ status, do_today: status === "active" ? item.do_today : false }, message, {
      status: item.status,
      do_today: item.do_today,
    });

  const needDate = () => {
    toast("날짜를 먼저 입력해 주세요", { description: "상세 화면에서 날짜를 넣으면 알림을 켤 수 있어요." });
    openEditor();
  };

  const openEditor = () => nav({ to: "/item/$id", params: { id: item.id }, search: { edit: true } });

  function def(code: ActionCode | "restore" | "confirm" | "edit", compact = false): ActionDef | null {
    switch (code) {
      case "calendar":
        if (!date) return null;
        return { key: code, label: "캘린더", icon: CalendarPlus, run: () => setCalendarOpen(true) };
      case "remind":
        if (item.reminder_enabled) {
          return {
            key: code,
            label: compact ? "알림" : `알림 ${formatShortDate(item.reminder_date) ?? "켜짐"}`,
            icon: BellRing,
            active: true,
            run: () => update({ reminder_enabled: false }, "알림을 껐어요", { reminder_enabled: true }),
          };
        }
        return {
          key: code,
          label: "알림",
          icon: Bell,
          run: () => {
            const on = reminderOnPatch(item);
            if (!on) return needDate();
            update(on, `${formatShortDate(on.reminder_date)}에 '지금 할 것'으로 올려 드릴게요`, {
              reminder_enabled: false,
            });
          },
        };
      case "map":
        if (!mapQuery) return null;
        return { key: code, label: "지도", icon: MapPin, run: () => setMapOpen(true) };
      case "call":
        if (!item.phone) return null;
        return {
          key: code,
          label: "전화",
          icon: Phone,
          run: () => {
            window.location.href = `tel:${item.phone!.replace(/[^\d+]/g, "")}`;
          },
        };
      case "open":
        if (!item.source_url) return null;
        return { key: code, label: openLabel(item.category), icon: ExternalLink, run: () => openExternal(item.source_url!) };
      case "visit":
        return {
          key: code,
          label: "가볼 곳",
          icon: Pin,
          active: item.do_today,
          run: () =>
            update(
              { do_today: !item.do_today },
              item.do_today ? "가볼 곳 표시를 뺐어요" : "가볼 곳으로 표시했어요 · '지금 할 것'에 보여요",
              { do_today: item.do_today },
            ),
        };
      case "today":
        return {
          key: code,
          label: "오늘 하기",
          icon: Sun,
          active: item.do_today,
          run: () =>
            update(
              { do_today: !item.do_today },
              item.do_today ? "오늘 할 일에서 뺐어요" : "오늘 할 일로 올렸어요",
              { do_today: item.do_today },
            ),
        };
      case "complete":
        return { key: code, label: completeLabel(item.category), icon: Check, run: () => moveTo("completed", "완료로 옮겼어요") };
      case "archive":
        return { key: code, label: "보관", icon: Archive, run: () => moveTo("archived", "보관했어요") };
      case "restore":
        return { key: code, label: "되돌리기", icon: RotateCcw, run: () => moveTo("active", "다시 꺼냈어요") };
      case "edit":
        return { key: code, label: "직접 입력", icon: Pencil, run: openEditor };
      case "confirm":
        return {
          key: code,
          label: "확인",
          icon: Check,
          run: () =>
            update({ status: "active" }, "확인했어요 · 홈에 넣었어요", { status: "inbox" }),
        };
    }
  }

  const pick = (codes: (ActionCode | "restore" | "confirm" | "edit")[], max: number, compact = false) => {
    const seen = new Set<string>();
    const out: ActionDef[] = [];
    for (const c of codes) {
      const d = seen.has(c) ? null : def(c, compact);
      seen.add(c);
      if (d) out.push(d);
      if (out.length >= max) break;
    }
    return out;
  };

  /** Two or three buttons for the card, by type. */
  const cardActions = (): ActionDef[] => {
    if (item.status === "completed" || item.status === "archived") return pick(["restore"], 1);
    if (item.status === "inbox") {
      if (item.analysis_status === "pending") return [];
      return pick(item.analysis_status === "failed" ? ["edit"] : ["confirm", "edit"], 2);
    }
    if (overdue && (item.category === "event" || item.category === "coupon")) return pick(["complete", "archive"], 2);
    return pick(CARD_ACTIONS[item.category], 2, true);
  };

  /** Up to four recommended actions for the detail screen: the AI's picks when it gave any, else the type defaults. */
  const recommended = (): ActionDef[] => {
    if (item.status === "completed" || item.status === "archived") return pick(["restore"], 1);
    const base = item.recommended_actions.length ? item.recommended_actions : CARD_ACTIONS[item.category];
    return pick([...base, ...CARD_ACTIONS[item.category], "call", "archive"], 4);
  };

  const calendarEvent = date
    ? {
        title,
        date,
        time: item.extracted_date ? item.extracted_time : null,
        location: [item.location, item.address].filter(Boolean).join(", ") || null,
        description: item.summary,
      }
    : null;

  const sheets = (
    <>
      <Sheet open={calendarOpen} onOpenChange={setCalendarOpen} title="캘린더에 추가">
        <p className="mt-1 text-sm text-muted">
          {formatShortDate(date)} {item.extracted_date ? item.extracted_time ?? "(종일)" : "(종일)"} · {title}
        </p>
        <div className="mt-4 space-y-2">
          <SheetOption
            title="휴대폰 기본 캘린더"
            hint=".ics 파일을 받아 캘린더 앱으로 엽니다"
            onClick={() => {
              if (!calendarEvent) return;
              downloadIcs(title, buildIcs(calendarEvent));
              setCalendarOpen(false);
            }}
          />
          <SheetOption
            title="Google 캘린더"
            hint="새 창에서 일정 추가 화면을 엽니다"
            onClick={() => {
              if (!calendarEvent) return;
              openExternal(googleCalendarUrl(calendarEvent));
              setCalendarOpen(false);
            }}
          />
        </div>
      </Sheet>
      <Sheet open={mapOpen} onOpenChange={setMapOpen} title="지도에서 보기">
        <p className="mt-1 truncate text-sm text-muted">{mapQuery}</p>
        <div className="mt-4 space-y-2">
          <SheetOption
            title="네이버 지도"
            hint="국내 장소 검색에 적합해요"
            onClick={() => {
              if (mapQuery) openExternal(naverMapUrl(mapQuery));
              setMapOpen(false);
            }}
          />
          <SheetOption
            title="Google 지도"
            hint="해외 장소도 찾을 수 있어요"
            onClick={() => {
              if (mapQuery) openExternal(googleMapUrl(mapQuery));
              setMapOpen(false);
            }}
          />
        </div>
      </Sheet>
    </>
  );

  return { cardActions, recommended, sheets, pending: patch.isPending };
}

function SheetOption({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3 text-left active:bg-surface-3"
    >
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] text-subtle">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
    </button>
  );
}

function ActionButton({ action, primary, className }: { action: ActionDef; primary?: boolean; className?: string }) {
  const Icon = action.active ? Check : action.icon;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        action.run();
      }}
      aria-pressed={action.active}
      className={cn(
        "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-md px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors",
        primary || action.active
          ? "bg-primary-soft text-primary active:bg-primary-soft/70"
          : "bg-surface-2 text-fg active:bg-surface-3",
        className,
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
      <span className="truncate">{action.label}</span>
    </button>
  );
}

/** Card footer: type-specific actions plus a way into the detail screen. */
export function CardActions({ item }: { item: Item }) {
  const { cardActions, sheets } = useItemActions(item);
  const actions = cardActions();
  return (
    <div className="flex items-center gap-2">
      {actions.map((a, i) => (
        <ActionButton key={a.key} action={a} primary={i === 0} />
      ))}
      <Link
        to="/item/$id"
        params={{ id: item.id }}
        className="ml-auto inline-flex h-11 shrink-0 items-center gap-0.5 rounded-md pr-1 pl-3 text-[14px] font-semibold whitespace-nowrap text-subtle active:bg-surface-2"
      >
        상세
        <ChevronRight className="size-4" aria-hidden />
      </Link>
      {sheets}
    </div>
  );
}

export function RecommendedActions({ item, footer }: { item: Item; footer?: ReactNode }) {
  const { recommended, sheets } = useItemActions(item);
  const actions = recommended();
  if (!actions.length) return null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a, i) => (
          <ActionButton
            key={a.key}
            action={a}
            primary={i === 0}
            className={cn("h-12", actions.length % 2 === 1 && i === actions.length - 1 && "col-span-2")}
          />
        ))}
      </div>
      {footer}
      {sheets}
    </div>
  );
}
