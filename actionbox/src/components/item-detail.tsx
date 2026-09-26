import { useState, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { CategoryButton, CategoryPicker, CategoryTile } from "@/components/category";
import { Notice } from "@/components/item-card";
import { ActionTiles, useItemActions } from "@/components/item-actions";
import { ItemImage } from "@/components/item-image";
import { ReminderSheet } from "@/components/reminder-sheet";
import { Button } from "@/components/ui/button";
import { EmptyRow, ListGroup, SectionHeader } from "@/components/ui/list";
import { isStalled } from "@/lib/items/home";
import { REMINDER_PRESETS, reminderPreset } from "@/lib/items/reminder";
import { CATEGORY_LABELS, isAiOff, SAMPLE_NOTE, type Category, type Item } from "@/lib/items/types";
import { useAnalyzingIds, useItemMutations } from "@/lib/query";
import { addDaysISO, cn, formatAmount, formatDateWithWeekday, formatDdayLabel, formatTimestamp, todayISO } from "@/lib/utils";

const STATUS_LABEL: Record<Item["status"], string> = {
  inbox: "확인 전",
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

export function ItemDetail({
  item,
  startEditing,
  onEditingChange,
}: {
  item: Item;
  startEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const nav = useNavigate();
  const { patch, removeWithUndo, analyze } = useItemMutations();
  const router = useRouter();
  const analyzingIds = useAnalyzingIds();
  const actions = useItemActions(item);
  const [editing, setEditingState] = useState(Boolean(startEditing));
  const [picking, setPicking] = useState(false);

  const setEditing = (v: boolean) => {
    setEditingState(v);
    onEditingChange?.(v);
  };

  const stalled = isStalled(item, analyzingIds);
  const analyzing = item.analysis_status === "pending" && !stalled;
  const inbox = item.status === "inbox";
  const done = item.status === "completed" || item.status === "archived";

  if (editing) return <ItemEditor item={item} onClose={() => setEditing(false)} />;

  const recommended = actions.detailActions();
  const cta = item.status === "active" ? recommended[0] : undefined;
  const tiles = item.status === "active" ? recommended.slice(1) : inbox && !analyzing ? recommended.slice(0, 4) : [];

  const confirm = () =>
    patch.mutate(
      { id: item.id, patch: { status: "active" } },
      {
        onSuccess: () => toast("확인했어요 · 홈에 넣었어요"),
        onError: (e) => toast.error(errorText(e)),
      },
    );

  const restore = () =>
    patch.mutate(
      { id: item.id, patch: { status: "active" } },
      { onSuccess: () => toast("다시 꺼냈어요"), onError: (e) => toast.error(errorText(e)) },
    );

  return (
    <div className="space-y-7 pt-1">
      <Original item={item} />

      <header className="px-1">
        <div className="flex items-center gap-2 text-small text-muted">
          <CategoryTile category={item.category} small />
          {analyzing ? CATEGORY_LABELS[item.category] : <CategoryButton category={item.category} onClick={() => setPicking(true)} />}
          <span aria-hidden>·</span>
          <span className={cn("font-medium", inbox ? "text-warn" : done ? "text-muted" : "text-fg")}>
            {STATUS_LABEL[item.status]}
          </span>
        </div>
        <h1 className="mt-3 text-display font-bold break-words">{item.title || "제목 없음"}</h1>
        {item.summary ? <p className="mt-2 text-body whitespace-pre-line text-muted">{item.summary}</p> : null}
      </header>

      {analyzing ? (
        <ListGroup className="flex items-center gap-3 px-4 py-4">
          <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
          <div role="status">
            <p className="text-body font-semibold">내용을 읽는 중이에요</p>
            <p className="text-small text-muted">원본은 이미 저장됐어요. 다른 화면으로 가도 분석은 계속돼요.</p>
          </div>
        </ListGroup>
      ) : stalled ? (
        <Notice tone="warn">분석이 중간에 멈췄어요. 아래 ‘다시 분석’을 눌러 주세요.</Notice>
      ) : inbox && item.analysis_status === "failed" ? (
        <Notice tone={isAiOff(item) ? "info" : "danger"}>{item.analysis_error || "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요."}</Notice>
      ) : item.analysis_note ? (
        <Notice tone={item.analysis_note === SAMPLE_NOTE ? "info" : "warn"}>{item.analysis_note}</Notice>
      ) : null}

      {tiles.length ? (
        <section aria-label="추천 행동">
          <ActionTiles actions={tiles} />
        </section>
      ) : null}

      <section aria-label="정보">
        <SectionHeader
          title="정보"
          action={
            analyzing ? null : (
              <button type="button" onClick={() => setEditing(true)} className="hit-area text-body font-semibold text-primary">
                수정
              </button>
            )
          }
        />
        <InfoList item={item} onEdit={() => setEditing(true)} />
        {item.analysis_status === "done" && item.analysis_note !== SAMPLE_NOTE ? (
          <p className="mt-2 px-1 text-small text-muted">
            생성형 AI가 원본을 읽고 채운 정보예요. 틀릴 수 있으니 중요한 내용은 원본에서 확인해 주세요.
          </p>
        ) : null}
      </section>

      {!done && !analyzing ? <ReminderSection item={item} /> : null}

      <div className="space-y-3">
        <p className="px-1 text-small text-muted">
          {formatTimestamp(item.created_at)} 저장 · {TYPE_LABEL[item.original_type]}
        </p>
        <ListGroup>
          <button
            type="button"
            onClick={() => {
              // Deleted with an 8-second "되돌리기", then back to the list it was opened from.
              removeWithUndo(item.id);
              if (window.history.length > 1) router.history.back();
              else nav({ to: "/" });
            }}
            className="flex min-h-13 w-full items-center px-4 text-left text-body font-medium text-danger active:bg-surface-2"
          >
            항목 삭제
          </button>
        </ListGroup>
      </div>

      <CategoryPicker
        open={picking}
        onOpenChange={setPicking}
        value={item.category}
        onSelect={(category) => {
          setPicking(false);
          if (category !== item.category) {
            patch.mutate({ id: item.id, patch: { category } }, { onError: (e) => toast.error(errorText(e)) });
          }
        }}
      />
      {actions.sheets}

      {analyzing ? null : inbox ? (
        <BottomBar>
          {/* Even when analysis failed the original is saved, so it can always be confirmed as is. */}
          {stalled || (item.analysis_status === "failed" && !isAiOff(item)) ? (
            <>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                disabled={analyze.isPending}
                onClick={() => analyze.mutate({ id: item.id })}
              >
                다시 분석
              </Button>
              <Button size="lg" className="flex-[1.6]" disabled={patch.isPending} onClick={confirm}>
                이대로 확인
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => setEditing(true)}>
                수정
              </Button>
              <Button size="lg" className="flex-[1.6]" disabled={patch.isPending} onClick={confirm}>
                이대로 확인
              </Button>
            </>
          )}
        </BottomBar>
      ) : done ? (
        <BottomBar>
          <Button size="lg" className="flex-1" disabled={patch.isPending} onClick={restore}>
            되돌리기
          </Button>
        </BottomBar>
      ) : cta ? (
        <BottomBar>
          <Button
            size="lg"
            variant={cta.active ? "secondary" : "primary"}
            className="flex-1"
            aria-pressed={cta.active}
            onClick={cta.run}
          >
            {cta.active ? <Check className="size-5" aria-hidden /> : <cta.icon className="size-5" aria-hidden />}
            {cta.label}
          </Button>
        </BottomBar>
      ) : null}
    </div>
  );
}

function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-md gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}

function Original({ item }: { item: Item }) {
  if (item.has_image) {
    return (
      <ItemImage
        id={item.id}
        hasImage
        alt={item.title || "원본 이미지"}
        className="max-h-80 min-h-40 w-full rounded-2xl bg-surface-3 object-contain"
      />
    );
  }
  if (item.original_type === "url" && item.source_url) {
    return (
      <ListGroup>
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center gap-3 px-4 active:bg-surface-2"
        >
          <ExternalLink className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-small text-muted">{item.source_url}</span>
        </a>
      </ListGroup>
    );
  }
  if (item.original_content) {
    return (
      <ListGroup className="max-h-60 overflow-y-auto px-4 py-3.5">
        <p className="text-body break-words whitespace-pre-wrap">{item.original_content}</p>
      </ListGroup>
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
  const rows: { label: string; value: ReactNode; missing?: boolean }[] = [];
  const withDday = (date: string) => (
    <>
      {formatDateWithWeekday(date)}
      {formatDdayLabel(date) ? <span className="ml-1.5 text-muted tabular-nums">{formatDdayLabel(date)}</span> : null}
    </>
  );

  if (item.extracted_date) rows.push({ label: "날짜", value: withDday(item.extracted_date) });
  else if (item.category === "event") rows.push({ label: "날짜", value: null, missing: true });
  if (item.extracted_time) rows.push({ label: "시간", value: item.extracted_time });
  if (item.expiration_date) {
    rows.push({ label: item.category === "coupon" ? "만료일" : "마감일", value: withDday(item.expiration_date) });
  } else if (item.category === "coupon") {
    rows.push({ label: "만료일", value: null, missing: true });
  }
  if (item.coupon_brand) rows.push({ label: "브랜드", value: item.coupon_brand });
  if (item.coupon_product) rows.push({ label: "상품", value: item.coupon_product });
  if (item.location) rows.push({ label: "장소", value: item.location });
  if (item.address) rows.push({ label: "주소", value: item.address });
  if (item.amount) rows.push({ label: "금액", value: formatAmount(item.amount) });
  if (item.phone) {
    rows.push({
      label: "전화",
      value: (
        <a className="relative z-10 text-primary" href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}>
          {item.phone}
        </a>
      ),
    });
  }
  if (item.reservation_number) rows.push({ label: "예약번호", value: item.reservation_number });
  if (item.source_url && item.original_type !== "url") {
    rows.push({
      label: "링크",
      value: (
        <a className="text-primary" href={item.source_url} target="_blank" rel="noopener noreferrer">
          {hostname(item.source_url)}
        </a>
      ),
    });
  }

  return (
    <ListGroup>
      {rows.length === 0 ? (
        <button type="button" onClick={onEdit} className="w-full text-left active:bg-surface-2">
          <EmptyRow>찾은 날짜·장소가 없어요. 눌러서 직접 입력하세요.</EmptyRow>
        </button>
      ) : (
        <dl>
          {rows.map((r) => (
            <div key={r.label} className="row-divider-text flex min-h-13 items-center gap-4 px-4 py-3">
              <dt className="w-16 shrink-0 text-body text-muted">{r.label}</dt>
              <dd className="min-w-0 flex-1 text-right text-body break-words">
                {r.missing ? (
                  <button type="button" onClick={onEdit} className="hit-area font-semibold text-primary">
                    확인 필요 · 입력하기
                  </button>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </ListGroup>
  );
}

function ReminderSection({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const preset = reminderPreset(item);
  const presetLabel = typeof preset === "number" ? REMINDER_PRESETS.find((p) => p.days === preset)?.label : null;
  const summary =
    item.reminder_enabled && item.reminder_date
      ? [presetLabel, formatDateWithWeekday(item.reminder_date)].filter(Boolean).join(" · ")
      : "꺼짐";

  return (
    <section aria-label="알림">
      <SectionHeader title="알림" />
      <ListGroup>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-13 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
        >
          <span className="flex-1 text-body">알림 시점</span>
          <span className="text-body text-muted">{summary}</span>
          <ChevronRight className="size-4 text-subtle" aria-hidden />
        </button>
      </ListGroup>
      <p className="mt-2 px-1 text-small text-muted">
        알림일이 되면 홈의 ‘지금 할 것’에 올라와요. 휴대폰에서 울리게 하려면 ‘캘린더에 추가’로 넣어 주세요. 알림도 함께 들어가요.
      </p>
      <ReminderSheet item={item} open={open} onOpenChange={setOpen} />
    </section>
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

const fieldInput = "h-13 min-w-0 flex-1 bg-transparent text-body text-fg placeholder:text-subtle focus:outline-none";

type DetailKey = Exclude<keyof Form, "title" | "category" | "summary">;

/** Every detail field, in the order they appear. */
const DETAIL_KEYS: DetailKey[] = [
  "extracted_date",
  "extracted_time",
  "expiration_date",
  "location",
  "address",
  "amount",
  "phone",
  "reservation_number",
  "coupon_brand",
  "coupon_product",
  "source_url",
];

/** What each kind of item usually needs; the rest wait behind "항목 더 보기". */
const MAIN_FIELDS: Record<Category, DetailKey[]> = {
  event: ["extracted_date", "extracted_time", "location", "address"],
  place: ["location", "address", "phone"],
  todo: ["extracted_date", "extracted_time"],
  coupon: ["coupon_brand", "coupon_product", "expiration_date"],
  buy: ["amount", "source_url"],
  read: ["source_url"],
  reference: [],
  other: ["extracted_date"],
};

/** One-tap dates for an empty date field. */
function quickDates(today = todayISO()): { label: string; value: string }[] {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  // Saturday, or today when it already is the weekend.
  const weekend = addDaysISO(today, weekday === 0 ? 0 : 6 - weekday);
  return [
    { label: "오늘", value: today },
    { label: "내일", value: addDaysISO(today, 1) },
    { label: "이번 주말", value: weekend },
    { label: "다음 주", value: addDaysISO(today, 7) },
  ];
}

function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { patch } = useItemMutations();
  const [initial] = useState<Form>(() => formFrom(item));
  const [form, setForm] = useState<Form>(initial);
  const [picking, setPicking] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const inbox = item.status === "inbox";
  const main = MAIN_FIELDS[form.category];
  // A field that holds (or held) a value is never hidden, whatever the category.
  const extra = DETAIL_KEYS.filter((k) => !main.includes(k) && (showAll || Boolean(initial[k] || form[k])));
  const hidden = DETAIL_KEYS.length - main.length - extra.length;

  const save = () => {
    patch.mutate(
      { id: item.id, patch: { ...form, status: inbox ? "active" : item.status } },
      {
        onSuccess: () => {
          toast(inbox ? "저장했어요 · 홈에 넣었어요" : "저장했어요");
          onClose();
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );
  };

  const text = (key: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field key={key} label={label}>
      <input className={fieldInput} value={form[key]} onChange={(e) => set(key, e.target.value)} {...props} />
    </Field>
  );

  const date = (key: "extracted_date" | "expiration_date", label: string) => (
    <Field
      label={label}
      trailing={
        form[key] ? (
          <button
            type="button"
            aria-label={`${label} 지우기`}
            onClick={() => set(key, "")}
            className="grid size-10 shrink-0 place-items-center rounded-full text-subtle active:bg-surface-2"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null
      }
    >
      <input type="date" className={fieldInput} value={form[key]} onChange={(e) => set(key, e.target.value)} />
    </Field>
  );

  const dateField = (key: "extracted_date" | "expiration_date", label: string) => (
    // The wrapper carries the row divider; the field inside is its first child.
    <div key={key} className="row-divider-text">
      {date(key, label)}
      {form[key] ? null : (
        <div className="flex flex-wrap gap-1.5 pr-4 pb-3 pl-24" role="group" aria-label={`${label} 빠르게 고르기`}>
          {quickDates().map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => set(key, q.value)}
              className="h-8 rounded-full bg-surface-2 px-3 text-small font-medium text-fg active:bg-surface-3"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const field = (key: DetailKey) => {
    switch (key) {
      case "extracted_date":
        return dateField("extracted_date", "날짜");
      case "expiration_date":
        return dateField("expiration_date", form.category === "coupon" ? "만료일" : "마감일");
      case "extracted_time":
        return text("extracted_time", "시간", { type: "time" });
      case "location":
        return text("location", "장소", { placeholder: "가게·장소 이름" });
      case "address":
        return text("address", "주소");
      case "amount":
        return text("amount", "금액", { placeholder: "예) 26,900원" });
      case "phone":
        return text("phone", "전화", { type: "tel", inputMode: "tel" });
      case "reservation_number":
        return text("reservation_number", "예약번호");
      case "coupon_brand":
        return text("coupon_brand", "브랜드");
      case "coupon_product":
        return text("coupon_product", "상품");
      case "source_url":
        return text("source_url", "링크", { type: "url", inputMode: "url", placeholder: "https://" });
    }
  };

  return (
    <form
      className="space-y-7 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h1 className="px-1 text-display font-bold">정보 수정</h1>

      <FormGroup title="기본">
        {text("title", "제목", { maxLength: 120 })}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="row-divider-text flex min-h-13 w-full items-center gap-4 px-4 text-left active:bg-surface-2"
        >
          <span className="w-16 shrink-0 text-body text-muted">분류</span>
          <span className="flex-1 text-body">{CATEGORY_LABELS[form.category]}</span>
          <ChevronRight className="size-4 text-subtle" aria-hidden />
        </button>
        <label className="row-divider-text block px-4 pt-3 pb-1">
          <span className="text-body text-muted">요약 (3줄 이내)</span>
          <textarea
            className="mt-1 block min-h-20 w-full resize-none bg-transparent text-body focus:outline-none"
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </label>
      </FormGroup>

      {main.length ? <FormGroup title={`${CATEGORY_LABELS[form.category]} 정보`}>{main.map(field)}</FormGroup> : null}

      {extra.length ? <FormGroup title="그 밖의 정보">{extra.map(field)}</FormGroup> : null}

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="flex h-12 w-full items-center justify-center gap-1 rounded-lg text-body font-semibold text-muted active:bg-surface-2"
        >
          항목 더 보기
          <ChevronDown className="size-4" aria-hidden />
        </button>
      ) : null}

      <CategoryPicker
        open={picking}
        onOpenChange={setPicking}
        value={form.category}
        onSelect={(c) => {
          set("category", c);
          setPicking(false);
        }}
      />

      <BottomBar>
        <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" size="lg" className="flex-[1.6]" disabled={patch.isPending}>
          {patch.isPending ? "저장 중…" : inbox ? "저장하고 확인" : "저장"}
        </Button>
      </BottomBar>
    </form>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={`${title} 항목`}>
      <p className="mb-2 px-1 text-small font-medium text-muted" aria-hidden>
        {title}
      </p>
      <ListGroup>{children}</ListGroup>
    </div>
  );
}

function Field({ label, children, trailing }: { label: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="row-divider-text flex items-center pr-2 focus-within:bg-surface-2/60">
      <label className="flex min-w-0 flex-1 items-center gap-4 pl-4">
        <span className="w-16 shrink-0 text-body text-muted">{label}</span>
        {children}
      </label>
      {trailing}
    </div>
  );
}
