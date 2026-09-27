import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  RotateCw,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ReminderSheet } from "@/components/reminder-sheet";
import { Sheet, SheetRow } from "@/components/ui/sheet";
import { isStalled } from "@/lib/items/home";
import { buildIcs, downloadIcs, googleCalendarUrl } from "@/lib/items/ics";
import { googleMapUrl, mapSearchQuery, naverMapUrl } from "@/lib/items/maps";
import { reminderOnPatch } from "@/lib/items/reminder";
import { isAiOff, keyDate, type ActionCode, type Category, type Item, type ItemPatch } from "@/lib/items/types";
import { useAnalyzingIds, useItemMutations } from "@/lib/query";
import { cn, daysUntil, formatShortDate } from "@/lib/utils";

/** What each type offers first on its row — never the same pair for every type. */
const ROW_ACTIONS: Record<Category, ActionCode[]> = {
  coupon: ["complete", "remind"],
  event: ["calendar", "remind"],
  place: ["map", "visit"],
  todo: ["complete", "today"],
  read: ["open", "complete"],
  buy: ["open", "archive"],
  reference: ["open", "archive"],
  // Memos saved without analysis land here, so a dated one still gets calendar and reminder.
  other: ["complete", "calendar", "remind"],
};

type Code = ActionCode | "restore" | "confirm" | "edit" | "reanalyze";

