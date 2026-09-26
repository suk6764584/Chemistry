import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { hasPendingShare, registerShareWorker, sharedText, takePendingShare, type SharedContent } from "@/lib/items/share";
import { keyDate, type CreateItemInput } from "@/lib/items/types";
import { useAccountStatus, useAnalyzingIds, useItem, useItemMutations } from "@/lib/query";
import { cn, formatDateWithWeekday, formatDdayLabel, formatShortDate, isUnauthorized, uuid } from "@/lib/utils";

type Mode = "pick" | "url" | "text" | "image" | "done" | "batch";

/** One of several things saved in a row (a multi-photo pick, or a share with several parts). */
type BatchSource =
  | { kind: "file"; file: File; originalType: "screenshot" | "image" }
  | { kind: "url" | "text"; value: string };
type BatchEntry = {
  /** Also the item id, so a retry never saves the same thing twice. */
  id: string;
  label: string;
  source: BatchSource;
  state: "waiting" | "saving" | "saved" | "failed";
  error?: string;
};

/** Each one is its own upload and AI analysis, so keep a batch small. */
const MAX_BATCH = 10;

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
  done: "저장했어요",
  batch: "여러 개 저장",
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

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof Error && /fetch|network/i.test(e.message));
}

function batchLabel(source: BatchSource, index: number): string {
  if (source.kind === "file") return `사진 ${index + 1}`;
  if (source.kind === "url") {
    try {
      return new URL(source.value).hostname.replace(/^www\./, "");
    } catch {
      return source.value;
    }
  }
  return source.value.split("\n")[0].slice(0, 40);
}

