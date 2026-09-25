import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ItemActions } from "@/components/item-actions";
import { ItemImage } from "@/components/item-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, CATEGORIES, type Category, type Item, type ItemPatch } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { formatKoreanDate } from "@/lib/utils";

function patchFromItem(item: Item): ItemPatch {
  return {
    title: item.title ?? "",
    summary: item.summary ?? "",
    category: item.category,
    extracted_date: item.extracted_date ?? "",
    extracted_time: item.extracted_time ?? "",
    expiration_date: item.expiration_date ?? "",
    location: item.location ?? "",
    address: item.address ?? "",
    amount: item.amount ?? "",
    phone: item.phone ?? "",
    source_url: item.source_url ?? "",
    reminder_date: item.reminder_date ?? "",
    reminder_enabled: item.reminder_enabled,
  };
}

export function ItemDetail({ item }: { item: Item }) {
  const nav = useNavigate();
  const { patch, remove, reanalyze } = useItemMutations();
  const [editing, setEditing] = useState(item.analysis_status === "failed");
  const [form, setForm] = useState<ItemPatch>(() => patchFromItem(item));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(patchFromItem(item));
    if (item.analysis_status === "failed") setEditing(true);
  }, [item.id, item.updated_at, item.analysis_status]);

  const set = (key: keyof ItemPatch, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = () => {
    const emptyToNull = (v: string | undefined) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t.length ? t : null;
    };
    patch.mutate(
      {
        id: item.id,
        patch: {
          title: emptyToNull(form.title as string),
          summary: emptyToNull(form.summary as string),
          category: form.category as Category,
          extracted_date: emptyToNull(form.extracted_date as string),
          extracted_time: emptyToNull(form.extracted_time as string),
          expiration_date: emptyToNull(form.expiration_date as string),
          location: emptyToNull(form.location as string),
          address: emptyToNull(form.address as string),
          amount: emptyToNull(form.amount as string),
          phone: emptyToNull(form.phone as string),
          source_url: emptyToNull(form.source_url as string),
          reminder_date: emptyToNull(form.reminder_date as string),
          reminder_enabled: Boolean(form.reminder_enabled),
          status: item.status === "inbox" ? "active" : item.status,
        },
      },
      {
        onSuccess: () => {
          toast.success("수정했습니다");
          setEditing(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "수정에 실패했습니다"),
      },
    );
  };

  const statusLabel =
    item.status === "inbox"
      ? "수신함"
      : item.status === "completed"
        ? "완료"
        : item.status === "archived"
          ? "보관"
          : "진행 중";

  return (
    <div className="space-y-6">
      {item.has_image ? (
        <ItemImage
          id={item.id}
          hasImage
          alt={item.title || "원본 이미지"}
          className="h-56 w-full rounded-lg object-cover"
        />
      ) : null}

      {item.analysis_status === "failed" ? (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {item.analysis_error || "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요."}
        </div>
      ) : null}

      {item.analysis_status === "pending" ? (
        <p className="text-sm text-muted">읽고 있습니다…</p>
      ) : null}

      {editing ? (
        <div className="space-y-4">
          <Field label="제목">
            <Input value={String(form.title ?? "")} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="유형">
            <select
              className="h-11 w-full rounded-md bg-surface px-3 text-base shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="한 줄 요약">
            <Textarea value={String(form.summary ?? "")} onChange={(e) => set("summary", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="날짜">
              <Input
                type="date"
                value={String(form.extracted_date ?? "")}
                onChange={(e) => set("extracted_date", e.target.value)}
              />
            </Field>
            <Field label="시간">
              <Input
                type="time"
                value={String(form.extracted_time ?? "")}
                onChange={(e) => set("extracted_time", e.target.value)}
              />
            </Field>
            <Field label="만료일">
              <Input
                type="date"
                value={String(form.expiration_date ?? "")}
                onChange={(e) => set("expiration_date", e.target.value)}
              />
            </Field>
            <Field label="금액">
              <Input value={String(form.amount ?? "")} onChange={(e) => set("amount", e.target.value)} />
            </Field>
          </div>
          <Field label="장소">
            <Input value={String(form.location ?? "")} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="주소">
            <Input value={String(form.address ?? "")} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="전화">
            <Input value={String(form.phone ?? "")} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="링크">
            <Input value={String(form.source_url ?? "")} onChange={(e) => set("source_url", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="알림 날짜">
              <Input
                type="date"
                value={String(form.reminder_date ?? "")}
                onChange={(e) => set("reminder_date", e.target.value)}
              />
            </Field>
            <Field label="알림">
              <button
                type="button"
                className="h-11 w-full rounded-md bg-surface-2 text-sm font-medium"
                onClick={() => set("reminder_enabled", !form.reminder_enabled)}
              >
                {form.reminder_enabled ? "켜짐" : "꺼짐"}
              </button>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={patch.isPending}>
              저장
            </Button>
            <Button className="flex-1" variant="secondary" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-accent">{CATEGORY_LABELS[item.category]}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{item.title || "제목 없음"}</h1>
            {item.summary ? <p className="mt-2 whitespace-pre-line text-sm text-muted">{item.summary}</p> : null}
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="날짜" value={formatKoreanDate(item.extracted_date)} extra={item.extracted_time} />
            <Row label="만료" value={formatKoreanDate(item.expiration_date)} />
            <Row label="장소" value={item.location} />
            <Row label="주소" value={item.address} />
            <Row label="금액" value={item.amount} />
            <Row label="전화" value={item.phone} />
            <Row label="예약번호" value={item.reservation_number} />
            <Row
              label="알림"
              value={
                item.reminder_enabled
                  ? formatKoreanDate(item.reminder_date) || "켜짐"
                  : "꺼짐"
              }
            />
            <Row label="상태" value={statusLabel} />
            <Row label="등록" value={formatKoreanDate(item.created_at.slice(0, 10))} />
          </dl>

          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm text-accent underline-offset-4 hover:underline"
            >
              {item.source_url}
            </a>
          ) : null}

          {item.original_content && item.original_type === "text" ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm">{item.original_content}</pre>
          ) : null}

          <ItemActions item={item} compact />

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              수정
            </Button>
            {item.analysis_status === "failed" ? (
              <Button
                variant="outline"
                disabled={reanalyze.isPending}
                onClick={() => reanalyze.mutate(item.id)}
              >
                다시 분석
              </Button>
            ) : null}
            {item.status !== "active" && item.status !== "inbox" ? (
              <Button
                variant="outline"
                onClick={() => patch.mutate({ id: item.id, patch: { status: "active" } })}
              >
                되돌리기
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        {confirmDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-danger">이 항목을 완전히 삭제합니다. 되돌릴 수 없습니다.</p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(item.id, {
                    onSuccess: () => {
                      toast.success("삭제했습니다");
                      nav({ to: "/" });
                    },
                  })
                }
              >
                삭제
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="h-11 text-sm text-muted underline-offset-4 hover:underline"
            onClick={() => setConfirmDelete(true)}
          >
            항목 삭제
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, extra }: { label: string; value?: string | null; extra?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-right">
        {value}
        {extra ? ` ${extra}` : ""}
      </dd>
    </div>
  );
}