type ActionDef = {
  key: Code;
  /** Full label: detail screen, accessible name of icon buttons. */
  label: string;
  /** Short label for the compact row button. */
  short: string;
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

export function useItemActions(item: Item) {
  const nav = useNavigate();
  const { patch, analyze } = useItemMutations();
  const analyzingIds = useAnalyzingIds();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  const date = keyDate(item);
  const overdue = (daysUntil(date) ?? 0) < 0;
  const mapQuery = mapSearchQuery(item.location, item.address);
  const title = item.title || "제목 없음";

  const update = (next: ItemPatch, message: string, undo?: ItemPatch) => {
    patch.mutate(
      { id: item.id, patch: next },
      {
        onSuccess: () =>
          toast(message, {
            // Long enough to read the message and reach "되돌리기".
            duration: undo ? 8000 : undefined,
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

  const openEditor = () => nav({ to: "/item/$id", params: { id: item.id }, search: { edit: true } });

  function def(code: Code): ActionDef | null {
    switch (code) {
      case "calendar":
        if (!date) return null;
        return { key: code, label: "캘린더에 추가", short: "캘린더", icon: CalendarPlus, run: () => setCalendarOpen(true) };
      case "remind":
        if (item.reminder_enabled) {
          return {
            key: code,
            label: `알림 ${formatShortDate(item.reminder_date) ?? "켜짐"}`,
            short: "알림",
            icon: BellRing,
            active: true,
            // Opens the choices instead of switching off on a single tap.
            run: () => setReminderOpen(true),
          };
        }
        return {
          key: code,
          label: "알림 받기",
          short: "알림",
          icon: Bell,
          run: () => {
            const on = reminderOnPatch(item);
            if (!on) {
              toast("날짜를 먼저 입력해 주세요", { description: "날짜가 있어야 알림 날짜를 정할 수 있어요." });
              return openEditor();
            }
            update(on, `${formatShortDate(on.reminder_date)}에 '지금 할 것'으로 올려 드릴게요`, {
              reminder_enabled: false,
            });
          },
        };
      case "map":
        if (!mapQuery) return null;
        return { key: code, label: "지도 보기", short: "지도", icon: MapPin, run: () => setMapOpen(true) };
      case "call":
        if (!item.phone) return null;
        return {
          key: code,
          label: "전화 걸기",
          short: "전화",
          icon: Phone,
          run: () => {
            window.location.href = `tel:${item.phone!.replace(/[^\d+]/g, "")}`;
          },
        };
      case "open":
        if (!item.source_url) return null;
        return {
          key: code,
          label: item.category === "read" ? "읽기" : item.category === "buy" ? "상품 보기" : "링크 열기",
          short: item.category === "read" ? "읽기" : item.category === "buy" ? "보기" : "열기",
          icon: ExternalLink,
          run: () => openExternal(item.source_url!),
        };
      case "visit":
        return {
          key: code,
          label: "가볼 곳",
          short: "가볼 곳",
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
          short: "오늘",
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
        return {
          key: code,
          label: completeLabel(item.category),
          short: completeLabel(item.category),
          icon: Check,
          run: () => moveTo("completed", "완료로 옮겼어요"),
        };
      case "archive":
        return { key: code, label: "보관", short: "보관", icon: Archive, run: () => moveTo("archived", "보관했어요") };
      case "restore":
        return { key: code, label: "되돌리기", short: "되돌리기", icon: RotateCcw, run: () => moveTo("active", "다시 꺼냈어요") };
      case "confirm":
        return {
          key: code,
          label: "이대로 확인",
          short: "확인",
          icon: Check,
          run: () => update({ status: "active" }, "확인했어요 · 홈에 넣었어요", { status: "inbox" }),
        };
      case "edit":
        return { key: code, label: "직접 입력", short: "입력", icon: Pencil, run: openEditor };
      case "reanalyze":
        return {
          key: code,
          label: "다시 분석",
          short: "다시 분석",
          icon: RotateCw,
          run: () => analyze.mutate({ id: item.id }),
        };
    }
  }

  const pick = (codes: Code[], max: number) => {
    const out: ActionDef[] = [];
    for (const c of new Set(codes)) {
      const d = def(c);
      if (d) out.push(d);
      if (out.length >= max) break;
    }
    return out;
  };

  const stalled = isStalled(item, analyzingIds);

  /** Row: one labelled button for the next step, one icon button for the second. */
  const rowActions = (): { primary: ActionDef | null; secondary: ActionDef | null } => {
    let codes: Code[];
    if (item.status === "completed" || item.status === "archived") codes = ["restore"];
    else if (item.status === "inbox") {
      if (stalled) codes = ["reanalyze", "edit"];
      else if (item.analysis_status === "pending") codes = [];
      // The original is saved either way, so "확인" always comes first.
      else if (item.analysis_status === "failed") codes = isAiOff(item) ? ["confirm", "edit"] : ["confirm", "reanalyze"];
      else codes = ["confirm", "edit"];
    } else if (overdue && (item.category === "event" || item.category === "coupon")) codes = ["complete", "archive"];
    else codes = ROW_ACTIONS[item.category];
    const [primary = null, secondary = null] = pick(codes, 2);
    return { primary, secondary };
  };

  /** Detail: the AI's recommended actions (or the type defaults), feasible ones only. */
  const detailActions = (): ActionDef[] => {
    if (item.status === "completed" || item.status === "archived") return [];
    // The type's own next step leads (it becomes the bottom button); the AI's picks follow.
    const lead: Code[] = overdue && (item.category === "event" || item.category === "coupon") ? ["complete"] : ROW_ACTIONS[item.category].slice(0, 1);
    // "complete" always makes the cut, so a finished event or a visited place can be closed out.
    const rest = pick([...item.recommended_actions, ...ROW_ACTIONS[item.category], "calendar", "call"], 5).map((a) => a.key);
    const withComplete = rest.includes("complete") ? rest : [...rest.slice(0, 3), "complete" as const];
    return pick([...lead, ...withComplete, "archive"], 5);
  };

  const calendarEvent = date
    ? {
        title,
        date,
        time: item.extracted_date ? item.extracted_time : null,
        location: [item.location, item.address].filter(Boolean).join(", ") || null,
        // Everything needed on the day, without opening the app.
        description:
          [
            item.summary,
            item.reservation_number ? `예약번호 ${item.reservation_number}` : null,
            item.phone ? `전화 ${item.phone}` : null,
            item.original_type === "text" && item.original_content !== item.title ? item.original_content : null,
            item.source_url,
          ]
            .filter(Boolean)
            .join("\n") || null,
        reminderDate: item.reminder_enabled ? item.reminder_date : null,
      }
    : null;

  const sheets = (
    <>
      <ReminderSheet item={item} open={reminderOpen} onOpenChange={setReminderOpen} />
      <Sheet
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        title="캘린더에 추가"
        description={`${formatShortDate(date) ?? ""} ${item.extracted_date ? (item.extracted_time ?? "종일") : "종일"} · ${title}`}
      >
        <div className="mt-3 -mx-2">
          <SheetRow
            title="휴대폰 기본 캘린더"
            hint="일정 파일을 받아 캘린더 앱에 넣어요 · 알림도 함께 들어가요"
            trailing={<ChevronRight className="size-4 text-subtle" aria-hidden />}
            onClick={() => {
              if (!calendarEvent) return;
              // ASCII name: some browsers drop a Korean file name and save it as "download".
              downloadIcs(`daram-${calendarEvent.date}`, buildIcs(calendarEvent));
              setCalendarOpen(false);
            }}
          />
          <SheetRow
            title="Google 캘린더"
            hint="새 창에서 일정 추가 화면을 엽니다"
            trailing={<ChevronRight className="size-4 text-subtle" aria-hidden />}
            onClick={() => {
              if (!calendarEvent) return;
              openExternal(googleCalendarUrl(calendarEvent));
              setCalendarOpen(false);
            }}
          />
        </div>
      </Sheet>
      <Sheet open={mapOpen} onOpenChange={setMapOpen} title="지도에서 보기" description={mapQuery ?? undefined}>
        <div className="mt-3 -mx-2">
          <SheetRow
            title="네이버 지도"
            hint="국내 장소 검색에 적합해요"
            trailing={<ChevronRight className="size-4 text-subtle" aria-hidden />}
            onClick={() => {
              if (mapQuery) openExternal(naverMapUrl(mapQuery));
              setMapOpen(false);
            }}
          />
          <SheetRow
            title="Google 지도"
            hint="해외 장소도 찾을 수 있어요"
            trailing={<ChevronRight className="size-4 text-subtle" aria-hidden />}
            onClick={() => {
              if (mapQuery) openExternal(googleMapUrl(mapQuery));
              setMapOpen(false);
            }}
          />
        </div>
      </Sheet>
    </>
  );

  return { rowActions, detailActions, sheets, busy: patch.isPending };
}

function stop(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Compact labelled button on a row (App Store "받기" pattern). */
function ActionPill({ action }: { action: ActionDef }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        action.run();
      }}
      aria-pressed={action.active}
      className={cn(
        "hit-area h-10 shrink-0 rounded-full px-4 text-small font-semibold whitespace-nowrap transition-colors",
        action.active ? "bg-primary text-on-primary" : "bg-surface-2 text-primary active:bg-surface-3",
      )}
    >
      {action.short}
    </button>
  );
}

function ActionIconButton({ action }: { action: ActionDef }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        action.run();
      }}
      aria-label={action.label}
      aria-pressed={action.active}
      className={cn(
        "flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-colors active:bg-surface-2",
        action.active ? "text-primary" : "text-muted",
      )}
    >
      <Icon className="size-5" strokeWidth={action.active ? 2.2 : 1.9} aria-hidden />
      {/* A word under the icon: a bare sun or bell left people guessing. */}
      <span className="text-micro leading-none font-medium whitespace-nowrap" aria-hidden>
        {action.short}
      </span>
    </button>
  );
}

export function RowActions({ item }: { item: Item }) {
  const { rowActions, sheets } = useItemActions(item);
  const { primary, secondary } = rowActions();
  if (!primary) return null;
  return (
    <div className="relative z-10 ml-auto flex shrink-0 items-center gap-2">
      {secondary ? <ActionIconButton action={secondary} /> : null}
      <ActionPill action={primary} />
      {sheets}
    </div>
  );
}

/** Equal-width action tiles (Apple Maps place-card pattern). */
export function ActionTiles({ actions }: { actions: ActionDef[] }) {
  if (!actions.length) return null;
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {actions.map((a) => {
        // The reminder keeps its bell: a check mark there read as "완료".
        const Icon = a.active && a.key !== "remind" ? Check : a.icon;
        return (
          <button
            key={a.key}
            type="button"
            onClick={a.run}
            aria-pressed={a.active}
            className={cn(
              "flex min-h-18 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-surface px-1 py-3 shadow-card transition-colors active:bg-surface-2",
              a.active ? "text-primary" : "text-fg",
            )}
          >
            <Icon className="size-5.5" strokeWidth={1.9} aria-hidden />
            <span className="w-full truncate text-center text-micro font-medium">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}
