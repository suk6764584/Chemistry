import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/app-shell";

/** Shared frame for the signed-out account screens (password reset). */
export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-10">
      <Link to="/" className="flex h-13 items-center gap-2 self-start">
        <Logo className="size-6" />
        <span className="text-body font-bold tracking-tight">ActionBox</span>
      </Link>
      <h1 className="mt-10 text-display font-bold">{title}</h1>
      {children}
    </main>
  );
}
