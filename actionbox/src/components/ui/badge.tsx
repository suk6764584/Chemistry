import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full bg-surface-2 px-2.5 text-xs font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
