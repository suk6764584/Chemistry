import type { ReactNode } from "react";
import { Drawer } from "vaul";

/** Bottom sheet — the one overlay pattern in the app (thumb-reachable on phones). */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Runs once the close animation has finished (safe moment to reset content). */
  onClosed?: () => void;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} onAnimationEnd={(isOpen) => !isOpen && onClosed?.()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[22px] bg-surface outline-none"
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" aria-hidden />
          <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Drawer.Title className="text-lg font-bold tracking-tight">{title}</Drawer.Title>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
