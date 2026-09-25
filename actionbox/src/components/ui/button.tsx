import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-[background-color,transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary active:bg-primary-strong",
        secondary: "bg-surface-2 text-fg active:bg-surface-3",
        outline: "bg-surface text-fg shadow-card active:bg-surface-2",
        ghost: "bg-transparent text-muted active:bg-surface-2",
        danger: "bg-danger text-on-primary",
      },
      size: {
        sm: "h-9 rounded-full px-3.5 text-small",
        md: "h-11 rounded-md px-4 text-body",
        lg: "h-14 rounded-lg px-5 text-body",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
}
