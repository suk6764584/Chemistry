import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, ChevronRight, ClipboardPaste, ImagePlus, Link2, Loader2, Type, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListGroup } from "@/components/ui/list";
import { Sheet, SheetRow } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/use-session";
import { clearDraft, saveDraft, type Draft } from "@/lib/items/drafts";
import { compressImageFile } from "@/lib/items/image-client";
import type { CreateItemInput } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { isUnauthorized, uuid } from "@/lib/utils";

type Mode = "pick" | "url" | "text" | "image";

type CaptureApi = {
  open: (mode?: "pick" | "url" | "text") => void;
  pickImage: (source: "screenshot" | "camera") => void;
  resume: (draft: Draft) => void;
};

const CaptureContext = createContext<CaptureApi | null>(null);

export function useCapture(): CaptureApi {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used inside <CaptureProvider>");
  return ctx;
}

const SHEET_TITLES: Record<Mode, string> = {
  pick: "무엇을 넣을까요?",
  url: "링크 붙여넣기",
  text: "텍스트 입력",
  image: "사진 저장",
};

function onlyUrl(text: string): string | null {
  const t = text.trim();
  return /^https?:\/\/\S+$/i.test(t) ? t : null;
}

function toInput(draft: Draft): CreateItemInput {
  if (draft.kind === "image") {
    return { id: draft.id, original_type: draft.originalType, image_base64: draft.base64, image_mime: draft.mime };
  }
  const url = draft.kind === "url" ? draft.value.trim() : onlyUrl(draft.value);
  if (url) return { id: draft.id, original_type: "url", source_url: url, original_content: url };
  return { id: draft.id, original_type: "text", original_content: draft.value };
}

function errorMessage(e: unknown): string {
  if (e instanceof TypeError || (e instanceof Error && /fetch|network/i.test(e.message))) {
    return "인터넷 연결을 확인해 주세요. 입력한 내용은 이 기기에 보관해 두었어요.";
  }
  return e instanceof Error && e.message ? e.message : "저장하지 못했어요. 다시 시도해 주세요.";
}

