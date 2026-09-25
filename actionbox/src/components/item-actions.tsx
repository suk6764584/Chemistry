import { useNavigate } from "@tanstack/react-router";
import { Bell, BellOff, CalendarPlus, Check, MapPin, Pin } from "lucide-react";
import { toast } from "sonner";
import { downloadIcs, buildIcs, googleCalendarUrl } from "@/lib/items/ics";
import { mapSearchQuery, naverMapUrl } from "@/lib/items/maps";
import type { Item } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { cn } from "@/lib/utils";

function ActionBtn({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex h-10 min-h-10 items-center gap-1.5 rounded-sm bg-surface-2 px-3 text-sm font-medium text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ItemActions({ item, compact = false }: { item: Item; compact?: boolean }) {
  const nav = useNavigate();
  const { patch } = useItemMutations();
  const mapQ = mapSearchQuery(item.location, item.address);
  const eventDate = item.extracted_date;
  const title = item.title || "제목 없음";

  const complete = () => {
    patch.mutate(
      { id: item.id, patch: { status: "completed", do_today: false } },
      { onSuccess: () => toast.success("완료로 옮겼습니다") },
    );
  };
  const archive = () => {
    patch.mutate(
      { id: item.id, patch: { status: "archived" } },
      { onSuccess: () => toast.success("보관했습니다") },
    );
  };
  const toggleToday = () => {
    patch.mutate(
      { id: item.id, patch: { do_today: !item.do_today } },
      { onSuccess: () => toast.success(item.do_today ? "오늘에서 뺐습니다" : "오늘 할 일에 넣었습니다") },
    );
  };
  const toggleReminder = () => {
    patch.mutate(
      { id: item.id, patch: { reminder_enabled: !item.reminder_enabled } },
      { onSuccess: () => toast.success(item.reminder_enabled ? "알림을 껐습니다" : "알림을 켰습니다") },
    );
  };
  const addCalendar = () => {
    if (!eventDate) {
      toast.error("날짜가 없습니다. 상세에서 날짜를 입력해 주세요.");
      return;
    }
    downloadIcs(
      title,
      buildIcs({
        title,
        date: eventDate,
        time: item.extracted_time,
        location: [item.location, item.address].filter(Boolean).join(", "),
        description: item.summary,
      }),
    );
    window.open(
      googleCalendarUrl({
        title,
        date: eventDate,
        time: item.extracted_time,
        location: [item.location, item.address].filter(Boolean).join(", "),
        description: item.summary,
      }),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const goDetail = () => nav({ to: "/item/$id", params: { id: item.id } });

  const buttons: React.ReactNode[] = [];

  if (item.category === "coupon") {
    buttons.push(
      <ActionBtn key="done" onClick={complete}>
        <Check className="size-4" />
        사용완료
      </ActionBtn>,
      <ActionBtn key="bell" onClick={toggleReminder}>
        {item.reminder_enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        알림
      </ActionBtn>,
    );
  } else if (item.category === "place") {
    if (mapQ) {
      buttons.push(
        <ActionBtn
          key="map"
          onClick={() => window.open(naverMapUrl(mapQ), "_blank", "noopener,noreferrer")}
        >
          <MapPin className="size-4" />
          지도
        </ActionBtn>,
      );
    }
    buttons.push(
      <ActionBtn key="today" onClick={toggleToday}>
        <Pin className="size-4" />
        가볼 곳
      </ActionBtn>,
    );
  } else if (item.category === "event") {
    buttons.push(
      <ActionBtn key="cal" onClick={addCalendar}>
        <CalendarPlus className="size-4" />
        캘린더
      </ActionBtn>,
      <ActionBtn key="bell" onClick={toggleReminder}>
        {item.reminder_enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        알림
      </ActionBtn>,
    );
    if (mapQ) {
      buttons.push(
        <ActionBtn
          key="map"
          onClick={() => window.open(naverMapUrl(mapQ), "_blank", "noopener,noreferrer")}
        >
          <MapPin className="size-4" />
          지도
        </ActionBtn>,
      );
    }
  } else if (item.category === "todo") {
    buttons.push(
      <ActionBtn key="done" onClick={complete}>
        <Check className="size-4" />
        완료
      </ActionBtn>,
      <ActionBtn key="today" onClick={toggleToday}>
        <Pin className="size-4" />
        오늘
      </ActionBtn>,
    );
  } else if (item.category === "read") {
    if (item.source_url) {
      buttons.push(
        <ActionBtn
          key="open"
          onClick={() => window.open(item.source_url!, "_blank", "noopener,noreferrer")}
        >
          열기
        </ActionBtn>,
      );
    }
    buttons.push(
      <ActionBtn key="done" onClick={complete}>
        <Check className="size-4" />
        완료
      </ActionBtn>,
    );
  } else if (item.category === "buy") {
    if (item.source_url) {
      buttons.push(
        <ActionBtn
          key="open"
          onClick={() => window.open(item.source_url!, "_blank", "noopener,noreferrer")}
        >
          링크
        </ActionBtn>,
      );
    }
    buttons.push(
      <ActionBtn key="keep" onClick={archive}>
        보관
      </ActionBtn>,
    );
  } else {
    buttons.push(
      <ActionBtn key="done" onClick={complete}>
        <Check className="size-4" />
        완료
      </ActionBtn>,
    );
  }

  if (!compact) {
    buttons.push(
      <ActionBtn key="detail" onClick={goDetail} className="bg-transparent text-muted">
        상세
      </ActionBtn>,
    );
  }

  return <div className="flex flex-wrap gap-2">{buttons}</div>;
}
