import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
