import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-md border border-line bg-surface px-3.5 py-3 text-base leading-relaxed text-fg placeholder:text-subtle focus:border-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
