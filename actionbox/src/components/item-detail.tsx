import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  Clock,
  ExternalLink,
  Hash,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Tag,
  Ticket,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { CategoryChips, CategoryPill } from "@/components/category";
import { isStalled, Notice } from "@/components/item-card";
import { RecommendedActions } from "@/components/item-actions";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REMINDER_PRESETS, reminderPreset } from "@/lib/items/reminder";
import { keyDate, SAMPLE_NOTE, type Category, type Item, type ItemPatch } from "@/lib/items/types";
import { useAnalyzingIds, useItemMutations } from "@/lib/query";
import { addDaysISO, cn, formatDateWithWeekday, formatDday, formatKoreanDate, formatTimestamp } from "@/lib/utils";

const STATUS_LABEL: Record<Item["status"], string> = {
  inbox: "확인 필요",
  active: "진행 중",
  completed: "완료",
  archived: "보관",
};

const TYPE_LABEL: Record<Item["original_type"], string> = {
  image: "사진",
  screenshot: "스크린샷",
  url: "링크",
  text: "텍스트",
};

function errorText(e: unknown) {
  return e instanceof Error && e.message ? e.message : "저장하지 못했어요. 다시 시도해 주세요.";
}

export function ItemDetail({ item, startEditing, onEditingChange }: {
  item: Item;
  startEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const nav = useNavigate();
  const { patch, remove, analyze } = useItemMutations();
  const analyzingIds = useAnalyzingIds();
  const [editing, setEditingState] = useState(Boolean(startEditing));
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setEditing = (v: boolean) => {
    setEditingState(v);
    onEditingChange?.(v);
  };

  const stalled = isStalled(item, analyzingIds);
  const analyzing = item.analysis_status === "pending" && !stalled;
  const inbox = item.status === "inbox";
  const done = item.status === "completed" || item.status === "archived";

  if (editing) return <ItemEditor item={item} onClose={() => setEditing(false)} />;

  const confirm = () =>
    patch.mutate(
      { id: item.id, patch: { status: "active" } },
      {
        onSuccess: () => toast.success("확인했어요 · 홈에 넣었어요"),
        onError: (e) => toast.error(errorText(e)),
      },
    );

  return (
    <div className={cn("space-y-6", inbox && !analyzing && "pb-20")}>
      <Original item={item} />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill
            category={item.category}
            expanded={picking}
            onClick={analyzing ? undefined : () => setPicking((v) => !v)}
          />
          <Badge tone={inbox ? "warn" : done ? "neutral" : "primary"}>{STATUS_LABEL[item.status]}</Badge>
        </div>
        {picking ? (
          <div className="mt-3">
            <CategoryChips
              value={item.category}
              onSelect={(category) => {
                setPicking(false);
                if (category !== item.category) {
                  patch.mutate({ id: item.id, patch: { category } }, { onError: (e) => toast.error(errorText(e)) });
                }
              }}
            />
          </div>
        ) : null}
        <h1 className="mt-3 text-[24px] leading-tight font-extrabold tracking-tight break-words">
          {item.title || "제목 없음"}
        </h1>
        {item.summary ? (
          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-muted">{item.summary}</p>
        ) : null}
      </div>

      {analyzing ? (
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]" role="status">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            내용을 읽는 중이에요
          </p>
          <p className="mt-1 text-[13px] text-subtle">원본은 이미 저장됐어요. 다른 화면으로 가도 분석은 계속돼요.</p>
        </div>
      ) : stalled ? (
        <Notice tone="warn">분석이 중간에 멈췄어요. 아래 ‘다시 분석’을 눌러 주세요.</Notice>
      ) : inbox && item.analysis_status === "failed" ? (
        <Notice tone="danger">{item.analysis_error || "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요."}</Notice>
      ) : item.analysis_note ? (
        <Notice tone={item.analysis_note === SAMPLE_NOTE ? "info" : "warn"}>{item.analysis_note}</Notice>
      ) : null}

      {!analyzing ? (
        <Block title="추천 행동">
          <RecommendedActions item={item} />
        </Block>
      ) : null}

      <Block
        title="정보"
        action={
          analyzing ? null : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="-mr-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-[14px] font-semibold text-primary active:bg-primary-soft"
            >
              <Pencil className="size-4" aria-hidden />
              수정
            </button>
          )
        }
      >
        <InfoList item={item} onEdit={() => setEditing(true)} />
      </Block>

      {!done && !analyzing ? <ReminderControl item={item} /> : null}

      <p className="px-0.5 text-[13px] text-subtle">
        {formatTimestamp(item.created_at)} 저장 · {TYPE_LABEL[item.original_type]}
      </p>

      <div className="border-t border-line pt-4">
        {confirmDelete ? (
          <div className="space-y-3">
            <p className="text-[14px] text-danger">이 항목과 원본을 완전히 지웁니다. 되돌릴 수 없어요.</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                취소
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(item.id, {
                    onSuccess: () => {
                      toast.success("삭제했어요");
                      nav({ to: "/" });
                    },
                    onError: (e) => toast.error(errorText(e)),
                  })
                }
              >
                완전히 삭제
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="h-11 px-0.5 text-[14px] font-semibold text-subtle active:text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            항목 삭제
          </button>
        )}
      </div>

      {inbox && !analyzing ? (
        <BottomBar>
          {item.analysis_status === "failed" || stalled ? (
            <>
              <Button
                variant="secondary"
                className="h-12 flex-1"
                disabled={analyze.isPending}
                onClick={() => analyze.mutate({ id: item.id })}
              >
                다시 분석
              </Button>
              <Button className="h-12 flex-[1.4]" onClick={() => setEditing(true)}>
                직접 입력
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="h-12 flex-1" onClick={() => setEditing(true)}>
                수정
              </Button>
              <Button className="h-12 flex-[1.4]" disabled={patch.isPending} onClick={confirm}>
                이대로 확인
              </Button>
            </>
          )}
        </BottomBar>
      ) : null}
    </div>
  );
}

