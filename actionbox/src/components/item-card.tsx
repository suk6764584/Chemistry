import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, BellRing, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryChips, CategoryPill } from "@/components/category";
import { CardActions } from "@/components/item-actions";
import { ItemImage } from "@/components/item-image";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { isReminderDue } from "@/lib/items/reminder";
import { keyDate, type Item } from "@/lib/items/types";
import { useAnalyzingIds, useItemMutations } from "@/lib/query";
import { daysUntil, formatDday, formatShortDate } from "@/lib/utils";

/** Analysis that has shown "pending" this long with no request from this tab has stalled. */
const STALE_PENDING_MS = 90_000;

export function isStalled(item: Item, analyzingIds: string[]): boolean {
  return (
    item.analysis_status === "pending" &&
    !analyzingIds.includes(item.id) &&
    Date.now() - new Date(item.updated_at).getTime() > STALE_PENDING_MS
  );
}

function ddayTone(days: number): BadgeTone {
  if (days < 0) return "neutral";
  if (days <= 3) return "danger";
  if (days <= 7) return "warn";
  return "neutral";
}

function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The one line under the title — only what matters for this type. */
function metaLine(item: Item): string | null {
  const parts: (string | null)[] = [];
  switch (item.category) {
    case "coupon":
      if (item.expiration_date) parts.push(`${formatShortDate(item.expiration_date)}까지`);
      if (item.coupon_brand && !item.title?.includes(item.coupon_brand)) parts.push(item.coupon_brand);
      else if (item.coupon_product && !item.title?.includes(item.coupon_product)) parts.push(item.coupon_product);
      break;
    case "event":
      if (item.extracted_date) {
        parts.push([formatShortDate(item.extracted_date), item.extracted_time].filter(Boolean).join(" "));
      }
      parts.push(item.location);
      break;
    case "place":
      parts.push(item.address && item.address !== item.title ? item.address : item.location !== item.title ? item.location : null);
      break;
    case "todo":
      if (keyDate(item)) parts.push(`${formatShortDate(keyDate(item))}까지`);
      break;
    case "buy":
      parts.push(item.amount, hostname(item.source_url));
      break;
    case "read":
    case "reference":
      parts.push(hostname(item.source_url));
      break;
  }
  const line = parts.filter(Boolean).join(" · ");
  if (line) return line;
  return item.summary ? item.summary.split("\n")[0] : null;
}

export function ItemCard({ item }: { item: Item }) {
  const [picking, setPicking] = useState(false);
  const { patch, analyze } = useItemMutations();
  const analyzingIds = useAnalyzingIds();
  const date = keyDate(item);
  const days = daysUntil(date);
  const dday = formatDday(date);
  const done = item.status === "completed" || item.status === "archived";
  const inbox = item.status === "inbox";
  const analyzing = item.analysis_status === "pending" && !isStalled(item, analyzingIds);
  const stalled = isStalled(item, analyzingIds);
  const meta = metaLine(item);
  const reminderDue = !done && isReminderDue(item);

  const changeCategory = (category: Item["category"]) => {
    setPicking(false);
    if (category === item.category) return;
    patch.mutate(
      { id: item.id, patch: { category } },
      { onError: () => toast.error("분류를 바꾸지 못했어요. 다시 시도해 주세요.") },
    );
  };

  return (
    <article className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]" aria-label={item.title ?? "항목"}>
      <div className="flex items-center justify-between gap-2">
        <CategoryPill
          category={item.category}
          expanded={picking}
          onClick={analyzing ? undefined : () => setPicking((v) => !v)}
        />
        <div className="flex items-center gap-1.5">
          {reminderDue ? (
            <Badge tone="warn">
              <BellRing className="size-3" aria-hidden />
              알림
            </Badge>
          ) : null}
          {dday && days !== null && !done ? (
            <Badge tone={ddayTone(days)}>{days < 0 ? `${dday} 지남` : dday}</Badge>
          ) : null}
          {done ? <Badge>{item.status === "completed" ? "완료" : "보관"}</Badge> : null}
        </div>
      </div>

      {picking ? (
        <div className="mt-3">
          <p className="mb-2 text-[13px] text-subtle">맞는 분류를 고르세요</p>
          <CategoryChips value={item.category} onSelect={changeCategory} />
        </div>
      ) : null}

      <Link to="/item/$id" params={{ id: item.id }} className="mt-2.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[17px] leading-snug font-bold tracking-tight">{item.title || "제목 없음"}</h3>
          {meta ? <p className="mt-1 truncate text-[14px] text-muted">{meta}</p> : null}
        </div>
        {item.has_image && inbox ? (
          <ItemImage id={item.id} hasImage alt="" className="size-14 shrink-0 rounded-md" />
        ) : item.has_image ? (
          <ImageIcon className="mt-1 size-4 shrink-0 text-subtle" aria-label="사진 있음" />
        ) : null}
      </Link>

      {inbox ? (
        analyzing ? (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-muted" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            내용을 읽는 중이에요…
          </p>
        ) : stalled ? (
          <Notice tone="warn">
            분석이 중간에 멈췄어요.{" "}
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={() => analyze.mutate({ id: item.id })}
            >
              다시 분석
            </button>
          </Notice>
        ) : item.analysis_status === "failed" ? (
          <Notice tone="danger">{item.analysis_error || "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요."}</Notice>
        ) : item.analysis_note ? (
          <Notice tone="warn">{item.analysis_note}</Notice>
        ) : null
      ) : null}

      {!analyzing && !stalled ? (
        <div className="mt-3">
          <CardActions item={item} />
        </div>
      ) : null}
    </article>
  );
}

export function Notice({ tone, children }: { tone: "warn" | "danger" | "info"; children: React.ReactNode }) {
  const styles = {
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-surface-2 text-muted",
  } as const;
  return (
    <p className={`mt-3 flex gap-2 rounded-md px-3 py-2.5 text-[14px] leading-snug ${styles[tone]}`}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
