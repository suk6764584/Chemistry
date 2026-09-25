import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-md bg-surface-2 px-4 py-3.5 text-body text-fg placeholder:text-subtle focus:bg-surface focus:shadow-focus focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
