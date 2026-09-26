import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Filled field — no border, the fill itself is the affordance. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-13 w-full min-w-0 rounded-md bg-surface-2 px-4 text-body text-fg placeholder:text-subtle focus:bg-surface focus:shadow-focus focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
