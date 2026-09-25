import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ImageIcon, Link2, Type } from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compressImageFile } from "@/lib/items/image-client";
import type { OriginalType } from "@/lib/items/types";
import { useItemMutations } from "@/lib/query";
import { cn } from "@/lib/utils";

type Mode = "pick" | "url" | "text" | "working";

export function CaptureBar({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pick");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const { create } = useItemMutations();

  const reset = () => {
    setMode("pick");
    setUrl("");
    setText("");
    setError(null);
  };

  const requireAuth = () => {
    if (signedIn) return false;
    nav({ to: "/login" });
    return true;
  };

  const submitImage = async (file: File) => {
    if (requireAuth()) return;
    setMode("working");
    setError(null);
    try {
      const img = await compressImageFile(file);
      const item = await create.mutateAsync({
        original_type: "screenshot",
        image_base64: img.base64,
        image_mime: img.mime,
      });
      toast.success("저장했습니다");
      setOpen(false);
      reset();
      nav({ to: "/item/$id", params: { id: item.id } });
    } catch (e) {
      setMode("pick");
      setError(e instanceof Error ? e.message : "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const submitUrl = async () => {
    if (requireAuth()) return;
    const value = url.trim();
    if (!value) {
      setError("링크를 붙여넣어 주세요.");
      return;
    }
    setMode("working");
    setError(null);
    try {
      const item = await create.mutateAsync({
        original_type: "url",
        source_url: value,
        original_content: value,
      });
      toast.success("저장했습니다");
      setOpen(false);
      reset();
      nav({ to: "/item/$id", params: { id: item.id } });
    } catch (e) {
      setMode("url");
      setError(e instanceof Error ? e.message : "저장에 실패했습니다. 링크는 그대로 있습니다.");
    }
  };

  const submitText = async () => {
    if (requireAuth()) return;
    const value = text.trim();
    if (!value) {
      setError("내용을 입력해 주세요.");
      return;
    }
    setMode("working");
    setError(null);
    try {
      const item = await create.mutateAsync({
        original_type: "text",
        original_content: value,
      });
      toast.success("저장했습니다");
      setOpen(false);
      reset();
      nav({ to: "/item/$id", params: { id: item.id } });
    } catch (e) {
      setMode("text");
      setError(e instanceof Error ? e.message : "저장에 실패했습니다. 입력한 내용은 그대로 있습니다.");
    }
  };

  const openMode = (next: OriginalType) => {
    if (requireAuth()) return;
    if (next === "screenshot" || next === "image") {
      fileRef.current?.click();
      return;
    }
    setError(null);
    setMode(next === "url" ? "url" : "text");
    setOpen(true);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            setOpen(true);
            void submitImage(file);
          }
        }}
      />

      <section className="space-y-3">
        <p className="text-xl font-semibold tracking-tight">저장만 해두고 잊어버리셨나요?</p>
        <p className="text-sm text-muted">올리면 다음에 할 일만 남깁니다.</p>
        <div className="grid grid-cols-1 gap-2">
          <CaptureButton
            icon={<ImageIcon className="size-5" />}
            label="스크린샷 올리기"
            onClick={() => openMode("screenshot")}
          />
          <CaptureButton
            icon={<Link2 className="size-5" />}
            label="링크 붙여넣기"
            onClick={() => openMode("url")}
          />
          <CaptureButton
            icon={<Type className="size-5" />}
            label="텍스트 입력"
            onClick={() => openMode("text")}
          />
        </div>
      </section>

      <Drawer.Root
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v && mode !== "working") reset();
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-fg/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            {mode === "working" ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-border border-t-accent" />
                <Drawer.Title className="text-lg font-semibold">읽고 있습니다</Drawer.Title>
                <p className="mt-2 text-sm text-muted">저장한 내용에서 다음 행동을 찾고 있어요.</p>
              </div>
            ) : mode === "url" ? (
              <div className="space-y-4">
                <Drawer.Title className="text-lg font-semibold">링크 붙여넣기</Drawer.Title>
                <Input
                  autoFocus
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitUrl();
                  }}
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <Button className="w-full" onClick={() => void submitUrl()}>
                  저장
                </Button>
              </div>
            ) : mode === "text" ? (
              <div className="space-y-4">
                <Drawer.Title className="text-lg font-semibold">텍스트 입력</Drawer.Title>
                <Textarea
                  autoFocus
                  placeholder="기억해 둘 내용, 할 일, 예약 정보…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <Button className="w-full" onClick={() => void submitText()}>
                  저장
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Drawer.Title className="text-lg font-semibold">무엇을 넣을까요?</Drawer.Title>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <CaptureButton
                  icon={<ImageIcon className="size-5" />}
                  label="스크린샷 올리기"
                  onClick={() => fileRef.current?.click()}
                />
                <CaptureButton
                  icon={<Link2 className="size-5" />}
                  label="링크 붙여넣기"
                  onClick={() => setMode("url")}
                />
                <CaptureButton
                  icon={<Type className="size-5" />}
                  label="텍스트 입력"
                  onClick={() => setMode("text")}
                />
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

function CaptureButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-14 min-h-14 w-full items-center gap-3 rounded-lg bg-surface px-4 text-left text-base font-medium shadow-[var(--shadow-card)]",
      )}
    >
      <span className="grid size-9 place-items-center rounded-sm bg-surface-2 text-accent">{icon}</span>
      {label}
    </button>
  );
}
