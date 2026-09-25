import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ItemActions } from "@/components/item-actions";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Item } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { cn, daysUntil, formatDday, formatShortDate } from "@/lib/utils";

const CAT_CLASS: Record<Category, string> = {
  coupon: "text-warn",
  event: "text-accent",
  place: "text-ok",
  todo: "text-fg",
  buy: "text-muted",
  read: "text-muted",
  reference: "text-muted",
  other: "text-muted",
};

export function ItemCard({ item }: { item: Item }) {
  const date = item.expiration_date || item.extracted_date;
  const dday = formatDday(date);
  const soon = (daysUntil(date) ?? 99) <= 7;
  const analyzing = item.analysis_status === "pending";
  const failed = item.analysis_status === "failed";
  const [picking, setPicking] = useState(false);
  const { patch } = useItemMutations();

  return (
    <article className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            className={cn("text-xs font-medium", CAT_CLASS[item.category])}
            onClick={() => setPicking((v) => !v)}
          >
            {CATEGORY_LABELS[item.category]}
          </button>
          <Link to="/item/$id" params={{ id: item.id }} className="block">
            <h3 className="mt-1 truncate text-base font-semibold tracking-tight">
              {item.title || "제목 없음"}
            </h3>
            {item.coupon_product && item.coupon_brand ? (
              <p className="mt-0.5 text-sm text-muted">
                {item.coupon_brand} · {item.coupon_product}
              </p>
            ) : item.location ? (
              <p className="mt-0.5 truncate text-sm text-muted">
                {item.location}
                {item.address ? ` · ${item.address}` : ""}
              </p>
            ) : item.summary ? (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted">{item.summary}</p>
            ) : null}
          </Link>
        </div>
        {dday ? (
          <Badge className={cn("shrink-0 tabular-nums", soon ? "bg-warn/10 text-warn" : "")}>
            {formatShortDate(date)} · {dday}
          </Badge>
        ) : null}
      </div>

      {picking ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "h-9 rounded-full px-3 text-xs font-medium",
                c === item.category ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
              )}
              onClick={() => {
                patch.mutate({ id: item.id, patch: { category: c, status: item.status === "inbox" ? "active" : item.status } });
                setPicking(false);
              }}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      ) : null}

      <Link to="/item/$id" params={{ id: item.id }} className="block">
        {item.has_image ? (
          <ItemImage
            id={item.id}
            hasImage
            alt=""
            className="mt-3 h-28 w-full rounded-md object-cover"
          />
        ) : null}

        {item.extracted_time && item.extracted_date ? (
          <p className="mt-2 text-sm text-muted">{item.extracted_time}</p>
        ) : null}
      </Link>

      {analyzing ? (
        <p className="mt-3 text-sm text-muted">읽고 있습니다…</p>
      ) : failed ? (
        <p className="mt-3 text-sm text-danger">
          {item.analysis_error || "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요."}
        </p>
      ) : null}

      {!analyzing ? (
        <div className="mt-3">
          <ItemActions item={item} />
        </div>
      ) : null}
    </article>
  );
}