function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-md px-4 pb-3">
      <div className="flex gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-float)]">{children}</div>
    </div>
  );
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex h-10 items-center justify-between px-0.5">
        <h2 className="text-[15px] font-bold text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Original({ item }: { item: Item }) {
  if (item.has_image) {
    return (
      <ItemImage
        id={item.id}
        hasImage
        alt={item.title || "원본 이미지"}
        className="max-h-80 min-h-40 w-full rounded-xl bg-surface-3 object-contain"
      />
    );
  }
  if (item.original_type === "url" && item.source_url) {
    return (
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-card)] active:bg-surface-2"
      >
        <ExternalLink className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[14px] text-muted">{item.source_url}</span>
      </a>
    );
  }
  if (item.original_content) {
    return (
      <p className="max-h-60 overflow-y-auto rounded-xl bg-surface p-4 text-[15px] leading-relaxed break-words whitespace-pre-wrap shadow-[var(--shadow-card)]">
        {item.original_content}
      </p>
    );
  }
  return null;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function InfoList({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const rows: { icon: LucideIcon; label: string; value: ReactNode; warn?: boolean }[] = [];
  const withDday = (date: string) => {
    const dday = formatDday(date);
    return (
      <>
        {formatDateWithWeekday(date)}
        {dday ? <span className="ml-1.5 text-[13px] font-semibold text-subtle">{dday}</span> : null}
      </>
    );
  };

  if (item.extracted_date) rows.push({ icon: CalendarDays, label: "날짜", value: withDday(item.extracted_date) });
  else if (item.category === "event") rows.push({ icon: CalendarDays, label: "날짜", value: "확인 필요", warn: true });
  if (item.extracted_time) rows.push({ icon: Clock, label: "시간", value: item.extracted_time });
  if (item.expiration_date) {
    rows.push({ icon: CalendarDays, label: item.category === "coupon" ? "만료일" : "마감일", value: withDday(item.expiration_date) });
  } else if (item.category === "coupon") {
    rows.push({ icon: CalendarDays, label: "만료일", value: "확인 필요", warn: true });
  }
  if (item.coupon_brand) rows.push({ icon: Tag, label: "브랜드", value: item.coupon_brand });
  if (item.coupon_product) rows.push({ icon: Ticket, label: "상품", value: item.coupon_product });
  if (item.location) rows.push({ icon: Building2, label: "장소", value: item.location });
  if (item.address) rows.push({ icon: MapPin, label: "주소", value: item.address });
  if (item.amount) rows.push({ icon: Wallet, label: "금액", value: item.amount });
  if (item.phone) {
    rows.push({
      icon: Phone,
      label: "전화",
      value: (
        <a className="text-primary" href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}>
          {item.phone}
        </a>
      ),
    });
  }
  if (item.reservation_number) rows.push({ icon: Hash, label: "예약번호", value: item.reservation_number });
  if (item.source_url && item.original_type !== "url") {
    rows.push({
      icon: ExternalLink,
      label: "링크",
      value: (
        <a className="text-primary" href={item.source_url} target="_blank" rel="noopener noreferrer">
          {hostname(item.source_url)}
        </a>
      ),
    });
  }

  if (!rows.length) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded-xl border border-dashed border-line px-4 py-5 text-center text-[14px] text-subtle"
      >
        찾은 날짜·장소가 없어요. 눌러서 직접 입력하세요.
      </button>
    );
  }

  return (
    <dl className="divide-y divide-line rounded-xl bg-surface px-4 shadow-[var(--shadow-card)]">
      {rows.map((r) => (
        <div key={r.label} className="flex min-h-12 items-center gap-3 py-2.5">
          <r.icon className="size-4 shrink-0 text-subtle" aria-hidden />
          <dt className="w-16 shrink-0 text-[14px] text-subtle">{r.label}</dt>
          <dd className={cn("min-w-0 flex-1 text-right text-[15px] font-medium break-words", r.warn && "text-warn")}>
            {r.warn ? (
              <button type="button" onClick={onEdit} className="font-semibold underline underline-offset-2">
                {r.value}
              </button>
            ) : (
              r.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReminderControl({ item }: { item: Item }) {
  const { patch } = useItemMutations();
  const key = keyDate(item);
  const preset = reminderPreset(item);
  const [choosingDate, setChoosingDate] = useState(false);
  const showDate = choosingDate || preset === "custom";

  const set = (next: ItemPatch) =>
    patch.mutate({ id: item.id, patch: next }, { onError: (e) => toast.error(errorText(e)) });

  return (
    <Block title="알림">
      <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="알림 시점">
          <Chip
            active={!item.reminder_enabled && !showDate}
            onClick={() => {
              setChoosingDate(false);
              set({ reminder_enabled: false });
            }}
          >
            끄기
          </Chip>
          {key
            ? REMINDER_PRESETS.map((p) => (
                <Chip
                  key={p.days}
                  active={preset === p.days && !choosingDate}
                  onClick={() => {
                    setChoosingDate(false);
                    set({ reminder_enabled: true, reminder_date: addDaysISO(key, -p.days) });
                  }}
                >
                  {p.label}
                </Chip>
              ))
            : null}
          <Chip active={showDate} onClick={() => setChoosingDate(true)}>
            날짜 선택
          </Chip>
        </div>
        {showDate ? (
          <Input
            type="date"
            aria-label="알림 날짜"
            className="mt-3"
            value={item.reminder_date ?? ""}
            onChange={(e) => {
              if (e.target.value) set({ reminder_enabled: true, reminder_date: e.target.value });
            }}
          />
        ) : null}
        <p className="mt-3 text-[13px] leading-snug text-subtle">
          {item.reminder_enabled && item.reminder_date
            ? `${formatKoreanDate(item.reminder_date)}부터 홈의 ‘지금 할 것’에 올라와요.`
            : key
              ? "알림이 꺼져 있어요."
              : "날짜가 없는 항목이에요. 원하면 알림 날짜를 직접 고르세요."}{" "}
          휴대폰 푸시 알림은 아직 지원하지 않아요.
        </p>
      </div>
    </Block>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "h-10 rounded-full px-3.5 text-[14px] font-semibold",
        active ? "bg-primary text-on-primary" : "bg-surface-2 text-muted active:bg-surface-3",
      )}
    >
      {children}
    </button>
  );
}

// ── Editing ──────────────────────────────────────────────────────────────────

type Form = {
  title: string;
  category: Category;
  summary: string;
  extracted_date: string;
  extracted_time: string;
  expiration_date: string;
  location: string;
  address: string;
  amount: string;
  phone: string;
  reservation_number: string;
  coupon_brand: string;
  coupon_product: string;
  source_url: string;
};

function formFrom(item: Item): Form {
  return {
    title: item.title ?? "",
    category: item.category,
    summary: item.summary ?? "",
    extracted_date: item.extracted_date ?? "",
    extracted_time: item.extracted_time ?? "",
    expiration_date: item.expiration_date ?? "",
    location: item.location ?? "",
    address: item.address ?? "",
    amount: item.amount ?? "",
    phone: item.phone ?? "",
    reservation_number: item.reservation_number ?? "",
    coupon_brand: item.coupon_brand ?? "",
    coupon_product: item.coupon_product ?? "",
    source_url: item.source_url ?? "",
  };
}

function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { patch } = useItemMutations();
  const [form, setForm] = useState<Form>(() => formFrom(item));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const inbox = item.status === "inbox";
  const showCoupon = form.category === "coupon" || Boolean(item.coupon_brand || item.coupon_product);

  const save = () => {
    const nextPatch: ItemPatch = {
      ...form,
      status: inbox ? "active" : item.status,
    };
    patch.mutate(
      { id: item.id, patch: nextPatch },
      {
        onSuccess: () => {
          toast.success(inbox ? "저장했어요 · 홈에 넣었어요" : "저장했어요");
          onClose();
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );
  };

  const text = (key: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} htmlFor={`f-${key}`}>
      <Input id={`f-${key}`} value={form[key]} onChange={(e) => set(key, e.target.value)} {...props} />
    </Field>
  );

  const date = (key: "extracted_date" | "expiration_date", label: string) => (
    <Field label={label} htmlFor={`f-${key}`}>
      <div className="relative">
        <Input id={`f-${key}`} type="date" value={form[key]} onChange={(e) => set(key, e.target.value)} />
        {form[key] ? (
          <button
            type="button"
            aria-label={`${label} 지우기`}
            onClick={() => set(key, "")}
            className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface text-subtle"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </Field>
  );

  return (
    <form
      className="space-y-5 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h1 className="text-[22px] font-extrabold tracking-tight">정보 수정</h1>
      {text("title", "제목", { maxLength: 120 })}
      <Field label="분류">
        <CategoryChips value={form.category} onSelect={(c) => set("category", c)} />
      </Field>
      <Field label="요약 (3줄 이내)" htmlFor="f-summary">
        <Textarea
          id="f-summary"
          className="min-h-24"
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {date("extracted_date", "날짜")}
        {text("extracted_time", "시간", { type: "time" })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {date("expiration_date", form.category === "coupon" ? "만료일" : "마감일")}
        {text("amount", "금액", { placeholder: "예) 26,900원" })}
      </div>
      {text("location", "장소", { placeholder: "가게·장소 이름" })}
      {text("address", "주소")}
      <div className="grid grid-cols-2 gap-3">
        {text("phone", "전화", { type: "tel", inputMode: "tel" })}
        {text("reservation_number", "예약번호")}
      </div>
      {showCoupon ? (
        <div className="grid grid-cols-2 gap-3">
          {text("coupon_brand", "브랜드")}
          {text("coupon_product", "상품")}
        </div>
      ) : null}
      {text("source_url", "링크", { type: "url", inputMode: "url", placeholder: "https://" })}

      <BottomBar>
        <Button variant="secondary" className="h-12 flex-1" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" className="h-12 flex-[1.4]" disabled={patch.isPending}>
          {patch.isPending ? "저장 중…" : inbox ? "저장하고 확인" : "저장"}
        </Button>
      </BottomBar>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
