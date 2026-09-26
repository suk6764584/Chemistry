import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  ListTodo,
  MapPin,
  Shapes,
  ShoppingBag,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetRow } from "@/components/ui/sheet";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/items/types";
import { cn } from "@/lib/utils";

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

/** Monochrome icon tile — type is told by the glyph and the label, not by color. */
export function CategoryTile({ category, small = false }: { category: Category; small?: boolean }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-surface-2 text-fg",
        small ? "size-7 rounded-sm" : "size-10 rounded-sm",
      )}
      aria-hidden
    >
      <Icon className={small ? "size-4" : "size-5"} strokeWidth={1.9} />
    </span>
  );
}

/** Text button showing the category, opening the picker — the one-tap fix for a wrong classification. */
export function CategoryButton({ category, onClick }: { category: Category; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={`분류: ${CATEGORY_LABELS[category]} (바꾸기)`}
      className="hit-area inline-flex items-center gap-0.5 font-medium text-muted underline decoration-surface-3 underline-offset-4"
    >
      {CATEGORY_LABELS[category]}
      <ChevronDown className="size-3.5" aria-hidden />
    </button>
  );
}

export function CategoryPicker({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: Category;
  onSelect: (c: Category) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="분류 바꾸기" description="맞는 분류를 고르면 바로 저장돼요.">
      <div className="mt-3 -mx-2" role="radiogroup" aria-label="분류 선택">
        {CATEGORIES.map((c) => (
          <SheetRow
            key={c}
            role="radio"
            checked={c === value}
            leading={<CategoryTile category={c} />}
            title={CATEGORY_LABELS[c]}
            trailing={c === value ? <Check className="size-5 text-primary" aria-hidden /> : null}
            onClick={() => onSelect(c)}
          />
        ))}
      </div>
    </Sheet>
  );
}