function errorMessage(e: unknown): string {
  if (isNetworkError(e)) {
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
  const { user, isPending } = useSession();
  const account = useAccountStatus(Boolean(user));
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
  // A save that reached the server and failed — only then does the button read "다시 시도".
  const [failed, setFailed] = useState(false);
  // After a save the sheet stays open on a short result, so several things can go in in a row.
  const [saved, setSaved] = useState<{ id: string; from: Mode } | null>(null);
  const [batch, setBatch] = useState<BatchEntry[]>([]);
  // One id per thing being entered, reused on retry so it is never saved twice.
  const draftId = useRef<string>(uuid());

  const reset = useCallback(() => {
    setMode("pick");
    setUrl("");
    setText("");
    setImage(null);
    setError(null);
    setFailed(false);
    setSaved(null);
    setBatch([]);
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
    setFailed(false);
    try {
      const item = await create.mutateAsync(toInput(draft));
      clearDraft(draft.id);
      analyze.mutate({ id: item.id });
      setSaved({ id: item.id, from: draft.kind === "image" ? "pick" : draft.kind });
      setMode("done");
    } catch (e) {
      if (isUnauthorized(e)) {
        setSheetOpen(false);
        nav({ to: "/login" });
        return;
      }
      setError(errorMessage(e));
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const captureFile = async (file: File, originalType: "screenshot" | "image") => {
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

  const runBatch = async (entries: BatchEntry[]) => {
    const update = (id: string, patch: Partial<BatchEntry>) =>
      setBatch((all) => all.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setBusy(true);
    for (const entry of entries) {
      update(entry.id, { state: "saving", error: undefined });
      try {
        const { source } = entry;
        const draft: Draft =
          source.kind === "file"
            ? { id: entry.id, kind: "image", originalType: source.originalType, ...(await compressImageFile(source.file)) }
            : { id: entry.id, kind: source.kind, value: source.value };
        const item = await create.mutateAsync(toInput(draft));
        analyze.mutate({ id: item.id });
        update(entry.id, { state: "saved" });
      } catch (e) {
        if (isUnauthorized(e)) {
          setBusy(false);
          setSheetOpen(false);
          nav({ to: "/login" });
          return;
        }
        update(entry.id, {
          state: "failed",
          error: isNetworkError(e) ? "인터넷 연결을 확인해 주세요." : e instanceof Error && e.message ? e.message : "저장하지 못했어요.",
        });
      }
    }
    setBusy(false);
  };

  const startBatch = (sources: BatchSource[], skipped = 0) => {
    if (!user) {
      toast("로그인한 뒤 다시 선택해 주세요");
      nav({ to: "/login" });
      return;
    }
    if (sources.length + skipped > MAX_BATCH) {
      toast(`한 번에 ${MAX_BATCH}개까지 저장할 수 있어요. 앞의 ${MAX_BATCH}개만 저장해요.`);
    }
    const entries: BatchEntry[] = sources
      .slice(0, MAX_BATCH)
      .map((source, i) => ({ id: uuid(), label: batchLabel(source, i), source, state: "waiting" }));
    reset();
    setMode("batch");
    setBatch(entries);
    setSheetOpen(true);
    void runBatch(entries);
  };

  const onFiles = (originalType: "screenshot" | "image") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 1) void captureFile(files[0], originalType);
    else if (files.length > 1) startBatch(files.map((file) => ({ kind: "file", file, originalType })));
  };

  /** Something shared from another app: one thing goes through the usual flow, several as a batch. */
  const receiveShare = (share: SharedContent) => {
    const text = sharedText(share);
    const sources: BatchSource[] = share.files.length
      ? share.files.map((file) => ({ kind: "file", file, originalType: "screenshot" }))
      : text
        ? [text]
        : [];
    const [only] = sources;
    if (!only) {
      toast("공유한 내용에서 저장할 것을 찾지 못했어요");
    } else if (sources.length > 1 || share.skipped) {
      startBatch(sources, share.skipped);
    } else if (only.kind === "file") {
      void captureFile(only.file, only.originalType);
    } else {
      reset();
      setMode(only.kind);
      if (only.kind === "url") setUrl(only.value);
      else setText(only.value);
      setSheetOpen(true);
      void save({ id: draftId.current, kind: only.kind, value: only.value });
    }
  };

  useEffect(() => registerShareWorker(), []);

  // Pick up a share once someone is signed in and past the consent screen.
  const takingShare = useRef(false);
  const askedToSignIn = useRef(false);
  const needsConsent = account.data?.needsConsent;
  useEffect(() => {
    if (isPending || takingShare.current) return;
    let cancelled = false;
    void (async () => {
      if (!(await hasPendingShare()) || cancelled) return;
      if (!user) {
        if (!askedToSignIn.current) {
          askedToSignIn.current = true;
          toast("로그인하면 공유한 내용이 바로 저장돼요");
        }
        if (window.location.pathname !== "/login") nav({ to: "/login" });
        return;
      }
      if (needsConsent !== false || takingShare.current) return;
      takingShare.current = true;
      try {
        const share = await takePendingShare();
        if (share) receiveShare(share);
      } catch {
        toast.error("공유한 내용을 불러오지 못했어요. 다시 공유해 주세요.");
      } finally {
        takingShare.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
    // receiveShare reads the latest state when it runs; re-run only when sign-in state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPending, needsConsent]);

  const submitUrl = () => {
    let value = url.trim();
    if (!value) return setError("링크를 붙여넣어 주세요.");
    // "naver.com/…" without a scheme is still clearly a link.
    if (!/^[a-z][a-z\d+.-]*:/i.test(value) && /^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(value)) value = `https://${value}`;
    if (!/^https?:\/\/\S+$/i.test(value)) return setError("http:// 또는 https://로 시작하는 링크를 넣어 주세요.");
    void save({ id: draftId.current, kind: "url", value });
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
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles("screenshot")} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFiles("image")}
      />
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          if (busy && !v) return;
          setSheetOpen(v);
        }}
        onClosed={reset}
        title={mode === "batch" ? batchTitle(batch, busy) : SHEET_TITLES[mode]}
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
            noValidate
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
                  setError(null);
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
              {busy ? "저장 중…" : failed ? "다시 시도" : "저장"}
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
                setError(null);
                draftId.current = uuid();
              }}
            />
            {error ? <p className="px-1 text-small text-danger">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? "저장 중…" : failed ? "다시 시도" : "저장"}
            </Button>
          </form>
        ) : mode === "batch" ? (
          <BatchResult
            entries={batch}
            running={busy}
            onRetry={() => void runBatch(batch.filter((e) => e.state === "failed"))}
            onOpen={(id) => {
              setSheetOpen(false);
              nav({ to: "/item/$id", params: { id } });
            }}
            onDone={() => setSheetOpen(false)}
          />
        ) : mode === "done" && saved ? (
          <SavedResult
            id={saved.id}
            onMore={() => {
              const from = saved.from;
              reset();
              setMode(from);
            }}
            onOpen={() => {
              setSheetOpen(false);
              nav({ to: "/item/$id", params: { id: saved.id } });
            }}
          />
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

/** What was found in the item just saved, updating live while it is being read. */
function SavedResult({ id, onMore, onOpen }: { id: string; onMore: () => void; onOpen: () => void }) {
  const { data: item } = useItem(id, true);
  const analyzingIds = useAnalyzingIds();
  const reading = !item || (item.analysis_status === "pending" && analyzingIds.includes(id));
  const date = item ? keyDate(item) : null;
  const when = date
    ? [formatDateWithWeekday(date), item?.extracted_date ? item.extracted_time : null, formatDdayLabel(date)]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="mt-4 space-y-4">
      <ListGroup className="px-4 py-3.5">
        <p className="line-clamp-2 text-body font-semibold">{item?.title || "새 항목"}</p>
        {reading ? (
          <p className="mt-1 flex items-center gap-1.5 text-small text-muted" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            날짜와 할 일을 찾는 중…
          </p>
        ) : (
          <p className="mt-1 text-small text-muted" role="status">
            {when ? (
              <>
                <span className="font-semibold text-fg">{when}</span>
                {item?.reminder_enabled && item.reminder_date ? ` · ${formatShortDate(item.reminder_date)}에 홈 맨 위로 올려 드려요` : null}
              </>
            ) : (
              "날짜는 찾지 못했어요. 자세히 보기에서 넣을 수 있어요."
            )}
          </p>
        )}
      </ListGroup>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onMore}>
          하나 더 넣기
        </Button>
        <Button size="lg" className="flex-1" onClick={onOpen}>
          자세히 보기
        </Button>
      </div>
    </div>
  );
}

function batchTitle(entries: BatchEntry[], running: boolean): string {
  const saved = entries.filter((e) => e.state === "saved").length;
  if (running) return `${entries.length}개 저장 중 (${saved}/${entries.length})`;
  return saved === entries.length ? `${saved}개 저장했어요` : `${entries.length}개 중 ${saved}개 저장했어요`;
}

/** Several saves in a row, each updating live as it is stored and read. */
function BatchResult({
  entries,
  running,
  onRetry,
  onOpen,
  onDone,
}: {
  entries: BatchEntry[];
  running: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onDone: () => void;
}) {
  const failed = entries.filter((e) => e.state === "failed").length;
  return (
    <div className="mt-4 space-y-3">
      <ListGroup>
        {entries.map((entry) => (
          <BatchRow key={entry.id} entry={entry} onOpen={onOpen} />
        ))}
      </ListGroup>
      {!running && failed ? (
        <Button variant="secondary" size="lg" className="w-full" onClick={onRetry}>
          실패한 {failed}개 다시 시도
        </Button>
      ) : null}
      <Button size="lg" className="w-full" disabled={running} onClick={onDone}>
        {running ? "저장 중…" : "완료"}
      </Button>
    </div>
  );
}

/** A small preview, so rows stay tellable apart before (or without) a title from the AI. */
function Thumb({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? (
    <img src={src} alt="" className="size-10 shrink-0 rounded-sm bg-surface-2 object-cover" />
  ) : (
    <span className="size-10 shrink-0 rounded-sm bg-surface-2" aria-hidden />
  );
}

function BatchRow({ entry, onOpen }: { entry: BatchEntry; onOpen: (id: string) => void }) {
  const saved = entry.state === "saved";
  const { data: item } = useItem(entry.id, saved);
  const analyzingIds = useAnalyzingIds();
  const reading = saved && (!item || (item.analysis_status === "pending" && analyzingIds.includes(entry.id)));
  const date = item ? keyDate(item) : null;
  const status =
    entry.state === "waiting"
      ? "기다리는 중"
      : entry.state === "saving"
        ? "저장 중…"
        : entry.state === "failed"
          ? entry.error
          : reading
            ? "날짜와 할 일을 찾는 중…"
            : date
              ? [formatDateWithWeekday(date), formatDdayLabel(date)].filter(Boolean).join(" · ")
              : "저장했어요 · 날짜 없음";
  const body = (
    <>
      {entry.source.kind === "file" ? <Thumb file={entry.source.file} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{(saved && item?.title) || entry.label}</span>
        <span className={cn("block text-small", entry.state === "failed" ? "text-danger" : "text-muted")}>{status}</span>
      </span>
      {entry.state === "saving" || reading ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-subtle" aria-hidden />
      ) : saved ? (
        <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
      ) : null}
    </>
  );
  return saved ? (
    <button
      type="button"
      onClick={() => onOpen(entry.id)}
      className="row-divider-text flex min-h-15 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2"
    >
      {body}
    </button>
  ) : (
    <div className="row-divider-text flex min-h-15 items-center gap-3 px-4 py-2.5" role="status">
      {body}
    </div>
  );
}
