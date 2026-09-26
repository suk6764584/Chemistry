import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryButton, CategoryPicker } from "@/components/category";
import { RowActions } from "@/components/item-actions";
import { ItemImage } from "@/components/item-image";
import { isStalled } from "@/lib/items/home";
import { isReminderDue } from "@/lib/items/reminder";
import { CATEGORY_LABELS, isAiOff, keyDate, type Item } from "@/lib/items/types";
import { useAnalyzingIds, useItemMutations } from "@/lib/query";
import { cn, daysUntil, formatAmount, formatCompactDate, formatDday, formatShortDate, todayISO } from "@/lib/utils";

function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The facts that matter for this type, in one line. */
function metaLine(item: Item): string | null {
  const parts: (string | null)[] = [];
  switch (item.category) {
    case "coupon":
      if (item.expiration_date) parts.push(`${formatCompactDate(item.expiration_date)}까지`);
      if (item.coupon_brand && !item.title?.includes(item.coupon_brand)) parts.push(item.coupon_brand);
      else if (item.coupon_product && !item.title?.includes(item.coupon_product)) parts.push(item.coupon_product);
      break;
    case "event":
      if (item.extracted_date) {
        parts.push([formatCompactDate(item.extracted_date), item.extracted_time].filter(Boolean).join(" "));
      }
      parts.push(item.location);
      break;
    case "place":
      parts.push(item.address && item.address !== item.title ? item.address : item.location !== item.title ? item.location : null);
      break;
    case "todo":
      if (keyDate(item)) parts.push(`${formatCompactDate(keyDate(item))}까지`);
      break;
    case "buy":
      parts.push(formatAmount(item.amount), hostname(item.source_url));
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

function Dday({ date }: { date: string | null }) {
  const days = daysUntil(date);
  const text = formatDday(date);
  if (days === null || !text) return null;
  if (days < 0) return <span>{text} 지남</span>;
  return (
    <span className={cn("tabular-nums", days <= 3 ? "font-semibold text-danger" : days <= 7 ? "font-semibold text-warn" : "")}>
      {text}
    </span>
  );
}

function Dot() {
  return <span aria-hidden> · </span>;
}

/**
 * One saved item as a list row: type icon, title, the one line of facts that
 * matters, and the next action on the right. Tapping the row opens the detail.
 */
export function ItemRow({ item, markUnconfirmed = false }: { item: Item; markUnconfirmed?: boolean }) {
  const [picking, setPicking] = useState(false);
  const { patch } = useItemMutations();
  const analyzingIds = useAnalyzingIds();
  const title = item.title || "제목 없음";
  const done = item.status === "completed" || item.status === "archived";
  const inbox = item.status === "inbox";
  const stalled = isStalled(item, analyzingIds);
  const analyzing = item.analysis_status === "pending" && !stalled;
  const meta = metaLine(item);

  const note = !inbox
    ? null
    : stalled
      ? { tone: "warn" as const, text: "분석이 중간에 멈췄어요." }
      : item.analysis_status === "failed"
        ? isAiOff(item)
          ? null // A normal state, said once above the list — not a red line on every row.
          : { tone: "danger" as const, text: item.analysis_error || "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요." }
        : item.analysis_note
          ? { tone: "warn" as const, text: item.analysis_note }
          : null;

  return (
    // Wraps: when text is large or the row is narrow, the buttons move under the title
    // instead of squeezing it.
    <article aria-label={title} className="row-divider-text flex min-h-18 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <Link to="/item/$id" params={{ id: item.id }} className="absolute inset-0" aria-label={`${title} 자세히`} />
      {inbox && item.has_image ? <ItemImage id={item.id} hasImage alt="" className="size-11 shrink-0 rounded-sm" /> : null}

      <div className="min-w-[10.5rem] flex-1 basis-0 py-0.5">
        <h3 className="line-clamp-2 text-body font-semibold">{title}</h3>
        {analyzing ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-small text-muted" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            내용을 읽는 중…
          </p>
        ) : (
          <p className="mt-0.5 truncate text-small text-muted">
            {!done && isReminderDue(item) ? (
              <BellRing className="mr-1 inline size-3.5 -translate-y-px text-warn" aria-label="알림" />
            ) : null}
            {done ? (
              <>
                {item.status === "completed" ? "완료" : "보관"}
                <Dot />
                {formatShortDate(todayISO(new Date(item.updated_at)))}
              </>
            ) : (
              <>
                {inbox && markUnconfirmed ? (
                  <>
                    <span className="font-semibold text-warn">확인 전</span>
                    <Dot />
                  </>
                ) : null}
                {inbox ? (
                  <span className="relative z-10">
                    <CategoryButton category={item.category} onClick={() => setPicking(true)} />
                  </span>
                ) : (
                  CATEGORY_LABELS[item.category]
                )}
                {keyDate(item) ? (
                  <>
                    <Dot />
                    <Dday date={keyDate(item)} />
                  </>
                ) : null}
                {meta ? (
                  <>
                    <Dot />
                    {meta}
                  </>
                ) : null}
              </>
            )}
          </p>
        )}
        {note ? (
          <p className={cn("mt-1 line-clamp-2 text-small", note.tone === "danger" ? "text-danger" : "text-warn")}>{note.text}</p>
        ) : null}
      </div>

      <RowActions item={item} />

      {inbox ? (
        <CategoryPicker
          open={picking}
          onOpenChange={setPicking}
          value={item.category}
          onSelect={(category) => {
            setPicking(false);
            if (category === item.category) return;
            patch.mutate(
              { id: item.id, patch: { category } },
              { onError: () => toast.error("분류를 바꾸지 못했어요. 다시 시도해 주세요.") },
            );
          }}
        />
      ) : null}
    </article>
  );
}

export function Notice({ tone, children }: { tone: "warn" | "danger" | "info"; children: React.ReactNode }) {
  const styles = {
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-surface text-muted shadow-card",
  } as const;
  return (
    <p className={cn("flex gap-2 rounded-lg px-4 py-3 text-small", styles[tone])}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
