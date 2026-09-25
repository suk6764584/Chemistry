import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Inset grouped list: one white surface, rows separated by inset hairlines. */
export function ListGroup({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-surface shadow-card", className)} aria-label={label}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-8 items-end gap-1.5 px-1">
      <h2 className="text-title font-semibold">{title}</h2>
      {count !== undefined ? <span className="text-title font-semibold text-subtle tabular-nums">{count}</span> : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-small text-muted">{children}</p>;
}

/** Page-level title for tab screens (iOS large-title pattern). */
export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-1 pt-2 pb-5">
      <h1 className="text-display font-bold">{title}</h1>
      {description ? <p className="mt-1 text-small text-muted">{description}</p> : null}
    </div>
  );
}
