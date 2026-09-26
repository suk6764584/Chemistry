import type { ReactNode } from "react";
import { Drawer } from "vaul";

/** Bottom sheet — the one overlay pattern in the app (thumb-reachable on phones). */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Runs once the close animation has finished (safe moment to reset content). */
  onClosed?: () => void;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} onAnimationEnd={(isOpen) => !isOpen && onClosed?.()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface outline-none"
        >
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-surface-3" aria-hidden />
          <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Drawer.Title className="text-title font-semibold">{title}</Drawer.Title>
            {description ? <p className="mt-1 text-small text-muted">{description}</p> : null}
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** A tappable row inside a sheet (choice lists). */
export function SheetRow({
  title,
  hint,
  onClick,
  leading,
  trailing,
  role,
  checked,
}: {
  title: string;
  hint?: string;
  onClick: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  role?: "radio";
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? Boolean(checked) : undefined}
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-2.5 text-left active:bg-surface-2"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium">{title}</span>
        {hint ? <span className="block text-small text-muted">{hint}</span> : null}
      </span>
      {trailing}
    </button>
  );
}
