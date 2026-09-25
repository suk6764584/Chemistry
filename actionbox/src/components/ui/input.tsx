import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full min-w-0 rounded-md border border-line bg-surface px-3.5 text-base text-fg placeholder:text-subtle focus:border-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
