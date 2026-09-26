import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { CategoryButton, CategoryPicker, CategoryTile } from "@/components/category";
import { Notice } from "@/components/item-card";
import { ActionTiles, useItemActions } from "@/components/item-actions";
import { ItemImage } from "@/components/item-image";
import { Button } from "@/components/ui/button";
import { EmptyRow, ListGroup, SectionHeader } from "@/components/ui/list";
import { Sheet, SheetRow } from "@/components/ui/sheet";
import { isStalled } from "@/lib/items/home";
import { REMINDER_PRESETS, reminderPreset } from "@/lib/items/reminder";
import { CATEGORY_LABELS, keyDate, SAMPLE_NOTE, type Category, type Item, type ItemPatch } from "@/lib/items/types";
import { useAnalyzingIds, useItemMutations } from "@/lib/query";
import { addDaysISO, cn, formatDateWithWeekday, formatDday, formatTimestamp } from "@/lib/utils";

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
  const { patch, remove, analyze } = useItemMutations();
  const analyzingIds = useAnalyzingIds();
  const actions = useItemActions(item);
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
        <Notice tone="danger">{item.analysis_error || "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요."}</Notice>
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
            onClick={() => setConfirmDelete(true)}
            className="flex min-h-13 w-full items-center px-4 text-left text-body font-medium text-danger active:bg-surface-2"
          >
            항목 삭제
          </button>
        </ListGroup>
      </div>

      <Sheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="이 항목을 삭제할까요?"
        description="원본과 정보가 모두 지워지고 되돌릴 수 없어요."
      >
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(item.id, {
                onSuccess: () => {
                  setConfirmDelete(false);
                  toast("삭제했어요");
                  nav({ to: "/" });
                },
                onError: (e) => toast.error(errorText(e)),
              })
            }
          >
            완전히 삭제
          </Button>
        </div>
      </Sheet>

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
          {item.analysis_status === "failed" || stalled ? (
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
              <Button size="lg" className="flex-[1.6]" onClick={() => setEditing(true)}>
                직접 입력
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
      {formatDday(date) ? <span className="ml-1.5 text-muted tabular-nums">{formatDday(date)}</span> : null}
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
  if (item.amount) rows.push({ label: "금액", value: item.amount });
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
  const { patch } = useItemMutations();
  const [open, setOpen] = useState(false);
  const [choosingDate, setChoosingDate] = useState(false);
  const key = keyDate(item);
  const preset = reminderPreset(item);

  const set = (next: ItemPatch) => {
    patch.mutate({ id: item.id, patch: next }, { onError: (e) => toast.error(errorText(e)) });
    setOpen(false);
  };

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
          onClick={() => {
            setChoosingDate(preset === "custom");
            setOpen(true);
          }}
          className="flex min-h-13 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
        >
          <span className="flex-1 text-body">알림 시점</span>
          <span className="text-body text-muted">{summary}</span>
          <ChevronRight className="size-4 text-subtle" aria-hidden />
        </button>
      </ListGroup>
      <p className="mt-2 px-1 text-small text-muted">
        알림일이 되면 홈의 ‘지금 할 것’에 올라와요. 휴대폰 푸시 알림은 아직 지원하지 않아요.
      </p>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="알림 시점"
        description={key ? `기준일 ${formatDateWithWeekday(key)}` : "날짜가 없는 항목이라 알림 날짜를 직접 골라야 해요."}
      >
        <div className="mt-3 -mx-2" role="radiogroup" aria-label="알림 시점">
          <SheetRow
            role="radio"
            checked={!item.reminder_enabled}
            title="끄기"
            trailing={!item.reminder_enabled ? <Check className="size-5 text-primary" aria-hidden /> : null}
            onClick={() => set({ reminder_enabled: false })}
          />
          {key
            ? REMINDER_PRESETS.map((p) => (
                <SheetRow
                  key={p.days}
                  role="radio"
                  checked={preset === p.days}
                  title={p.label}
                  hint={formatDateWithWeekday(addDaysISO(key, -p.days)) ?? undefined}
                  trailing={preset === p.days ? <Check className="size-5 text-primary" aria-hidden /> : null}
                  onClick={() => set({ reminder_enabled: true, reminder_date: addDaysISO(key, -p.days) })}
                />
              ))
            : null}
          <SheetRow
            role="radio"
            checked={preset === "custom"}
            title="날짜 직접 선택"
            trailing={preset === "custom" ? <Check className="size-5 text-primary" aria-hidden /> : null}
            onClick={() => setChoosingDate(true)}
          />
        </div>
        {choosingDate ? (
          <input
            type="date"
            aria-label="알림 날짜"
            defaultValue={item.reminder_date ?? ""}
            onChange={(e) => {
              if (e.target.value) set({ reminder_enabled: true, reminder_date: e.target.value });
            }}
            className="mt-2 h-13 w-full rounded-md bg-surface-2 px-4 text-body focus:shadow-focus focus:outline-none"
          />
        ) : null}
      </Sheet>
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

function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { patch } = useItemMutations();
  const [form, setForm] = useState<Form>(() => formFrom(item));
  const [picking, setPicking] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const inbox = item.status === "inbox";
  const showCoupon = form.category === "coupon" || Boolean(item.coupon_brand || item.coupon_product);

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
    <Field label={label}>
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

      <FormGroup title="날짜">
        {date("extracted_date", "날짜")}
        {text("extracted_time", "시간", { type: "time" })}
        {date("expiration_date", form.category === "coupon" ? "만료일" : "마감일")}
      </FormGroup>

      <FormGroup title="장소">
        {text("location", "장소", { placeholder: "가게·장소 이름" })}
        {text("address", "주소")}
      </FormGroup>

      <FormGroup title="기타">
        {text("amount", "금액", { placeholder: "예) 26,900원" })}
        {text("phone", "전화", { type: "tel", inputMode: "tel" })}
        {text("reservation_number", "예약번호")}
        {showCoupon ? text("coupon_brand", "브랜드") : null}
        {showCoupon ? text("coupon_product", "상품") : null}
        {text("source_url", "링크", { type: "url", inputMode: "url", placeholder: "https://" })}
      </FormGroup>

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