/**
 * Capture flow, mounted once for the whole app: 넣는다.
 * Save stores the original first (inbox), then analysis runs in the background
 * and the user lands on the item to 확인한다.
 */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { user } = useSession();
  const { create, analyze } = useItemMutations();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pick");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<Extract<Draft, { kind: "image" }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per thing being entered, reused on retry so it is never saved twice.
  const draftId = useRef<string>(uuid());

  const reset = useCallback(() => {
    setMode("pick");
    setUrl("");
    setText("");
    setImage(null);
    setError(null);
    draftId.current = uuid();
  }, []);

  const save = async (draft: Draft) => {
    if (!user) {
      const kept = saveDraft(draft);
      setSheetOpen(false);
      toast(kept ? "로그인하면 바로 저장돼요" : "로그인한 뒤 다시 선택해 주세요");
      nav({ to: "/login" });
      return;
    }
    saveDraft(draft);
    setBusy(true);
    setError(null);
    try {
      const item = await create.mutateAsync(toInput(draft));
      clearDraft(draft.id);
      analyze.mutate({ id: item.id });
      setSheetOpen(false);
      nav({ to: "/item/$id", params: { id: item.id } });
    } catch (e) {
      if (isUnauthorized(e)) {
        setSheetOpen(false);
        nav({ to: "/login" });
        return;
      }
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (originalType: "screenshot" | "image") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    draftId.current = uuid();
    setMode("image");
    setError(null);
    setImage(null);
    setSheetOpen(true);
    setBusy(true);
    try {
      const img = await compressImageFile(file);
      const draft = { id: draftId.current, kind: "image" as const, originalType, base64: img.base64, mime: img.mime };
      setImage(draft);
      setBusy(false);
      await save(draft);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "사진을 열지 못했어요.");
    }
  };

  const submitUrl = () => {
    if (!url.trim()) return setError("링크를 붙여넣어 주세요.");
    void save({ id: draftId.current, kind: "url", value: url.trim() });
  };

  const submitText = () => {
    if (!text.trim()) return setError("내용을 입력해 주세요.");
    void save({ id: draftId.current, kind: "text", value: text.trim() });
  };

  const pasteFromClipboard = async () => {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (value) {
        setUrl(value);
        draftId.current = uuid();
      }
    } catch {
      toast("붙여넣기 권한이 없어요. 입력칸을 길게 눌러 붙여넣어 주세요.");
    }
  };

  const open = useCallback((next: "pick" | "url" | "text" = "pick") => {
    reset();
    setMode(next);
    setSheetOpen(true);
  }, [reset]);

  const pickImage = useCallback((source: "screenshot" | "camera") => {
    (source === "camera" ? cameraRef : galleryRef).current?.click();
  }, []);

  const resume = useCallback(
    (draft: Draft) => {
      draftId.current = draft.id;
      if (draft.kind === "image") {
        setImage(draft);
        setMode("image");
      } else if (draft.kind === "url") {
        setUrl(draft.value);
        setMode("url");
      } else {
        setText(draft.value);
        setMode("text");
      }
      setError(null);
      setSheetOpen(true);
      void save(draft);
    },
    // save closes over the latest user/mutations each render; resume is only called from a click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );

  const api = useMemo(() => ({ open, pickImage, resume }), [open, pickImage, resume]);

  return (
    <CaptureContext.Provider value={api}>
      {children}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile("screenshot")} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile("image")}
      />
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          if (busy && !v) return;
          setSheetOpen(v);
        }}
        onClosed={reset}
        title={SHEET_TITLES[mode]}
      >
        {mode === "pick" ? (
          <div className="mt-3 -mx-2">
            <PickOption
              icon={ImagePlus}
              label="스크린샷·사진 선택"
              hint="쿠폰, 행사 포스터, 캡처 화면"
              onClick={() => galleryRef.current?.click()}
            />
            <PickOption
              icon={Camera}
              label="사진 찍기"
              hint="눈앞의 포스터나 안내문을 바로"
              onClick={() => cameraRef.current?.click()}
            />
            <PickOption icon={Link2} label="링크 붙여넣기" hint="블로그, SNS 게시물, 쇼핑 링크" onClick={() => setMode("url")} />
            <PickOption icon={Type} label="텍스트 입력" hint="메모, 예약 정보, 할 일" onClick={() => setMode("text")} />
          </div>
        ) : mode === "url" ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitUrl();
            }}
          >
            <div className="flex gap-2">
              <Input
                autoFocus
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                aria-label="링크"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  draftId.current = uuid();
                }}
              />
              {typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function" ? (
                <Button variant="secondary" className="h-13 shrink-0" onClick={() => void pasteFromClipboard()}>
                  <ClipboardPaste className="size-4" aria-hidden />
                  붙여넣기
                </Button>
              ) : null}
            </div>
            <p className="px-1 text-small text-muted">로그인이 필요한 페이지는 내용을 읽지 못할 수 있어요. 그래도 링크는 저장돼요.</p>
            {error ? <p className="px-1 text-small text-danger">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? "저장 중…" : error ? "다시 시도" : "저장"}
            </Button>
          </form>
        ) : mode === "text" ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitText();
            }}
          >
            <Textarea
              autoFocus
              aria-label="내용"
              placeholder={"예) 10월 2일까지 자동차 검사 예약하기\n예약번호, 주소, 메신저 내용도 그대로 붙여넣으세요"}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                draftId.current = uuid();
              }}
            />
            {error ? <p className="px-1 text-small text-danger">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? "저장 중…" : error ? "다시 시도" : "저장"}
            </Button>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            {image ? (
              <img
                src={`data:${image.mime};base64,${image.base64}`}
                alt="선택한 사진"
                className="max-h-56 w-full rounded-lg bg-surface-2 object-contain"
              />
            ) : (
              <div className="h-40 animate-pulse rounded-lg bg-surface-2" />
            )}
            {error ? (
              <>
                <p className="px-1 text-small text-danger">{error}</p>
                {image ? (
                  <Button size="lg" className="w-full" onClick={() => void save(image)}>
                    다시 시도
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" className="w-full" onClick={() => galleryRef.current?.click()}>
                    다른 사진 선택
                  </Button>
                )}
              </>
            ) : (
              <p className="flex items-center justify-center gap-2 py-2 text-body text-muted" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {image ? "저장하는 중…" : "사진을 준비하는 중…"}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </CaptureContext.Provider>
  );
}

function PickOption({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <SheetRow
      title={label}
      hint={hint}
      onClick={onClick}
      leading={
        <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface-2" aria-hidden>
          <Icon className="size-5" strokeWidth={1.9} />
        </span>
      }
      trailing={<ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />}
    />
  );
}

/** The three first-screen entry points (spec: 스크린샷 / 링크 / 텍스트). */
export function CaptureButtons() {
  const capture = useCapture();
  return (
    <ListGroup>
      <CaptureRow icon={ImagePlus} label="스크린샷 올리기" hint="쿠폰·포스터·캡처" onClick={() => capture.pickImage("screenshot")} />
      <CaptureRow icon={Link2} label="링크 붙여넣기" hint="블로그·SNS·쇼핑" onClick={() => capture.open("url")} />
      <CaptureRow icon={Type} label="텍스트 입력" hint="메모·예약 정보·할 일" onClick={() => capture.open("text")} />
    </ListGroup>
  );
}

function CaptureRow({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="row-divider flex min-h-16 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface-2 text-fg" aria-hidden>
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <span className="flex-1 text-body font-semibold">{label}</span>
      <span className="text-small text-muted">{hint}</span>
      <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
    </button>
  );
}
