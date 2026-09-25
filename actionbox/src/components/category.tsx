import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileText,
  ListTodo,
  MapPin,
  Shapes,
  ShoppingBag,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/items/types";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<Category, string> = {
  event: "bg-cat-event-soft text-cat-event",
  coupon: "bg-cat-coupon-soft text-cat-coupon",
  place: "bg-cat-place-soft text-cat-place",
  todo: "bg-cat-todo-soft text-cat-todo",
  buy: "bg-cat-buy-soft text-cat-buy",
  read: "bg-cat-read-soft text-cat-read",
  reference: "bg-cat-reference-soft text-cat-reference",
  other: "bg-cat-other-soft text-cat-other",
};

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  event: CalendarDays,
  coupon: Ticket,
  place: MapPin,
  todo: ListTodo,
  buy: ShoppingBag,
  read: BookOpen,
  reference: FileText,
  other: Shapes,
};

/** Category label. With `onClick` it becomes the one-tap way to fix a wrong classification. */
export function CategoryPill({
  category,
  onClick,
  expanded,
}: {
  category: Category;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const Icon = CATEGORY_ICON[category];
  const className = cn(
    "inline-flex h-7 items-center gap-1 rounded-full pr-2.5 pl-2 text-[13px] font-semibold",
    CATEGORY_STYLE[category],
  );
  const body = (
    <>
      <Icon className="size-3.5" strokeWidth={2.2} aria-hidden />
      {CATEGORY_LABELS[category]}
      {onClick ? (
        <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
      ) : null}
    </>
  );
  if (!onClick) return <span className={className}>{body}</span>;
  return (
    <button
      type="button"
      className={cn(className, "relative after:absolute after:-inset-2 after:content-['']")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={expanded}
      aria-label={`분류: ${CATEGORY_LABELS[category]} (바꾸기)`}
    >
      {body}
    </button>
  );
}

export function CategoryChips({ value, onSelect }: { value: Category; onSelect: (c: Category) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="분류 선택">
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON[c];
        const selected = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(c);
            }}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 rounded-md text-[12px] font-semibold",
              selected ? "bg-primary text-on-primary" : "bg-surface-2 text-muted active:bg-surface-3",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {CATEGORY_LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}
