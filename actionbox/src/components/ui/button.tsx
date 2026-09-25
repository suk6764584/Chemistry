import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-opacity duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg",
        secondary: "bg-surface-2 text-fg",
        ghost: "bg-transparent text-fg",
        outline: "bg-surface text-fg shadow-[var(--shadow-card)]",
        danger: "bg-danger text-accent-fg",
      },
      size: {
        md: "h-11 min-h-11 rounded-md px-4 text-sm",
        sm: "h-9 min-h-9 rounded-sm px-3 text-sm",
        lg: "h-12 min-h-12 rounded-lg px-4 text-base",
        icon: "size-11 min-h-11 rounded-md",
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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
